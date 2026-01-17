import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { createAIService, AIProvider, ChatMessage } from '@/lib/ai-service'

// AI 設定的 key 常數
const AI_SETTINGS_KEYS = {
  PROVIDER: 'ai.provider',
  API_KEY: 'ai.apiKey',
  MODEL: 'ai.model',
} as const

export const aiRouter = router({
  // 取得 AI 設定（不含敏感資訊）
  getConfig: publicProcedure.query(async ({ ctx }) => {
    const providerSetting = await ctx.prisma.systemSetting.findUnique({
      where: { key: AI_SETTINGS_KEYS.PROVIDER },
    })
    const modelSetting = await ctx.prisma.systemSetting.findUnique({
      where: { key: AI_SETTINGS_KEYS.MODEL },
    })
    const apiKeySetting = await ctx.prisma.systemSetting.findUnique({
      where: { key: AI_SETTINGS_KEYS.API_KEY },
    })

    return {
      provider: (providerSetting?.value as AIProvider) || 'disabled',
      model: modelSetting?.value || '',
      hasApiKey: !!apiKeySetting?.value,
    }
  }),

  // 更新 AI 設定（需要管理員權限，這裡簡化處理）
  updateConfig: publicProcedure
    .input(z.object({
      provider: z.enum(['openai', 'gemini', 'disabled']),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 更新 provider
      await ctx.prisma.systemSetting.upsert({
        where: { key: AI_SETTINGS_KEYS.PROVIDER },
        update: { value: input.provider },
        create: { key: AI_SETTINGS_KEYS.PROVIDER, value: input.provider },
      })

      // 更新 model
      if (input.model !== undefined) {
        await ctx.prisma.systemSetting.upsert({
          where: { key: AI_SETTINGS_KEYS.MODEL },
          update: { value: input.model },
          create: { key: AI_SETTINGS_KEYS.MODEL, value: input.model },
        })
      }

      // 更新 API Key（只有當提供時才更新）
      if (input.apiKey && input.apiKey.trim() !== '') {
        await ctx.prisma.systemSetting.upsert({
          where: { key: AI_SETTINGS_KEYS.API_KEY },
          update: { value: input.apiKey },
          create: { key: AI_SETTINGS_KEYS.API_KEY, value: input.apiKey },
        })
      }

      return { success: true }
    }),

  // 發送訊息給 AI
  chat: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // 取得 AI 設定
      const providerSetting = await ctx.prisma.systemSetting.findUnique({
        where: { key: AI_SETTINGS_KEYS.PROVIDER },
      })
      const apiKeySetting = await ctx.prisma.systemSetting.findUnique({
        where: { key: AI_SETTINGS_KEYS.API_KEY },
      })
      const modelSetting = await ctx.prisma.systemSetting.findUnique({
        where: { key: AI_SETTINGS_KEYS.MODEL },
      })

      const provider = (providerSetting?.value as AIProvider) || 'disabled'
      const apiKey = apiKeySetting?.value || ''
      const model = modelSetting?.value || undefined

      if (provider === 'disabled' || !apiKey) {
        return {
          content: '',
          error: 'AI 服務未啟用。請聯繫系統管理員設定 API Key。',
        }
      }

      const aiService = createAIService({
        provider,
        apiKey,
        model,
      })

      const response = await aiService.chat(input.messages as ChatMessage[])
      return response
    }),
})
