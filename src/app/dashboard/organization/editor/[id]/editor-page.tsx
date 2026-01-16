'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { OrgChartEditor } from '@/components/org-chart-editor'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { OrgNodeType, OrgRelationType } from '@/components/org-chart-editor'

interface OrgChartEditorPageProps {
  chart: {
    id: string
    name: string
    type: 'GROUP' | 'COMPANY'
    groupId: string | null
    companyId: string | null
  }
  initialNodes: Array<{
    id: string
    nodeType: OrgNodeType
    referenceId?: string
    label?: string
    posX: number
    posY: number
  }>
  initialEdges: Array<{
    id: string
    fromNodeId: string
    toNodeId: string
    relationType: OrgRelationType
    includeInApproval: boolean
  }>
}

export function OrgChartEditorPage({
  chart,
  initialNodes,
  initialEdges,
}: OrgChartEditorPageProps) {
  const router = useRouter()

  // 儲存節點位置
  const updatePositions = trpc.orgChart.updateNodePositions.useMutation()

  // 儲存整個組織圖需要先刪除再重建
  const addNode = trpc.orgChart.addNode.useMutation()
  const addRelation = trpc.orgChart.addRelation.useMutation()

  const handleSave = async (data: {
    nodes: Array<{
      id: string
      nodeType: OrgNodeType
      referenceId?: string
      label: string
      posX: number
      posY: number
    }>
    edges: Array<{
      fromNodeId: string
      toNodeId: string
      relationType: OrgRelationType
      includeInApproval: boolean
    }>
  }) => {
    try {
      // 簡化版：只更新節點位置
      // 完整版需要實作差異比對，這裡先用位置更新
      const positionUpdates = data.nodes
        .filter((node) => !node.id.startsWith('node-')) // 只更新已存在的節點
        .map((node) => ({
          id: node.id,
          posX: node.posX,
          posY: node.posY,
        }))

      if (positionUpdates.length > 0) {
        await updatePositions.mutateAsync(positionUpdates)
      }

      // 新增節點
      const newNodes = data.nodes.filter((node) => node.id.startsWith('node-'))
      for (const node of newNodes) {
        await addNode.mutateAsync({
          chartId: chart.id,
          nodeType: node.nodeType,
          referenceId: node.referenceId,
          label: node.label,
          posX: node.posX,
          posY: node.posY,
        })
      }

      alert('儲存成功')
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      alert('儲存失敗')
    }
  }

  const isSaving =
    updatePositions.isPending || addNode.isPending || addRelation.isPending

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* 頂部導航 */}
      <div className="border-b bg-background px-4 py-2 flex items-center gap-4">
        <Link href="/dashboard/organization">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold">{chart.name}</h1>
          <p className="text-xs text-muted-foreground">
            {chart.type === 'GROUP' ? '集團組織圖' : '公司組織圖'}
          </p>
        </div>
      </div>

      {/* 編輯器 */}
      <div className="flex-1">
        <OrgChartEditor
          chartId={chart.id}
          chartName={chart.name}
          chartType={chart.type}
          groupId={chart.groupId}
          companyId={chart.companyId}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  )
}
