import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { isGroupAdmin } from '@/lib/group-permission'
import { isCompanyManager } from '@/lib/permission'

// 特休年資計算（台灣勞基法）
function calculateAnnualLeaveDays(seniorityMonths: number): number {
  if (seniorityMonths < 6) return 0
  if (seniorityMonths < 12) return 3
  if (seniorityMonths < 24) return 7
  if (seniorityMonths < 36) return 10
  if (seniorityMonths < 60) return 14
  if (seniorityMonths < 120) return 15
  // 滿10年後每年加1天，最多30天
  const extraYears = Math.floor((seniorityMonths - 120) / 12)
  return Math.min(15 + extraYears, 30)
}

// 曆年制特休計算
function calculateCalendarYearAnnualLeave(
  hireDate: Date,
  year: number,
  seniorityMonths: number
): number {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  // 如果員工在該年度前已到職
  if (hireDate <= yearStart) {
    // 整年都在職，直接計算
    return calculateAnnualLeaveDays(seniorityMonths)
  }

  // 如果員工在該年度中間到職
  if (hireDate > yearStart && hireDate <= yearEnd) {
    // 計算該年度的在職月數比例
    const monthsInYear = 12 - hireDate.getMonth()
    const fullYearDays = calculateAnnualLeaveDays(seniorityMonths)
    // 按比例計算，四捨五入到小數點第一位
    return Math.round(fullYearDays * (monthsInYear / 12) * 10) / 10
  }

  // 員工尚未到職
  return 0
}

export const leaveBalanceRouter = router({
  // 取得員工所有假別餘額
  list: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()

      // 取得公司的特休計算制度設定
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { annualLeaveMethod: true },
      })

      const annualLeaveMethod = company?.annualLeaveMethod || 'ANNIVERSARY'

      // 取得所有可用假別
      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        orderBy: { sortOrder: 'asc' },
      })

      // 取得現有餘額
      const balances = await ctx.prisma.leaveBalance.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          year,
        },
      })

      // 取得員工到職日以計算年資
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        select: { hireDate: true },
      })

      const hireDate = employee?.hireDate || new Date()
      const now = new Date()
      const seniorityMonths = Math.floor(
        (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      )

      // 合併資料
      return leaveTypes.map(lt => {
        const balance = balances.find(b => b.leaveTypeId === lt.id)

        // 計算應有額度
        let entitledHours = lt.annualQuotaDays * 8
        if (lt.quotaType === 'SENIORITY' && lt.code === 'ANNUAL') {
          if (annualLeaveMethod === 'CALENDAR') {
            // 曆年制計算
            entitledHours = calculateCalendarYearAnnualLeave(hireDate, year, seniorityMonths) * 8
          } else {
            // 週年制計算
            entitledHours = calculateAnnualLeaveDays(seniorityMonths) * 8
          }
        } else if (lt.quotaType === 'UNLIMITED') {
          entitledHours = -1 // -1 表示無限
        }

        const usedHours = balance?.usedHours || 0
        const pendingHours = balance?.pendingHours || 0
        const carriedHours = balance?.carriedHours || 0
        const adjustedHours = balance?.adjustedHours || 0

        const totalAvailable = entitledHours === -1
          ? -1
          : entitledHours + carriedHours + adjustedHours
        const remainingHours = entitledHours === -1
          ? -1
          : totalAvailable - usedHours - pendingHours

        return {
          leaveType: lt,
          year,
          entitledHours,
          carriedHours,
          adjustedHours,
          totalAvailable,
          usedHours,
          pendingHours,
          remainingHours,
        }
      })
    }),

  // 列出公司所有員工的假別餘額（管理員用）
  listByCompany: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number().optional(),
      leaveTypeId: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()

      // 取得公司的員工
      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          companyId: input.companyId,
          status: 'ACTIVE',
          employee: input.search ? {
            OR: [
              { name: { contains: input.search } },
              { employeeNo: { contains: input.search } },
            ],
          } : undefined,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              hireDate: true,
            },
          },
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      })

      // 取得公司的特休計算制度設定
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { annualLeaveMethod: true },
      })
      const annualLeaveMethod = company?.annualLeaveMethod || 'ANNIVERSARY'

      // 取得假別（如果指定了特定假別）
      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          ...(input.leaveTypeId ? { id: input.leaveTypeId } : {}),
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        orderBy: { sortOrder: 'asc' },
      })

      // 取得所有餘額
      const balances = await ctx.prisma.leaveBalance.findMany({
        where: {
          companyId: input.companyId,
          year,
          ...(input.leaveTypeId ? { leaveTypeId: input.leaveTypeId } : {}),
        },
      })

      const now = new Date()

      return assignments.map(assignment => {
        const employee = assignment.employee
        const hireDate = employee.hireDate
        const seniorityMonths = Math.floor(
          (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        )

        const employeeBalances = leaveTypes.map(lt => {
          const balance = balances.find(
            b => b.employeeId === employee.id && b.leaveTypeId === lt.id
          )

          // 計算應有額度
          let entitledHours = lt.annualQuotaDays * 8
          if (lt.quotaType === 'SENIORITY' && lt.code === 'ANNUAL') {
            if (annualLeaveMethod === 'CALENDAR') {
              entitledHours = calculateCalendarYearAnnualLeave(hireDate, year, seniorityMonths) * 8
            } else {
              entitledHours = calculateAnnualLeaveDays(seniorityMonths) * 8
            }
          } else if (lt.quotaType === 'UNLIMITED') {
            entitledHours = -1
          }

          const usedHours = balance?.usedHours || 0
          const pendingHours = balance?.pendingHours || 0
          const carriedHours = balance?.carriedHours || 0
          const adjustedHours = balance?.adjustedHours || 0

          const totalAvailable = entitledHours === -1 ? -1 : entitledHours + carriedHours + adjustedHours
          const remainingHours = entitledHours === -1 ? -1 : totalAvailable - usedHours - pendingHours

          return {
            leaveType: lt,
            entitledHours,
            carriedHours,
            adjustedHours,
            totalAvailable,
            usedHours,
            pendingHours,
            remainingHours,
          }
        })

        return {
          employee: {
            id: employee.id,
            employeeNo: employee.employeeNo,
            name: employee.name,
            hireDate: employee.hireDate,
          },
          department: assignment.department.name,
          position: assignment.position.name,
          balances: employeeBalances,
        }
      })
    }),

  // 調整餘額（管理員用）- 含權限檢查和稽核記錄
  adjust: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      leaveTypeId: z.string(),
      year: z.number(),
      adjustedHours: z.number(),
      reason: z.string().min(1, '請輸入調整原因'),
      adjustedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查權限：集團管理員、公司管理者、或有特殊權限者
      const groupAdmin = await isGroupAdmin(input.adjustedById)
      const companyManager = await isCompanyManager(input.adjustedById, input.companyId)

      // 檢查是否有 leave.balance_adjust 特殊權限
      let hasSpecialPermission = false
      const permission = await ctx.prisma.permission.findUnique({
        where: { code: 'leave.balance_adjust' },
      })
      if (permission) {
        const employeePermission = await ctx.prisma.employeePermission.findUnique({
          where: {
            employeeId_companyId_permissionId: {
              employeeId: input.adjustedById,
              companyId: input.companyId,
              permissionId: permission.id,
            },
          },
        })
        if (employeePermission?.grantType === 'GRANT') {
          if (!employeePermission.expiresAt || employeePermission.expiresAt > new Date()) {
            hasSpecialPermission = true
          }
        }
      }

      if (!groupAdmin && !companyManager && !hasSpecialPermission) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您沒有權限調整假別餘額',
        })
      }

      // 取得現有餘額
      const existingBalance = await ctx.prisma.leaveBalance.findUnique({
        where: {
          employeeId_companyId_leaveTypeId_year: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            leaveTypeId: input.leaveTypeId,
            year: input.year,
          },
        },
      })

      const previousHours = existingBalance?.adjustedHours || 0
      const changeHours = input.adjustedHours - previousHours

      // 更新或建立餘額
      const balance = await ctx.prisma.leaveBalance.upsert({
        where: {
          employeeId_companyId_leaveTypeId_year: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            leaveTypeId: input.leaveTypeId,
            year: input.year,
          },
        },
        update: { adjustedHours: input.adjustedHours },
        create: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          leaveTypeId: input.leaveTypeId,
          year: input.year,
          adjustedHours: input.adjustedHours,
        },
      })

      // 建立調整記錄（稽核用）
      await ctx.prisma.leaveBalanceAdjustment.create({
        data: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          leaveTypeId: input.leaveTypeId,
          year: input.year,
          previousHours,
          newHours: input.adjustedHours,
          changeHours,
          reason: input.reason,
          adjustedById: input.adjustedById,
        },
      })

      return balance
    }),

  // 查詢調整記錄
  listAdjustments: publicProcedure
    .input(z.object({
      employeeId: z.string().optional(),
      companyId: z.string(),
      leaveTypeId: z.string().optional(),
      year: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveBalanceAdjustment.findMany({
        where: {
          companyId: input.companyId,
          ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          ...(input.leaveTypeId ? { leaveTypeId: input.leaveTypeId } : {}),
          ...(input.year ? { year: input.year } : {}),
        },
        include: {
          employee: {
            select: { id: true, name: true, employeeNo: true },
          },
          adjustedBy: {
            select: { id: true, name: true, employeeNo: true },
          },
          leaveType: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { adjustedAt: 'desc' },
        take: input.limit,
      })
    }),
})
