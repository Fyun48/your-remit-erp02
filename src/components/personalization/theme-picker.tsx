'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { themes, ThemeDefinition } from '@/lib/themes'
import { cn } from '@/lib/utils'

interface ThemePickerProps {
  currentTheme: string
  onThemeChange: (themeId: string) => void
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
}

function ThemeCard({
  theme,
  isSelected,
  onSelect,
}: {
  theme: ThemeDefinition
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative flex flex-col items-center p-3 rounded-lg border-2 transition-all',
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50'
      )}
    >
      {/* Color preview circle */}
      <div
        className={cn(
          'w-12 h-12 rounded-full mb-2 flex items-center justify-center',
          theme.isDark ? 'ring-1 ring-white/20' : 'ring-1 ring-black/10'
        )}
        style={{ backgroundColor: theme.primaryColor }}
      >
        {isSelected && (
          <Check className="h-6 w-6 text-white drop-shadow-md" />
        )}
      </div>

      {/* Theme name */}
      <span className="text-sm font-medium">{theme.name}</span>

      {/* Theme description */}
      <span className="text-xs text-muted-foreground text-center mt-1">
        {theme.description}
      </span>
    </button>
  )
}

export function ThemePicker({
  currentTheme,
  onThemeChange,
  onSave,
  onCancel,
  isSaving,
}: ThemePickerProps) {
  const [selectedTheme, setSelectedTheme] = useState(currentTheme)

  useEffect(() => {
    setSelectedTheme(currentTheme)
  }, [currentTheme])

  const handleSelect = (themeId: string) => {
    setSelectedTheme(themeId)
    onThemeChange(themeId)
    // Apply theme immediately for preview
    document.documentElement.setAttribute('data-theme', themeId)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">佈景主題</h3>
        <p className="text-sm text-muted-foreground">
          選擇您喜愛的視覺風格，立即預覽效果
        </p>
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isSelected={selectedTheme === theme.id}
            onSelect={() => handleSelect(theme.id)}
          />
        ))}
      </div>

      {/* Preview section */}
      <div className="p-4 bg-card rounded-lg border">
        <p className="text-sm font-medium mb-2">預覽效果</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">主要按鈕</Button>
          <Button variant="secondary" size="sm">次要按鈕</Button>
          <Button variant="outline" size="sm">外框按鈕</Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? '儲存中...' : '儲存'}
        </Button>
      </div>
    </div>
  )
}
