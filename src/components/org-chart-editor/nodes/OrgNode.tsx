'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow'
import { Building2, Briefcase, User, Users, Building, UserCog, Factory, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrgNodeData, OrgNodeType } from '../stores/use-org-chart-store'

const nodeIcons: Record<OrgNodeType, typeof Building2> = {
  DEPARTMENT: Building2,
  POSITION: Briefcase,
  EMPLOYEE: User,
  TEAM: Users,
  DIVISION: Building,
  COMMITTEE: UserCog,
  COMPANY: Factory,
  EXTERNAL: UserPlus,
}

const nodeColors: Record<OrgNodeType, string> = {
  DEPARTMENT: 'bg-blue-50 border-blue-300 hover:border-blue-500',
  POSITION: 'bg-purple-50 border-purple-300 hover:border-purple-500',
  EMPLOYEE: 'bg-green-50 border-green-300 hover:border-green-500',
  TEAM: 'bg-teal-50 border-teal-300 hover:border-teal-500',
  DIVISION: 'bg-indigo-50 border-indigo-300 hover:border-indigo-500',
  COMMITTEE: 'bg-amber-50 border-amber-300 hover:border-amber-500',
  COMPANY: 'bg-slate-50 border-slate-300 hover:border-slate-500',
  EXTERNAL: 'bg-rose-50 border-rose-300 hover:border-rose-500',
}

const iconColors: Record<OrgNodeType, string> = {
  DEPARTMENT: 'text-blue-600',
  POSITION: 'text-purple-600',
  EMPLOYEE: 'text-green-600',
  TEAM: 'text-teal-600',
  DIVISION: 'text-indigo-600',
  COMMITTEE: 'text-amber-600',
  COMPANY: 'text-slate-600',
  EXTERNAL: 'text-rose-600',
}

// 縮放控制點的樣式
const resizeLineStyle = {
  borderColor: '#3b82f6',
  borderWidth: 1,
}

const resizeHandleStyle = {
  width: 10,
  height: 10,
  backgroundColor: '#3b82f6',
  borderRadius: 2,
}

function OrgNodeComponent({ data, selected }: NodeProps<OrgNodeData>) {
  const Icon = nodeIcons[data.nodeType]

  return (
    <>
      {/* 縮放控制器 - 只在選取時顯示 */}
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={60}
        lineStyle={resizeLineStyle}
        handleStyle={resizeHandleStyle}
      />

      <div
        className={cn(
          'px-4 py-3 rounded-lg border-2 shadow-sm transition-all h-full',
          nodeColors[data.nodeType],
          selected && 'ring-2 ring-offset-2 ring-blue-500'
        )}
        style={{
          minWidth: data.width || 160,
          minHeight: data.height || 60,
        }}
      >
        {/* 上方連接點 */}
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
        />

        <div className="flex items-center gap-3 h-full">
          <div className={cn('p-2 rounded-full bg-white flex-shrink-0', iconColors[data.nodeType])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{data.label}</p>
            {/* 職位節點顯示員工名稱 */}
            {data.nodeType === 'POSITION' && data.employeeName && (
              <p className="text-xs text-purple-700 truncate font-medium">{data.employeeName}</p>
            )}
            {data.subtitle && (
              <p className="text-xs text-muted-foreground truncate">{data.subtitle}</p>
            )}
          </div>
        </div>

        {/* 下方連接點 */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
        />
      </div>
    </>
  )
}

export const OrgNode = memo(OrgNodeComponent)
