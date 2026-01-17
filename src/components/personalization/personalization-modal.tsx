'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SidebarSettings } from './sidebar-settings'
import { LayoutList, Palette } from 'lucide-react'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { trpc } from '@/lib/trpc'

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

  const updateSidebar = trpc.userPreference.updateSidebar.useMutation({
    onSuccess: () => {
      onOpenChange(false)
    },
  })

  const handleSaveSidebar = () => {
    updateSidebar.mutate({
      employeeId,
      sidebarConfig: config,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <TabsTrigger value="theme" className="flex items-center gap-2" disabled>
              <Palette className="h-4 w-4" />
              佈景主題
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sidebar" className="mt-4">
            <SidebarSettings
              onSave={handleSaveSidebar}
              onCancel={() => onOpenChange(false)}
              isSaving={updateSidebar.isPending}
            />
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <p className="text-muted-foreground text-center py-8">
              佈景主題功能即將推出
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
