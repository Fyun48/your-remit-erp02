'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Merge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function ParallelJoinNodeComponent({ selected }: NodeProps<WorkflowNodeData>) {
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
