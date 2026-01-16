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
