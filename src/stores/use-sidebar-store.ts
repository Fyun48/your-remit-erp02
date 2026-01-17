import { create } from 'zustand'
import { getDefaultMenuOrder } from '@/lib/sidebar-menu'

interface SidebarConfig {
  menuOrder: string[]
  hiddenMenus: string[]
}

interface SidebarStore {
  // 設定狀態
  config: SidebarConfig
  isLoaded: boolean

  // 操作
  setConfig: (config: SidebarConfig) => void
  updateMenuOrder: (menuOrder: string[]) => void
  toggleMenuVisibility: (menuId: string) => void
  resetToDefault: () => void
  setLoaded: (loaded: boolean) => void
}

const defaultConfig: SidebarConfig = {
  menuOrder: getDefaultMenuOrder(),
  hiddenMenus: [],
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  config: defaultConfig,
  isLoaded: false,

  setConfig: (config) => set({ config, isLoaded: true }),

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

  resetToDefault: () => set({ config: defaultConfig }),

  setLoaded: (loaded) => set({ isLoaded: loaded }),
}))
