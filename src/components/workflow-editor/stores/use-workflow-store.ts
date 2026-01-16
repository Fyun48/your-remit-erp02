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
