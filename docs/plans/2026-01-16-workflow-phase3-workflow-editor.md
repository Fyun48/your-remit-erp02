# Phase 3: 流程定義可視化編輯器 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立可拖曳的工作流程（簽核流程）視覺編輯器，支援開始/結束、審批、條件判斷、並行簽核等節點類型

**Architecture:** 基於 Phase 2 的 React Flow 經驗，建立流程專用的自訂節點和連線元件。使用 Zustand 管理編輯器狀態，整合 tRPC workflow router 進行資料存取。

**Tech Stack:** React Flow, Zustand, tRPC, Tailwind CSS

---

## Task 1: 建立流程編輯器的狀態管理 Store

**Files:**
- Create: `src/components/workflow-editor/stores/use-workflow-store.ts`

**Step 1: 建立 store 檔案**

```typescript
'use client'

import { create } from 'zustand'
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow'

export type WorkflowNodeType = 'START' | 'APPROVAL' | 'CONDITION' | 'PARALLEL_START' | 'PARALLEL_JOIN' | 'END'
export type ApproverType = 'SPECIFIC_EMPLOYEE' | 'POSITION' | 'ROLE' | 'ORG_RELATION' | 'DEPARTMENT_HEAD' | 'CUSTOM_FIELD'
export type OrgRelation = 'DIRECT_SUPERVISOR' | 'DOTTED_SUPERVISOR' | 'N_LEVEL_UP' | 'DEPARTMENT_MANAGER' | 'COMPANY_HEAD'
export type ParallelMode = 'ALL' | 'ANY' | 'MAJORITY'
export type ConditionOperator = 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'GREATER_OR_EQUAL' | 'LESS_OR_EQUAL' | 'CONTAINS' | 'IN' | 'NOT_IN'

export interface WorkflowNodeData {
  nodeType: WorkflowNodeType
  name?: string
  // 審批節點設定
  approverType?: ApproverType
  approverId?: string
  approverName?: string // 用於顯示
  orgRelation?: OrgRelation
  orgLevelUp?: number
  customFieldName?: string
  // 並行節點設定
  parallelMode?: ParallelMode
}

export interface WorkflowEdgeData {
  // 條件設定
  conditionField?: string
  conditionOperator?: ConditionOperator
  conditionValue?: string
  isDefault?: boolean
  sortOrder?: number
  label?: string // 用於顯示
}

interface WorkflowState {
  // 基本資訊
  definitionId: string | null
  definitionName: string
  scopeType: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
  companyId: string | null
  groupId: string | null
  employeeId: string | null
  requestType: string | null

  // React Flow 狀態
  nodes: Node<WorkflowNodeData>[]
  edges: Edge<WorkflowEdgeData>[]

  // 選取狀態
  selectedNodeId: string | null
  selectedEdgeId: string | null

  // 操作
  setDefinitionInfo: (info: {
    definitionId: string | null
    definitionName: string
    scopeType: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
    companyId: string | null
    groupId: string | null
    employeeId: string | null
    requestType: string | null
  }) => void
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void
  setEdges: (edges: Edge<WorkflowEdgeData>[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: Node<WorkflowNodeData>) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  updateEdgeData: (edgeId: string, data: Partial<WorkflowEdgeData>) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edgeId: string) => void
  setSelectedNode: (nodeId: string | null) => void
  setSelectedEdge: (edgeId: string | null) => void
  clearSelection: () => void
  reset: () => void
}

const initialState = {
  definitionId: null,
  definitionName: '',
  scopeType: 'DEFAULT' as const,
  companyId: null,
  groupId: null,
  employeeId: null,
  requestType: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  setDefinitionInfo: (info) => set(info),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    })
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },

  onConnect: (connection) => {
    const newEdge: Edge<WorkflowEdgeData> = {
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'workflowEdge',
      data: {
        isDefault: false,
        sortOrder: 0,
      },
    } as Edge<WorkflowEdgeData>

    set({
      edges: addEdge(newEdge, get().edges),
    })
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    })
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })
  },

  updateEdgeData: (edgeId, data) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, ...data } as WorkflowEdgeData }
          : edge
      ) as Edge<WorkflowEdgeData>[],
    })
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    })
  },

  deleteEdge: (edgeId) => {
    set({
      edges: get().edges.filter((edge) => edge.id !== edgeId),
      selectedEdgeId: get().selectedEdgeId === edgeId ? null : get().selectedEdgeId,
    })
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedEdgeId: null })
  },

  setSelectedEdge: (edgeId) => {
    set({ selectedEdgeId: edgeId, selectedNodeId: null })
  },

  clearSelection: () => {
    set({ selectedNodeId: null, selectedEdgeId: null })
  },

  reset: () => set(initialState),
}))
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/stores/use-workflow-store.ts
git commit -m "feat: add workflow editor zustand store"
```

---

## Task 2: 建立開始與結束節點元件

**Files:**
- Create: `src/components/workflow-editor/nodes/StartNode.tsx`
- Create: `src/components/workflow-editor/nodes/EndNode.tsx`

**Step 1: 建立 StartNode 元件**

```typescript
'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function StartNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'w-16 h-16 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center shadow-sm',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      <Play className="w-6 h-6 text-green-600 ml-1" />

      {/* 下方連接點 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  )
}

export const StartNode = memo(StartNodeComponent)
```

**Step 2: 建立 EndNode 元件**

```typescript
'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function EndNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'w-16 h-16 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center shadow-sm',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      <Square className="w-5 h-5 text-red-600 fill-red-600" />

      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-red-500 border-2 border-white"
      />
    </div>
  )
}

export const EndNode = memo(EndNodeComponent)
```

**Step 3: Commit**

```bash
git add src/components/workflow-editor/nodes/StartNode.tsx src/components/workflow-editor/nodes/EndNode.tsx
git commit -m "feat: add start and end workflow nodes"
```

---

## Task 3: 建立審批節點元件

**Files:**
- Create: `src/components/workflow-editor/nodes/ApprovalNode.tsx`

**Step 1: 建立 ApprovalNode 元件**

```typescript
'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { UserCheck, User, Briefcase, Shield, Network, Building2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData, ApproverType } from '../stores/use-workflow-store'

const approverIcons: Record<ApproverType, typeof User> = {
  SPECIFIC_EMPLOYEE: User,
  POSITION: Briefcase,
  ROLE: Shield,
  ORG_RELATION: Network,
  DEPARTMENT_HEAD: Building2,
  CUSTOM_FIELD: FileText,
}

const approverLabels: Record<ApproverType, string> = {
  SPECIFIC_EMPLOYEE: '指定員工',
  POSITION: '指定職位',
  ROLE: '指定角色',
  ORG_RELATION: '組織關係',
  DEPARTMENT_HEAD: '部門主管',
  CUSTOM_FIELD: '自訂欄位',
}

function ApprovalNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const Icon = data.approverType ? approverIcons[data.approverType] : UserCheck
  const approverLabel = data.approverType ? approverLabels[data.approverType] : '審批'

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg bg-blue-50 border-2 border-blue-400 shadow-sm min-w-[140px]',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-blue-100">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {data.name || '審批節點'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {data.approverName || approverLabel}
          </p>
        </div>
      </div>

      {/* 下方連接點 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  )
}

export const ApprovalNode = memo(ApprovalNodeComponent)
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/nodes/ApprovalNode.tsx
git commit -m "feat: add approval workflow node"
```

---

## Task 4: 建立條件判斷節點元件

**Files:**
- Create: `src/components/workflow-editor/nodes/ConditionNode.tsx`

**Step 1: 建立 ConditionNode 元件**

```typescript
'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function ConditionNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'w-24 h-24 rotate-45 bg-amber-50 border-2 border-amber-500 flex items-center justify-center shadow-sm',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      <div className="-rotate-45 flex flex-col items-center">
        <GitBranch className="w-5 h-5 text-amber-600" />
        <p className="text-xs font-medium mt-1 text-amber-700 max-w-[60px] truncate text-center">
          {data.name || '條件'}
        </p>
      </div>

      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-amber-500 border-2 border-white -rotate-45"
        style={{ top: -6, left: '50%', transform: 'translateX(-50%) rotate(-45deg)' }}
      />

      {/* 左側連接點 (否) */}
      <Handle
        type="source"
        position={Position.Left}
        id="no"
        className="w-3 h-3 bg-red-400 border-2 border-white -rotate-45"
        style={{ left: -6, top: '50%', transform: 'translateY(-50%) rotate(-45deg)' }}
      />

      {/* 右側連接點 (是) */}
      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        className="w-3 h-3 bg-green-400 border-2 border-white -rotate-45"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%) rotate(-45deg)' }}
      />

      {/* 下方連接點 (預設) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="w-3 h-3 bg-gray-400 border-2 border-white -rotate-45"
        style={{ bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(-45deg)' }}
      />
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent)
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/nodes/ConditionNode.tsx
git commit -m "feat: add condition workflow node"
```

---

## Task 5: 建立並行節點元件

**Files:**
- Create: `src/components/workflow-editor/nodes/ParallelStartNode.tsx`
- Create: `src/components/workflow-editor/nodes/ParallelJoinNode.tsx`

**Step 1: 建立 ParallelStartNode 元件**

```typescript
'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Split } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData, ParallelMode } from '../stores/use-workflow-store'

const modeLabels: Record<ParallelMode, string> = {
  ALL: '全部通過',
  ANY: '任一通過',
  MAJORITY: '多數通過',
}

function ParallelStartNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'px-4 py-2 rounded bg-purple-50 border-2 border-purple-400 shadow-sm min-w-[120px]',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />

      <div className="flex items-center gap-2">
        <Split className="w-4 h-4 text-purple-600" />
        <div>
          <p className="font-medium text-sm">並行開始</p>
          <p className="text-xs text-muted-foreground">
            {data.parallelMode ? modeLabels[data.parallelMode] : '全部通過'}
          </p>
        </div>
      </div>

      {/* 下方連接點 - 多個 */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-1"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-2"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
        style={{ left: '70%' }}
      />
    </div>
  )
}

export const ParallelStartNode = memo(ParallelStartNodeComponent)
```

**Step 2: 建立 ParallelJoinNode 元件**

```typescript
'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Merge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function ParallelJoinNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'px-4 py-2 rounded bg-purple-50 border-2 border-purple-400 shadow-sm min-w-[120px]',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      {/* 上方連接點 - 多個 */}
      <Handle
        type="target"
        position={Position.Top}
        id="in-1"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
        style={{ left: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="in-2"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
        style={{ left: '70%' }}
      />

      <div className="flex items-center gap-2">
        <Merge className="w-4 h-4 text-purple-600" />
        <p className="font-medium text-sm">並行匯合</p>
      </div>

      {/* 下方連接點 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
    </div>
  )
}

export const ParallelJoinNode = memo(ParallelJoinNodeComponent)
```

**Step 3: Commit**

```bash
git add src/components/workflow-editor/nodes/ParallelStartNode.tsx src/components/workflow-editor/nodes/ParallelJoinNode.tsx
git commit -m "feat: add parallel start and join workflow nodes"
```

---

## Task 6: 建立自訂連線元件

**Files:**
- Create: `src/components/workflow-editor/edges/WorkflowEdge.tsx`

**Step 1: 建立 WorkflowEdge 元件**

```typescript
'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
} from 'reactflow'
import { cn } from '@/lib/utils'
import { WorkflowEdgeData, ConditionOperator } from '../stores/use-workflow-store'

const operatorLabels: Record<ConditionOperator, string> = {
  EQUALS: '=',
  NOT_EQUALS: '≠',
  GREATER_THAN: '>',
  LESS_THAN: '<',
  GREATER_OR_EQUAL: '≥',
  LESS_OR_EQUAL: '≤',
  CONTAINS: '包含',
  IN: '在列表中',
  NOT_IN: '不在列表中',
}

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<WorkflowEdgeData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  })

  // 產生標籤文字
  let label = data?.label || ''
  if (!label && data?.conditionField && data?.conditionOperator) {
    const op = operatorLabels[data.conditionOperator]
    label = `${data.conditionField} ${op} ${data.conditionValue || ''}`
  }
  if (data?.isDefault) {
    label = label ? `${label} (預設)` : '預設'
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3b82f6' : data?.isDefault ? '#9ca3af' : '#64748b',
          strokeWidth: 2,
          strokeDasharray: data?.isDefault ? '5,5' : 'none',
        }}
        markerEnd="url(#arrow)"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={cn(
                'px-2 py-1 rounded text-xs font-medium bg-white border shadow-sm max-w-[150px] truncate',
                selected && 'ring-2 ring-blue-500',
                data?.isDefault && 'border-dashed'
              )}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/edges/WorkflowEdge.tsx
git commit -m "feat: add workflow edge component with condition labels"
```

---

## Task 7: 建立節點工具列元件

**Files:**
- Create: `src/components/workflow-editor/panels/WorkflowToolbox.tsx`

**Step 1: 建立 WorkflowToolbox 元件**

```typescript
'use client'

import { Play, Square, UserCheck, GitBranch, Split, Merge } from 'lucide-react'
import { WorkflowNodeType, useWorkflowStore } from '../stores/use-workflow-store'

interface NodeTypeConfig {
  type: WorkflowNodeType
  label: string
  icon: typeof Play
  color: string
  description: string
}

const nodeTypes: NodeTypeConfig[] = [
  {
    type: 'START',
    label: '開始',
    icon: Play,
    color: 'bg-green-100 text-green-600 border-green-300',
    description: '流程起點'
  },
  {
    type: 'APPROVAL',
    label: '審批',
    icon: UserCheck,
    color: 'bg-blue-100 text-blue-600 border-blue-300',
    description: '需審核的關卡'
  },
  {
    type: 'CONDITION',
    label: '條件',
    icon: GitBranch,
    color: 'bg-amber-100 text-amber-600 border-amber-300',
    description: '分支判斷'
  },
  {
    type: 'PARALLEL_START',
    label: '並行開始',
    icon: Split,
    color: 'bg-purple-100 text-purple-600 border-purple-300',
    description: '同時發送多人'
  },
  {
    type: 'PARALLEL_JOIN',
    label: '並行匯合',
    icon: Merge,
    color: 'bg-purple-100 text-purple-600 border-purple-300',
    description: '等待並行完成'
  },
  {
    type: 'END',
    label: '結束',
    icon: Square,
    color: 'bg-red-100 text-red-600 border-red-300',
    description: '流程結束'
  },
]

export function WorkflowToolbox() {
  const addNode = useWorkflowStore((state) => state.addNode)

  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleAddNode = (nodeType: WorkflowNodeType) => {
    const id = `node-${Date.now()}`
    const config = nodeTypes.find(n => n.type === nodeType)

    addNode({
      id,
      type: nodeType.toLowerCase().replace('_', '') + 'Node',
      position: { x: 250, y: 100 + Math.random() * 200 },
      data: {
        nodeType,
        name: config?.label || nodeType,
      },
    })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground px-2">節點工具</h3>
      <div className="space-y-1">
        {nodeTypes.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            onClick={() => handleAddNode(item.type)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab
              hover:shadow-md transition-shadow ${item.color}
            `}
          >
            <item.icon className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium block">{item.label}</span>
              <span className="text-xs opacity-70 block truncate">{item.description}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground px-2 pt-2">
        拖曳或點擊新增節點
      </p>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/panels/WorkflowToolbox.tsx
git commit -m "feat: add workflow toolbox panel"
```

---

## Task 8: 建立屬性面板元件 - 節點屬性

**Files:**
- Create: `src/components/workflow-editor/panels/WorkflowPropertyPanel.tsx`

**Step 1: 建立 WorkflowPropertyPanel 元件**

```typescript
'use client'

import {
  useWorkflowStore,
  ApproverType,
  OrgRelation,
  ParallelMode,
  ConditionOperator
} from '../stores/use-workflow-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'

const approverTypeLabels: Record<ApproverType, string> = {
  SPECIFIC_EMPLOYEE: '指定員工',
  POSITION: '指定職位',
  ROLE: '指定角色',
  ORG_RELATION: '組織關係',
  DEPARTMENT_HEAD: '部門主管',
  CUSTOM_FIELD: '自訂欄位',
}

const orgRelationLabels: Record<OrgRelation, string> = {
  DIRECT_SUPERVISOR: '直屬主管',
  DOTTED_SUPERVISOR: '虛線主管',
  N_LEVEL_UP: '往上 N 層',
  DEPARTMENT_MANAGER: '部門最高主管',
  COMPANY_HEAD: '公司負責人',
}

const parallelModeLabels: Record<ParallelMode, string> = {
  ALL: '全部通過',
  ANY: '任一通過',
  MAJORITY: '多數通過',
}

const conditionOperatorLabels: Record<ConditionOperator, string> = {
  EQUALS: '等於 (=)',
  NOT_EQUALS: '不等於 (≠)',
  GREATER_THAN: '大於 (>)',
  LESS_THAN: '小於 (<)',
  GREATER_OR_EQUAL: '大於等於 (≥)',
  LESS_OR_EQUAL: '小於等於 (≤)',
  CONTAINS: '包含',
  IN: '在列表中',
  NOT_IN: '不在列表中',
}

const conditionFieldOptions = [
  { value: 'AMOUNT', label: '申請金額' },
  { value: 'REQUEST_TYPE', label: '申請類型' },
  { value: 'SUB_TYPE', label: '子類型' },
  { value: 'APPLICANT_DEPARTMENT', label: '申請人部門' },
  { value: 'APPLICANT_POSITION', label: '申請人職位' },
  { value: 'APPLICANT_LEVEL', label: '申請人職級' },
  { value: 'CUSTOM_FIELD', label: '自訂欄位' },
]

export function WorkflowPropertyPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    updateEdgeData,
    deleteNode,
    deleteEdge,
  } = useWorkflowStore()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">選取節點或連線以編輯屬性</p>
      </div>
    )
  }

  // 節點屬性面板
  if (selectedNode) {
    const { nodeType } = selectedNode.data

    return (
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">節點屬性</h3>
          {nodeType !== 'START' && nodeType !== 'END' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => deleteNode(selectedNode.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {/* 節點名稱 */}
          <div className="space-y-1.5">
            <Label htmlFor="node-name">名稱</Label>
            <Input
              id="node-name"
              value={selectedNode.data.name || ''}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { name: e.target.value })
              }
              placeholder="節點名稱"
            />
          </div>

          {/* 審批節點設定 */}
          {nodeType === 'APPROVAL' && (
            <>
              <div className="space-y-1.5">
                <Label>審批人類型</Label>
                <Select
                  value={selectedNode.data.approverType || ''}
                  onValueChange={(value) =>
                    updateNodeData(selectedNode.id, { approverType: value as ApproverType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇審批人類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(approverTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 組織關係選項 */}
              {selectedNode.data.approverType === 'ORG_RELATION' && (
                <>
                  <div className="space-y-1.5">
                    <Label>組織關係</Label>
                    <Select
                      value={selectedNode.data.orgRelation || ''}
                      onValueChange={(value) =>
                        updateNodeData(selectedNode.id, { orgRelation: value as OrgRelation })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇關係" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(orgRelationLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedNode.data.orgRelation === 'N_LEVEL_UP' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="org-level">往上層數</Label>
                      <Input
                        id="org-level"
                        type="number"
                        min={1}
                        max={10}
                        value={selectedNode.data.orgLevelUp || 1}
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, { orgLevelUp: parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                  )}
                </>
              )}

              {/* 自訂欄位名稱 */}
              {selectedNode.data.approverType === 'CUSTOM_FIELD' && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-field">欄位名稱</Label>
                  <Input
                    id="custom-field"
                    value={selectedNode.data.customFieldName || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { customFieldName: e.target.value })
                    }
                    placeholder="例：projectManager"
                  />
                </div>
              )}

              {/* 指定員工 ID (簡化版，實際需要員工選擇器) */}
              {selectedNode.data.approverType === 'SPECIFIC_EMPLOYEE' && (
                <div className="space-y-1.5">
                  <Label htmlFor="approver-id">員工 ID</Label>
                  <Input
                    id="approver-id"
                    value={selectedNode.data.approverId || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { approverId: e.target.value })
                    }
                    placeholder="員工 ID"
                  />
                </div>
              )}
            </>
          )}

          {/* 並行節點設定 */}
          {nodeType === 'PARALLEL_START' && (
            <div className="space-y-1.5">
              <Label>通過模式</Label>
              <Select
                value={selectedNode.data.parallelMode || 'ALL'}
                onValueChange={(value) =>
                  updateNodeData(selectedNode.id, { parallelMode: value as ParallelMode })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(parallelModeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 節點類型顯示 */}
          <div className="space-y-1.5">
            <Label>節點類型</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {nodeType === 'START' && '開始節點'}
              {nodeType === 'END' && '結束節點'}
              {nodeType === 'APPROVAL' && '審批節點'}
              {nodeType === 'CONDITION' && '條件節點'}
              {nodeType === 'PARALLEL_START' && '並行開始'}
              {nodeType === 'PARALLEL_JOIN' && '並行匯合'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 連線屬性面板
  if (selectedEdge) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">連線屬性</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => deleteEdge(selectedEdge.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {/* 標籤 */}
          <div className="space-y-1.5">
            <Label htmlFor="edge-label">標籤</Label>
            <Input
              id="edge-label"
              value={selectedEdge.data?.label || ''}
              onChange={(e) =>
                updateEdgeData(selectedEdge.id, { label: e.target.value })
              }
              placeholder="選填"
            />
          </div>

          {/* 條件欄位 */}
          <div className="space-y-1.5">
            <Label>條件欄位</Label>
            <Select
              value={selectedEdge.data?.conditionField || ''}
              onValueChange={(value) =>
                updateEdgeData(selectedEdge.id, { conditionField: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇欄位 (選填)" />
              </SelectTrigger>
              <SelectContent>
                {conditionFieldOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 條件運算子 */}
          {selectedEdge.data?.conditionField && (
            <>
              <div className="space-y-1.5">
                <Label>運算子</Label>
                <Select
                  value={selectedEdge.data?.conditionOperator || ''}
                  onValueChange={(value) =>
                    updateEdgeData(selectedEdge.id, { conditionOperator: value as ConditionOperator })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇運算子" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(conditionOperatorLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="condition-value">比較值</Label>
                <Input
                  id="condition-value"
                  value={selectedEdge.data?.conditionValue || ''}
                  onChange={(e) =>
                    updateEdgeData(selectedEdge.id, { conditionValue: e.target.value })
                  }
                  placeholder="例：5000"
                />
              </div>
            </>
          )}

          {/* 預設路徑 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is-default">預設路徑</Label>
            <Switch
              id="is-default"
              checked={selectedEdge.data?.isDefault ?? false}
              onCheckedChange={(checked) =>
                updateEdgeData(selectedEdge.id, { isDefault: checked })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return null
}
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/panels/WorkflowPropertyPanel.tsx
git commit -m "feat: add workflow property panel with node and edge settings"
```

---

## Task 9: 建立主編輯器元件

**Files:**
- Create: `src/components/workflow-editor/WorkflowEditor.tsx`

**Step 1: 建立 WorkflowEditor 元件**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/WorkflowEditor.tsx
git commit -m "feat: add main workflow editor component"
```

---

## Task 10: 建立元件 index 匯出檔

**Files:**
- Create: `src/components/workflow-editor/index.ts`

**Step 1: 建立 index.ts**

```typescript
export { WorkflowEditor } from './WorkflowEditor'
export { useWorkflowStore } from './stores/use-workflow-store'
export type {
  WorkflowNodeData,
  WorkflowEdgeData,
  WorkflowNodeType,
  ApproverType,
  OrgRelation,
  ParallelMode,
  ConditionOperator,
} from './stores/use-workflow-store'
```

**Step 2: Commit**

```bash
git add src/components/workflow-editor/index.ts
git commit -m "feat: add workflow editor exports"
```

---

## Task 11: 建立流程列表頁面

**Files:**
- Create: `src/app/dashboard/workflow/page.tsx`

**Step 1: 建立列表頁面**

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentCompany } from '@/lib/use-current-company'
import { WorkflowList } from './workflow-list'

export default async function WorkflowPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentCompany = await getCurrentCompany(session.user.id)
  if (!currentCompany) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">流程管理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  const workflows = await prisma.workflowDefinition.findMany({
    where: {
      OR: [
        { companyId: currentCompany.id },
        { groupId: currentCompany.groupId },
      ],
    },
    include: {
      company: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true, employeeNo: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { nodes: true, instances: true } },
    },
    orderBy: [{ scopeType: 'asc' }, { updatedAt: 'desc' }],
  })

  return (
    <WorkflowList
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      userId={session.user.id}
      workflows={workflows}
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/workflow/page.tsx
git commit -m "feat: add workflow list page"
```

---

## Task 12: 建立流程列表客戶端元件

**Files:**
- Create: `src/app/dashboard/workflow/workflow-list.tsx`

**Step 1: 建立列表元件**

```typescript
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
import { Workflow, Plus, Pencil, Eye, GitBranch, Users, Copy, Trash2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface WorkflowDef {
  id: string
  name: string
  description: string | null
  scopeType: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
  requestType: string | null
  isActive: boolean
  version: number
  company: { id: string; name: string } | null
  group: { id: string; name: string } | null
  employee: { id: string; name: string; employeeNo: string } | null
  createdBy: { id: string; name: string } | null
  _count: { nodes: number; instances: number }
  updatedAt: Date
}

interface WorkflowListProps {
  companyId: string
  companyName: string
  userId: string
  workflows: WorkflowDef[]
}

const scopeTypeLabels = {
  EMPLOYEE: '員工特殊路徑',
  REQUEST_TYPE: '申請類型流程',
  DEFAULT: '預設流程',
}

const scopeTypeBadgeColors = {
  EMPLOYEE: 'bg-purple-100 text-purple-700',
  REQUEST_TYPE: 'bg-blue-100 text-blue-700',
  DEFAULT: 'bg-gray-100 text-gray-700',
}

export function WorkflowList({ companyId, companyName, userId, workflows }: WorkflowListProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createData, setCreateData] = useState({
    name: '',
    description: '',
    scopeType: 'REQUEST_TYPE' as 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT',
    requestType: '',
  })

  const createWorkflow = trpc.workflow.create.useMutation({
    onSuccess: (data) => {
      setIsCreateOpen(false)
      setCreateData({ name: '', description: '', scopeType: 'REQUEST_TYPE', requestType: '' })
      router.push(`/dashboard/workflow/editor/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const deleteWorkflow = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      router.refresh()
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const duplicateWorkflow = trpc.workflow.duplicate.useMutation({
    onSuccess: (data) => {
      router.push(`/dashboard/workflow/editor/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
    },
  })

  const handleCreate = () => {
    if (!createData.name.trim()) {
      alert('請輸入流程名稱')
      return
    }

    createWorkflow.mutate({
      name: createData.name,
      description: createData.description || undefined,
      scopeType: createData.scopeType,
      companyId: companyId,
      requestType: createData.scopeType === 'REQUEST_TYPE' ? createData.requestType : undefined,
      createdById: userId,
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`確定要刪除流程「${name}」嗎？`)) {
      deleteWorkflow.mutate({ id })
    }
  }

  const handleDuplicate = (id: string, name: string) => {
    const newName = prompt('請輸入複製流程的名稱', `${name} (副本)`)
    if (newName) {
      duplicateWorkflow.mutate({ id, newName, createdById: userId })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">流程管理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增流程
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">尚無流程定義，點擊上方按鈕建立</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Badge className={scopeTypeBadgeColors[workflow.scopeType]}>
                      {scopeTypeLabels[workflow.scopeType]}
                    </Badge>
                    {workflow.isActive ? (
                      <Badge variant="default">啟用</Badge>
                    ) : (
                      <Badge variant="secondary">停用</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {workflow.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workflow.description}
                  </p>
                )}
                {workflow.scopeType === 'EMPLOYEE' && workflow.employee && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">員工：</span>
                    {workflow.employee.name} ({workflow.employee.employeeNo})
                  </p>
                )}
                {workflow.scopeType === 'REQUEST_TYPE' && workflow.requestType && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">申請類型：</span>
                    {workflow.requestType}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-4 w-4" />
                    <span>{workflow._count.nodes} 節點</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{workflow._count.instances} 實例</span>
                  </div>
                  <span>v{workflow.version}</span>
                </div>
                <div className="flex gap-1 pt-2">
                  <Link href={`/dashboard/workflow/view/${workflow.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-1" />
                      檢視
                    </Button>
                  </Link>
                  <Link href={`/dashboard/workflow/editor/${workflow.id}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <Pencil className="h-4 w-4 mr-1" />
                      編輯
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDuplicate(workflow.id, workflow.name)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(workflow.id, workflow.name)}
                    disabled={workflow._count.instances > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增流程 Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增流程</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>流程類型</Label>
              <Select
                value={createData.scopeType}
                onValueChange={(value) =>
                  setCreateData({ ...createData, scopeType: value as typeof createData.scopeType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUEST_TYPE">申請類型流程</SelectItem>
                  <SelectItem value="DEFAULT">預設流程</SelectItem>
                  <SelectItem value="EMPLOYEE">員工特殊路徑</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createData.scopeType === 'REQUEST_TYPE' && (
              <div className="space-y-2">
                <Label>申請類型</Label>
                <Select
                  value={createData.requestType}
                  onValueChange={(value) =>
                    setCreateData({ ...createData, requestType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇申請類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">費用報銷</SelectItem>
                    <SelectItem value="LEAVE">請假申請</SelectItem>
                    <SelectItem value="SEAL">用印申請</SelectItem>
                    <SelectItem value="BUSINESS_CARD">名片申請</SelectItem>
                    <SelectItem value="STATIONERY">文具領用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workflow-name">名稱 *</Label>
              <Input
                id="workflow-name"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder="例：費用報銷審批流程"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-desc">說明</Label>
              <Input
                id="workflow-desc"
                value={createData.description}
                onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                placeholder="選填"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createWorkflow.isPending}>
                {createWorkflow.isPending ? '建立中...' : '建立並編輯'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/workflow/workflow-list.tsx
git commit -m "feat: add workflow list client component"
```

---

## Task 13: 建立流程編輯器頁面

**Files:**
- Create: `src/app/dashboard/workflow/editor/[id]/page.tsx`
- Create: `src/app/dashboard/workflow/editor/[id]/editor-page.tsx`

**Step 1: 建立編輯器頁面路由**

```typescript
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WorkflowEditorPage } from './editor-page'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkflowEditorRoute({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const definition = await prisma.workflowDefinition.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true } },
      nodes: true,
      edges: true,
    },
  })

  if (!definition) notFound()

  return (
    <WorkflowEditorPage
      definition={{
        id: definition.id,
        name: definition.name,
        scopeType: definition.scopeType,
        companyId: definition.companyId,
        groupId: definition.groupId,
        employeeId: definition.employeeId,
        requestType: definition.requestType,
      }}
      initialNodes={definition.nodes}
      initialEdges={definition.edges}
    />
  )
}
```

**Step 2: 建立編輯器頁面客戶端元件**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkflowEditor, WorkflowNodeType } from '@/components/workflow-editor'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface WorkflowEditorPageProps {
  definition: {
    id: string
    name: string
    scopeType: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
    companyId: string | null
    groupId: string | null
    employeeId: string | null
    requestType: string | null
  }
  initialNodes: Array<{
    id: string
    nodeType: string
    name: string | null
    approverType: string | null
    approverId: string | null
    orgRelation: string | null
    orgLevelUp: number | null
    customFieldName: string | null
    parallelMode: string | null
    posX: number
    posY: number
  }>
  initialEdges: Array<{
    id: string
    fromNodeId: string
    toNodeId: string
    conditionField: string | null
    conditionOperator: string | null
    conditionValue: string | null
    isDefault: boolean
    sortOrder: number
  }>
}

const scopeTypeLabels = {
  EMPLOYEE: '員工特殊路徑',
  REQUEST_TYPE: '申請類型流程',
  DEFAULT: '預設流程',
}

export function WorkflowEditorPage({
  definition,
  initialNodes,
  initialEdges,
}: WorkflowEditorPageProps) {
  const router = useRouter()

  const saveDesign = trpc.workflow.saveDesign.useMutation({
    onSuccess: () => {
      alert('儲存成功')
      router.refresh()
    },
    onError: (error) => {
      alert(`儲存失敗：${error.message}`)
    },
  })

  const handleSave = async (data: {
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
  }) => {
    saveDesign.mutate({
      definitionId: definition.id,
      nodes: data.nodes.map((node) => ({
        id: node.id,
        nodeType: node.nodeType,
        name: node.name,
        approverType: node.approverType as 'SPECIFIC_EMPLOYEE' | 'POSITION' | 'ROLE' | 'ORG_RELATION' | 'DEPARTMENT_HEAD' | 'CUSTOM_FIELD' | undefined,
        approverId: node.approverId,
        orgRelation: node.orgRelation as 'DIRECT_SUPERVISOR' | 'DOTTED_SUPERVISOR' | 'N_LEVEL_UP' | 'DEPARTMENT_MANAGER' | 'COMPANY_HEAD' | undefined,
        orgLevelUp: node.orgLevelUp,
        customFieldName: node.customFieldName,
        parallelMode: node.parallelMode as 'ALL' | 'ANY' | 'MAJORITY' | undefined,
        posX: node.posX,
        posY: node.posY,
      })),
      edges: data.edges.map((edge) => ({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        conditionField: edge.conditionField,
        conditionOperator: edge.conditionOperator as 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'GREATER_OR_EQUAL' | 'LESS_OR_EQUAL' | 'CONTAINS' | 'IN' | 'NOT_IN' | undefined,
        conditionValue: edge.conditionValue,
        isDefault: edge.isDefault,
        sortOrder: edge.sortOrder,
      })),
    })
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* 頂部導航 */}
      <div className="border-b bg-background px-4 py-2 flex items-center gap-4">
        <Link href="/dashboard/workflow">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold">{definition.name}</h1>
          <p className="text-xs text-muted-foreground">
            {scopeTypeLabels[definition.scopeType]}
          </p>
        </div>
      </div>

      {/* 編輯器 */}
      <div className="flex-1">
        <WorkflowEditor
          definitionId={definition.id}
          definitionName={definition.name}
          scopeType={definition.scopeType}
          companyId={definition.companyId}
          groupId={definition.groupId}
          employeeId={definition.employeeId}
          requestType={definition.requestType}
          initialNodes={initialNodes.map((node) => ({
            ...node,
            nodeType: node.nodeType as WorkflowNodeType,
          }))}
          initialEdges={initialEdges}
          onSave={handleSave}
          isSaving={saveDesign.isPending}
        />
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add "src/app/dashboard/workflow/editor/[id]/page.tsx" "src/app/dashboard/workflow/editor/[id]/editor-page.tsx"
git commit -m "feat: add workflow editor page"
```

---

## Task 14: 新增流程管理選單到 Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 在 sidebar 的選單中新增流程管理項目**

找到組織圖項目後面，新增：

```typescript
import { Workflow } from 'lucide-react'
```

然後在 navigation 陣列中新增：

```typescript
{ name: '流程管理', href: '/dashboard/workflow', icon: Workflow },
```

**Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add workflow menu to sidebar"
```

---

## Task 15: 最終驗證

**Step 1: 執行 TypeScript 類型檢查**

Run: `npx tsc --noEmit`

Expected: 無錯誤

**Step 2: 執行開發伺服器**

Run: `npm run dev`

Expected: 伺服器正常啟動

**Step 3: 測試頁面**

1. 開啟 http://localhost:3000/dashboard/workflow
2. 建立新的流程定義
3. 測試拖曳新增各種節點（開始、結束、審批、條件、並行）
4. 測試連線節點
5. 測試選取並編輯節點/連線屬性
6. 測試儲存功能

**Step 4: Commit 總結**

```bash
git add .
git commit -m "feat: complete Phase 3 - workflow visual editor

- Create zustand store for workflow state management
- Build custom nodes: Start, End, Approval, Condition, Parallel
- Build custom workflow edge with condition labels
- Create WorkflowToolbox and WorkflowPropertyPanel
- Build main WorkflowEditor component
- Add workflow pages (list, editor)
- Integrate with tRPC workflow router"
```

---

## Summary

Phase 3 完成後，您將擁有：

| 功能 | 狀態 |
|------|------|
| 流程編輯器 Zustand Store | ✅ |
| 開始/結束節點 | ✅ |
| 審批節點（多種審批人類型） | ✅ |
| 條件判斷節點（菱形） | ✅ |
| 並行開始/匯合節點 | ✅ |
| 自訂連線（條件標籤） | ✅ |
| 節點工具列 | ✅ |
| 完整屬性面板（審批人設定、條件設定） | ✅ |
| 流程列表頁面 | ✅ |
| 流程編輯器頁面 | ✅ |
| 儲存/載入功能 | ✅ |

下一階段（Phase 4）將實作：
- 員工特殊路徑設定頁面
- 費用報銷整合
- 流程執行引擎
