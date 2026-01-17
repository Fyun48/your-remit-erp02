export interface ThemeDefinition {
  id: string
  name: string
  description: string
  primaryColor: string  // Display color for preview
  isDark: boolean
}

export const themes: ThemeDefinition[] = [
  {
    id: 'classic',
    name: '經典藍',
    description: '專業沉穩的藍色系配色',
    primaryColor: '#1e40af',
    isDark: false,
  },
  {
    id: 'dark',
    name: '現代暗黑',
    description: '深色背景搭配亮紫色調',
    primaryColor: '#6366f1',
    isDark: true,
  },
  {
    id: 'mint',
    name: '清新薄荷',
    description: '清爽的薄荷綠色系',
    primaryColor: '#10b981',
    isDark: false,
  },
  {
    id: 'sunset',
    name: '溫暖橙光',
    description: '溫暖活潑的橙色系',
    primaryColor: '#f97316',
    isDark: false,
  },
  {
    id: 'purple',
    name: '優雅紫羅',
    description: '優雅浪漫的紫色系',
    primaryColor: '#8b5cf6',
    isDark: false,
  },
]

export const defaultTheme = 'classic'

export function getThemeById(id: string): ThemeDefinition | undefined {
  return themes.find((theme) => theme.id === id)
}

export function isValidTheme(id: string): boolean {
  return themes.some((theme) => theme.id === id)
}
