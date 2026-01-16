'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkflowEditor, WorkflowNodeType } from '@/components/workflow-editor'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface WorkflowEditorPageProps {
  definition: {
    id: string
    name: string
    scopeType: 'EMPLOYEE' | 'REQUEST_TYPE' | 'DEFAULT'
    companyId: string | null
    groupId: string | null
    employeeId: string | null
    requestType: string | null
  }
  initialNodes: Array<{
    id: string
    nodeType: string
    name: string | null
    approverType: string | null
    approverId: string | null
    orgRelation: string | null
    orgLevelUp: number | null
    customFieldName: string | null
    parallelMode: string | null
    posX: number
    posY: number
  }>
  initialEdges: Array<{
    id: string
    fromNodeId: string
    toNodeId: string
    conditionField: string | null
    conditionOperator: string | null
    conditionValue: string | null
    isDefault: boolean
    sortOrder: number
  }>
}

const scopeTypeLabels = {
  EMPLOYEE: '員工特殊路徑',
  REQUEST_TYPE: '申請類型流程',
  DEFAULT: '預設流程',
}

export function WorkflowEditorPage({
  definition,
  initialNodes,
  initialEdges,
}: WorkflowEditorPageProps) {
  const router = useRouter()

  const saveDesign = trpc.workflow.saveDesign.useMutation({
    onSuccess: () => {
      alert('儲存成功')
      router.refresh()
    },
    onError: (error) => {
      alert(`儲存失敗：${error.message}`)
    },
  })

  const handleSave = async (data: {
    nodes: Array<{
      id: string
      nodeType: WorkflowNodeType
      name?: string
      approverType?: string
      approverId?: string
      orgRelation?: string
      orgLevelUp?: number
      customFieldName?: string
      parallelMode?: string
      posX: number
      posY: number
    }>
    edges: Array<{
      fromNodeId: string
      toNodeId: string
      conditionField?: string
      conditionOperator?: string
      conditionValue?: string
      isDefault: boolean
      sortOrder: number
    }>
  }) => {
    saveDesign.mutate({
      definitionId: definition.id,
      nodes: data.nodes.map((node) => ({
        id: node.id,
        nodeType: node.nodeType,
        name: node.name,
        approverType: node.approverType as 'SPECIFIC_EMPLOYEE' | 'POSITION' | 'ROLE' | 'ORG_RELATION' | 'DEPARTMENT_HEAD' | 'CUSTOM_FIELD' | undefined,
        approverId: node.approverId,
        orgRelation: node.orgRelation as 'DIRECT_SUPERVISOR' | 'DOTTED_SUPERVISOR' | 'N_LEVEL_UP' | 'DEPARTMENT_MANAGER' | 'COMPANY_HEAD' | undefined,
        orgLevelUp: node.orgLevelUp,
        customFieldName: node.customFieldName,
        parallelMode: node.parallelMode as 'ALL' | 'ANY' | 'MAJORITY' | undefined,
        posX: node.posX,
        posY: node.posY,
      })),
      edges: data.edges.map((edge) => ({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        conditionField: edge.conditionField,
        conditionOperator: edge.conditionOperator as 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'GREATER_OR_EQUAL' | 'LESS_OR_EQUAL' | 'CONTAINS' | 'IN' | 'NOT_IN' | undefined,
        conditionValue: edge.conditionValue,
        isDefault: edge.isDefault,
        sortOrder: edge.sortOrder,
      })),
    })
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* 頂部導航 */}
      <div className="border-b bg-background px-4 py-2 flex items-center gap-4">
        <Link href="/dashboard/workflow">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold">{definition.name}</h1>
          <p className="text-xs text-muted-foreground">
            {scopeTypeLabels[definition.scopeType]}
          </p>
        </div>
      </div>

      {/* 編輯器 */}
      <div className="flex-1">
        <WorkflowEditor
          definitionId={definition.id}
          definitionName={definition.name}
          scopeType={definition.scopeType}
          companyId={definition.companyId}
          groupId={definition.groupId}
          employeeId={definition.employeeId}
          requestType={definition.requestType}
          initialNodes={initialNodes.map((node) => ({
            ...node,
            nodeType: node.nodeType as WorkflowNodeType,
          }))}
          initialEdges={initialEdges}
          onSave={handleSave}
          isSaving={saveDesign.isPending}
        />
      </div>
    </div>
  )
}
