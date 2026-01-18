import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const systemSettingRouter = router({
  // 取得單一設定
  get: publicProcedure
    .input(z.object({
      key: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.prisma.systemSetting.findUnique({
        where: { key: input.key },
      })
      return setting
    }),

  // 取得多個設定
  getMany: publicProcedure
    .input(z.object({
      keys: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.prisma.systemSetting.findMany({
        where: { key: { in: input.keys } },
      })
      return settings.reduce((acc, s) => {
        acc[s.key] = s.value
        return acc
      }, {} as Record<string, string>)
    }),

  // 設定值（upsert）
  set: publicProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.systemSetting.upsert({
        where: { key: input.key },
        create: {
          key: input.key,
          value: input.value,
        },
        update: {
          value: input.value,
        },
      })
    }),

  // 批量設定
  setMany: publicProcedure
    .input(z.object({
      settings: z.array(z.object({
        key: z.string(),
        value: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.settings.map(({ key, value }) =>
          ctx.prisma.systemSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          })
        )
      )
      return results
    }),

  // 刪除設定
  delete: publicProcedure
    .input(z.object({
      key: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.systemSetting.delete({
        where: { key: input.key },
      })
    }),

  // LINE 整合設定 - 取得
  getLineConfig: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'LINE_CHANNEL_ID',
            'LINE_CHANNEL_SECRET',
            'LINE_CHANNEL_ACCESS_TOKEN',
            'LINE_NOTIFY_CLIENT_ID',
            'LINE_NOTIFY_CLIENT_SECRET',
            'LINE_ENABLED',
          ],
        },
      },
    })

    const config = settings.reduce((acc, s) => {
      // 隱藏敏感資訊的部分內容
      if (s.key.includes('SECRET') || s.key.includes('TOKEN')) {
        const value = s.value
        if (value.length > 8) {
          acc[s.key] = value.substring(0, 4) + '****' + value.substring(value.length - 4)
        } else {
          acc[s.key] = '****'
        }
        acc[`${s.key}_SET`] = true
      } else {
        acc[s.key] = s.value
      }
      return acc
    }, {} as Record<string, string | boolean>)

    return config
  }),

  // LINE 整合設定 - 儲存
  saveLineConfig: publicProcedure
    .input(z.object({
      channelId: z.string().optional(),
      channelSecret: z.string().optional(),
      channelAccessToken: z.string().optional(),
      notifyClientId: z.string().optional(),
      notifyClientSecret: z.string().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: { key: string; value: string }[] = []

      if (input.channelId !== undefined) {
        updates.push({ key: 'LINE_CHANNEL_ID', value: input.channelId })
      }
      if (input.channelSecret !== undefined && !input.channelSecret.includes('****')) {
        updates.push({ key: 'LINE_CHANNEL_SECRET', value: input.channelSecret })
      }
      if (input.channelAccessToken !== undefined && !input.channelAccessToken.includes('****')) {
        updates.push({ key: 'LINE_CHANNEL_ACCESS_TOKEN', value: input.channelAccessToken })
      }
      if (input.notifyClientId !== undefined) {
        updates.push({ key: 'LINE_NOTIFY_CLIENT_ID', value: input.notifyClientId })
      }
      if (input.notifyClientSecret !== undefined && !input.notifyClientSecret.includes('****')) {
        updates.push({ key: 'LINE_NOTIFY_CLIENT_SECRET', value: input.notifyClientSecret })
      }
      if (input.enabled !== undefined) {
        updates.push({ key: 'LINE_ENABLED', value: String(input.enabled) })
      }

      await Promise.all(
        updates.map(({ key, value }) =>
          ctx.prisma.systemSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          })
        )
      )

      return { success: true }
    }),

  // 測試 LINE 連線
  testLineConnection: publicProcedure.mutation(async ({ ctx }) => {
    const settings = await ctx.prisma.systemSetting.findMany({
      where: {
        key: { in: ['LINE_CHANNEL_ACCESS_TOKEN'] },
      },
    })

    const accessToken = settings.find(s => s.key === 'LINE_CHANNEL_ACCESS_TOKEN')?.value

    if (!accessToken) {
      return { success: false, message: '尚未設定 Channel Access Token' }
    }

    try {
      // 測試 LINE Messaging API
      const response = await fetch('https://api.line.me/v2/bot/info', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          message: `連線成功！Bot 名稱: ${data.displayName}`,
          botInfo: data,
        }
      } else {
        const error = await response.json()
        return {
          success: false,
          message: `連線失敗: ${error.message || response.statusText}`,
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `連線錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`,
      }
    }
  }),
})
