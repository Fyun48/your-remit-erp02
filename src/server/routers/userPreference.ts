import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { getDefaultMenuOrder } from '@/lib/sidebar-menu'
import { defaultTheme } from '@/lib/themes'

// 側邊欄設定 schema
const sidebarConfigSchema = z.object({
  menuOrder: z.array(z.string()),
  hiddenMenus: z.array(z.string()),
  expandedMenuId: z.string().nullable().optional(),
  personalMenuItems: z.array(z.string()).optional(), // 個人專區子選單 ID 陣列
})

export const userPreferenceRouter = router({
  // 取得使用者偏好設定
  get: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const preference = await ctx.prisma.userPreference.findUnique({
        where: { employeeId: input.employeeId },
      })

      // 如果沒有設定，回傳預設值
      if (!preference) {
        return {
          sidebarConfig: {
            menuOrder: getDefaultMenuOrder(),
            hiddenMenus: [],
            expandedMenuId: null,
            personalMenuItems: [],
          },
          themeConfig: {
            theme: defaultTheme,
          },
        }
      }

      const storedConfig = preference.sidebarConfig as {
        menuOrder: string[]
        hiddenMenus: string[]
        expandedMenuId?: string | null
        personalMenuItems?: string[]
      } | null

      return {
        sidebarConfig: {
          menuOrder: storedConfig?.menuOrder || getDefaultMenuOrder(),
          hiddenMenus: storedConfig?.hiddenMenus || [],
          expandedMenuId: storedConfig?.expandedMenuId || null,
          personalMenuItems: storedConfig?.personalMenuItems || [],
        },
        themeConfig: preference.themeConfig as { theme: string } || {
          theme: defaultTheme,
        },
      }
    }),

  // 更新側邊欄設定
  updateSidebar: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      sidebarConfig: sidebarConfigSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          sidebarConfig: input.sidebarConfig,
        },
        create: {
          employeeId: input.employeeId,
          sidebarConfig: input.sidebarConfig,
        },
      })
    }),

  // 還原側邊欄預設設定
  resetSidebar: publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const defaultConfig = {
        menuOrder: getDefaultMenuOrder(),
        hiddenMenus: [],
        expandedMenuId: null,
        personalMenuItems: [],
      }

      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          sidebarConfig: defaultConfig,
        },
        create: {
          employeeId: input.employeeId,
          sidebarConfig: defaultConfig,
        },
      })
    }),

  // 更新展開的選單 ID（用於記住展開狀態）
  updateExpandedMenu: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      expandedMenuId: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 先取得現有設定
      const existing = await ctx.prisma.userPreference.findUnique({
        where: { employeeId: input.employeeId },
      })

      const currentConfig = existing?.sidebarConfig as {
        menuOrder: string[]
        hiddenMenus: string[]
        expandedMenuId?: string | null
        personalMenuItems?: string[]
      } | null

      const updatedConfig = {
        menuOrder: currentConfig?.menuOrder || getDefaultMenuOrder(),
        hiddenMenus: currentConfig?.hiddenMenus || [],
        expandedMenuId: input.expandedMenuId,
        personalMenuItems: currentConfig?.personalMenuItems || [],
      }

      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          sidebarConfig: updatedConfig,
        },
        create: {
          employeeId: input.employeeId,
          sidebarConfig: updatedConfig,
        },
      })
    }),

  // 更新個人專區子選單
  updatePersonalMenuItems: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      personalMenuItems: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      // 先取得現有設定
      const existing = await ctx.prisma.userPreference.findUnique({
        where: { employeeId: input.employeeId },
      })

      const currentConfig = existing?.sidebarConfig as {
        menuOrder: string[]
        hiddenMenus: string[]
        expandedMenuId?: string | null
        personalMenuItems?: string[]
      } | null

      const updatedConfig = {
        menuOrder: currentConfig?.menuOrder || getDefaultMenuOrder(),
        hiddenMenus: currentConfig?.hiddenMenus || [],
        expandedMenuId: currentConfig?.expandedMenuId || null,
        personalMenuItems: input.personalMenuItems,
      }

      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          sidebarConfig: updatedConfig,
        },
        create: {
          employeeId: input.employeeId,
          sidebarConfig: updatedConfig,
        },
      })
    }),

  // 更新主題設定
  updateTheme: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      theme: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPreference.upsert({
        where: { employeeId: input.employeeId },
        update: {
          themeConfig: { theme: input.theme },
        },
        create: {
          employeeId: input.employeeId,
          themeConfig: { theme: input.theme },
        },
      })
    }),
})
