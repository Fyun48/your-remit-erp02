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
