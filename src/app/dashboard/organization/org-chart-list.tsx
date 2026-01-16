'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Network, Plus, Pencil, Eye, Building2, Users } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface OrgChart {
  id: string
  name: string
  description: string | null
  type: 'GROUP' | 'COMPANY'
  group: { id: string; name: string } | null
  company: { id: string; name: string } | null
  _count: { nodes: number; relations: number }
  updatedAt: Date
}

interface OrgChartListProps {
  companyId: string
  companyName: string
  orgCharts: OrgChart[]
}

export function OrgChartList({ companyId, companyName, orgCharts }: OrgChartListProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createData, setCreateData] = useState({
    name: '',
    description: '',
    type: 'COMPANY' as 'GROUP' | 'COMPANY',
  })

  const createChart = trpc.orgChart.create.useMutation({
    onSuccess: (data) => {
      setIsCreateOpen(false)
      setCreateData({ name: '', description: '', type: 'COMPANY' })
      router.push(`/dashboard/organization/editor/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = () => {
    if (!createData.name.trim()) {
      alert('請輸入組織圖名稱')
      return
    }

    createChart.mutate({
      name: createData.name,
      description: createData.description || undefined,
      type: createData.type,
      companyId: createData.type === 'COMPANY' ? companyId : undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">組織圖管理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增組織圖
        </Button>
      </div>

      {orgCharts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">尚無組織圖，點擊上方按鈕建立</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgCharts.map((chart) => (
            <Card key={chart.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">{chart.name}</CardTitle>
                  </div>
                  <Badge variant={chart.type === 'GROUP' ? 'default' : 'secondary'}>
                    {chart.type === 'GROUP' ? '集團' : '公司'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {chart.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {chart.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    <span>{chart._count.nodes} 節點</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{chart._count.relations} 關係</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href={`/dashboard/organization/view/${chart.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-1" />
                      檢視
                    </Button>
                  </Link>
                  <Link href={`/dashboard/organization/editor/${chart.id}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <Pencil className="h-4 w-4 mr-1" />
                      編輯
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增組織圖 Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增組織圖</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>組織圖類型</Label>
              <Select
                value={createData.type}
                onValueChange={(value) =>
                  setCreateData({ ...createData, type: value as 'GROUP' | 'COMPANY' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">公司組織圖</SelectItem>
                  <SelectItem value="GROUP">集團組織圖</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chart-name">名稱 *</Label>
              <Input
                id="chart-name"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder="例：2026 年組織架構"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chart-desc">說明</Label>
              <Input
                id="chart-desc"
                value={createData.description}
                onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                placeholder="選填"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createChart.isPending}>
                {createChart.isPending ? '建立中...' : '建立並編輯'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
