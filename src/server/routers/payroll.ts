import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { calculatePayroll, type PayrollSetting, type EmployeeSalaryData, type OvertimeData } from '@/lib/payroll-calculator'

export const payrollRouter = router({
  // ==================== 薪資設定 ====================

  // 取得公司薪資設定
  getSetting: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      let setting = await ctx.prisma.payrollSetting.findUnique({
        where: { companyId: input.companyId },
      })

      // 如果沒有設定，建立預設設定
      if (!setting) {
        setting = await ctx.prisma.payrollSetting.create({
          data: {
            companyId: input.companyId,
            // 使用 2026 年預設值
            laborInsuranceRate: 0.125,
            laborInsuranceEmpShare: 0.2,
            healthInsuranceRate: 0.0517,
            healthInsuranceEmpShare: 0.3,
            laborPensionRate: 0.06,
            overtimeRate1: 1.34,
            overtimeRate2: 1.67,
            overtimeRateHoliday: 2.0,
            minimumWage: 29500,
            withholdingThreshold: 88501,
          },
        })
      }

      return setting
    }),

  // 更新公司薪資設定
  updateSetting: publicProcedure
    .input(z.object({
      companyId: z.string(),
      laborInsuranceRate: z.number().min(0).max(1).optional(),
      laborInsuranceEmpShare: z.number().min(0).max(1).optional(),
      healthInsuranceRate: z.number().min(0).max(1).optional(),
      healthInsuranceEmpShare: z.number().min(0).max(1).optional(),
      laborPensionRate: z.number().min(0).max(1).optional(),
      overtimeRate1: z.number().min(1).optional(),
      overtimeRate2: z.number().min(1).optional(),
      overtimeRateHoliday: z.number().min(1).optional(),
      minimumWage: z.number().min(0).optional(),
      withholdingThreshold: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, ...data } = input

      return ctx.prisma.payrollSetting.upsert({
        where: { companyId },
        create: {
          companyId,
          ...data,
        },
        update: data,
      })
    }),

  // ==================== 投保級距 ====================

  // 取得投保級距表
  getInsuranceGrades: publicProcedure
    .input(z.object({
      year: z.number(),
      type: z.enum(['LABOR', 'HEALTH', 'PENSION']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.insuranceGrade.findMany({
        where: {
          year: input.year,
          ...(input.type && { type: input.type }),
        },
        orderBy: [{ type: 'asc' }, { grade: 'asc' }],
      })
    }),

  // 根據薪資查找適用的投保級距
  findInsuranceGrade: publicProcedure
    .input(z.object({
      year: z.number(),
      type: z.enum(['LABOR', 'HEALTH', 'PENSION']),
      salary: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const grades = await ctx.prisma.insuranceGrade.findMany({
        where: {
          year: input.year,
          type: input.type,
        },
        orderBy: { grade: 'asc' },
      })

      // 找出適用的級距
      for (const grade of grades) {
        const min = Number(grade.minSalary)
        const max = grade.maxSalary ? Number(grade.maxSalary) : Infinity

        if (input.salary >= min && input.salary <= max) {
          return grade
        }
      }

      // 如果超過最高級距，返回最高級距
      return grades[grades.length - 1] || null
    }),

  // 初始化投保級距（2026年資料）
  seedInsuranceGrades: publicProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已有資料
      const existing = await ctx.prisma.insuranceGrade.count({
        where: { year: input.year },
      })

      if (existing > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${input.year} 年投保級距已存在`,
        })
      }

      // 2026 年勞保級距
      const laborGrades = [
        { grade: 1, minSalary: 0, maxSalary: 29500, insuredAmount: 29500 },
        { grade: 2, minSalary: 29501, maxSalary: 31800, insuredAmount: 31800 },
        { grade: 3, minSalary: 31801, maxSalary: 33300, insuredAmount: 33300 },
        { grade: 4, minSalary: 33301, maxSalary: 34800, insuredAmount: 34800 },
        { grade: 5, minSalary: 34801, maxSalary: 36300, insuredAmount: 36300 },
        { grade: 6, minSalary: 36301, maxSalary: 38200, insuredAmount: 38200 },
        { grade: 7, minSalary: 38201, maxSalary: 40100, insuredAmount: 40100 },
        { grade: 8, minSalary: 40101, maxSalary: 42000, insuredAmount: 42000 },
        { grade: 9, minSalary: 42001, maxSalary: 43900, insuredAmount: 43900 },
        { grade: 10, minSalary: 43901, maxSalary: 45800, insuredAmount: 45800 },
        { grade: 11, minSalary: 45801, maxSalary: null, insuredAmount: 45800 }, // 最高級
      ]

      // 2026 年健保級距 (簡化版，實際有更多級距)
      const healthGrades = [
        { grade: 1, minSalary: 0, maxSalary: 29500, insuredAmount: 29500 },
        { grade: 2, minSalary: 29501, maxSalary: 31800, insuredAmount: 31800 },
        { grade: 3, minSalary: 31801, maxSalary: 33300, insuredAmount: 33300 },
        { grade: 4, minSalary: 33301, maxSalary: 34800, insuredAmount: 34800 },
        { grade: 5, minSalary: 34801, maxSalary: 36300, insuredAmount: 36300 },
        { grade: 6, minSalary: 36301, maxSalary: 38200, insuredAmount: 38200 },
        { grade: 7, minSalary: 38201, maxSalary: 40100, insuredAmount: 40100 },
        { grade: 8, minSalary: 40101, maxSalary: 42000, insuredAmount: 42000 },
        { grade: 9, minSalary: 42001, maxSalary: 43900, insuredAmount: 43900 },
        { grade: 10, minSalary: 43901, maxSalary: 45800, insuredAmount: 45800 },
        // ... 健保有更多級距直到 313,000
        { grade: 11, minSalary: 45801, maxSalary: null, insuredAmount: 313000 }, // 最高級
      ]

      // 2026 年勞退級距 (簡化版)
      const pensionGrades = [
        { grade: 1, minSalary: 0, maxSalary: 29500, insuredAmount: 29500 },
        { grade: 2, minSalary: 29501, maxSalary: 31800, insuredAmount: 31800 },
        { grade: 3, minSalary: 31801, maxSalary: 33300, insuredAmount: 33300 },
        { grade: 4, minSalary: 33301, maxSalary: 34800, insuredAmount: 34800 },
        { grade: 5, minSalary: 34801, maxSalary: 36300, insuredAmount: 36300 },
        { grade: 6, minSalary: 36301, maxSalary: 38200, insuredAmount: 38200 },
        { grade: 7, minSalary: 38201, maxSalary: 40100, insuredAmount: 40100 },
        { grade: 8, minSalary: 40101, maxSalary: 42000, insuredAmount: 42000 },
        { grade: 9, minSalary: 42001, maxSalary: 43900, insuredAmount: 43900 },
        { grade: 10, minSalary: 43901, maxSalary: 45800, insuredAmount: 45800 },
        // 勞退最高 150,000
        { grade: 11, minSalary: 45801, maxSalary: null, insuredAmount: 150000 },
      ]

      const createData: Prisma.InsuranceGradeCreateManyInput[] = [
        ...laborGrades.map(g => ({
          year: input.year,
          type: 'LABOR' as const,
          grade: g.grade,
          minSalary: g.minSalary,
          maxSalary: g.maxSalary,
          insuredAmount: g.insuredAmount,
        })),
        ...healthGrades.map(g => ({
          year: input.year,
          type: 'HEALTH' as const,
          grade: g.grade,
          minSalary: g.minSalary,
          maxSalary: g.maxSalary,
          insuredAmount: g.insuredAmount,
        })),
        ...pensionGrades.map(g => ({
          year: input.year,
          type: 'PENSION' as const,
          grade: g.grade,
          minSalary: g.minSalary,
          maxSalary: g.maxSalary,
          insuredAmount: g.insuredAmount,
        })),
      ]

      await ctx.prisma.insuranceGrade.createMany({
        data: createData,
      })

      return { success: true, count: createData.length }
    }),

  // 更新單一投保級距
  updateInsuranceGrade: publicProcedure
    .input(z.object({
      id: z.string(),
      minSalary: z.number(),
      maxSalary: z.number().nullable(),
      insuredAmount: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.insuranceGrade.update({
        where: { id: input.id },
        data: {
          minSalary: input.minSalary,
          maxSalary: input.maxSalary,
          insuredAmount: input.insuredAmount,
        },
      })
    }),

  // 批次更新投保級距
  updateInsuranceGrades: publicProcedure
    .input(z.object({
      grades: z.array(z.object({
        id: z.string(),
        minSalary: z.number(),
        maxSalary: z.number().nullable(),
        insuredAmount: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = input.grades.map(grade =>
        ctx.prisma.insuranceGrade.update({
          where: { id: grade.id },
          data: {
            minSalary: grade.minSalary,
            maxSalary: grade.maxSalary,
            insuredAmount: grade.insuredAmount,
          },
        })
      )
      await ctx.prisma.$transaction(updates)
      return { success: true, count: input.grades.length }
    }),

  // ==================== 投保級距範本 ====================

  // 取得所有範本
  listGradeTemplates: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.insuranceGradeTemplate.findMany({
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }),

  // 取得範本詳情（含項目）
  getGradeTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.insuranceGradeTemplate.findUnique({
        where: { id: input.id },
        include: {
          items: {
            orderBy: [{ type: 'asc' }, { grade: 'asc' }],
          },
        },
      })
    }),

  // 將當前年度級距另存為範本
  saveGradesAsTemplate: publicProcedure
    .input(z.object({
      year: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      userId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 取得該年度所有級距
      const grades = await ctx.prisma.insuranceGrade.findMany({
        where: { year: input.year },
        orderBy: [{ type: 'asc' }, { grade: 'asc' }],
      })

      if (grades.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${input.year} 年無投保級距資料`,
        })
      }

      // 建立範本
      const template = await ctx.prisma.insuranceGradeTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          baseYear: input.year,
          createdBy: input.userId,
          items: {
            create: grades.map(g => ({
              type: g.type,
              grade: g.grade,
              minSalary: g.minSalary,
              maxSalary: g.maxSalary,
              insuredAmount: g.insuredAmount,
            })),
          },
        },
        include: {
          _count: { select: { items: true } },
        },
      })

      return template
    }),

  // 從範本建立新年度級距
  createGradesFromTemplate: publicProcedure
    .input(z.object({
      templateId: z.string(),
      targetYear: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查目標年度是否已有資料
      const existing = await ctx.prisma.insuranceGrade.count({
        where: { year: input.targetYear },
      })

      if (existing > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${input.targetYear} 年投保級距已存在`,
        })
      }

      // 取得範本資料
      const template = await ctx.prisma.insuranceGradeTemplate.findUnique({
        where: { id: input.templateId },
        include: { items: true },
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '範本不存在',
        })
      }

      // 建立新年度級距
      const createData: Prisma.InsuranceGradeCreateManyInput[] = template.items.map(item => ({
        year: input.targetYear,
        type: item.type,
        grade: item.grade,
        minSalary: item.minSalary,
        maxSalary: item.maxSalary,
        insuredAmount: item.insuredAmount,
      }))

      await ctx.prisma.insuranceGrade.createMany({
        data: createData,
      })

      return { success: true, count: createData.length, templateName: template.name }
    }),

  // 刪除範本
  deleteGradeTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.insuranceGradeTemplate.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),

  // ==================== 員工薪資檔案 ====================

  // 取得員工薪資列表
  listEmployeeSalaries: publicProcedure
    .input(z.object({
      companyId: z.string(),
      isActive: z.boolean().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.employeeSalary.findMany({
        where: {
          companyId: input.companyId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.search && {
            employee: {
              OR: [
                { name: { contains: input.search, mode: 'insensitive' } },
                { employeeNo: { contains: input.search, mode: 'insensitive' } },
              ],
            },
          }),
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { employee: { employeeNo: 'asc' } },
      })
    }),

  // 取得員工薪資詳情
  getEmployeeSalary: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.employeeSalary.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          isActive: true,
        },
        include: {
          employee: true,
        },
      })
    }),

  // 新增/更新員工薪資檔案
  upsertEmployeeSalary: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      baseSalary: z.number(),
      allowances: z.array(z.object({
        name: z.string(),
        amount: z.number(),
      })).optional(),
      laborInsuranceGrade: z.number(),
      healthInsuranceGrade: z.number(),
      laborPensionGrade: z.number(),
      employeePensionRate: z.number().min(0).max(0.06).optional(),
      dependents: z.number().min(0).optional(),
      effectiveDate: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { employeeId, companyId, effectiveDate, ...data } = input

      // 將舊的薪資檔案設為非作用中
      await ctx.prisma.employeeSalary.updateMany({
        where: {
          employeeId,
          companyId,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: effectiveDate,
        },
      })

      // 建立新的薪資檔案
      return ctx.prisma.employeeSalary.create({
        data: {
          employeeId,
          companyId,
          effectiveDate,
          isActive: true,
          baseSalary: data.baseSalary,
          allowances: data.allowances || [],
          laborInsuranceGrade: data.laborInsuranceGrade,
          healthInsuranceGrade: data.healthInsuranceGrade,
          laborPensionGrade: data.laborPensionGrade,
          employeePensionRate: data.employeePensionRate || 0,
          dependents: data.dependents || 0,
        },
      })
    }),

  // ==================== 薪資期間 ====================

  // 取得薪資期間列表
  listPeriods: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number().optional(),
      status: z.enum(['DRAFT', 'CALCULATED', 'APPROVED', 'PAID']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payrollPeriod.findMany({
        where: {
          companyId: input.companyId,
          ...(input.year && { year: input.year }),
          ...(input.status && { status: input.status }),
        },
        include: {
          _count: { select: { slips: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      })
    }),

  // 取得薪資期間詳情
  getPeriod: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payrollPeriod.findUnique({
        where: { id: input.id },
        include: {
          slips: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeNo: true,
                  name: true,
                },
              },
            },
            orderBy: { employee: { employeeNo: 'asc' } },
          },
          company: true,
        },
      })
    }),

  // 建立薪資期間
  createPeriod: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已存在
      const existing = await ctx.prisma.payrollPeriod.findUnique({
        where: {
          companyId_year_month: {
            companyId: input.companyId,
            year: input.year,
            month: input.month,
          },
        },
      })

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${input.year} 年 ${input.month} 月薪資期間已存在`,
        })
      }

      return ctx.prisma.payrollPeriod.create({
        data: input,
      })
    }),

  // 更新薪資期間狀態
  updatePeriodStatus: publicProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['DRAFT', 'CALCULATED', 'APPROVED', 'PAID']),
      operatorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.payrollPeriod.findUnique({
        where: { id: input.id },
      })

      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到薪資期間' })
      }

      const updateData: Prisma.PayrollPeriodUpdateInput = {
        status: input.status,
      }

      if (input.status === 'CALCULATED') {
        updateData.calculatedAt = new Date()
        updateData.calculatedBy = input.operatorId
      } else if (input.status === 'APPROVED') {
        updateData.approvedAt = new Date()
        updateData.approvedBy = input.operatorId
      } else if (input.status === 'PAID') {
        updateData.paidAt = new Date()
        updateData.paidBy = input.operatorId
      }

      return ctx.prisma.payrollPeriod.update({
        where: { id: input.id },
        data: updateData,
      })
    }),

  // ==================== 薪資單 ====================

  // 取得薪資單列表
  listSlips: publicProcedure
    .input(z.object({
      periodId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payrollSlip.findMany({
        where: { periodId: input.periodId },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { employee: { employeeNo: 'asc' } },
      })
    }),

  // 取得薪資單詳情
  getSlip: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payrollSlip.findUnique({
        where: { id: input.id },
        include: {
          employee: true,
          period: {
            include: { company: true },
          },
        },
      })
    }),

  // 取得員工薪資單歷史
  getEmployeeSlipHistory: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payrollSlip.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          ...(input.year && {
            period: { year: input.year },
          }),
        },
        include: {
          period: true,
        },
        orderBy: [
          { period: { year: 'desc' } },
          { period: { month: 'desc' } },
        ],
      })
    }),

  // ==================== 薪資計算 ====================

  // 計算指定期間的薪資
  calculatePeriodPayroll: publicProcedure
    .input(z.object({
      periodId: z.string(),
      operatorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.payrollPeriod.findUnique({
        where: { id: input.periodId },
        include: { company: true },
      })

      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到薪資期間' })
      }

      if (period.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '只能計算草稿狀態的薪資期間',
        })
      }

      // 取得公司薪資設定
      const settingRecord = await ctx.prisma.payrollSetting.findUnique({
        where: { companyId: period.companyId },
      })

      if (!settingRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '請先設定公司薪資參數',
        })
      }

      const setting: PayrollSetting = {
        laborInsuranceRate: Number(settingRecord.laborInsuranceRate),
        laborInsuranceEmpShare: Number(settingRecord.laborInsuranceEmpShare),
        healthInsuranceRate: Number(settingRecord.healthInsuranceRate),
        healthInsuranceEmpShare: Number(settingRecord.healthInsuranceEmpShare),
        laborPensionRate: Number(settingRecord.laborPensionRate),
        overtimeRate1: Number(settingRecord.overtimeRate1),
        overtimeRate2: Number(settingRecord.overtimeRate2),
        overtimeRateHoliday: Number(settingRecord.overtimeRateHoliday),
        minimumWage: Number(settingRecord.minimumWage),
        withholdingThreshold: Number(settingRecord.withholdingThreshold),
      }

      // 取得所有在職員工的薪資檔案
      const employeeSalaries = await ctx.prisma.employeeSalary.findMany({
        where: {
          companyId: period.companyId,
          isActive: true,
        },
        include: {
          employee: true,
        },
      })

      if (employeeSalaries.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '沒有找到在職員工的薪資檔案',
        })
      }

      // 取得出勤加班資料（本月第一天到最後一天）
      const startDate = new Date(period.year, period.month - 1, 1)
      const endDate = new Date(period.year, period.month, 0)

      // 計算每位員工的薪資
      const slipsData: Prisma.PayrollSlipCreateManyInput[] = []

      for (const empSalary of employeeSalaries) {
        // 取得員工出勤紀錄
        const attendanceRecords = await ctx.prisma.attendanceRecord.findMany({
          where: {
            employeeId: empSalary.employeeId,
            companyId: period.companyId,
            date: { gte: startDate, lte: endDate },
          },
        })

        // 計算加班時數
        const totalOvertimeMinutes = attendanceRecords.reduce(
          (sum, r) => sum + r.overtimeMinutes,
          0
        )
        const totalOvertimeHours = totalOvertimeMinutes / 60

        // 簡化處理：假設所有加班都是平日加班前2小時
        // 實際應該根據加班日期類型分類
        const overtime: OvertimeData = {
          regularHours1: Math.min(totalOvertimeHours, 2 * attendanceRecords.length),
          regularHours2: Math.max(0, totalOvertimeHours - 2 * attendanceRecords.length),
          holidayHours: 0, // 需要另外判斷假日
        }

        const allowances = (empSalary.allowances as { name: string; amount: number }[]) || []

        const employeeData: EmployeeSalaryData = {
          baseSalary: Number(empSalary.baseSalary),
          allowances,
          laborInsuranceGrade: Number(empSalary.laborInsuranceGrade),
          healthInsuranceGrade: Number(empSalary.healthInsuranceGrade),
          laborPensionGrade: Number(empSalary.laborPensionGrade),
          employeePensionRate: Number(empSalary.employeePensionRate),
          dependents: empSalary.dependents,
        }

        const result = calculatePayroll({
          setting,
          employee: employeeData,
          overtime,
        })

        slipsData.push({
          periodId: period.id,
          employeeId: empSalary.employeeId,
          companyId: period.companyId,
          baseSalary: result.baseSalary,
          allowances: result.totalAllowances,
          overtimePay: result.overtimePay,
          bonus: result.bonus,
          otherIncome: result.otherIncome,
          grossPay: result.grossPay,
          laborInsurance: result.laborInsurance,
          healthInsurance: result.healthInsurance,
          laborPension: result.laborPension,
          incomeTax: result.incomeTax,
          otherDeduction: result.otherDeduction,
          totalDeduction: result.totalDeduction,
          netPay: result.netPay,
          overtimeDetails: result.overtimeDetails,
        })
      }

      // 刪除舊的薪資單（如果有）
      await ctx.prisma.payrollSlip.deleteMany({
        where: { periodId: period.id },
      })

      // 建立新的薪資單
      await ctx.prisma.payrollSlip.createMany({
        data: slipsData,
      })

      // 更新期間狀態
      await ctx.prisma.payrollPeriod.update({
        where: { id: period.id },
        data: {
          status: 'CALCULATED',
          calculatedAt: new Date(),
          calculatedBy: input.operatorId,
        },
      })

      return {
        success: true,
        slipCount: slipsData.length,
      }
    }),

  // ==================== 報表 ====================

  // 薪資彙總報表
  getSummaryReport: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
      month: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const periods = await ctx.prisma.payrollPeriod.findMany({
        where: {
          companyId: input.companyId,
          year: input.year,
          ...(input.month && { month: input.month }),
          status: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
        },
        include: {
          slips: true,
        },
        orderBy: { month: 'asc' },
      })

      return periods.map(period => {
        const slips = period.slips
        return {
          year: period.year,
          month: period.month,
          status: period.status,
          employeeCount: slips.length,
          totalGrossPay: slips.reduce((sum, s) => sum + Number(s.grossPay), 0),
          totalDeduction: slips.reduce((sum, s) => sum + Number(s.totalDeduction), 0),
          totalNetPay: slips.reduce((sum, s) => sum + Number(s.netPay), 0),
          totalLaborInsurance: slips.reduce((sum, s) => sum + Number(s.laborInsurance), 0),
          totalHealthInsurance: slips.reduce((sum, s) => sum + Number(s.healthInsurance), 0),
          totalLaborPension: slips.reduce((sum, s) => sum + Number(s.laborPension), 0),
          totalIncomeTax: slips.reduce((sum, s) => sum + Number(s.incomeTax), 0),
        }
      })
    }),
})
