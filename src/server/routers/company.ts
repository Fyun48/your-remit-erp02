import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { canManageCompany, canViewCrossCompany, DEFAULT_DEPARTMENTS, DEFAULT_POSITIONS } from '@/lib/group-permission'
import { auditCreate, auditUpdate } from '@/lib/audit'

export const companyRouter = router({
  // 取得使用者可選擇的報銷公司
  getSelectableForExpense: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = input

      // 1. 檢查是否為集團管理員 (可選擇所有公司)
      const groupPermission = await ctx.prisma.groupPermission.findFirst({
        where: {
          employeeId: userId,
          permission: 'GROUP_ADMIN',
        },
      })

      if (groupPermission) {
        // 集團管理員：回傳所有啟用的公司
        return ctx.prisma.company.findMany({
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            group: { select: { id: true, name: true } },
          },
          orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
        })
      }

      // 2. 一般員工：回傳有任職的公司
      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          employeeId: userId,
          status: 'ACTIVE',
        },
        select: {
          companyId: true,
        },
      })

      const companyIds = Array.from(new Set(assignments.map(a => a.companyId)))

      if (companyIds.length === 0) {
        return []
      }

      return ctx.prisma.company.findMany({
        where: {
          id: { in: companyIds },
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          group: { select: { id: true, name: true } },
        },
        orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
      })
    }),

  // 列出所有公司 (需要跨公司檢視權限)
  listAll: publicProcedure
    .input(z.object({
      userId: z.string(),
      activeOnly: z.boolean().optional().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewCrossCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無跨公司檢視權限' })
      }
      return ctx.prisma.company.findMany({
        where: input.activeOnly ? { isActive: true } : undefined,
        include: {
          group: true,
          _count: {
            select: {
              departments: true,
              positions: true,
              employees: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
      })
    }),

  // 列出集團
  listGroups: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }
      return ctx.prisma.group.findMany({
        include: {
          _count: { select: { companies: true } },
        },
        orderBy: { name: 'asc' },
      })
    }),

  // 取得單一公司
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.company.findUnique({
        where: { id: input.id },
        include: {
          group: true,
          departments: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          positions: { where: { isActive: true }, orderBy: { level: 'desc' } },
          _count: {
            select: {
              employees: { where: { status: 'ACTIVE' } },
            },
          },
        },
      })
    }),

  // 取得下一個公司編號
  getNextCode: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const companies = await ctx.prisma.company.findMany({
        where: { groupId: input.groupId },
        select: { code: true },
      })

      let maxNum = 0
      for (const company of companies) {
        const match = company.code.match(/^CO(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
      return `CO${String(maxNum + 1).padStart(3, '0')}`
    }),

  // 創建公司
  create: publicProcedure
    .input(z.object({
      userId: z.string(),
      groupId: z.string(),
      code: z.string().optional(),
      name: z.string(),
      taxId: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      createDefaultDepartments: z.boolean().default(true),
      createDefaultPositions: z.boolean().default(true),
      copySettingsFromCompanyId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      // 產生編號
      let code = input.code
      if (!code) {
        const companies = await ctx.prisma.company.findMany({
          where: { groupId: input.groupId },
          select: { code: true },
        })
        let maxNum = 0
        for (const company of companies) {
          const match = company.code.match(/^CO(\d+)$/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (num > maxNum) maxNum = num
          }
        }
        code = `CO${String(maxNum + 1).padStart(3, '0')}`
      }

      // 檢查編號是否重複
      const existing = await ctx.prisma.company.findUnique({ where: { code } })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '公司編號已存在' })
      }

      // 使用交易確保一致性
      const result = await ctx.prisma.$transaction(async (tx) => {
        // 創建公司
        const company = await tx.company.create({
          data: {
            groupId: input.groupId,
            code,
            name: input.name,
            taxId: input.taxId,
            address: input.address,
            phone: input.phone,
          },
        })

        // 創建預設部門
        if (input.createDefaultDepartments) {
          await tx.department.createMany({
            data: DEFAULT_DEPARTMENTS.map(dept => ({
              companyId: company.id,
              code: dept.code,
              name: dept.name,
              sortOrder: dept.sortOrder,
            })),
          })
        }

        // 創建預設職位
        if (input.createDefaultPositions) {
          await tx.position.createMany({
            data: DEFAULT_POSITIONS.map(pos => ({
              companyId: company.id,
              code: pos.code,
              name: pos.name,
              level: pos.level,
            })),
          })
        }

        // 複製其他公司設定 (審批流程、費用類別等)
        if (input.copySettingsFromCompanyId) {
          // 複製審批流程
          const flows = await tx.approvalFlow.findMany({
            where: { companyId: input.copySettingsFromCompanyId },
            include: { steps: true },
          })

          for (const flow of flows) {
            const newFlow = await tx.approvalFlow.create({
              data: {
                companyId: company.id,
                code: flow.code,
                name: flow.name,
                description: flow.description,
                module: flow.module,
                conditions: flow.conditions,
                isActive: flow.isActive,
                isDefault: flow.isDefault,
                sortOrder: flow.sortOrder,
              },
            })

            // 複製審批步驟
            if (flow.steps.length > 0) {
              await tx.approvalStep.createMany({
                data: flow.steps.map(step => ({
                  flowId: newFlow.id,
                  stepOrder: step.stepOrder,
                  name: step.name,
                  approverType: step.approverType,
                  approverValue: step.approverValue,
                  approvalMode: step.approvalMode,
                  canSkip: step.canSkip,
                  skipCondition: step.skipCondition,
                  ccType: step.ccType,
                  ccValue: step.ccValue,
                  timeoutHours: step.timeoutHours,
                  timeoutAction: step.timeoutAction,
                })),
              })
            }
          }

          // 複製費用類別
          const categories = await tx.expenseCategory.findMany({
            where: { companyId: input.copySettingsFromCompanyId },
          })

          if (categories.length > 0) {
            await tx.expenseCategory.createMany({
              data: categories.map(cat => ({
                companyId: company.id,
                code: cat.code,
                name: cat.name,
                description: cat.description,
                requiresReceipt: cat.requiresReceipt,
                maxAmountPerItem: cat.maxAmountPerItem,
                maxAmountPerMonth: cat.maxAmountPerMonth,
                requiresPreApproval: cat.requiresPreApproval,
                isActive: cat.isActive,
                sortOrder: cat.sortOrder,
              })),
            })
          }
        }

        return company
      })

      // 記錄稽核日誌
      await auditCreate('Company', result.id, result, input.userId)

      return result
    }),

  // 更新公司
  update: publicProcedure
    .input(z.object({
      userId: z.string(),
      id: z.string(),
      name: z.string().optional(),
      taxId: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      const { userId, id, ...data } = input

      // 取得原始資料
      const oldData = await ctx.prisma.company.findUnique({ where: { id } })
      if (!oldData) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '公司不存在' })
      }

      const result = await ctx.prisma.company.update({
        where: { id },
        data,
      })

      // 記錄稽核日誌
      await auditUpdate('Company', id, oldData, result, userId)

      return result
    }),

  // 停用公司
  deactivate: publicProcedure
    .input(z.object({
      userId: z.string(),
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      // 檢查是否有在職員工
      const activeEmployees = await ctx.prisma.employeeAssignment.count({
        where: { companyId: input.id, status: 'ACTIVE' },
      })

      if (activeEmployees > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `此公司仍有 ${activeEmployees} 位在職員工，無法停用`,
        })
      }

      const oldData = await ctx.prisma.company.findUnique({ where: { id: input.id } })
      const result = await ctx.prisma.company.update({
        where: { id: input.id },
        data: { isActive: false },
      })

      await auditUpdate('Company', input.id, oldData, result, input.userId)

      return result
    }),

  // 重新啟用公司
  reactivate: publicProcedure
    .input(z.object({
      userId: z.string(),
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      const company = await ctx.prisma.company.findUnique({ where: { id: input.id } })
      if (!company) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '公司不存在' })
      }

      if (company.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '公司已是啟用狀態' })
      }

      const result = await ctx.prisma.company.update({
        where: { id: input.id },
        data: { isActive: true },
      })

      await auditUpdate('Company', input.id, company, result, input.userId)

      return result
    }),

  // 創建集團
  createGroup: publicProcedure
    .input(z.object({
      userId: z.string(),
      code: z.string(),
      name: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      const existing = await ctx.prisma.group.findUnique({ where: { code: input.code } })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '集團編號已存在' })
      }

      const result = await ctx.prisma.group.create({
        data: {
          code: input.code,
          name: input.name,
        },
      })

      await auditCreate('Group', result.id, result, input.userId)

      return result
    }),

  // 更新集團
  updateGroup: publicProcedure
    .input(z.object({
      userId: z.string(),
      id: z.string(),
      name: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      const { userId, id, ...data } = input
      const oldData = await ctx.prisma.group.findUnique({ where: { id } })

      const result = await ctx.prisma.group.update({
        where: { id },
        data,
      })

      await auditUpdate('Group', id, oldData, result, userId)

      return result
    }),

  // 更新公司特休制度設定
  updateAnnualLeaveSettings: publicProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.string(),
      annualLeaveMethod: z.enum(['ANNIVERSARY', 'CALENDAR']),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      const oldData = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
      })
      if (!oldData) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '公司不存在' })
      }

      const result = await ctx.prisma.company.update({
        where: { id: input.companyId },
        data: { annualLeaveMethod: input.annualLeaveMethod },
      })

      await auditUpdate('Company', input.companyId, oldData, result, input.userId)

      return result
    }),

  // 取得公司特休制度設定
  getAnnualLeaveSettings: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
        select: {
          id: true,
          name: true,
          annualLeaveMethod: true,
        },
      })
      if (!company) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '公司不存在' })
      }
      return company
    }),

  // 取得可轉移的目標公司列表（排除被刪除的公司，只取啟用的）
  getTransferTargets: publicProcedure
    .input(z.object({
      userId: z.string(),
      excludeCompanyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      return ctx.prisma.company.findMany({
        where: {
          isActive: true,
          id: { not: input.excludeCompanyId },
        },
        select: {
          id: true,
          code: true,
          name: true,
          departments: {
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { sortOrder: 'asc' },
          },
          positions: {
            where: { isActive: true },
            select: { id: true, code: true, name: true, level: true },
            orderBy: { level: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      })
    }),

  // 刪除公司（停用公司並處理員工）
  delete: publicProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.string(),
      mode: z.enum(['TRANSFER', 'DEACTIVATE']),
      targetCompanyId: z.string().optional(),
      targetDepartmentId: z.string().optional(),
      targetPositionId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hasPermission = await canManageCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無公司管理權限' })
      }

      // 取得要刪除的公司資料
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
        include: {
          _count: { select: { employees: { where: { status: 'ACTIVE' } } } },
        },
      })

      if (!company) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '公司不存在' })
      }

      if (!company.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '公司已停用' })
      }

      // 取得該公司所有在職的員工任職
      const activeAssignments = await ctx.prisma.employeeAssignment.findMany({
        where: { companyId: input.companyId, status: 'ACTIVE' },
        include: {
          employee: true,
          department: true,
          position: true,
        },
      })

      // 如果有員工且為轉移模式，驗證目標資料
      if (activeAssignments.length > 0 && input.mode === 'TRANSFER') {
        if (!input.targetCompanyId || !input.targetDepartmentId || !input.targetPositionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '轉移模式需要指定目標公司、部門和職位',
          })
        }

        // 驗證目標公司存在且啟用
        const targetCompany = await ctx.prisma.company.findUnique({
          where: { id: input.targetCompanyId },
        })
        if (!targetCompany || !targetCompany.isActive) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '目標公司不存在或已停用' })
        }

        // 驗證目標部門存在且啟用
        const targetDepartment = await ctx.prisma.department.findUnique({
          where: { id: input.targetDepartmentId },
        })
        if (!targetDepartment || !targetDepartment.isActive || targetDepartment.companyId !== input.targetCompanyId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '目標部門不存在或已停用' })
        }

        // 驗證目標職位存在且啟用
        const targetPosition = await ctx.prisma.position.findUnique({
          where: { id: input.targetPositionId },
        })
        if (!targetPosition || !targetPosition.isActive || targetPosition.companyId !== input.targetCompanyId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '目標職位不存在或已停用' })
        }
      }

      const now = new Date()

      // 使用交易確保資料一致性
      const result = await ctx.prisma.$transaction(async (tx) => {
        // 處理每個在職的員工任職
        for (const assignment of activeAssignments) {
          // 結束原公司的任職
          await tx.employeeAssignment.update({
            where: { id: assignment.id },
            data: {
              status: 'RESIGNED',
              endDate: now,
            },
          })

          if (input.mode === 'TRANSFER') {
            // 轉移模式：檢查員工在目標公司是否已有任職
            const existingAssignment = await tx.employeeAssignment.findUnique({
              where: {
                employeeId_companyId: {
                  employeeId: assignment.employeeId,
                  companyId: input.targetCompanyId!,
                },
              },
            })

            if (!existingAssignment) {
              // 建立新的任職紀錄
              await tx.employeeAssignment.create({
                data: {
                  employeeId: assignment.employeeId,
                  companyId: input.targetCompanyId!,
                  departmentId: input.targetDepartmentId!,
                  positionId: input.targetPositionId!,
                  isPrimary: assignment.isPrimary,
                  startDate: now,
                  status: 'ACTIVE',
                },
              })
            }

            // 記錄員工異動（轉調）
            await tx.employeeChangeLog.create({
              data: {
                employeeId: assignment.employeeId,
                changeType: 'TRANSFER',
                changeDate: now,
                fromCompanyId: input.companyId,
                fromDepartmentId: assignment.departmentId,
                fromPositionId: assignment.positionId,
                toCompanyId: input.targetCompanyId!,
                toDepartmentId: input.targetDepartmentId!,
                toPositionId: input.targetPositionId!,
                reason: '公司刪除 - 員工轉移',
                createdById: input.userId,
              },
            })
          } else {
            // 停用模式：檢查員工是否有其他 ACTIVE 任職
            const otherActiveAssignments = await tx.employeeAssignment.count({
              where: {
                employeeId: assignment.employeeId,
                status: 'ACTIVE',
                id: { not: assignment.id },
              },
            })

            if (otherActiveAssignments === 0) {
              // 沒有其他任職，停用員工帳號
              await tx.employee.update({
                where: { id: assignment.employeeId },
                data: {
                  isActive: false,
                  resignDate: now,
                },
              })
            }

            // 記錄員工異動（離職）
            await tx.employeeChangeLog.create({
              data: {
                employeeId: assignment.employeeId,
                changeType: 'OFFBOARD',
                changeDate: now,
                fromCompanyId: input.companyId,
                fromDepartmentId: assignment.departmentId,
                fromPositionId: assignment.positionId,
                reason: '公司刪除 - 員工停用',
                createdById: input.userId,
              },
            })
          }
        }

        // 停用公司
        const updatedCompany = await tx.company.update({
          where: { id: input.companyId },
          data: { isActive: false },
        })

        return updatedCompany
      })

      // 記錄稽核日誌
      await auditUpdate('Company', input.companyId, company, result, input.userId)

      return {
        success: true,
        company: result,
        processedEmployees: activeAssignments.length,
        mode: input.mode,
      }
    }),
})
