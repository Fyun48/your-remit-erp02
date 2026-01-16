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
          permissionType: 'GROUP_ADMIN',
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

      const companyIds = [...new Set(assignments.map(a => a.companyId))]

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
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const hasPermission = await canViewCrossCompany(input.userId)
      if (!hasPermission) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無跨公司檢視權限' })
      }
      return ctx.prisma.company.findMany({
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
})
