'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Stamp, Save, Send } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface SealRequestFormProps {
  companyId: string
  companyName: string
  applicantId: string
  applicantName: string
}

const sealTypes = [
  { value: 'COMPANY_SEAL', label: '公司大章', description: '用於重要合約、官方文件' },
  { value: 'COMPANY_SMALL_SEAL', label: '公司小章', description: '用於一般文件' },
  { value: 'CONTRACT_SEAL', label: '合約用印', description: '用於合約簽署' },
  { value: 'INVOICE_SEAL', label: '發票章', description: '用於發票開立' },
  { value: 'BOARD_SEAL', label: '董事會印鑑', description: '用於董事會決議' },
  { value: 'BANK_SEAL', label: '銀行印鑑', description: '用於銀行往來' },
]

export function SealRequestForm({
  companyId,
  companyName,
  applicantId,
  applicantName,
}: SealRequestFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    sealType: '' as string,
    purpose: '',
    documentName: '',
    documentCount: 1,
    isCarryOut: false,
    expectedReturn: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const create = trpc.sealRequest.create.useMutation({
    onSuccess: (data) => {
      router.push(`/dashboard/admin/seal/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const submit = trpc.sealRequest.submit.useMutation({
    onSuccess: () => {
      router.push('/dashboard/admin/seal')
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.sealType) {
      newErrors.sealType = '請選擇印章類型'
    }
    if (!formData.purpose.trim()) {
      newErrors.purpose = '請填寫用途說明'
    }
    if (formData.documentCount < 1) {
      newErrors.documentCount = '用印份數至少為 1'
    }
    if (formData.isCarryOut && !formData.expectedReturn) {
      newErrors.expectedReturn = '攜出印章需填寫預計歸還時間'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    create.mutate({
      companyId,
      applicantId,
      sealType: formData.sealType as 'COMPANY_SEAL' | 'COMPANY_SMALL_SEAL' | 'CONTRACT_SEAL' | 'INVOICE_SEAL' | 'BOARD_SEAL' | 'BANK_SEAL',
      purpose: formData.purpose,
      documentName: formData.documentName || undefined,
      documentCount: formData.documentCount,
      isCarryOut: formData.isCarryOut,
      expectedReturn: formData.expectedReturn ? new Date(formData.expectedReturn) : undefined,
    })
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)

    // 先建立再提交
    create.mutate(
      {
        companyId,
        applicantId,
        sealType: formData.sealType as 'COMPANY_SEAL' | 'COMPANY_SMALL_SEAL' | 'CONTRACT_SEAL' | 'INVOICE_SEAL' | 'BOARD_SEAL' | 'BANK_SEAL',
        purpose: formData.purpose,
        documentName: formData.documentName || undefined,
        documentCount: formData.documentCount,
        isCarryOut: formData.isCarryOut,
        expectedReturn: formData.expectedReturn ? new Date(formData.expectedReturn) : undefined,
      },
      {
        onSuccess: (data) => {
          submit.mutate({ id: data.id })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/seal">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增用印申請</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 申請表單 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stamp className="h-5 w-5" />
                用印資訊
              </CardTitle>
              <CardDescription>請填寫用印申請相關資訊</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sealType">印章類型 *</Label>
                <Select
                  value={formData.sealType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, sealType: value })
                  }
                >
                  <SelectTrigger className={errors.sealType ? 'border-red-500' : ''}>
                    <SelectValue placeholder="選擇印章類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {sealTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div>{type.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {type.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sealType && (
                  <p className="text-sm text-red-500">{errors.sealType}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">用途說明 *</Label>
                <Textarea
                  id="purpose"
                  placeholder="請說明用印用途..."
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  className={errors.purpose ? 'border-red-500' : ''}
                  rows={3}
                />
                {errors.purpose && (
                  <p className="text-sm text-red-500">{errors.purpose}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="documentName">文件名稱</Label>
                  <Input
                    id="documentName"
                    placeholder="輸入文件名稱"
                    value={formData.documentName}
                    onChange={(e) =>
                      setFormData({ ...formData, documentName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentCount">用印份數 *</Label>
                  <Input
                    id="documentCount"
                    type="number"
                    min={1}
                    value={formData.documentCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        documentCount: parseInt(e.target.value) || 1,
                      })
                    }
                    className={errors.documentCount ? 'border-red-500' : ''}
                  />
                  {errors.documentCount && (
                    <p className="text-sm text-red-500">{errors.documentCount}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>攜出設定</CardTitle>
              <CardDescription>如需攜出印章，請開啟此選項並填寫歸還時間</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>需要攜出</Label>
                  <p className="text-sm text-muted-foreground">
                    印章需要攜帶至公司外使用
                  </p>
                </div>
                <Switch
                  checked={formData.isCarryOut}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isCarryOut: checked })
                  }
                />
              </div>

              {formData.isCarryOut && (
                <div className="space-y-2">
                  <Label htmlFor="expectedReturn">預計歸還時間 *</Label>
                  <Input
                    id="expectedReturn"
                    type="datetime-local"
                    value={formData.expectedReturn}
                    onChange={(e) =>
                      setFormData({ ...formData, expectedReturn: e.target.value })
                    }
                    className={errors.expectedReturn ? 'border-red-500' : ''}
                  />
                  {errors.expectedReturn && (
                    <p className="text-sm text-red-500">{errors.expectedReturn}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 側邊欄 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>申請人資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">申請人</span>
                <span className="font-medium">{applicantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">公司</span>
                <span>{companyName}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? '處理中...' : '提交審批'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSave}
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4 mr-2" />
                儲存草稿
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
