'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Users, Shield, FileStack, Loader2, Search, CheckCircle } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface BatchAuthorizationProps {
  userId: string
  companyId: string
}

interface ModuleGroup {
  module: string
  name: string
  permissions: {
    code: string
    name: string
    module: string
    isBasic: boolean
  }[]
}

export function BatchAuthorization({ userId, companyId }: BatchAuthorizationProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [step, setStep] = useState<'select-employees' | 'select-permissions' | 'confirm'>('select-employees')
  const [authType, setAuthType] = useState<'template' | 'custom'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const { data: employees = [] } = trpc.permission.listCompanyEmployeePermissions.useQuery(
    { userId, companyId }
  )

  const { data: templates = [] } = trpc.permission.listTemplates.useQuery(
    { userId },
    { retry: false }
  )

  const { data: moduleGroups = [] } = trpc.permission.listModulesGrouped.useQuery()

  const applyTemplateMutation = trpc.permission.applyTemplateToEmployees.useMutation({
    onSuccess: (data) => {
      setResult({
        success: true,
        message: `已為 ${data.employeesProcessed} 位員工授予 ${data.totalPermissionsGranted} 項權限`,
      })
    },
    onError: (error) => {
      setResult({ success: false, message: error.message })
    },
  })

  const batchGrantMutation = trpc.permission.batchGrantToEmployees.useMutation({
    onSuccess: (data) => {
      setResult({
        success: true,
        message: `已為 ${data.employeesProcessed} 位員工授予 ${data.totalPermissionsGranted} 項權限`,
      })
    },
    onError: (error) => {
      setResult({ success: false, message: error.message })
    },
  })

  const resetDialog = () => {
    setStep('select-employees')
    setSelectedEmployees([])
    setSelectedPermissions([])
    setSelectedTemplate('')
    setAuthType('template')
    setSearch('')
    setResult(null)
  }

  const handleClose = () => {
    setShowDialog(false)
    resetDialog()
  }

  const handleConfirm = () => {
    if (authType === 'template' && selectedTemplate) {
      applyTemplateMutation.mutate({
        userId,
        templateId: selectedTemplate,
        employeeIds: selectedEmployees,
        companyId,
      })
    } else if (authType === 'custom') {
      batchGrantMutation.mutate({
        userId,
        employeeIds: selectedEmployees,
        companyId,
        permissions: selectedPermissions,
      })
    }
  }

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const togglePermission = (code: string) => {
    setSelectedPermissions(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const selectAllEmployees = () => {
    const allIds = filteredEmployees
      .filter(e => !e.isGroupAdmin && !e.isCompanyManager)
      .map(e => e.employeeId)
    setSelectedEmployees(allIds)
  }

  const filteredEmployees = employees.filter((emp) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      emp.name.toLowerCase().includes(s) ||
      emp.employeeNo.toLowerCase().includes(s) ||
      emp.department.toLowerCase().includes(s)
    )
  })

  const selectedTemplateName = templates.find(t => t.id === selectedTemplate)?.name

  const getPermissionName = (code: string) => {
    const allPerms = moduleGroups.flatMap((g: ModuleGroup) => g.permissions)
    const perm = allPerms.find((p: { code: string }) => p.code === code)
    return perm?.name || code
  }

  const isPending = applyTemplateMutation.isPending || batchGrantMutation.isPending

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            批次授權
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            選擇多名員工，一次授予相同的權限，適合新進員工或部門調整時使用。
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Shield className="h-4 w-4 mr-2" />
            開始批次授權
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>批次授權</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <CheckCircle className={cn(
                'h-16 w-16 mb-4',
                result.success ? 'text-green-500' : 'text-red-500'
              )} />
              <p className="text-lg font-medium mb-2">
                {result.success ? '授權完成' : '授權失敗'}
              </p>
              <p className="text-muted-foreground">{result.message}</p>
              <Button onClick={handleClose} className="mt-6">
                關閉
              </Button>
            </div>
          ) : (
            <>
              {/* 步驟指示器 */}
              <div className="flex items-center justify-center gap-4 py-4 border-b">
                <div className={cn(
                  'flex items-center gap-2',
                  step === 'select-employees' ? 'text-primary' : 'text-muted-foreground'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    step === 'select-employees' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>1</div>
                  <span>選擇員工</span>
                </div>
                <div className="w-8 h-px bg-border" />
                <div className={cn(
                  'flex items-center gap-2',
                  step === 'select-permissions' ? 'text-primary' : 'text-muted-foreground'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    step === 'select-permissions' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>2</div>
                  <span>選擇權限</span>
                </div>
                <div className="w-8 h-px bg-border" />
                <div className={cn(
                  'flex items-center gap-2',
                  step === 'confirm' ? 'text-primary' : 'text-muted-foreground'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    step === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>3</div>
                  <span>確認授權</span>
                </div>
              </div>

              {/* 步驟內容 */}
              <div className="flex-1 overflow-hidden">
                {step === 'select-employees' && (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center gap-4 p-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="搜尋員工..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllEmployees}>
                        全選
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 px-4">
                      <div className="space-y-2 pb-4">
                        {filteredEmployees.map((emp) => {
                          const isAdmin = emp.isGroupAdmin || emp.isCompanyManager
                          return (
                            <label
                              key={emp.employeeId}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border',
                                isAdmin
                                  ? 'bg-muted/50 cursor-not-allowed'
                                  : 'hover:bg-muted/30 cursor-pointer'
                              )}
                            >
                              <Checkbox
                                checked={selectedEmployees.includes(emp.employeeId)}
                                disabled={isAdmin}
                                onCheckedChange={() => toggleEmployee(emp.employeeId)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{emp.name}</span>
                                  <span className="text-sm text-muted-foreground">{emp.employeeNo}</span>
                                  {isAdmin && (
                                    <Badge variant="secondary" className="text-xs">
                                      {emp.isGroupAdmin ? '集團管理員' : '公司管理人員'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {emp.department} · {emp.position}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        已選擇 {selectedEmployees.length} 位員工
                      </p>
                    </div>
                  </div>
                )}

                {step === 'select-permissions' && (
                  <div className="h-full flex flex-col p-4 space-y-4">
                    <div className="space-y-2">
                      <Label>授權方式</Label>
                      <Select value={authType} onValueChange={(v) => setAuthType(v as 'template' | 'custom')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="template">
                            <div className="flex items-center gap-2">
                              <FileStack className="h-4 w-4" />
                              使用權限範本
                            </div>
                          </SelectItem>
                          <SelectItem value="custom">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              自訂權限
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {authType === 'template' ? (
                      <div className="space-y-2">
                        <Label>選擇範本</Label>
                        {templates.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">
                            尚未建立任何權限範本，請先建立範本或選擇自訂權限。
                          </p>
                        ) : (
                          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇權限範本" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  <div>
                                    <div>{template.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {(template.permissions as string[]).length} 項權限
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ) : (
                      <ScrollArea className="flex-1">
                        <div className="space-y-4">
                          {moduleGroups.map((group: ModuleGroup) => (
                            <div key={group.module}>
                              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                                {group.name}
                              </h4>
                              <div className="grid gap-2">
                                {group.permissions
                                  .filter(p => !p.isBasic)
                                  .map((perm) => (
                                    <label
                                      key={perm.code}
                                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={selectedPermissions.includes(perm.code)}
                                        onCheckedChange={() => togglePermission(perm.code)}
                                      />
                                      <span className="text-sm">{perm.name}</span>
                                    </label>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                {step === 'confirm' && (
                  <div className="h-full p-4 space-y-6">
                    <div>
                      <h4 className="font-medium mb-2">選擇的員工</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployees.map((id) => {
                          const emp = employees.find(e => e.employeeId === id)
                          return (
                            <Badge key={id} variant="secondary">
                              {emp?.name || id}
                            </Badge>
                          )
                        })}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        共 {selectedEmployees.length} 位員工
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">授予的權限</h4>
                      {authType === 'template' ? (
                        <p>使用範本：{selectedTemplateName}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedPermissions.map((code) => (
                            <Badge key={code} variant="outline">
                              {getPermissionName(code)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">
                        共 {authType === 'template'
                          ? (templates.find(t => t.id === selectedTemplate)?.permissions as string[])?.length || 0
                          : selectedPermissions.length
                        } 項權限
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={handleClose}>
                  取消
                </Button>
                {step === 'select-employees' && (
                  <Button
                    onClick={() => setStep('select-permissions')}
                    disabled={selectedEmployees.length === 0}
                  >
                    下一步
                  </Button>
                )}
                {step === 'select-permissions' && (
                  <>
                    <Button variant="outline" onClick={() => setStep('select-employees')}>
                      上一步
                    </Button>
                    <Button
                      onClick={() => setStep('confirm')}
                      disabled={
                        (authType === 'template' && !selectedTemplate) ||
                        (authType === 'custom' && selectedPermissions.length === 0)
                      }
                    >
                      下一步
                    </Button>
                  </>
                )}
                {step === 'confirm' && (
                  <>
                    <Button variant="outline" onClick={() => setStep('select-permissions')}>
                      上一步
                    </Button>
                    <Button onClick={handleConfirm} disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      確認授權
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
