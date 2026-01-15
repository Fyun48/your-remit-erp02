import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const reportRouter = router({
  // 出勤月報
  attendanceMonthly: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1)
      const endDate = new Date(input.year, input.month, 1)

      // 取得員工列表
      const employeeFilter: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }
      if (input.departmentId) {
        employeeFilter.departmentId = input.departmentId
      }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: employeeFilter,
        include: {
          employee: true,
          department: true,
        },
      })

      // 取得出勤記錄
      const records = await ctx.prisma.attendanceRecord.findMany({
        where: {
          companyId: input.companyId,
          date: { gte: startDate, lt: endDate },
          employeeId: { in: assignments.map(a => a.employeeId) },
        },
      })

      // 建立員工記錄查找 Map (O(1) lookup)
      const recordsByEmployee = new Map<string, typeof records>()
      records.forEach(r => {
        const existing = recordsByEmployee.get(r.employeeId) || []
        existing.push(r)
        recordsByEmployee.set(r.employeeId, existing)
      })

      // 統計每位員工
      const report = assignments.map(assignment => {
        const empRecords = recordsByEmployee.get(assignment.employeeId) || []

        // 單次遍歷統計所有狀態
        const statusCounts = empRecords.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          acc.overtimeMinutes += r.overtimeMinutes
          return acc
        }, { NORMAL: 0, LATE: 0, EARLY_LEAVE: 0, ABSENT: 0, LEAVE: 0, overtimeMinutes: 0 } as Record<string, number>)

        return {
          employeeId: assignment.employeeId,
          employeeName: assignment.employee.name,
          employeeNo: assignment.employee.employeeNo,
          department: assignment.department?.name || '-',
          normalDays: statusCounts.NORMAL,
          lateDays: statusCounts.LATE,
          earlyLeaveDays: statusCounts.EARLY_LEAVE,
          absentDays: statusCounts.ABSENT,
          leaveDays: statusCounts.LEAVE,
          totalOvertimeMinutes: statusCounts.overtimeMinutes,
        }
      })

      return {
        period: { year: input.year, month: input.month },
        data: report,
        summary: {
          totalEmployees: report.length,
          avgNormalDays: report.length > 0
            ? (report.reduce((sum, r) => sum + r.normalDays, 0) / report.length).toFixed(1)
            : '0',
          totalOvertimeHours: (report.reduce((sum, r) => sum + r.totalOvertimeMinutes, 0) / 60).toFixed(1),
        },
      }
    }),

  // 請假統計
  leaveStatistics: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startOfYear = new Date(input.year, 0, 1)
      const startOfNextYear = new Date(input.year + 1, 0, 1)

      // 取得請假類型
      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [{ companyId: null }, { companyId: input.companyId }],
        },
      })

      // 員工篩選
      const employeeFilter: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }
      if (input.departmentId) {
        employeeFilter.departmentId = input.departmentId
      }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: employeeFilter,
        include: { employee: true, department: true },
      })

      // 取得請假記錄
      const requests = await ctx.prisma.leaveRequest.findMany({
        where: {
          companyId: input.companyId,
          employeeId: { in: assignments.map(a => a.employeeId) },
          status: 'APPROVED',
          startDate: { gte: startOfYear, lt: startOfNextYear },
        },
        include: { leaveType: true },
      })

      // 預先分組請假記錄 (O(n) 單次遍歷)
      const requestsByType = new Map<string, { totalHours: number; count: number }>()
      const requestsByMonth = new Map<number, { totalHours: number; count: number }>()

      requests.forEach(r => {
        // 按假別分組
        const typeStats = requestsByType.get(r.leaveTypeId) || { totalHours: 0, count: 0 }
        typeStats.totalHours += r.totalHours
        typeStats.count += 1
        requestsByType.set(r.leaveTypeId, typeStats)

        // 按月份分組
        const month = new Date(r.startDate).getMonth()
        const monthStats = requestsByMonth.get(month) || { totalHours: 0, count: 0 }
        monthStats.totalHours += r.totalHours
        monthStats.count += 1
        requestsByMonth.set(month, monthStats)
      })

      // 按假別統計
      const byType = leaveTypes.map(type => {
        const stats = requestsByType.get(type.id) || { totalHours: 0, count: 0 }
        return {
          typeId: type.id,
          typeName: type.name,
          typeCode: type.code,
          totalHours: stats.totalHours,
          requestCount: stats.count,
        }
      })

      // 按月份統計
      const byMonth = Array.from({ length: 12 }, (_, i) => {
        const stats = requestsByMonth.get(i) || { totalHours: 0, count: 0 }
        return {
          month: i + 1,
          totalHours: stats.totalHours,
          requestCount: stats.count,
        }
      })

      return {
        year: input.year,
        byType,
        byMonth,
        summary: {
          totalRequests: requests.length,
          totalHours: requests.reduce((sum, r) => sum + r.totalHours, 0),
          avgPerEmployee: assignments.length > 0
            ? (requests.reduce((sum, r) => sum + r.totalHours, 0) / assignments.length).toFixed(1)
            : '0',
        },
      }
    }),

  // 費用分析
  expenseAnalysis: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string().optional(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startOfYear = new Date(input.year, 0, 1)
      const startOfNextYear = new Date(input.year + 1, 0, 1)

      // 取得費用類別
      const categories = await ctx.prisma.expenseCategory.findMany({
        where: {
          isActive: true,
          OR: [{ companyId: null }, { companyId: input.companyId }],
        },
      })

      // 員工篩選
      const employeeFilter: Record<string, unknown> = {
        companyId: input.companyId,
        status: 'ACTIVE',
      }
      if (input.departmentId) {
        employeeFilter.departmentId = input.departmentId
      }

      const assignments = await ctx.prisma.employeeAssignment.findMany({
        where: employeeFilter,
        include: { employee: true, department: true },
      })

      // 取得費用記錄
      const requests = await ctx.prisma.expenseRequest.findMany({
        where: {
          companyId: input.companyId,
          employeeId: { in: assignments.map(a => a.employeeId) },
          status: 'APPROVED',
          periodStart: { gte: startOfYear, lt: startOfNextYear },
        },
        include: {
          items: { include: { category: true } },
        },
      })

      // 預先分組費用項目和請求 (O(n) 單次遍歷)
      const itemsByCategory = new Map<string, { totalAmount: number; count: number }>()
      const requestsByMonth = new Map<number, { totalAmount: number; count: number }>()
      const requestsByEmployee = new Map<string, { totalAmount: number; count: number }>()

      requests.forEach(r => {
        // 按月份分組
        const month = new Date(r.periodStart).getMonth()
        const monthStats = requestsByMonth.get(month) || { totalAmount: 0, count: 0 }
        monthStats.totalAmount += r.totalAmount
        monthStats.count += 1
        requestsByMonth.set(month, monthStats)

        // 按員工分組
        const empStats = requestsByEmployee.get(r.employeeId) || { totalAmount: 0, count: 0 }
        empStats.totalAmount += r.totalAmount
        empStats.count += 1
        requestsByEmployee.set(r.employeeId, empStats)

        // 按類別分組項目
        r.items.forEach(item => {
          const catStats = itemsByCategory.get(item.categoryId) || { totalAmount: 0, count: 0 }
          catStats.totalAmount += item.amount
          catStats.count += 1
          itemsByCategory.set(item.categoryId, catStats)
        })
      })

      // 按類別統計
      const byCategory = categories.map(cat => {
        const stats = itemsByCategory.get(cat.id) || { totalAmount: 0, count: 0 }
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryCode: cat.code,
          totalAmount: stats.totalAmount,
          itemCount: stats.count,
        }
      })

      // 按月份統計
      const byMonth = Array.from({ length: 12 }, (_, i) => {
        const stats = requestsByMonth.get(i) || { totalAmount: 0, count: 0 }
        return {
          month: i + 1,
          totalAmount: stats.totalAmount,
          requestCount: stats.count,
        }
      })

      // 按部門統計 (使用預分組的員工資料)
      const byDepartmentMap = new Map<string, { totalAmount: number; requestCount: number }>()
      assignments.forEach(assignment => {
        const deptName = assignment.department?.name || '未分配'
        const empStats = requestsByEmployee.get(assignment.employeeId) || { totalAmount: 0, count: 0 }

        const existing = byDepartmentMap.get(deptName) || { totalAmount: 0, requestCount: 0 }
        existing.totalAmount += empStats.totalAmount
        existing.requestCount += empStats.count
        byDepartmentMap.set(deptName, existing)
      })

      const byDepartment = Array.from(byDepartmentMap.entries()).map(([departmentName, stats]) => ({
        departmentName,
        totalAmount: stats.totalAmount,
        requestCount: stats.requestCount,
      }))

      return {
        year: input.year,
        byCategory,
        byMonth,
        byDepartment,
        summary: {
          totalRequests: requests.length,
          totalAmount: requests.reduce((sum, r) => sum + r.totalAmount, 0),
          avgPerRequest: requests.length > 0
            ? (requests.reduce((sum, r) => sum + r.totalAmount, 0) / requests.length).toFixed(0)
            : '0',
        },
      }
    }),
})
