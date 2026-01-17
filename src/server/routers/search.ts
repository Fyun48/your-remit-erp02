import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { defaultMenuItems } from '@/lib/sidebar-menu'

export interface SearchResult {
  id: string
  type: 'employee' | 'leave' | 'expense' | 'page'
  title: string
  subtitle?: string
  href: string
  icon?: string
}

export const searchRouter = router({
  // 全站搜尋
  global: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      companyId: z.string(),
      limit: z.number().optional().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { query, companyId, limit } = input
      const results: SearchResult[] = []
      const searchTerm = query.toLowerCase()

      // 1. 搜尋功能頁面
      const pageResults = defaultMenuItems
        .filter(item =>
          item.name.toLowerCase().includes(searchTerm) ||
          item.id.toLowerCase().includes(searchTerm)
        )
        .slice(0, 5)
        .map(item => ({
          id: `page-${item.id}`,
          type: 'page' as const,
          title: item.name,
          subtitle: '功能頁面',
          href: item.href,
        }))
      results.push(...pageResults)

      // 2. 搜尋員工
      const employees = await ctx.prisma.employee.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { employeeNo: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
          assignments: {
            some: { companyId },
          },
        },
        include: {
          assignments: {
            where: { companyId },
            include: { department: true },
          },
        },
        take: limit,
      })

      const employeeResults = employees.map(emp => ({
        id: `emp-${emp.id}`,
        type: 'employee' as const,
        title: emp.name,
        subtitle: emp.assignments[0]?.department?.name || emp.employeeNo,
        href: `/dashboard/hr/employees/${emp.id}`,
      }))
      results.push(...employeeResults)

      // 3. 搜尋請假單
      const leaveRequests = await ctx.prisma.leaveRequest.findMany({
        where: {
          companyId,
          OR: [
            { employee: { name: { contains: query, mode: 'insensitive' } } },
            { leaveType: { name: { contains: query, mode: 'insensitive' } } },
            { reason: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          employee: true,
          leaveType: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })

      const leaveResults = leaveRequests.map(req => ({
        id: `leave-${req.id}`,
        type: 'leave' as const,
        title: `${req.employee.name} - ${req.leaveType.name}`,
        subtitle: `${req.startDate.toLocaleDateString()} ~ ${req.endDate.toLocaleDateString()}`,
        href: `/dashboard/leave/${req.id}`,
      }))
      results.push(...leaveResults)

      // 4. 搜尋報銷單
      const expenseRequests = await ctx.prisma.expenseRequest.findMany({
        where: {
          companyId,
          OR: [
            { employee: { name: { contains: query, mode: 'insensitive' } } },
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          employee: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })

      const expenseResults = expenseRequests.map(req => ({
        id: `expense-${req.id}`,
        type: 'expense' as const,
        title: req.title,
        subtitle: `${req.employee.name} - $${req.totalAmount.toLocaleString()}`,
        href: `/dashboard/expense/${req.id}`,
      }))
      results.push(...expenseResults)

      return results.slice(0, limit * 2)
    }),

  // 取得最近搜尋（暫時返回空陣列，未來可實作）
  recent: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async () => {
      // TODO: 實作最近搜尋記錄
      return [] as SearchResult[]
    }),
})
