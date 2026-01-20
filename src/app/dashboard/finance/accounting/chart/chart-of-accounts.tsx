'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  BookOpen,
  ArrowLeft,
  RotateCcw,
  Copy,
  Building2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'

interface Company {
  companyId: string
  company: {
    id: string
    name: string
  }
}

interface ChartOfAccountsProps {
  assignments: Company[]
  initialCompanyId: string
  hasPermission: boolean
}

type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

const categoryNames: Record<AccountCategory, string> = {
  ASSET: '資產',
  LIABILITY: '負債',
  EQUITY: '權益',
  REVENUE: '收入',
  EXPENSE: '費用',
}

const categoryOrder: AccountCategory[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

export function ChartOfAccounts({
  assignments,
  initialCompanyId,
  hasPermission,
}: ChartOfAccountsProps) {
  const router = useRouter()
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [targetCompanyId, setTargetCompanyId] = useState('')
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    category: 'EXPENSE' as AccountCategory,
    accountType: 'DEBIT' as 'DEBIT' | 'CREDIT',
    level: 3,
    isDetail: true,
    parentId: '',
  })

  const utils = trpc.useUtils()

  const { data: accounts = [], isLoading } = trpc.accountChart.list.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !!selectedCompanyId }
  )

  const initializeMutation = trpc.accountChart.initializeDefaults.useMutation({
    onSuccess: () => {
      toast.success('已初始化預設科目表')
      utils.accountChart.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const resetMutation = trpc.accountChart.resetToDefaults.useMutation({
    onSuccess: () => {
      toast.success('已重置為預設科目表')
      utils.accountChart.list.invalidate()
      setShowResetDialog(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const copyMutation = trpc.accountChart.copyToCompany.useMutation({
    onSuccess: (data) => {
      toast.success(`已複製 ${data.count} 個科目到目標公司`)
      setShowCopyDialog(false)
      setTargetCompanyId('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const createMutation = trpc.accountChart.create.useMutation({
    onSuccess: () => {
      toast.success('已新增科目')
      utils.accountChart.list.invalidate()
      setShowAddDialog(false)
      setNewAccount({
        code: '',
        name: '',
        category: 'EXPENSE',
        accountType: 'DEBIT',
        level: 3,
        isDetail: true,
        parentId: '',
      })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const selectedCompany = assignments.find(a => a.companyId === selectedCompanyId)

  const handleCompanyChange = async (companyId: string) => {
    // 更新全域公司選擇 cookie
    try {
      const response = await fetch('/api/company/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      })
      if (response.ok) {
        // 重新載入頁面以套用新公司
        window.location.reload()
      }
    } catch (error) {
      toast.error('切換公司失敗')
    }
  }

  const handleInitialize = () => {
    initializeMutation.mutate({ companyId: selectedCompanyId })
  }

  const handleReset = () => {
    resetMutation.mutate({ companyId: selectedCompanyId })
  }

  const handleCopy = () => {
    if (!targetCompanyId) {
      toast.error('請選擇目標公司')
      return
    }
    copyMutation.mutate({
      sourceCompanyId: selectedCompanyId,
      targetCompanyId,
    })
  }

  const handleCreateAccount = () => {
    if (!newAccount.code || !newAccount.name) {
      toast.error('請填寫科目代碼和名稱')
      return
    }
    createMutation.mutate({
      companyId: selectedCompanyId,
      code: newAccount.code,
      name: newAccount.name,
      category: newAccount.category,
      accountType: newAccount.accountType,
      level: newAccount.level,
      isDetail: newAccount.isDetail,
      parentId: newAccount.parentId || undefined,
    })
  }

  // 依類別分組
  const accountsByCategory = categoryOrder.reduce((acc, category) => {
    acc[category] = accounts.filter((a) => a.category === category)
    return acc
  }, {} as Record<AccountCategory, typeof accounts>)

  // 取得可選的父科目（level 1 或 2）
  const parentOptions = accounts.filter(
    (a) => a.level < 3 && a.category === newAccount.category
  )

  // 其他可複製的公司
  const otherCompanies = assignments.filter(a => a.companyId !== selectedCompanyId)

  return (
    <div className="space-y-6">
      {/* 頂部導航欄 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/finance/accounting')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">會計科目表</h1>
            <p className="text-muted-foreground">{selectedCompany?.company.name}</p>
          </div>
        </div>

        {/* 公司選擇器 */}
        {assignments.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="選擇公司" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.companyId} value={a.companyId}>
                    {a.company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      {hasPermission && (
        <div className="flex flex-wrap gap-2">
          {accounts.length === 0 ? (
            <Button
              onClick={handleInitialize}
              disabled={initializeMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              初始化預設科目
            </Button>
          ) : (
            <>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新增科目
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重置為預設
              </Button>
              {otherCompanies.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowCopyDialog(true)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  複製到其他公司
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* 科目列表 */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">載入中...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立會計科目表</p>
              {hasPermission && (
                <p className="text-sm text-muted-foreground mt-2">
                  點擊「初始化預設科目」建立符合 IFRS 的標準科目表
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {categoryOrder.map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {categoryNames[category]} ({accountsByCategory[category].length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 w-24">代碼</th>
                        <th className="text-left py-2 px-2">名稱</th>
                        <th className="text-center py-2 px-2 w-20">層級</th>
                        <th className="text-center py-2 px-2 w-24">性質</th>
                        <th className="text-center py-2 px-2 w-24">明細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsByCategory[category].map((account) => (
                        <tr
                          key={account.id}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="py-2 px-2 font-mono">{account.code}</td>
                          <td
                            className="py-2 px-2"
                            style={{
                              paddingLeft: `${(account.level - 1) * 20 + 8}px`,
                            }}
                          >
                            {account.name}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {account.level}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {account.accountType === 'DEBIT' ? '借' : '貸'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {account.isDetail ? '✓' : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新增科目對話框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增會計科目</DialogTitle>
            <DialogDescription>
              輸入科目資訊以新增自訂會計科目
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>科目代碼</Label>
                <Input
                  value={newAccount.code}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, code: e.target.value })
                  }
                  placeholder="例: 5207"
                />
              </div>
              <div className="space-y-2">
                <Label>科目名稱</Label>
                <Input
                  value={newAccount.name}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, name: e.target.value })
                  }
                  placeholder="例: 廣告費"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>類別</Label>
                <Select
                  value={newAccount.category}
                  onValueChange={(v: AccountCategory) =>
                    setNewAccount({
                      ...newAccount,
                      category: v,
                      accountType: v === 'ASSET' || v === 'EXPENSE' ? 'DEBIT' : 'CREDIT',
                      parentId: '',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOrder.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {categoryNames[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>性質</Label>
                <Select
                  value={newAccount.accountType}
                  onValueChange={(v: 'DEBIT' | 'CREDIT') =>
                    setNewAccount({ ...newAccount, accountType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">借方</SelectItem>
                    <SelectItem value="CREDIT">貸方</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>層級</Label>
                <Select
                  value={String(newAccount.level)}
                  onValueChange={(v) =>
                    setNewAccount({ ...newAccount, level: Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - 大類</SelectItem>
                    <SelectItem value="2">2 - 中類</SelectItem>
                    <SelectItem value="3">3 - 明細</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>上層科目</Label>
                <Select
                  value={newAccount.parentId || '_none'}
                  onValueChange={(v) =>
                    setNewAccount({
                      ...newAccount,
                      parentId: v === '_none' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇上層科目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">無</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateAccount}
              disabled={createMutation.isPending}
            >
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置確認對話框 */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要重置科目表？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將刪除所有現有科目並還原為系統預設的 IFRS 標準科目表。
              <br />
              <br />
              <strong className="text-destructive">
                注意：如果公司已有傳票使用科目表，則無法重置。
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確定重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 複製到其他公司對話框 */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>複製科目表到其他公司</DialogTitle>
            <DialogDescription>
              將目前公司的科目表複製到您有權限的其他公司
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>目標公司</Label>
              <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇目標公司" />
                </SelectTrigger>
                <SelectContent>
                  {otherCompanies.map((c) => (
                    <SelectItem key={c.companyId} value={c.companyId}>
                      {c.company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              注意：目標公司必須尚未建立科目表才能複製。期初餘額將設為 0。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCopy} disabled={copyMutation.isPending}>
              複製
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
