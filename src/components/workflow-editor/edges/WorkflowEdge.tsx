'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
} from 'reactflow'
import { cn } from '@/lib/utils'
import { WorkflowEdgeData, ConditionOperator } from '../stores/use-workflow-store'

const operatorLabels: Record<ConditionOperator, string> = {
  EQUALS: '=',
  NOT_EQUALS: '≠',
  GREATER_THAN: '>',
  LESS_THAN: '<',
  GREATER_OR_EQUAL: '≥',
  LESS_OR_EQUAL: '≤',
  CONTAINS: '包含',
  IN: '在列表中',
  NOT_IN: '不在列表中',
}

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<WorkflowEdgeData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  })

  // 產生標籤文字
  let label = data?.label || ''
  if (!label && data?.conditionField && data?.conditionOperator) {
    const op = operatorLabels[data.conditionOperator]
    label = `${data.conditionField} ${op} ${data.conditionValue || ''}`
  }
  if (data?.isDefault) {
    label = label ? `${label} (預設)` : '預設'
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3b82f6' : data?.isDefault ? '#9ca3af' : '#64748b',
          strokeWidth: 2,
          strokeDasharray: data?.isDefault ? '5,5' : 'none',
        }}
        markerEnd="url(#arrow)"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={cn(
                'px-2 py-1 rounded text-xs font-medium bg-white border shadow-sm max-w-[150px] truncate',
                selected && 'ring-2 ring-blue-500',
                data?.isDefault && 'border-dashed'
              )}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
