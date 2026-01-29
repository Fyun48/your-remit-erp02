'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Plus,
  AlertCircle,
  Save,
  BookTemplate,
  Pencil,
  Trash2,
  FolderOpen,
  Check,
  X,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface EditingGrade {
  id: string
  minSalary: string
  maxSalary: string
  insuredAmount: string
}

export default function InsuranceGrades() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [editingGrade, setEditingGrade] = useState<EditingGrade | null>(null)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [isLoadTemplateOpen, setIsLoadTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  const utils = trpc.useUtils()

  const { data: grades, isLoading } = trpc.payroll.getInsuranceGrades.useQuery({
    year: parseInt(selectedYear),
  })

  const { data: templates } = trpc.payroll.listGradeTemplates.useQuery()

  const seedMutation = trpc.payroll.seedInsuranceGrades.useMutation({
    onSuccess: () => {
      toast.success('投保級距已建立')
      utils.payroll.getInsuranceGrades.invalidate({ year: parseInt(selectedYear) })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateGradeMutation = trpc.payroll.updateInsuranceGrade.useMutation({
    onSuccess: () => {
      toast.success('級距已更新')
      utils.payroll.getInsuranceGrades.invalidate({ year: parseInt(selectedYear) })
      setEditingGrade(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const saveTemplateMutation = trpc.payroll.saveGradesAsTemplate.useMutation({
    onSuccess: (template) => {
      toast.success(`範本「${template.name}」已儲存`)
      utils.payroll.listGradeTemplates.invalidate()
      setIsSaveTemplateOpen(false)
      setTemplateName('')
      setTemplateDescription('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const loadTemplateMutation = trpc.payroll.createGradesFromTemplate.useMutation({
    onSuccess: (result) => {
      toast.success(`已從範本「${result.templateName}」建立 ${result.count} 筆級距`)
      utils.payroll.getInsuranceGrades.invalidate({ year: parseInt(selectedYear) })
      setIsLoadTemplateOpen(false)
      setSelectedTemplateId('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteTemplateMutation = trpc.payroll.deleteGradeTemplate.useMutation({
    onSuccess: () => {
      toast.success('範本已刪除')
      utils.payroll.listGradeTemplates.invalidate()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const formatAmount = (amount: number | string | { toString(): string } | null) => {
    if (amount === null) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) :
                typeof amount === 'number' ? amount : parseFloat(amount.toString())
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  const parseAmount = (value: string): number => {
    const num = parseFloat(value.replace(/,/g, ''))
    return isNaN(num) ? 0 : num
  }

  const laborGrades = grades?.filter(g => g.type === 'LABOR') || []
  const healthGrades = grades?.filter(g => g.type === 'HEALTH') || []
  const pensionGrades = grades?.filter(g => g.type === 'PENSION') || []

  const handleSeed = () => {
    seedMutation.mutate({ year: parseInt(selectedYear) })
  }

  const handleStartEdit = (grade: {
    id: string
    minSalary: number | string | { toString(): string }
    maxSalary: number | string | { toString(): string } | null
    insuredAmount: number | string | { toString(): string }
  }) => {
    setEditingGrade({
      id: grade.id,
      minSalary: grade.minSalary.toString(),
      maxSalary: grade.maxSalary?.toString() || '',
      insuredAmount: grade.insuredAmount.toString(),
    })
  }

  const handleCancelEdit = () => {
    setEditingGrade(null)
  }

  const handleSaveEdit = () => {
    if (!editingGrade) return
    updateGradeMutation.mutate({
      id: editingGrade.id,
      minSalary: parseAmount(editingGrade.minSalary),
      maxSalary: editingGrade.maxSalary ? parseAmount(editingGrade.maxSalary) : null,
      insuredAmount: parseAmount(editingGrade.insuredAmount),
    })
  }

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('請輸入範本名稱')
      return
    }
    saveTemplateMutation.mutate({
      year: parseInt(selectedYear),
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
    })
  }

  const handleLoadTemplate = () => {
    if (!selectedTemplateId) {
      toast.error('請選擇範本')
      return
    }
    loadTemplateMutation.mutate({
      templateId: selectedTemplateId,
      targetYear: parseInt(selectedYear),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasData = grades && grades.length > 0

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hr/payroll">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              投保級距表
            </h1>
            <p className="text-muted-foreground">
              勞保、健保、勞退投保薪資級距對照表
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasData ? (
            <>
              {/* 另存範本 */}
              <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    另存範本
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>另存為範本</DialogTitle>
                    <DialogDescription>
                      將 {selectedYear} 年的投保級距儲存為範本，以便日後套用
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="templateName">範本名稱 *</Label>
                      <Input
                        id="templateName"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="例如：2026年標準級距"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="templateDescription">說明</Label>
                      <Textarea
                        id="templateDescription"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        placeholder="可選填範本說明..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSaveTemplateOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending}>
                      {saveTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      儲存範本
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              {/* 從範本載入 */}
              {templates && templates.length > 0 && (
                <Dialog open={isLoadTemplateOpen} onOpenChange={setIsLoadTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      從範本建立
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>從範本建立</DialogTitle>
                      <DialogDescription>
                        選擇一個範本來建立 {selectedYear} 年的投保級距
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>選擇範本</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇範本" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name} ({t.baseYear}年, {t._count.items}筆)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsLoadTemplateOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleLoadTemplate} disabled={loadTemplateMutation.isPending || !selectedTemplateId}>
                        {loadTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        建立級距
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* 建立預設級距 */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    建立 {selectedYear} 年級距
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>建立投保級距</AlertDialogTitle>
                    <AlertDialogDescription>
                      確定要建立 {selectedYear} 年的投保級距表嗎？
                      此操作會建立勞保、健保、勞退三種類型的級距資料。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSeed} disabled={seedMutation.isPending}>
                      {seedMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      確定建立
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* 範本管理 */}
      {templates && templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookTemplate className="h-4 w-4" />
              已儲存的範本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-1 bg-secondary/50 rounded-lg px-3 py-1.5">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge variant="outline" className="ml-1 text-xs">
                    {t.baseYear}年
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({t._count.items}筆)
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>刪除範本</AlertDialogTitle>
                        <AlertDialogDescription>
                          確定要刪除範本「{t.name}」嗎？此操作無法復原。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteTemplateMutation.mutate({ id: t.id })}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          刪除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">尚無 {selectedYear} 年投保級距資料</h3>
            <p className="text-muted-foreground mb-4">
              點擊上方「建立」按鈕以建立 {selectedYear} 年的投保級距表，
              {templates && templates.length > 0 && '或從現有範本載入'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedYear} 年（民國 {parseInt(selectedYear) - 1911} 年）投保級距
            </CardTitle>
            <CardDescription>
              共 {grades?.length} 筆資料。點擊 <Pencil className="h-3 w-3 inline" /> 可編輯個別項目。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="labor">
              <TabsList className="mb-4">
                <TabsTrigger value="labor">
                  勞保 <Badge variant="secondary" className="ml-2">{laborGrades.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="health">
                  健保 <Badge variant="secondary" className="ml-2">{healthGrades.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pension">
                  勞退 <Badge variant="secondary" className="ml-2">{pensionGrades.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="labor">
                <GradeTable
                  grades={laborGrades}
                  formatAmount={formatAmount}
                  editingGrade={editingGrade}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onEditChange={setEditingGrade}
                  isSaving={updateGradeMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="health">
                <GradeTable
                  grades={healthGrades}
                  formatAmount={formatAmount}
                  editingGrade={editingGrade}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onEditChange={setEditingGrade}
                  isSaving={updateGradeMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="pension">
                <GradeTable
                  grades={pensionGrades}
                  formatAmount={formatAmount}
                  editingGrade={editingGrade}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onEditChange={setEditingGrade}
                  isSaving={updateGradeMutation.isPending}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 說明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">勞工保險</h4>
            <p className="text-sm text-muted-foreground">
              2026 年勞保費率為 12.5%（含就業保險 1%）。員工自付 20%，雇主負擔 70%，政府補助 10%。
              投保薪資上限為 45,800 元。
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">全民健保</h4>
            <p className="text-sm text-muted-foreground">
              2026 年健保費率為 5.17%。員工自付 30%，雇主負擔 60%，政府補助 10%。
              投保薪資上限為 313,000 元。
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">勞工退休金</h4>
            <p className="text-sm text-muted-foreground">
              雇主每月應提撥工資 6% 至員工勞退專戶。員工可自願提繳 0-6%，自提部分可享稅賦優惠。
              提繳工資上限為 150,000 元。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface GradeTableProps {
  grades: Array<{
    id: string
    grade: number
    minSalary: number | string | { toString(): string }
    maxSalary: number | string | { toString(): string } | null
    insuredAmount: number | string | { toString(): string }
  }>
  formatAmount: (amount: number | string | { toString(): string } | null) => string
  editingGrade: EditingGrade | null
  onStartEdit: (grade: GradeTableProps['grades'][number]) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditChange: (grade: EditingGrade | null) => void
  isSaving: boolean
}

function GradeTable({
  grades,
  formatAmount,
  editingGrade,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  isSaving,
}: GradeTableProps) {
  if (grades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        無資料
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">級數</TableHead>
          <TableHead className="text-right">薪資下限</TableHead>
          <TableHead className="text-right">薪資上限</TableHead>
          <TableHead className="text-right">投保金額</TableHead>
          <TableHead className="w-[80px]">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grades.map((grade) => {
          const isEditing = editingGrade?.id === grade.id
          return (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.grade}</TableCell>
              {isEditing ? (
                <>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={editingGrade.minSalary}
                      onChange={(e) => onEditChange({ ...editingGrade, minSalary: e.target.value })}
                      className="w-28 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={editingGrade.maxSalary}
                      onChange={(e) => onEditChange({ ...editingGrade, maxSalary: e.target.value })}
                      className="w-28 ml-auto text-right"
                      placeholder="無上限"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={editingGrade.insuredAmount}
                      onChange={(e) => onEditChange({ ...editingGrade, insuredAmount: e.target.value })}
                      className="w-28 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onSaveEdit}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onCancelEdit}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right font-mono">
                    {formatAmount(grade.minSalary)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {grade.maxSalary ? formatAmount(grade.maxSalary) : '以上'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatAmount(grade.insuredAmount)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onStartEdit(grade)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
