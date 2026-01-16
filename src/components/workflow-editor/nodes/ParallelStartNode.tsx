'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Split } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData, ParallelMode } from '../stores/use-workflow-store'

const modeLabels: Record<ParallelMode, string> = {
  ALL: '全部通過',
  ANY: '任一通過',
  MAJORITY: '多數通過',
}

function ParallelStartNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        'px-4 py-2 rounded bg-purple-50 border-2 border-purple-400 shadow-sm min-w-[120px]',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />

      <div className="flex items-center gap-2">
        <Split className="w-4 h-4 text-purple-600" />
        <div>
          <p className="font-medium text-sm">並行開始</p>
          <p className="text-xs text-muted-foreground">
            {data.parallelMode ? modeLabels[data.parallelMode] : '全部通過'}
          </p>
        </div>
      </div>

      {/* 下方連接點 - 多個 */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-1"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-2"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
        style={{ left: '70%' }}
      />
    </div>
  )
}

export const ParallelStartNode = memo(ParallelStartNodeComponent)
