import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const messagingRouter = router({
  // 取得對話列表
  getConversations: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const conversations = await ctx.prisma.conversation.findMany({
        where: {
          participants: {
            some: { employeeId: input.userId },
          },
        },
        include: {
          participants: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  employeeNo: true,
                  avatarUrl: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      // 計算未讀訊息數量
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const participant = conv.participants.find(p => p.employeeId === input.userId)
          const unreadCount = participant?.lastReadAt
            ? await ctx.prisma.message.count({
                where: {
                  conversationId: conv.id,
                  createdAt: { gt: participant.lastReadAt },
                  senderId: { not: input.userId },
                  isDeleted: false,
                },
              })
            : await ctx.prisma.message.count({
                where: {
                  conversationId: conv.id,
                  senderId: { not: input.userId },
                  isDeleted: false,
                },
              })

          // 取得對方名稱（一對一對話）
          const otherParticipants = conv.participants.filter(p => p.employeeId !== input.userId)
          const displayName = conv.type === 'DIRECT' && otherParticipants.length === 1
            ? otherParticipants[0].employee.name
            : conv.name || '群組對話'

          return {
            id: conv.id,
            type: conv.type,
            name: displayName,
            participants: conv.participants.map(p => ({
              ...p.employee,
              isCurrentUser: p.employeeId === input.userId,
            })),
            lastMessage: conv.messages[0] || null,
            unreadCount,
            updatedAt: conv.updatedAt,
          }
        })
      )

      return conversationsWithUnread
    }),

  // 取得或建立一對一對話
  getOrCreateDirectConversation: publicProcedure
    .input(z.object({
      userId: z.string(),
      otherUserId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === input.otherUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '無法與自己建立對話',
        })
      }

      // 檢查對方是否存在
      const otherUser = await ctx.prisma.employee.findUnique({
        where: { id: input.otherUserId },
        select: { id: true, name: true, isActive: true },
      })

      if (!otherUser || !otherUser.isActive) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '找不到該使用者',
        })
      }

      // 檢查是否已存在一對一對話
      const existingConversation = await ctx.prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { participants: { some: { employeeId: input.userId } } },
            { participants: { some: { employeeId: input.otherUserId } } },
          ],
        },
        include: {
          participants: {
            include: {
              employee: {
                select: { id: true, name: true, employeeNo: true, avatarUrl: true },
              },
            },
          },
        },
      })

      if (existingConversation) {
        return existingConversation
      }

      // 建立新對話
      const newConversation = await ctx.prisma.conversation.create({
        data: {
          type: 'DIRECT',
          participants: {
            create: [
              { employeeId: input.userId },
              { employeeId: input.otherUserId },
            ],
          },
        },
        include: {
          participants: {
            include: {
              employee: {
                select: { id: true, name: true, employeeNo: true, avatarUrl: true },
              },
            },
          },
        },
      })

      return newConversation
    }),

  // 取得對話訊息
  getMessages: publicProcedure
    .input(z.object({
      userId: z.string(),
      conversationId: z.string(),
      cursor: z.string().optional(), // 分頁游標 (messageId)
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      // 檢查使用者是否為對話參與者
      const participant = await ctx.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_employeeId: {
            conversationId: input.conversationId,
            employeeId: input.userId,
          },
        },
      })

      if (!participant) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您沒有權限檢視此對話',
        })
      }

      // 取得其他參與者的 lastReadAt（用於已讀顯示）
      const otherParticipants = await ctx.prisma.conversationParticipant.findMany({
        where: {
          conversationId: input.conversationId,
          employeeId: { not: input.userId },
        },
        select: {
          employeeId: true,
          lastReadAt: true,
        },
      })

      const messages = await ctx.prisma.message.findMany({
        where: {
          conversationId: input.conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              avatarUrl: true,
            },
          },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      })

      let nextCursor: string | undefined
      if (messages.length > input.limit) {
        const nextItem = messages.pop()
        nextCursor = nextItem?.id
      }

      // 反轉以便按時間正序顯示
      return {
        messages: messages.reverse(),
        nextCursor,
        // 回傳其他參與者的已讀狀態（一對一對話只有一個人）
        recipientReadAt: otherParticipants.length === 1
          ? otherParticipants[0].lastReadAt
          : null,
      }
    }),

  // 發送訊息
  sendMessage: publicProcedure
    .input(z.object({
      userId: z.string(),
      conversationId: z.string(),
      content: z.string().min(1).max(5000),
      attachments: z.array(z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        fileUrl: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查使用者是否為對話參與者
      const participant = await ctx.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_employeeId: {
            conversationId: input.conversationId,
            employeeId: input.userId,
          },
        },
      })

      if (!participant) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您沒有權限在此對話中發送訊息',
        })
      }

      // 建立訊息
      const message = await ctx.prisma.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.userId,
          content: input.content,
          attachments: input.attachments && input.attachments.length > 0
            ? {
                create: input.attachments.map(a => ({
                  fileName: a.fileName,
                  fileType: a.fileType,
                  fileSize: a.fileSize,
                  fileUrl: a.fileUrl,
                })),
              }
            : undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              avatarUrl: true,
            },
          },
          attachments: true,
        },
      })

      // 更新對話的 updatedAt
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      })

      // 更新發送者的最後閱讀時間
      await ctx.prisma.conversationParticipant.update({
        where: {
          conversationId_employeeId: {
            conversationId: input.conversationId,
            employeeId: input.userId,
          },
        },
        data: { lastReadAt: new Date() },
      })

      return message
    }),

  // 標記已讀
  markAsRead: publicProcedure
    .input(z.object({
      userId: z.string(),
      conversationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.conversationParticipant.update({
        where: {
          conversationId_employeeId: {
            conversationId: input.conversationId,
            employeeId: input.userId,
          },
        },
        data: { lastReadAt: new Date() },
      })

      return { success: true }
    }),

  // 收回訊息（軟刪除）
  deleteMessage: publicProcedure
    .input(z.object({
      userId: z.string(),
      messageId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.prisma.message.findUnique({
        where: { id: input.messageId },
      })

      if (!message) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '訊息不存在',
        })
      }

      if (message.senderId !== input.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '只能收回自己的訊息',
        })
      }

      await ctx.prisma.message.update({
        where: { id: input.messageId },
        data: { isDeleted: true, content: '' },
      })

      return { success: true }
    }),

  // 取得總未讀數量
  getTotalUnreadCount: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const participants = await ctx.prisma.conversationParticipant.findMany({
        where: { employeeId: input.userId },
        select: {
          conversationId: true,
          lastReadAt: true,
        },
      })

      let totalUnread = 0
      for (const p of participants) {
        const count = p.lastReadAt
          ? await ctx.prisma.message.count({
              where: {
                conversationId: p.conversationId,
                createdAt: { gt: p.lastReadAt },
                senderId: { not: input.userId },
                isDeleted: false,
              },
            })
          : await ctx.prisma.message.count({
              where: {
                conversationId: p.conversationId,
                senderId: { not: input.userId },
                isDeleted: false,
              },
            })
        totalUnread += count
      }

      return { count: totalUnread }
    }),

  // 搜尋可開啟對話的員工
  searchEmployees: publicProcedure
    .input(z.object({
      userId: z.string(),
      query: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const employees = await ctx.prisma.employee.findMany({
        where: {
          isActive: true,
          id: { not: input.userId },
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { employeeNo: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          employeeNo: true,
          avatarUrl: true,
          assignments: {
            where: { status: 'ACTIVE' },
            select: {
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
            take: 1,
          },
        },
        take: 10,
      })

      return employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        employeeNo: emp.employeeNo,
        avatarUrl: emp.avatarUrl,
        department: emp.assignments[0]?.department?.name,
        position: emp.assignments[0]?.position?.name,
      }))
    }),
})
