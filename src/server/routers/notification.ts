import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const notificationRouter = router({
  // 取得未讀通知 (最近 50 筆)
  getUnread: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.notification.findMany({
        where: {
          userId: input.userId,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    }),

  // 取得所有通知 (分頁)
  getAll: publicProcedure
    .input(z.object({
      userId: z.string(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      isRead: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { userId: input.userId }
      if (input.isRead !== undefined) {
        where.isRead = input.isRead
      }

      const [items, total] = await Promise.all([
        ctx.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.notification.count({ where }),
      ])

      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      }
    }),

  // 標記單一通知為已讀
  markAsRead: publicProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.prisma.notification.findUnique({
        where: { id: input.id },
      })

      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '通知不存在' })
      }

      if (notification.userId !== input.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無權限操作此通知' })
      }

      if (notification.isRead) {
        return notification
      }

      return ctx.prisma.notification.update({
        where: { id: input.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })
    }),

  // 標記所有通知為已讀
  markAllAsRead: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.notification.updateMany({
        where: {
          userId: input.userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      return { count: result.count }
    }),

  // 刪除單一通知
  delete: publicProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.prisma.notification.findUnique({
        where: { id: input.id },
      })

      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '通知不存在' })
      }

      if (notification.userId !== input.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '無權限操作此通知' })
      }

      return ctx.prisma.notification.delete({
        where: { id: input.id },
      })
    }),

  // 清除所有已讀通知
  clearAll: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.notification.deleteMany({
        where: {
          userId: input.userId,
          isRead: true,
        },
      })

      return { count: result.count }
    }),

  // 取得未讀通知數量
  getUnreadCount: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.prisma.notification.count({
        where: {
          userId: input.userId,
          isRead: false,
        },
      })

      return { count }
    }),
})
