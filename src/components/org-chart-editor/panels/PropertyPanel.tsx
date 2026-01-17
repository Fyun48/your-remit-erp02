'use client'

import { useOrgChartStore, OrgRelationType } from '../stores/use-org-chart-store'
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

export function PropertyPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeData,
    updateEdgeData,
    deleteNode,
    deleteEdge,
  } = useOrgChartStore()

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
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">節點屬性</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => {
              deleteNode(selectedNode.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="node-label">名稱</Label>
            <Input
              id="node-label"
              value={selectedNode.data.label}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { label: e.target.value })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="node-subtitle">副標題</Label>
            <Input
              id="node-subtitle"
              value={selectedNode.data.subtitle || ''}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { subtitle: e.target.value })
              }
              placeholder="選填"
            />
          </div>

          {/* 職位節點顯示員工名稱輸入 */}
          {selectedNode.data.nodeType === 'POSITION' && (
            <div className="space-y-1.5">
              <Label htmlFor="employee-name">負責人姓名</Label>
              <Input
                id="employee-name"
                value={selectedNode.data.employeeName || ''}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { employeeName: e.target.value })
                }
                placeholder="輸入負責人姓名"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>節點類型</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {selectedNode.data.nodeType === 'DEPARTMENT' && '部門'}
              {selectedNode.data.nodeType === 'POSITION' && '職位'}
              {selectedNode.data.nodeType === 'EMPLOYEE' && '員工'}
              {selectedNode.data.nodeType === 'TEAM' && '團隊'}
              {selectedNode.data.nodeType === 'DIVISION' && '事業部'}
              {selectedNode.data.nodeType === 'COMMITTEE' && '委員會'}
              {selectedNode.data.nodeType === 'COMPANY' && '公司'}
              {selectedNode.data.nodeType === 'EXTERNAL' && '外部單位'}
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
            onClick={() => {
              deleteEdge(selectedEdge.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>關係類型</Label>
            <Select
              value={selectedEdge.data?.relationType || 'SOLID'}
              onValueChange={(value) =>
                updateEdgeData(selectedEdge.id, { relationType: value as OrgRelationType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SOLID">實線（正式彙報）</SelectItem>
                <SelectItem value="DOTTED">虛線（功能性彙報）</SelectItem>
                <SelectItem value="MATRIX">矩陣（多重隸屬）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-approval">納入簽核路徑</Label>
            <Switch
              id="include-approval"
              checked={selectedEdge.data?.includeInApproval ?? true}
              onCheckedChange={(checked) =>
                updateEdgeData(selectedEdge.id, { includeInApproval: checked })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return null
}
