'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData } from '../stores/use-workflow-store'

function StartNodeComponent({ selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'w-16 h-16 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center shadow-sm',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      <Play className="w-6 h-6 text-green-600 ml-1" />

      {/* 下方連接點 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  )
}

export const StartNode = memo(StartNodeComponent)
