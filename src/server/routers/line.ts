import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { createAuditLog } from '@/lib/audit'

// LINE Login configuration
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET
const LINE_CALLBACK_URL = process.env.LINE_CALLBACK_URL || '/api/line/callback'

export const lineRouter = router({
  // 取得目前的 LINE 連動狀態
  getStatus: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.userId },
        select: {
          lineUserId: true,
          lineTokenExpiresAt: true,
        },
      })

      if (!employee) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到用戶' })
      }

      const isLinked = !!employee.lineUserId
      const isTokenValid = employee.lineTokenExpiresAt
        ? new Date(employee.lineTokenExpiresAt) > new Date()
        : false

      return {
        isLinked,
        isTokenValid,
        lineUserId: employee.lineUserId,
      }
    }),

  // 產生 LINE Login 授權 URL
  getAuthUrl: publicProcedure
    .input(z.object({
      userId: z.string(),
      redirectUrl: z.string().optional(),
    }))
    .query(({ input }) => {
      if (!LINE_CHANNEL_ID) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'LINE 整合尚未設定',
        })
      }

      const state = Buffer.from(JSON.stringify({
        userId: input.userId,
        redirectUrl: input.redirectUrl || '/dashboard/settings',
        timestamp: Date.now(),
      })).toString('base64')

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: LINE_CHANNEL_ID,
        redirect_uri: LINE_CALLBACK_URL,
        state,
        scope: 'profile openid',
      })

      return {
        authUrl: `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`,
      }
    }),

  // LINE 授權回調處理（由 API route 呼叫）
  handleCallback: publicProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'LINE 整合尚未設定',
        })
      }

      // 解析 state
      let stateData: { userId: string; redirectUrl: string }
      try {
        stateData = JSON.parse(Buffer.from(input.state, 'base64').toString())
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無效的 state 參數' })
      }

      // 換取 access token
      const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: input.code,
          redirect_uri: LINE_CALLBACK_URL,
          client_id: LINE_CHANNEL_ID,
          client_secret: LINE_CHANNEL_SECRET,
        }),
      })

      if (!tokenResponse.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '無法取得 LINE access token',
        })
      }

      const tokenData = await tokenResponse.json()
      const { access_token, expires_in } = tokenData

      // 取得用戶資料
      const profileResponse = await fetch('https://api.line.me/v2/profile', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      })

      if (!profileResponse.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '無法取得 LINE 用戶資料',
        })
      }

      const profile = await profileResponse.json()
      const { userId: lineUserId, displayName } = profile

      // 檢查此 LINE 帳號是否已被其他員工連結
      const existingLink = await ctx.prisma.employee.findFirst({
        where: {
          lineUserId,
          id: { not: stateData.userId },
        },
      })

      if (existingLink) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '此 LINE 帳號已連結到其他員工',
        })
      }

      // 更新員工資料
      const expiresAt = new Date(Date.now() + expires_in * 1000)

      await ctx.prisma.employee.update({
        where: { id: stateData.userId },
        data: {
          lineUserId,
          lineAccessToken: access_token,
          lineTokenExpiresAt: expiresAt,
        },
      })

      await createAuditLog({
        entityType: 'Employee',
        entityId: stateData.userId,
        action: 'LINE_LINK',
        operatorId: stateData.userId,
        newValue: { lineUserId, displayName },
      })

      return {
        success: true,
        displayName,
        redirectUrl: stateData.redirectUrl,
      }
    }),

  // 解除 LINE 連動
  unlink: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.userId },
        select: { lineUserId: true },
      })

      if (!employee?.lineUserId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '尚未連結 LINE 帳號' })
      }

      await ctx.prisma.employee.update({
        where: { id: input.userId },
        data: {
          lineUserId: null,
          lineAccessToken: null,
          lineTokenExpiresAt: null,
        },
      })

      await createAuditLog({
        entityType: 'Employee',
        entityId: input.userId,
        action: 'LINE_UNLINK',
        operatorId: input.userId,
      })

      return { success: true }
    }),

  // 產生 LINE Share URL（用於分享內容到 LINE）
  getShareUrl: publicProcedure
    .input(z.object({
      text: z.string().max(1000),
      url: z.string().optional(),
    }))
    .query(({ input }) => {
      const params = new URLSearchParams({
        text: input.text,
      })

      if (input.url) {
        params.set('url', input.url)
      }

      // LINE Share URL scheme
      return {
        shareUrl: `https://line.me/R/share?${params.toString()}`,
      }
    }),

  // 檢查 LINE 整合是否已設定
  isConfigured: publicProcedure.query(() => {
    return {
      isConfigured: !!(LINE_CHANNEL_ID && LINE_CHANNEL_SECRET),
    }
  }),
})
