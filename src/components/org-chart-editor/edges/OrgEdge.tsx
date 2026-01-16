'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
} from 'reactflow'
import { cn } from '@/lib/utils'
import { OrgEdgeData } from '../stores/use-org-chart-store'

const edgeStyles = {
  SOLID: {
    stroke: '#64748b',
    strokeWidth: 2,
    strokeDasharray: 'none',
  },
  DOTTED: {
    stroke: '#94a3b8',
    strokeWidth: 2,
    strokeDasharray: '5,5',
  },
  MATRIX: {
    stroke: '#f59e0b',
    strokeWidth: 2,
    strokeDasharray: '10,5,2,5',
  },
}

const edgeLabels = {
  SOLID: '實線',
  DOTTED: '虛線',
  MATRIX: '矩陣',
}

function OrgEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<OrgEdgeData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  })

  const relationType = data?.relationType || 'SOLID'
  const style = edgeStyles[relationType]

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? '#3b82f6' : style.stroke,
        }}
      />
      {selected && (
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
                'px-2 py-1 rounded text-xs font-medium bg-white border shadow-sm',
                selected && 'ring-2 ring-blue-500'
              )}
            >
              {edgeLabels[relationType]}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const OrgEdge = memo(OrgEdgeComponent)
