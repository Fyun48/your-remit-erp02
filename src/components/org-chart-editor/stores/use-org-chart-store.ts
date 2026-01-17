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

export type OrgNodeType = 'DEPARTMENT' | 'POSITION' | 'EMPLOYEE' | 'TEAM' | 'DIVISION' | 'COMMITTEE' | 'COMPANY' | 'EXTERNAL'
export type OrgRelationType = 'SOLID' | 'DOTTED' | 'MATRIX'

export interface OrgNodeData {
  nodeType: OrgNodeType
  referenceId?: string
  label: string
  subtitle?: string
  employeeName?: string  // 職位節點的負責人姓名
  width?: number
  height?: number
}

export interface OrgEdgeData {
  relationType: OrgRelationType
  includeInApproval: boolean
}

interface OrgChartState {
  // 基本資訊
  chartId: string | null
  chartName: string
  chartType: 'GROUP' | 'COMPANY'
  groupId: string | null
  companyId: string | null

  // React Flow 狀態
  nodes: Node<OrgNodeData>[]
  edges: Edge<OrgEdgeData>[]

  // 選取狀態
  selectedNodeId: string | null
  selectedEdgeId: string | null

  // 操作
  setChartInfo: (info: {
    chartId: string | null
    chartName: string
    chartType: 'GROUP' | 'COMPANY'
    groupId: string | null
    companyId: string | null
  }) => void
  setNodes: (nodes: Node<OrgNodeData>[]) => void
  setEdges: (edges: Edge<OrgEdgeData>[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: Node<OrgNodeData>) => void
  updateNodeData: (nodeId: string, data: Partial<OrgNodeData>) => void
  updateEdgeData: (edgeId: string, data: Partial<OrgEdgeData>) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edgeId: string) => void
  setSelectedNode: (nodeId: string | null) => void
  setSelectedEdge: (edgeId: string | null) => void
  clearSelection: () => void
  reset: () => void
}

const initialState = {
  chartId: null,
  chartName: '',
  chartType: 'COMPANY' as const,
  groupId: null,
  companyId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
}

export const useOrgChartStore = create<OrgChartState>((set, get) => ({
  ...initialState,

  setChartInfo: (info) => set(info),

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
    const newEdge: Edge<OrgEdgeData> = {
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'orgEdge',
      data: {
        relationType: 'SOLID',
        includeInApproval: true,
      },
    } as Edge<OrgEdgeData>

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
          ? { ...edge, data: { ...edge.data, ...data } as OrgEdgeData }
          : edge
      ) as Edge<OrgEdgeData>[],
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
