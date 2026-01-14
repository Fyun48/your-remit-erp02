import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

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
          entitledHours = calculateAnnualLeaveDays(seniorityMonths) * 8
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

  // 調整餘額（管理員用）
  adjust: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      leaveTypeId: z.string(),
      year: z.number(),
      adjustedHours: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.leaveBalance.upsert({
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
    }),
})
