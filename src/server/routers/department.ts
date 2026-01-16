import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const departmentRouter = router({
  // 取得公司所有部門
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      includeInactive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.department.findMany({
        where: {
          companyId: input.companyId,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        include: {
          parent: true,
          _count: { select: { employees: true, children: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      })
    }),

  // 取得部門樹狀結構
  tree: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const departments = await ctx.prisma.department.findMany({
        where: { companyId: input.companyId, isActive: true },
        include: {
          _count: { select: { employees: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      })

      // 建立樹狀結構
      const buildTree = (parentId: string | null): typeof departments => {
        return departments
          .filter((d) => d.parentId === parentId)
          .map((d) => ({
            ...d,
            children: buildTree(d.id),
          }))
      }

      return buildTree(null)
    }),

  // 取得單一部門
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.department.findUnique({
        where: { id: input.id },
        include: {
          parent: true,
          children: true,
          employees: {
            include: {
              employee: { select: { id: true, name: true, employeeNo: true } },
              position: { select: { id: true, name: true } },
            },
            where: { status: 'ACTIVE' },
          },
        },
      })
    }),

  // 取得下一個編號
  getNextCode: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const departments = await ctx.prisma.department.findMany({
        where: { companyId: input.companyId },
        select: { code: true },
      })

      let maxNum = 0
      for (const dept of departments) {
        const match = dept.code.match(/^D(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
      return `D${String(maxNum + 1).padStart(3, '0')}`
    }),

  // 建立部門
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string().optional(),
      name: z.string(),
      parentId: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let code = input.code
      if (!code) {
        const departments = await ctx.prisma.department.findMany({
          where: { companyId: input.companyId },
          select: { code: true },
        })
        let maxNum = 0
        for (const dept of departments) {
          const match = dept.code.match(/^D(\d+)$/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (num > maxNum) maxNum = num
          }
        }
        code = `D${String(maxNum + 1).padStart(3, '0')}`
      }

      const existing = await ctx.prisma.department.findFirst({
        where: { companyId: input.companyId, code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '部門編號已存在' })
      }

      return ctx.prisma.department.create({
        data: {
          companyId: input.companyId,
          code,
          name: input.name,
          parentId: input.parentId,
          sortOrder: input.sortOrder ?? 0,
        },
      })
    }),

  // 更新部門
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      parentId: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // 防止部門設為自己的子部門
      if (data.parentId === id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '部門不能設為自己的子部門' })
      }

      return ctx.prisma.department.update({
        where: { id },
        data,
      })
    }),

  // 刪除部門（軟刪除）
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否有員工
      const employeeCount = await ctx.prisma.employeeAssignment.count({
        where: { departmentId: input.id, status: 'ACTIVE' },
      })
      if (employeeCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `此部門有 ${employeeCount} 位在職員工，無法停用`,
        })
      }

      // 檢查是否有子部門
      const childCount = await ctx.prisma.department.count({
        where: { parentId: input.id, isActive: true },
      })
      if (childCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `此部門有 ${childCount} 個子部門，請先處理子部門`,
        })
      }

      return ctx.prisma.department.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
