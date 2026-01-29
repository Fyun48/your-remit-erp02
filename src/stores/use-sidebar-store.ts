import { create } from 'zustand'
import { getDefaultMenuOrder } from '@/lib/sidebar-menu'

interface SidebarConfig {
  menuOrder: string[]
  hiddenMenus: string[]
  expandedMenuId: string | null
  personalMenuItems: string[]
}

interface SidebarStore {
  // 設定狀態
  config: SidebarConfig
  isLoaded: boolean

  // 操作
  setConfig: (config: SidebarConfig) => void
  updateMenuOrder: (menuOrder: string[]) => void
  toggleMenuVisibility: (menuId: string) => void
  setExpandedMenuId: (menuId: string | null) => void
  setPersonalMenuItems: (items: string[]) => void
  togglePersonalMenuItem: (itemId: string) => void
  resetToDefault: () => void
  setLoaded: (loaded: boolean) => void
}

const defaultConfig: SidebarConfig = {
  menuOrder: getDefaultMenuOrder(),
  hiddenMenus: [],
  expandedMenuId: null,
  personalMenuItems: [],
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  config: defaultConfig,
  isLoaded: false,

  setConfig: (config) => set({ config: { ...defaultConfig, ...config }, isLoaded: true }),

  updateMenuOrder: (menuOrder) =>
    set((state) => ({
      config: { ...state.config, menuOrder },
    })),

  toggleMenuVisibility: (menuId) =>
    set((state) => {
      const hiddenMenus = state.config.hiddenMenus.includes(menuId)
        ? state.config.hiddenMenus.filter((id) => id !== menuId)
        : [...state.config.hiddenMenus, menuId]
      return {
        config: { ...state.config, hiddenMenus },
      }
    }),

  setExpandedMenuId: (menuId) =>
    set((state) => ({
      config: { ...state.config, expandedMenuId: menuId },
    })),

  setPersonalMenuItems: (items) =>
    set((state) => ({
      config: { ...state.config, personalMenuItems: items },
    })),

  togglePersonalMenuItem: (itemId) =>
    set((state) => {
      const personalMenuItems = state.config.personalMenuItems.includes(itemId)
        ? state.config.personalMenuItems.filter((id) => id !== itemId)
        : [...state.config.personalMenuItems, itemId]
      return {
        config: { ...state.config, personalMenuItems },
      }
    }),

  resetToDefault: () => set({ config: defaultConfig }),

  setLoaded: (loaded) => set({ isLoaded: loaded }),
}))
