import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const workShiftRouter = router({
  // 取得公司所有班別
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workShift.findMany({
        where: { companyId: input.companyId, isActive: true },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { name: 'asc' },
      })
    }),

  // 取得單一班別
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workShift.findUnique({
        where: { id: input.id },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
      })
    }),

  // 建立班別
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      name: z.string().min(1),
      code: z.string().min(1),
      shiftType: z.enum(['FIXED', 'FLEXIBLE']).default('FIXED'),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/),
      workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
      coreStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      coreEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      flexStartRange: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      flexEndRange: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      requiredHours: z.number().optional(),
      lateGraceMinutes: z.number().default(0),
      earlyLeaveGraceMinutes: z.number().default(0),
      overtimeThreshold: z.number().default(30),
      workDays: z.string().default('1,2,3,4,5'),
      breaks: z.array(z.object({
        name: z.string(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        isPaid: z.boolean().default(false),
        isRequired: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { breaks, ...shiftData } = input
      return ctx.prisma.workShift.create({
        data: {
          ...shiftData,
          breaks: breaks ? { create: breaks } : undefined,
        },
        include: { breaks: true },
      })
    }),

  // 更新班別
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      workEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      lateGraceMinutes: z.number().optional(),
      earlyLeaveGraceMinutes: z.number().optional(),
      overtimeThreshold: z.number().optional(),
      workDays: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.workShift.update({
        where: { id },
        data,
      })
    }),

  // 刪除班別（軟刪除）
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workShift.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),
})
