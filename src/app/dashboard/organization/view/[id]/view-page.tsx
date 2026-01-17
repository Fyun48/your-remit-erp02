'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Node,
  Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { OrgNode } from '@/components/org-chart-editor/nodes/OrgNode'
import { OrgEdge } from '@/components/org-chart-editor/edges/OrgEdge'
import { OrgNodeType, OrgNodeData } from '@/components/org-chart-editor/stores/use-org-chart-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Building2, Network } from 'lucide-react'

const nodeTypes = {
  orgNode: OrgNode,
}

const edgeTypes = {
  orgEdge: OrgEdge,
}

interface OrgChartViewPageProps {
  chart: {
    id: string
    name: string
    description: string | null
    type: 'GROUP' | 'COMPANY'
    groupId: string | null
    companyId: string | null
    groupName?: string
    companyName?: string
  }
  nodes: Array<{
    id: string
    nodeType: OrgNodeType
    referenceId?: string
    label?: string
    posX: number
    posY: number
  }>
  edges: Array<{
    id: string
    fromNodeId: string
    toNodeId: string
    relationType: 'SOLID' | 'DOTTED' | 'MATRIX'
    includeInApproval: boolean
  }>
}

function OrgChartViewInner({ chart, nodes, edges }: OrgChartViewPageProps) {
  // 轉換節點為 React Flow 格式
  const flowNodes: Node<OrgNodeData>[] = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: 'orgNode',
        position: { x: node.posX, y: node.posY },
        data: {
          nodeType: node.nodeType,
          referenceId: node.referenceId,
          label: node.label || '未命名',
        },
        draggable: false,
        selectable: false,
      })),
    [nodes]
  )

  // 轉換連線為 React Flow 格式
  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.fromNodeId,
        target: edge.toNodeId,
        type: 'orgEdge',
        data: {
          relationType: edge.relationType,
          includeInApproval: edge.includeInApproval,
        },
      })),
    [edges]
  )

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* 頂部導航 */}
      <div className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/organization">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5 text-blue-500" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold">{chart.name}</h1>
                <Badge variant={chart.type === 'GROUP' ? 'default' : 'secondary'}>
                  {chart.type === 'GROUP' ? '集團' : '公司'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {chart.type === 'GROUP' ? chart.groupName : chart.companyName}
                {chart.description && ` - ${chart.description}`}
              </p>
            </div>
          </div>
        </div>
        <Link href={`/dashboard/organization/editor/${chart.id}`}>
          <Button size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            編輯
          </Button>
        </Link>
      </div>

      {/* 統計資訊 */}
      <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">節點數量:</span>
          <span className="font-medium">{nodes.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Network className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">關係數量:</span>
          <span className="font-medium">{edges.length}</span>
        </div>
      </div>

      {/* 組織圖 */}
      <div className="flex-1">
        {nodes.length === 0 ? (
          <Card className="m-6">
            <div className="py-12 text-center">
              <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">此組織圖尚無節點</p>
              <Link href={`/dashboard/organization/editor/${chart.id}`}>
                <Button>
                  <Pencil className="h-4 w-4 mr-2" />
                  開始編輯
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
          >
            <Background gap={15} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => {
                const colors: Record<OrgNodeType, string> = {
                  DEPARTMENT: '#93c5fd',
                  POSITION: '#c4b5fd',
                  EMPLOYEE: '#86efac',
                  TEAM: '#5eead4',
                  DIVISION: '#a5b4fc',
                  COMMITTEE: '#fcd34d',
                  COMPANY: '#94a3b8',
                  EXTERNAL: '#fda4af',
                }
                return colors[node.data?.nodeType as OrgNodeType] || '#e5e7eb'
              }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export function OrgChartViewPage(props: OrgChartViewPageProps) {
  return (
    <ReactFlowProvider>
      <OrgChartViewInner {...props} />
    </ReactFlowProvider>
  )
}
