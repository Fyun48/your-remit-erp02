'use client'

import { useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { OrgNode } from './nodes/OrgNode'
import { OrgEdge } from './edges/OrgEdge'
import { NodeToolbox } from './panels/NodeToolbox'
import { PropertyPanel } from './panels/PropertyPanel'
import { useOrgChartStore, OrgNodeType } from './stores/use-org-chart-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Save, RotateCcw } from 'lucide-react'

const nodeTypes = {
  orgNode: OrgNode,
}

const edgeTypes = {
  orgEdge: OrgEdge,
}

interface OrgChartEditorProps {
  chartId?: string
  chartName?: string
  chartType?: 'GROUP' | 'COMPANY'
  groupId?: string | null
  companyId?: string | null
  initialNodes?: Array<{
    id: string
    nodeType: OrgNodeType
    referenceId?: string
    label?: string
    posX: number
    posY: number
  }>
  initialEdges?: Array<{
    id: string
    fromNodeId: string
    toNodeId: string
    relationType: 'SOLID' | 'DOTTED' | 'MATRIX'
    includeInApproval: boolean
  }>
  onSave?: (data: {
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
      relationType: 'SOLID' | 'DOTTED' | 'MATRIX'
      includeInApproval: boolean
    }>
  }) => void
  isSaving?: boolean
}

function OrgChartEditorInner({
  chartId,
  chartName = '新組織圖',
  chartType = 'COMPANY',
  groupId = null,
  companyId = null,
  initialNodes = [],
  initialEdges = [],
  onSave,
  isSaving = false,
}: OrgChartEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  const {
    nodes,
    edges,
    setChartInfo,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    setSelectedEdge,
    clearSelection,
    reset,
  } = useOrgChartStore()

  // 初始化
  useEffect(() => {
    setChartInfo({
      chartId: chartId || null,
      chartName,
      chartType,
      groupId,
      companyId,
    })

    // 轉換初始節點
    const flowNodes = initialNodes.map((node) => ({
      id: node.id,
      type: 'orgNode',
      position: { x: node.posX, y: node.posY },
      data: {
        nodeType: node.nodeType,
        referenceId: node.referenceId,
        label: node.label || '未命名',
      },
    }))

    // 轉換初始連線
    const flowEdges = initialEdges.map((edge) => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'orgEdge',
      data: {
        relationType: edge.relationType,
        includeInApproval: edge.includeInApproval,
      },
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)

    return () => {
      reset()
    }
  }, [chartId, chartName, chartType, groupId, companyId, initialNodes, initialEdges, setChartInfo, setNodes, setEdges, reset])

  // 拖放處理
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as OrgNodeType
      if (!type) return

      if (!reactFlowInstance.current || !reactFlowWrapper.current) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const id = `node-${Date.now()}`
      const labels = {
        DEPARTMENT: '新部門',
        POSITION: '新職位',
        EMPLOYEE: '新員工',
      }

      addNode({
        id,
        type: 'orgNode',
        position,
        data: {
          nodeType: type,
          label: labels[type],
        },
      })
    },
    [addNode]
  )

  // 節點點擊
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode]
  )

  // 連線點擊
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdge(edge.id)
    },
    [setSelectedEdge]
  )

  // 點擊空白處
  const onPaneClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  // 儲存
  const handleSave = () => {
    if (!onSave) return

    const saveData = {
      nodes: nodes.map((node) => ({
        id: node.id,
        nodeType: node.data.nodeType,
        referenceId: node.data.referenceId,
        label: node.data.label,
        posX: node.position.x,
        posY: node.position.y,
      })),
      edges: edges.map((edge) => ({
        fromNodeId: edge.source,
        toNodeId: edge.target,
        relationType: edge.data?.relationType || 'SOLID',
        includeInApproval: edge.data?.includeInApproval ?? true,
      })),
    }

    onSave(saveData)
  }

  return (
    <div className="flex h-full">
      {/* 左側工具列 */}
      <div className="w-48 border-r bg-background p-3 flex flex-col">
        <NodeToolbox />
      </div>

      {/* 中間畫布 */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        {/* 頂部工具列 */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-background/80 backdrop-blur px-3 py-1 rounded">
            {chartName}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                reset()
                setChartInfo({
                  chartId: chartId || null,
                  chartName,
                  chartType,
                  groupId,
                  companyId,
                })
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? '儲存中...' : '儲存'}
            </Button>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(instance) => {
            reactFlowInstance.current = instance
          }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: 'orgEdge',
          }}
        >
          <Background gap={15} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const colors = {
                DEPARTMENT: '#93c5fd',
                POSITION: '#c4b5fd',
                EMPLOYEE: '#86efac',
              }
              return colors[node.data?.nodeType as OrgNodeType] || '#e5e7eb'
            }}
          />
        </ReactFlow>
      </div>

      {/* 右側屬性面板 */}
      <Card className="w-64 border-l rounded-none">
        <PropertyPanel />
      </Card>
    </div>
  )
}

export function OrgChartEditor(props: OrgChartEditorProps) {
  return (
    <ReactFlowProvider>
      <OrgChartEditorInner {...props} />
    </ReactFlowProvider>
  )
}
