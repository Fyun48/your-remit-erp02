import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { defaultMenuItems, getAllSubMenuItems } from '@/lib/sidebar-menu'

export const menuConfigRouter = router({
  // 取得公司的選單配置
  getByCompany: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const menuConfigs = await ctx.prisma.menuConfig.findMany({
        where: { companyId: input.companyId },
        include: {
          subMenus: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })

      // 取得獨立顯示的子選單（不歸屬任何主選單）
      const independentSubMenus = await ctx.prisma.subMenuConfig.findMany({
        where: {
          companyId: input.companyId,
          isIndependent: true,
        },
        orderBy: { sortOrder: 'asc' },
      })

      return {
        menuConfigs,
        independentSubMenus,
      }
    }),

  // 初始化公司的選單配置（根據預設選單結構）
  initializeForCompany: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已初始化
      const existingCount = await ctx.prisma.menuConfig.count({
        where: { companyId: input.companyId },
      })

      if (existingCount > 0) {
        return { success: true, message: '選單配置已存在' }
      }

      // 建立主選單配置
      const menuConfigsData = defaultMenuItems.map((item, index) => ({
        companyId: input.companyId,
        menuId: item.id,
        menuName: item.name,
        sortOrder: index,
        isLocked: item.isLocked || false,
        isActive: true,
      }))

      await ctx.prisma.menuConfig.createMany({
        data: menuConfigsData,
      })

      // 取得剛建立的主選單 ID 對應
      const createdMenus = await ctx.prisma.menuConfig.findMany({
        where: { companyId: input.companyId },
      })

      const menuIdMap = new Map(createdMenus.map((m) => [m.menuId, m.id]))

      // 建立子選單配置
      const subMenusData: {
        companyId: string
        parentMenuId: string | null
        subMenuId: string
        subMenuName: string
        href: string
        sortOrder: number
        isIndependent: boolean
        isSystem: boolean
      }[] = []

      for (const menuItem of defaultMenuItems) {
        if (menuItem.children) {
          const parentMenuId = menuIdMap.get(menuItem.id)
          menuItem.children.forEach((child, index) => {
            subMenusData.push({
              companyId: input.companyId,
              parentMenuId: parentMenuId || null,
              subMenuId: child.id,
              subMenuName: child.name,
              href: child.href,
              sortOrder: index,
              isIndependent: false,
              isSystem: false,
            })
          })
        }
      }

      if (subMenusData.length > 0) {
        await ctx.prisma.subMenuConfig.createMany({
          data: subMenusData,
        })
      }

      return { success: true, message: '選單配置初始化完成' }
    }),

  // 更新主選單排序
  updateMenuOrder: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        menuOrders: z.array(
          z.object({
            menuId: z.string(),
            sortOrder: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.menuOrders.map((order) =>
          ctx.prisma.menuConfig.updateMany({
            where: {
              companyId: input.companyId,
              menuId: order.menuId,
            },
            data: { sortOrder: order.sortOrder },
          })
        )
      )

      return { success: true }
    }),

  // 更新主選單名稱
  updateMenuName: publicProcedure
    .input(
      z.object({
        id: z.string(),
        menuName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const menu = await ctx.prisma.menuConfig.findUnique({
        where: { id: input.id },
      })

      if (!menu) {
        throw new Error('選單不存在')
      }

      if (menu.isLocked) {
        throw new Error('此選單已鎖定，無法修改名稱')
      }

      return ctx.prisma.menuConfig.update({
        where: { id: input.id },
        data: { menuName: input.menuName },
      })
    }),

  // 更新子選單歸屬（移動到其他主選單）
  moveSubMenu: publicProcedure
    .input(
      z.object({
        subMenuConfigId: z.string(),
        targetParentMenuId: z.string().nullable(), // null 表示設為獨立
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subMenu = await ctx.prisma.subMenuConfig.findUnique({
        where: { id: input.subMenuConfigId },
        include: { parentMenu: true },
      })

      if (!subMenu) {
        throw new Error('子選單不存在')
      }

      // 檢查原本的父選單是否鎖定
      if (subMenu.parentMenu?.isLocked) {
        throw new Error('原選單已鎖定，無法移動子選單')
      }

      // 如果目標不是獨立，檢查目標父選單是否鎖定
      if (input.targetParentMenuId) {
        const targetMenu = await ctx.prisma.menuConfig.findUnique({
          where: { id: input.targetParentMenuId },
        })

        if (targetMenu?.isLocked) {
          throw new Error('目標選單已鎖定，無法新增子選單')
        }
      }

      return ctx.prisma.subMenuConfig.update({
        where: { id: input.subMenuConfigId },
        data: {
          parentMenuId: input.targetParentMenuId,
          isIndependent: input.targetParentMenuId === null,
        },
      })
    }),

  // 更新子選單排序（在同一主選單內）
  updateSubMenuOrder: publicProcedure
    .input(
      z.object({
        parentMenuId: z.string().nullable(),
        subMenuOrders: z.array(
          z.object({
            id: z.string(),
            sortOrder: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.subMenuOrders.map((order) =>
          ctx.prisma.subMenuConfig.update({
            where: { id: order.id },
            data: { sortOrder: order.sortOrder },
          })
        )
      )

      return { success: true }
    }),

  // 更新子選單名稱
  updateSubMenuName: publicProcedure
    .input(
      z.object({
        id: z.string(),
        subMenuName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subMenu = await ctx.prisma.subMenuConfig.findUnique({
        where: { id: input.id },
        include: { parentMenu: true },
      })

      if (!subMenu) {
        throw new Error('子選單不存在')
      }

      if (subMenu.parentMenu?.isLocked) {
        throw new Error('此選單的父選單已鎖定，無法修改')
      }

      return ctx.prisma.subMenuConfig.update({
        where: { id: input.id },
        data: { subMenuName: input.subMenuName },
      })
    }),

  // 切換子選單獨立顯示狀態
  toggleSubMenuIndependent: publicProcedure
    .input(
      z.object({
        id: z.string(),
        isIndependent: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subMenu = await ctx.prisma.subMenuConfig.findUnique({
        where: { id: input.id },
        include: { parentMenu: true },
      })

      if (!subMenu) {
        throw new Error('子選單不存在')
      }

      if (subMenu.parentMenu?.isLocked) {
        throw new Error('此選單的父選單已鎖定，無法修改')
      }

      return ctx.prisma.subMenuConfig.update({
        where: { id: input.id },
        data: {
          isIndependent: input.isIndependent,
          // 如果設為獨立，清除父選單關聯
          parentMenuId: input.isIndependent ? null : subMenu.parentMenuId,
        },
      })
    }),

  // 同步檢查新功能（比對現有配置與程式定義）
  syncNewFeatures: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 取得程式定義的所有子選單
      const allDefinedSubMenus = getAllSubMenuItems()

      // 取得公司現有的子選單配置
      const existingSubMenus = await ctx.prisma.subMenuConfig.findMany({
        where: { companyId: input.companyId },
        select: { subMenuId: true },
      })

      const existingIds = new Set(existingSubMenus.map((s) => s.subMenuId))

      // 找出新增的功能
      const newSubMenus = allDefinedSubMenus.filter(
        (item) => !existingIds.has(item.id)
      )

      if (newSubMenus.length === 0) {
        return { success: true, newCount: 0, message: '沒有發現新功能' }
      }

      // 新增到資料庫（標記為系統自動偵測）
      await ctx.prisma.subMenuConfig.createMany({
        data: newSubMenus.map((item, index) => ({
          companyId: input.companyId,
          parentMenuId: null, // 預設不歸屬任何主選單
          subMenuId: item.id,
          subMenuName: item.name,
          href: item.href,
          sortOrder: 999 + index, // 排在最後
          isIndependent: false,
          isSystem: true,
        })),
      })

      return {
        success: true,
        newCount: newSubMenus.length,
        message: `已新增 ${newSubMenus.length} 個新功能`,
        newFeatures: newSubMenus.map((s) => s.name),
      }
    }),

  // 重置為預設配置
  resetToDefault: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 刪除現有配置
      await ctx.prisma.subMenuConfig.deleteMany({
        where: { companyId: input.companyId },
      })

      await ctx.prisma.menuConfig.deleteMany({
        where: { companyId: input.companyId },
      })

      // 重新初始化
      // 建立主選單配置
      const menuConfigsData = defaultMenuItems.map((item, index) => ({
        companyId: input.companyId,
        menuId: item.id,
        menuName: item.name,
        sortOrder: index,
        isLocked: item.isLocked || false,
        isActive: true,
      }))

      await ctx.prisma.menuConfig.createMany({
        data: menuConfigsData,
      })

      // 取得剛建立的主選單 ID 對應
      const createdMenus = await ctx.prisma.menuConfig.findMany({
        where: { companyId: input.companyId },
      })

      const menuIdMap = new Map(createdMenus.map((m) => [m.menuId, m.id]))

      // 建立子選單配置
      const subMenusData: {
        companyId: string
        parentMenuId: string | null
        subMenuId: string
        subMenuName: string
        href: string
        sortOrder: number
        isIndependent: boolean
        isSystem: boolean
      }[] = []

      for (const menuItem of defaultMenuItems) {
        if (menuItem.children) {
          const parentMenuId = menuIdMap.get(menuItem.id)
          menuItem.children.forEach((child, index) => {
            subMenusData.push({
              companyId: input.companyId,
              parentMenuId: parentMenuId || null,
              subMenuId: child.id,
              subMenuName: child.name,
              href: child.href,
              sortOrder: index,
              isIndependent: false,
              isSystem: false,
            })
          })
        }
      }

      if (subMenusData.length > 0) {
        await ctx.prisma.subMenuConfig.createMany({
          data: subMenusData,
        })
      }

      return { success: true, message: '已重置為預設配置' }
    }),
})
