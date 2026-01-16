'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Building2, Briefcase, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrgNodeData } from '../stores/use-org-chart-store'

const nodeIcons = {
  DEPARTMENT: Building2,
  POSITION: Briefcase,
  EMPLOYEE: User,
}

const nodeColors = {
  DEPARTMENT: 'bg-blue-50 border-blue-300 hover:border-blue-500',
  POSITION: 'bg-purple-50 border-purple-300 hover:border-purple-500',
  EMPLOYEE: 'bg-green-50 border-green-300 hover:border-green-500',
}

const iconColors = {
  DEPARTMENT: 'text-blue-600',
  POSITION: 'text-purple-600',
  EMPLOYEE: 'text-green-600',
}

function OrgNodeComponent({ data, selected }: NodeProps<OrgNodeData>) {
  const Icon = nodeIcons[data.nodeType]

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px] transition-all',
        nodeColors[data.nodeType],
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />

      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-full bg-white', iconColors[data.nodeType])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{data.label}</p>
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
  )
}

export const OrgNode = memo(OrgNodeComponent)
