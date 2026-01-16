'use client'

import { Building2, Briefcase, User } from 'lucide-react'
import { OrgNodeType, useOrgChartStore } from '../stores/use-org-chart-store'

interface NodeTypeConfig {
  type: OrgNodeType
  label: string
  icon: typeof Building2
  color: string
}

const nodeTypes: NodeTypeConfig[] = [
  { type: 'DEPARTMENT', label: '部門', icon: Building2, color: 'bg-blue-100 text-blue-600 border-blue-300' },
  { type: 'POSITION', label: '職位', icon: Briefcase, color: 'bg-purple-100 text-purple-600 border-purple-300' },
  { type: 'EMPLOYEE', label: '員工', icon: User, color: 'bg-green-100 text-green-600 border-green-300' },
]

export function NodeToolbox() {
  const addNode = useOrgChartStore((state) => state.addNode)

  const onDragStart = (event: React.DragEvent, nodeType: OrgNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleAddNode = (nodeType: OrgNodeType) => {
    const id = `node-${Date.now()}`
    const labels = {
      DEPARTMENT: '新部門',
      POSITION: '新職位',
      EMPLOYEE: '新員工',
    }

    addNode({
      id,
      type: 'orgNode',
      position: { x: 250, y: 100 + Math.random() * 200 },
      data: {
        nodeType,
        label: labels[nodeType],
      },
    })
  }

  return (
    <div className="space-y-2">
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
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground px-2 pt-2">
        拖曳或點擊新增節點
      </p>
    </div>
  )
}
