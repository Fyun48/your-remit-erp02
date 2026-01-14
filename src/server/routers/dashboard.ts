import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const dashboardRouter = router({
  // 取得員工個人儀表板統計
  getMyStats: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      const startOfMonth = new Date(year, month, 1)
      const startOfNextMonth = new Date(year, month + 1, 1)
      const startOfYear = new Date(year, 0, 1)
      const startOfNextYear = new Date(year + 1, 0, 1)

      // 本月出勤天數
      const attendanceCount = await ctx.prisma.attendanceRecord.count({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          date: { gte: startOfMonth, lt: startOfNextMonth },
          status: { in: ['NORMAL', 'LATE', 'EARLY_LEAVE'] },
        },
      })

      // 待審核申請數（請假 + 費用）
      const pendingLeave = await ctx.prisma.leaveRequest.count({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'PENDING',
        },
      })

      const pendingExpense = await ctx.prisma.expenseRequest.count({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'PENDING',
        },
      })

      // 剩餘特休時數
      const annualLeaveType = await ctx.prisma.leaveType.findFirst({
        where: { code: 'ANNUAL' },
      })

      let remainingAnnualHours = 0
      if (annualLeaveType) {
        const balance = await ctx.prisma.leaveBalance.findFirst({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            leaveTypeId: annualLeaveType.id,
            year,
          },
        })
        if (balance) {
          remainingAnnualHours =
            balance.entitledHours + balance.carriedHours + balance.adjustedHours
            - balance.usedHours - balance.pendingHours
        }
      }

      // 本年度費用報銷總額
      const expenseTotal = await ctx.prisma.expenseRequest.aggregate({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'APPROVED',
          periodStart: { gte: startOfYear, lt: startOfNextYear },
        },
        _sum: { totalAmount: true },
      })

      return {
        attendanceDays: attendanceCount,
        pendingApprovals: pendingLeave + pendingExpense,
        remainingAnnualDays: Math.floor(remainingAnnualHours / 8),
        yearlyExpenseTotal: expenseTotal._sum.totalAmount || 0,
      }
    }),

  // 取得主管儀表板統計（待審核數量）
  getApproverStats: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得下屬
      const subordinates = await ctx.prisma.employeeAssignment.findMany({
        where: { supervisorId: input.approverId, status: 'ACTIVE' },
        select: { employeeId: true, companyId: true },
      })

      if (subordinates.length === 0) {
        return { pendingLeave: 0, pendingExpense: 0, subordinateCount: 0 }
      }

      const pendingLeave = await ctx.prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
      })

      const pendingExpense = await ctx.prisma.expenseRequest.count({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
      })

      return {
        pendingLeave,
        pendingExpense,
        subordinateCount: subordinates.length,
      }
    }),

  // 取得近期活動
  getRecentActivity: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      limit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      const [recentLeave, recentExpense, recentAttendance] = await Promise.all([
        ctx.prisma.leaveRequest.findMany({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          include: { leaveType: true },
        }),
        ctx.prisma.expenseRequest.findMany({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
        }),
        ctx.prisma.attendanceRecord.findMany({
          where: {
            employeeId: input.employeeId,
            companyId: input.companyId,
          },
          orderBy: { date: 'desc' },
          take: input.limit,
        }),
      ])

      // 合併並排序
      const activities = [
        ...recentLeave.map(l => ({
          type: 'leave' as const,
          title: `${l.leaveType.name} 申請`,
          status: l.status,
          date: l.createdAt,
          id: l.id,
        })),
        ...recentExpense.map(e => ({
          type: 'expense' as const,
          title: e.title,
          status: e.status,
          date: e.createdAt,
          id: e.id,
        })),
        ...recentAttendance.map(a => ({
          type: 'attendance' as const,
          title: `出勤打卡`,
          status: a.status,
          date: a.date,
          id: a.id,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, input.limit)

      return activities
    }),
})
