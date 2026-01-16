'use client'

import {
  useWorkflowStore,
  ApproverType,
  OrgRelation,
  ParallelMode,
  ConditionOperator
} from '../stores/use-workflow-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'

const approverTypeLabels: Record<ApproverType, string> = {
  SPECIFIC_EMPLOYEE: '指定員工',
  POSITION: '指定職位',
  ROLE: '指定角色',
  ORG_RELATION: '組織關係',
  DEPARTMENT_HEAD: '部門主管',
  CUSTOM_FIELD: '自訂欄位',
}

const orgRelationLabels: Record<OrgRelation, string> = {
  DIRECT_SUPERVISOR: '直屬主管',
  DOTTED_SUPERVISOR: '虛線主管',
  N_LEVEL_UP: '往上 N 層',
  DEPARTMENT_MANAGER: '部門最高主管',
  COMPANY_HEAD: '公司負責人',
}

const parallelModeLabels: Record<ParallelMode, string> = {
  ALL: '全部通過',
  ANY: '任一通過',
  MAJORITY: '多數通過',
}

const conditionOperatorLabels: Record<ConditionOperator, string> = {
  EQUALS: '等於 (=)',
  NOT_EQUALS: '不等於 (≠)',
  GREATER_THAN: '大於 (>)',
  LESS_THAN: '小於 (<)',
  GREATER_OR_EQUAL: '大於等於 (≥)',
  LESS_OR_EQUAL: '小於等於 (≤)',
  CONTAINS: '包含',
  IN: '在列表中',
  NOT_IN: '不在列表中',
}

const conditionFieldOptions = [
  { value: 'AMOUNT', label: '申請金額' },
  { value: 'REQUEST_TYPE', label: '申請類型' },
  { value: 'SUB_TYPE', label: '子類型' },
  { value: 'APPLICANT_DEPARTMENT', label: '申請人部門' },
  { value: 'APPLICANT_POSITION', label: '申請人職位' },
  { value: 'APPLICANT_LEVEL', label: '申請人職級' },
  { value: 'CUSTOM_FIELD', label: '自訂欄位' },
]

export function WorkflowPropertyPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    updateEdgeData,
    deleteNode,
    deleteEdge,
  } = useWorkflowStore()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">選取節點或連線以編輯屬性</p>
      </div>
    )
  }

  // 節點屬性面板
  if (selectedNode) {
    const { nodeType } = selectedNode.data

    return (
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">節點屬性</h3>
          {nodeType !== 'START' && nodeType !== 'END' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => deleteNode(selectedNode.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {/* 節點名稱 */}
          <div className="space-y-1.5">
            <Label htmlFor="node-name">名稱</Label>
            <Input
              id="node-name"
              value={selectedNode.data.name || ''}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { name: e.target.value })
              }
              placeholder="節點名稱"
            />
          </div>

          {/* 審批節點設定 */}
          {nodeType === 'APPROVAL' && (
            <>
              <div className="space-y-1.5">
                <Label>審批人類型</Label>
                <Select
                  value={selectedNode.data.approverType || ''}
                  onValueChange={(value) =>
                    updateNodeData(selectedNode.id, { approverType: value as ApproverType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇審批人類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(approverTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 組織關係選項 */}
              {selectedNode.data.approverType === 'ORG_RELATION' && (
                <>
                  <div className="space-y-1.5">
                    <Label>組織關係</Label>
                    <Select
                      value={selectedNode.data.orgRelation || ''}
                      onValueChange={(value) =>
                        updateNodeData(selectedNode.id, { orgRelation: value as OrgRelation })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇關係" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(orgRelationLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedNode.data.orgRelation === 'N_LEVEL_UP' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="org-level">往上層數</Label>
                      <Input
                        id="org-level"
                        type="number"
                        min={1}
                        max={10}
                        value={selectedNode.data.orgLevelUp || 1}
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, { orgLevelUp: parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                  )}
                </>
              )}

              {/* 自訂欄位名稱 */}
              {selectedNode.data.approverType === 'CUSTOM_FIELD' && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-field">欄位名稱</Label>
                  <Input
                    id="custom-field"
                    value={selectedNode.data.customFieldName || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { customFieldName: e.target.value })
                    }
                    placeholder="例：projectManager"
                  />
                </div>
              )}

              {/* 指定員工 ID (簡化版，實際需要員工選擇器) */}
              {selectedNode.data.approverType === 'SPECIFIC_EMPLOYEE' && (
                <div className="space-y-1.5">
                  <Label htmlFor="approver-id">員工 ID</Label>
                  <Input
                    id="approver-id"
                    value={selectedNode.data.approverId || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { approverId: e.target.value })
                    }
                    placeholder="員工 ID"
                  />
                </div>
              )}
            </>
          )}

          {/* 並行節點設定 */}
          {nodeType === 'PARALLEL_START' && (
            <div className="space-y-1.5">
              <Label>通過模式</Label>
              <Select
                value={selectedNode.data.parallelMode || 'ALL'}
                onValueChange={(value) =>
                  updateNodeData(selectedNode.id, { parallelMode: value as ParallelMode })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(parallelModeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 節點類型顯示 */}
          <div className="space-y-1.5">
            <Label>節點類型</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {nodeType === 'START' && '開始節點'}
              {nodeType === 'END' && '結束節點'}
              {nodeType === 'APPROVAL' && '審批節點'}
              {nodeType === 'CONDITION' && '條件節點'}
              {nodeType === 'PARALLEL_START' && '並行開始'}
              {nodeType === 'PARALLEL_JOIN' && '並行匯合'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 連線屬性面板
  if (selectedEdge) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">連線屬性</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => deleteEdge(selectedEdge.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {/* 標籤 */}
          <div className="space-y-1.5">
            <Label htmlFor="edge-label">標籤</Label>
            <Input
              id="edge-label"
              value={selectedEdge.data?.label || ''}
              onChange={(e) =>
                updateEdgeData(selectedEdge.id, { label: e.target.value })
              }
              placeholder="選填"
            />
          </div>

          {/* 條件欄位 */}
          <div className="space-y-1.5">
            <Label>條件欄位</Label>
            <Select
              value={selectedEdge.data?.conditionField || ''}
              onValueChange={(value) =>
                updateEdgeData(selectedEdge.id, { conditionField: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇欄位 (選填)" />
              </SelectTrigger>
              <SelectContent>
                {conditionFieldOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 條件運算子 */}
          {selectedEdge.data?.conditionField && (
            <>
              <div className="space-y-1.5">
                <Label>運算子</Label>
                <Select
                  value={selectedEdge.data?.conditionOperator || ''}
                  onValueChange={(value) =>
                    updateEdgeData(selectedEdge.id, { conditionOperator: value as ConditionOperator })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇運算子" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(conditionOperatorLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="condition-value">比較值</Label>
                <Input
                  id="condition-value"
                  value={selectedEdge.data?.conditionValue || ''}
                  onChange={(e) =>
                    updateEdgeData(selectedEdge.id, { conditionValue: e.target.value })
                  }
                  placeholder="例：5000"
                />
              </div>
            </>
          )}

          {/* 預設路徑 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is-default">預設路徑</Label>
            <Switch
              id="is-default"
              checked={selectedEdge.data?.isDefault ?? false}
              onCheckedChange={(checked) =>
                updateEdgeData(selectedEdge.id, { isDefault: checked })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return null
}
