'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function EndNodeComponent({ selected }: NodeProps<WorkflowNodeData>) {
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
