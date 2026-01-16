'use client'

import { useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  ReactFlowInstance,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { StartNode } from './nodes/StartNode'
import { EndNode } from './nodes/EndNode'
import { ApprovalNode } from './nodes/ApprovalNode'
import { ConditionNode } from './nodes/ConditionNode'
import { ParallelStartNode } from './nodes/ParallelStartNode'
import { ParallelJoinNode } from './nodes/ParallelJoinNode'
import { WorkflowEdge } from './edges/WorkflowEdge'
import { WorkflowToolbox } from './panels/WorkflowToolbox'
import { WorkflowPropertyPanel } from './panels/WorkflowPropertyPanel'
import { useWorkflowStore, WorkflowNodeType, WorkflowNodeData, WorkflowEdgeData } from './stores/use-workflow-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Save, RotateCcw } from 'lucide-react'
import { Node, Edge } from 'reactflow'

const nodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  approvalNode: ApprovalNode,
  conditionNode: ConditionNode,
  parallelstartNode: ParallelStartNode,
  paralleljoinNode: ParallelJoinNode,
}

const edgeTypes = {
  workflowEdge: WorkflowEdge,
}

const nodeTypeToComponent: Record<WorkflowNodeType, string> = {
  START: 'startNode',
  END: 'endNode',
  APPROVAL: 'approvalNode',
  CONDITION: 'conditionNode',
  PARALLEL_START: 'parallelstartNode',
  PARALLEL_JOIN: 'paralleljoinNode',
}

interface WorkflowEditorProps {
  definitionId?: string
  definitionName?: string
  scopeType?: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
  companyId?: string | null
  groupId?: string | null
  employeeId?: string | null
  requestType?: string | null
  initialNodes?: Array<{
    id: string
    nodeType: WorkflowNodeType
    name?: string | null
    approverType?: string | null
    approverId?: string | null
    orgRelation?: string | null
    orgLevelUp?: number | null
    customFieldName?: string | null
    parallelMode?: string | null
    posX: number
    posY: number
  }>
  initialEdges?: Array<{
    id: string
    fromNodeId: string
    toNodeId: string
    conditionField?: string | null
    conditionOperator?: string | null
    conditionValue?: string | null
    isDefault: boolean
    sortOrder: number
  }>
  onSave?: (data: {
    nodes: Array<{
      id: string
      nodeType: WorkflowNodeType
      name?: string
      approverType?: string
      approverId?: string
      orgRelation?: string
      orgLevelUp?: number
      customFieldName?: string
      parallelMode?: string
      posX: number
      posY: number
    }>
    edges: Array<{
      fromNodeId: string
      toNodeId: string
      conditionField?: string
      conditionOperator?: string
      conditionValue?: string
      isDefault: boolean
      sortOrder: number
    }>
  }) => void
  isSaving?: boolean
}

function WorkflowEditorInner({
  definitionId,
  definitionName = '新流程',
  scopeType = 'DEFAULT',
  companyId = null,
  groupId = null,
  employeeId = null,
  requestType = null,
  initialNodes = [],
  initialEdges = [],
  onSave,
  isSaving = false,
}: WorkflowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  const {
    nodes,
    edges,
    setDefinitionInfo,
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
  } = useWorkflowStore()

  // 初始化
  useEffect(() => {
    setDefinitionInfo({
      definitionId: definitionId || null,
      definitionName,
      scopeType,
      companyId,
      groupId,
      employeeId,
      requestType,
    })

    // 轉換初始節點
    const flowNodes: Node<WorkflowNodeData>[] = initialNodes.map((node) => ({
      id: node.id,
      type: nodeTypeToComponent[node.nodeType],
      position: { x: node.posX, y: node.posY },
      data: {
        nodeType: node.nodeType,
        name: node.name || undefined,
        approverType: node.approverType as WorkflowNodeData['approverType'],
        approverId: node.approverId || undefined,
        orgRelation: node.orgRelation as WorkflowNodeData['orgRelation'],
        orgLevelUp: node.orgLevelUp || undefined,
        customFieldName: node.customFieldName || undefined,
        parallelMode: node.parallelMode as WorkflowNodeData['parallelMode'],
      },
    }))

    // 轉換初始連線
    const flowEdges: Edge<WorkflowEdgeData>[] = initialEdges.map((edge) => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'workflowEdge',
      data: {
        conditionField: edge.conditionField || undefined,
        conditionOperator: edge.conditionOperator as WorkflowEdgeData['conditionOperator'],
        conditionValue: edge.conditionValue || undefined,
        isDefault: edge.isDefault,
        sortOrder: edge.sortOrder,
      },
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)

    return () => {
      reset()
    }
  }, [definitionId, definitionName, scopeType, companyId, groupId, employeeId, requestType, initialNodes, initialEdges, setDefinitionInfo, setNodes, setEdges, reset])

  // 拖放處理
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType
      if (!type) return

      if (!reactFlowInstance.current || !reactFlowWrapper.current) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const id = `node-${Date.now()}`
      const componentType = nodeTypeToComponent[type]

      addNode({
        id,
        type: componentType,
        position,
        data: {
          nodeType: type,
          name: type === 'START' ? '開始' : type === 'END' ? '結束' : undefined,
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
        name: node.data.name,
        approverType: node.data.approverType,
        approverId: node.data.approverId,
        orgRelation: node.data.orgRelation,
        orgLevelUp: node.data.orgLevelUp,
        customFieldName: node.data.customFieldName,
        parallelMode: node.data.parallelMode,
        posX: node.position.x,
        posY: node.position.y,
      })),
      edges: edges.map((edge, index) => ({
        fromNodeId: edge.source,
        toNodeId: edge.target,
        conditionField: edge.data?.conditionField,
        conditionOperator: edge.data?.conditionOperator,
        conditionValue: edge.data?.conditionValue,
        isDefault: edge.data?.isDefault ?? false,
        sortOrder: edge.data?.sortOrder ?? index,
      })),
    }

    onSave(saveData)
  }

  return (
    <div className="flex h-full">
      {/* 左側工具列 */}
      <div className="w-52 border-r bg-background p-3 flex flex-col">
        <WorkflowToolbox />
      </div>

      {/* 中間畫布 */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        {/* 頂部工具列 */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-background/80 backdrop-blur px-3 py-1 rounded">
            {definitionName}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                reset()
                setDefinitionInfo({
                  definitionId: definitionId || null,
                  definitionName,
                  scopeType,
                  companyId,
                  groupId,
                  employeeId,
                  requestType,
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
            type: 'workflowEdge',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
          }}
        >
          <Background gap={15} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                startNode: '#86efac',
                endNode: '#fca5a5',
                approvalNode: '#93c5fd',
                conditionNode: '#fcd34d',
                parallelstartNode: '#c4b5fd',
                paralleljoinNode: '#c4b5fd',
              }
              return colors[node.type || ''] || '#e5e7eb'
            }}
          />
          {/* 箭頭定義 */}
          <svg>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>
      </div>

      {/* 右側屬性面板 */}
      <Card className="w-72 border-l rounded-none">
        <WorkflowPropertyPanel />
      </Card>
    </div>
  )
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  )
}
