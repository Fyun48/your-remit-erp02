'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { UserCheck, User, Briefcase, Shield, Network, Building2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowNodeData, ApproverType } from '../stores/use-workflow-store'

const approverIcons: Record<ApproverType, typeof User> = {
  SPECIFIC_EMPLOYEE: User,
  POSITION: Briefcase,
  ROLE: Shield,
  ORG_RELATION: Network,
  DEPARTMENT_HEAD: Building2,
  CUSTOM_FIELD: FileText,
}

const approverLabels: Record<ApproverType, string> = {
  SPECIFIC_EMPLOYEE: '指定員工',
  POSITION: '指定職位',
  ROLE: '指定角色',
  ORG_RELATION: '組織關係',
  DEPARTMENT_HEAD: '部門主管',
  CUSTOM_FIELD: '自訂欄位',
}

function ApprovalNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const Icon = data.approverType ? approverIcons[data.approverType] : UserCheck
  const approverLabel = data.approverType ? approverLabels[data.approverType] : '審批'

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg bg-blue-50 border-2 border-blue-400 shadow-sm min-w-[140px]',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
    >
      {/* 上方連接點 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-blue-100">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {data.name || '審批節點'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {data.approverName || approverLabel}
          </p>
        </div>
      </div>

      {/* 下方連接點 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  )
}

export const ApprovalNode = memo(ApprovalNodeComponent)
