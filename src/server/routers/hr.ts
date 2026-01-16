import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'

export const hrRouter = router({
  // 取得員工列表（人事視角）
  listEmployees: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED']).optional(),
      search: z.string().optional(),
      excludeEmployeeId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      }
      if (input.departmentId) where.departmentId = input.departmentId
      if (input.status) where.status = input.status
      if (input.excludeEmployeeId) where.employeeId = { not: input.excludeEmployeeId }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where,
        include: {
          employee: true,
          department: true,
          position: true,
          supervisor: {
            include: {
              employee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
        },
        orderBy: { employee: { employeeNo: 'asc' } },
      })

      // 搜尋過濾
      if (input.search) {
        const search = input.search.toLowerCase()
        return assignments.filter((a) =>
          a.employee.name.toLowerCase().includes(search) ||
          a.employee.employeeNo.toLowerCase().includes(search) ||
          a.employee.email.toLowerCase().includes(search)
        )
      }

      return assignments
    }),

  // 取得員工詳細資料
  getEmployee: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        include: {
          assignments: {
            include: {
              company: true,
              department: true,
              position: true,
              role: true,
              supervisor: {
                include: {
                  employee: { select: { name: true } },
                },
              },
            },
            orderBy: { startDate: 'desc' },
          },
        },
      })
    }),

  // 到職作業（建立新員工）
  onboard: publicProcedure
    .input(z.object({
      // 員工基本資料
      employeeNo: z.string(),
      name: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
      // 個人資料
      idNumber: z.string().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      birthDate: z.date().optional(),
      phone: z.string().optional(),
      personalEmail: z.string().email().optional(),
      residentialAddress: z.string().optional(),
      householdAddress: z.string().optional(),
      emergencyContact: z.string().optional(),
      emergencyPhone: z.string().optional(),
      // 任職資料
      companyId: z.string(),
      departmentId: z.string(),
      positionId: z.string(),
      supervisorId: z.string().optional(),
      hireDate: z.date(),
      roleId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查員工編號是否重複
      const existingNo = await ctx.prisma.employee.findUnique({
        where: { employeeNo: input.employeeNo },
      })
      if (existingNo) {
        throw new TRPCError({ code: 'CONFLICT', message: '員工編號已存在' })
      }

      // 檢查 Email 是否重複
      const existingEmail = await ctx.prisma.employee.findUnique({
        where: { email: input.email },
      })
      if (existingEmail) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email 已被使用' })
      }

      // 密碼規則驗證
      const passwordErrors: string[] = []
      if (input.password.length < 8) {
        passwordErrors.push('密碼長度至少 8 個字元')
      }
      if (!/[A-Z]/.test(input.password)) {
        passwordErrors.push('密碼須包含大寫字母')
      }
      if (!/[a-z]/.test(input.password)) {
        passwordErrors.push('密碼須包含小寫字母')
      }
      if (!/[0-9]/.test(input.password)) {
        passwordErrors.push('密碼須包含數字')
      }
      if (passwordErrors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordErrors.join('、'),
        })
      }

      // 加密密碼
      const passwordHash = await bcrypt.hash(input.password, 10)

      // 建立員工與任職記錄
      return ctx.prisma.employee.create({
        data: {
          employeeNo: input.employeeNo,
          name: input.name,
          email: input.email,
          passwordHash,
          idNumber: input.idNumber,
          gender: input.gender,
          birthDate: input.birthDate,
          phone: input.phone,
          personalEmail: input.personalEmail,
          residentialAddress: input.residentialAddress,
          householdAddress: input.householdAddress,
          emergencyContact: input.emergencyContact,
          emergencyPhone: input.emergencyPhone,
          hireDate: input.hireDate,
          assignments: {
            create: {
              companyId: input.companyId,
              departmentId: input.departmentId,
              positionId: input.positionId,
              supervisorId: input.supervisorId,
              roleId: input.roleId,
              isPrimary: true,
              startDate: input.hireDate,
              status: 'ACTIVE',
            },
          },
        },
        include: {
          assignments: {
            include: {
              company: true,
              department: true,
              position: true,
            },
          },
        },
      })
    }),

  // 更新員工個人資料
  updateEmployee: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      name: z.string().optional(),
      idNumber: z.string().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
      birthDate: z.date().nullable().optional(),
      phone: z.string().optional(),
      personalEmail: z.string().email().optional(),
      residentialAddress: z.string().optional(),
      householdAddress: z.string().optional(),
      emergencyContact: z.string().optional(),
      emergencyPhone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { employeeId, ...data } = input
      return ctx.prisma.employee.update({
        where: { id: employeeId },
        data,
      })
    }),

  // 離職作業
  offboard: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      resignDate: z.date(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 更新員工離職日期與停用帳號
      await ctx.prisma.employee.update({
        where: { id: input.employeeId },
        data: {
          resignDate: input.resignDate,
          isActive: false,
        },
      })

      // 更新所有任職記錄為離職狀態
      await ctx.prisma.employeeAssignment.updateMany({
        where: { employeeId: input.employeeId, status: 'ACTIVE' },
        data: {
          status: 'RESIGNED',
          endDate: input.resignDate,
        },
      })

      return { success: true }
    }),

  // 調動作業
  transfer: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      departmentId: z.string(),
      positionId: z.string(),
      supervisorId: z.string().optional(),
      effectiveDate: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 結束現有任職記錄
      const currentAssignment = await ctx.prisma.employeeAssignment.findFirst({
        where: { employeeId: input.employeeId, status: 'ACTIVE', isPrimary: true },
      })

      if (currentAssignment) {
        await ctx.prisma.employeeAssignment.update({
          where: { id: currentAssignment.id },
          data: {
            endDate: input.effectiveDate,
            isPrimary: false,
          },
        })
      }

      // 建立新任職記錄
      return ctx.prisma.employeeAssignment.create({
        data: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          departmentId: input.departmentId,
          positionId: input.positionId,
          supervisorId: input.supervisorId,
          startDate: input.effectiveDate,
          isPrimary: true,
          status: 'ACTIVE',
        },
        include: {
          company: true,
          department: true,
          position: true,
        },
      })
    }),

  // 新增兼任職位（多公司任職）
  addSecondaryAssignment: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      departmentId: z.string(),
      positionId: z.string(),
      supervisorId: z.string().optional(),
      startDate: z.date(),
      roleId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已有同公司的 active assignment
      const existingInCompany = await ctx.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'ACTIVE',
        },
      })

      if (existingInCompany) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '該員工在此公司已有有效任職記錄，請使用調動功能',
        })
      }

      // 建立新的兼任記錄
      return ctx.prisma.employeeAssignment.create({
        data: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          departmentId: input.departmentId,
          positionId: input.positionId,
          supervisorId: input.supervisorId,
          roleId: input.roleId,
          startDate: input.startDate,
          isPrimary: false,
          status: 'ACTIVE',
        },
        include: {
          company: true,
          department: true,
          position: true,
        },
      })
    }),

  // 結束兼任職位
  endSecondaryAssignment: publicProcedure
    .input(z.object({
      assignmentId: z.string(),
      endDate: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.employeeAssignment.findUnique({
        where: { id: input.assignmentId },
      })

      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '任職記錄不存在' })
      }

      if (assignment.isPrimary) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '主要任職不可透過此功能結束，請使用離職或調動功能',
        })
      }

      return ctx.prisma.employeeAssignment.update({
        where: { id: input.assignmentId },
        data: {
          status: 'RESIGNED',
          endDate: input.endDate,
        },
      })
    }),

  // 取得可選的公司列表（用於新增兼任）
  getAvailableCompanies: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得員工目前已有任職的公司 ID
      const existingAssignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          employeeId: input.employeeId,
          status: 'ACTIVE',
        },
        select: { companyId: true },
      })

      const existingCompanyIds = existingAssignments.map((a) => a.companyId)

      // 取得所有啟用的公司，排除已有任職的
      return ctx.prisma.company.findMany({
        where: {
          isActive: true,
          id: { notIn: existingCompanyIds },
        },
        include: {
          departments: { where: { isActive: true } },
          positions: { where: { isActive: true } },
        },
        orderBy: { name: 'asc' },
      })
    }),

  // 取得指定公司的部門、職位、主管資料（用於集團管理員新增員工）
  getCompanyData: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [departments, positions, supervisors] = await Promise.all([
        ctx.prisma.department.findMany({
          where: { companyId: input.companyId, isActive: true },
          orderBy: { code: 'asc' },
        }),
        ctx.prisma.position.findMany({
          where: { companyId: input.companyId, isActive: true },
          orderBy: { level: 'desc' },
        }),
        ctx.prisma.employeeAssignment.findMany({
          where: { companyId: input.companyId, status: 'ACTIVE' },
          include: {
            employee: { select: { id: true, name: true, employeeNo: true } },
            position: { select: { name: true, level: true } },
          },
          orderBy: { position: { level: 'desc' } },
        }),
      ])

      return { departments, positions, supervisors }
    }),

  // 人事統計
  statistics: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [totalActive, totalOnLeave, totalResigned, byDepartment] = await Promise.all([
        ctx.prisma.employeeAssignment.count({
          where: { companyId: input.companyId, status: 'ACTIVE' },
        }),
        ctx.prisma.employeeAssignment.count({
          where: { companyId: input.companyId, status: 'ON_LEAVE' },
        }),
        ctx.prisma.employeeAssignment.count({
          where: { companyId: input.companyId, status: 'RESIGNED' },
        }),
        ctx.prisma.employeeAssignment.groupBy({
          by: ['departmentId'],
          where: { companyId: input.companyId, status: 'ACTIVE' },
          _count: true,
        }),
      ])

      return {
        totalActive,
        totalOnLeave,
        totalResigned,
        byDepartment,
      }
    }),
})
