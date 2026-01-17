import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { getDefaultMenuOrder } from '@/lib/sidebar-menu'

// 側邊欄設定 schema
const sidebarConfigSchema = z.object({
  menuOrder: z.array(z.string()),
  hiddenMenus: z.array(z.string()),
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
          },
          themeConfig: {
            theme: 'classic',
          },
        }
      }

      return {
        sidebarConfig: preference.sidebarConfig as {
          menuOrder: string[]
          hiddenMenus: string[]
        } || {
          menuOrder: getDefaultMenuOrder(),
          hiddenMenus: [],
        },
        themeConfig: preference.themeConfig as { theme: string } || {
          theme: 'classic',
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
})
