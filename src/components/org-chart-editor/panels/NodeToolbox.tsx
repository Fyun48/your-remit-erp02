'use client'

import { Building2, Briefcase, User, Users, Building, UserCog, Factory, UserPlus } from 'lucide-react'
import { OrgNodeType, useOrgChartStore } from '../stores/use-org-chart-store'

interface NodeTypeConfig {
  type: OrgNodeType
  label: string
  icon: typeof Building2
  color: string
  category: 'basic' | 'organization' | 'other'
}

const nodeTypes: NodeTypeConfig[] = [
  // 基本節點
  { type: 'DEPARTMENT', label: '部門', icon: Building2, color: 'bg-blue-100 text-blue-600 border-blue-300', category: 'basic' },
  { type: 'POSITION', label: '職位', icon: Briefcase, color: 'bg-purple-100 text-purple-600 border-purple-300', category: 'basic' },
  { type: 'EMPLOYEE', label: '員工', icon: User, color: 'bg-green-100 text-green-600 border-green-300', category: 'basic' },
  // 組織結構節點
  { type: 'COMPANY', label: '公司', icon: Factory, color: 'bg-slate-100 text-slate-600 border-slate-300', category: 'organization' },
  { type: 'DIVISION', label: '事業部', icon: Building, color: 'bg-indigo-100 text-indigo-600 border-indigo-300', category: 'organization' },
  { type: 'TEAM', label: '團隊', icon: Users, color: 'bg-teal-100 text-teal-600 border-teal-300', category: 'organization' },
  // 其他節點
  { type: 'COMMITTEE', label: '委員會', icon: UserCog, color: 'bg-amber-100 text-amber-600 border-amber-300', category: 'other' },
  { type: 'EXTERNAL', label: '外部單位', icon: UserPlus, color: 'bg-rose-100 text-rose-600 border-rose-300', category: 'other' },
]

export function NodeToolbox() {
  const addNode = useOrgChartStore((state) => state.addNode)

  const onDragStart = (event: React.DragEvent, nodeType: OrgNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleAddNode = (nodeType: OrgNodeType) => {
    const id = `node-${Date.now()}`
    const labels: Record<OrgNodeType, string> = {
      DEPARTMENT: '新部門',
      POSITION: '新職位',
      EMPLOYEE: '新員工',
      TEAM: '新團隊',
      DIVISION: '新事業部',
      COMMITTEE: '新委員會',
      COMPANY: '新公司',
      EXTERNAL: '新外部單位',
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

  const basicNodes = nodeTypes.filter((n) => n.category === 'basic')
  const organizationNodes = nodeTypes.filter((n) => n.category === 'organization')
  const otherNodes = nodeTypes.filter((n) => n.category === 'other')

  const renderNodeGroup = (items: NodeTypeConfig[]) => (
    <div className="space-y-1">
      {items.map((item) => (
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
  )

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-1.5">基本節點</h3>
        {renderNodeGroup(basicNodes)}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-1.5">組織節點</h3>
        {renderNodeGroup(organizationNodes)}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-1.5">其他節點</h3>
        {renderNodeGroup(otherNodes)}
      </div>
      <p className="text-xs text-muted-foreground px-2 pt-1 border-t">
        拖曳或點擊新增節點
      </p>
    </div>
  )
}
