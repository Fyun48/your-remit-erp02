import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const employeeRouter = router({
  // 取得員工的所有任職記錄
  getAssignments: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.employeeAssignment.findMany({
        where: {
          employeeId: input.employeeId,
          status: 'ACTIVE',
        },
        include: {
          company: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true, level: true } },
          role: { select: { id: true, name: true } },
        },
        orderBy: [
          { isPrimary: 'desc' },
          { startDate: 'desc' },
        ],
      })
    }),

  // 取得員工的主要任職公司
  getPrimaryCompany: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          isPrimary: true,
          status: 'ACTIVE',
        },
        include: {
          company: true,
        },
      })

      return assignment?.company || null
    }),

  // 取得員工基本資料
  getProfile: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        select: {
          id: true,
          employeeNo: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          hireDate: true,
        },
      })
    }),
})
