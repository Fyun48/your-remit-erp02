'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SidebarSettings } from './sidebar-settings'
import { ThemePicker } from './theme-picker'
import { LayoutList, Palette } from 'lucide-react'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { trpc } from '@/lib/trpc'
import { defaultTheme } from '@/lib/themes'

interface PersonalizationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
}

export function PersonalizationModal({
  open,
  onOpenChange,
  employeeId,
}: PersonalizationModalProps) {
  const [activeTab, setActiveTab] = useState('sidebar')
  const { config } = useSidebarStore()
  const [selectedTheme, setSelectedTheme] = useState(defaultTheme)
  const [originalTheme, setOriginalTheme] = useState(defaultTheme)

  // Fetch current preferences
  const { data: preference } = trpc.userPreference.get.useQuery(
    { employeeId },
    { enabled: !!employeeId && open }
  )

  // Initialize theme when preference loads
  useEffect(() => {
    if (preference?.themeConfig?.theme) {
      setSelectedTheme(preference.themeConfig.theme)
      setOriginalTheme(preference.themeConfig.theme)
    }
  }, [preference])

  // Reset theme preview on cancel
  const handleCancel = () => {
    // Restore original theme
    document.documentElement.setAttribute('data-theme', originalTheme)
    onOpenChange(false)
  }

  const updateSidebar = trpc.userPreference.updateSidebar.useMutation({
    onSuccess: () => {
      onOpenChange(false)
    },
  })

  const updateTheme = trpc.userPreference.updateTheme.useMutation({
    onSuccess: () => {
      setOriginalTheme(selectedTheme)
      onOpenChange(false)
    },
  })

  const handleSaveSidebar = () => {
    updateSidebar.mutate({
      employeeId,
      sidebarConfig: config,
    })
  }

  const handleSaveTheme = () => {
    updateTheme.mutate({
      employeeId,
      theme: selectedTheme,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        // Restore original theme when closing without save
        document.documentElement.setAttribute('data-theme', originalTheme)
      }
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>個人化設定</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sidebar" className="flex items-center gap-2">
              <LayoutList className="h-4 w-4" />
              側邊欄
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              佈景主題
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sidebar" className="mt-4">
            <SidebarSettings
              onSave={handleSaveSidebar}
              onCancel={handleCancel}
              isSaving={updateSidebar.isPending}
            />
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <ThemePicker
              currentTheme={selectedTheme}
              onThemeChange={setSelectedTheme}
              onSave={handleSaveTheme}
              onCancel={handleCancel}
              isSaving={updateTheme.isPending}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
