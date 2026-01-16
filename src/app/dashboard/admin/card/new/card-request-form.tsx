'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompanySelect } from '@/components/ui/company-select'
import { ArrowLeft, CreditCard, Save, Send, Eye } from 'lucide-react'
import { trpc } from '@/lib/trpc'

interface Company {
  id: string
  name: string
  defaultData: {
    title: string
    department: string
    phone: string
    address: string
  }
}

interface CardRequestFormProps {
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  companies: Company[]
}

export function CardRequestForm({
  applicantId,
  applicantName,
  applicantEmail,
  applicantPhone,
  companies,
}: CardRequestFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [formData, setFormData] = useState({
    companyId: companies.length === 1 ? companies[0].id : '',
    name: applicantName,
    nameEn: '',
    title: '',
    titleEn: '',
    department: '',
    phone: '',
    mobile: applicantPhone,
    fax: '',
    email: applicantEmail,
    address: '',
    quantity: 1,
    note: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // 當選擇公司時，自動帶入該公司的預設資料
  useEffect(() => {
    if (formData.companyId) {
      const company = companies.find((c) => c.id === formData.companyId)
      if (company) {
        setFormData((prev) => ({
          ...prev,
          title: company.defaultData.title,
          department: company.defaultData.department,
          phone: company.defaultData.phone,
          address: company.defaultData.address,
        }))
      }
    }
  }, [formData.companyId, companies])

  const create = trpc.businessCard.create.useMutation({
    onSuccess: (data) => {
      router.push(`/dashboard/admin/card/${data.id}`)
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const submit = trpc.businessCard.submit.useMutation({
    onSuccess: () => {
      router.push('/dashboard/admin/card')
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const startWorkflow = trpc.workflow.startInstance.useMutation()

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.companyId) {
      newErrors.companyId = '請選擇公司'
    }
    if (!formData.name.trim()) {
      newErrors.name = '請填寫姓名'
    }
    if (!formData.title.trim()) {
      newErrors.title = '請填寫職稱'
    }
    if (formData.quantity < 1) {
      newErrors.quantity = '數量至少為 1'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    create.mutate({
      companyId: formData.companyId,
      applicantId,
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      title: formData.title,
      titleEn: formData.titleEn || undefined,
      department: formData.department || undefined,
      phone: formData.phone || undefined,
      mobile: formData.mobile || undefined,
      fax: formData.fax || undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      quantity: formData.quantity,
      note: formData.note || undefined,
    })
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    create.mutate(
      {
        companyId: formData.companyId,
        applicantId,
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        title: formData.title,
        titleEn: formData.titleEn || undefined,
        department: formData.department || undefined,
        phone: formData.phone || undefined,
        mobile: formData.mobile || undefined,
        fax: formData.fax || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        quantity: formData.quantity,
        note: formData.note || undefined,
      },
      {
        onSuccess: async (data) => {
          // 嘗試啟動工作流程
          try {
            await startWorkflow.mutateAsync({
              requestType: 'CARD',
              requestId: data.id,
              applicantId,
              companyId: formData.companyId,
              requestData: {
                quantity: formData.quantity,
                name: formData.name,
                title: formData.title,
              },
            })
            router.push('/dashboard/admin/card')
          } catch {
            // 無工作流程定義，使用傳統審批
            console.log('No workflow defined, using traditional approval')
            submit.mutate({ id: data.id })
          }
        },
      }
    )
  }

  const selectedCompany = companies.find((c) => c.id === formData.companyId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/card">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增名片申請</h1>
          <p className="text-muted-foreground">填寫名片資料並提交審批</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 表單區域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 選擇公司 */}
          <Card>
            <CardHeader>
              <CardTitle>選擇公司</CardTitle>
              <CardDescription>選擇要印製名片的公司抬頭</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>公司 *</Label>
                <CompanySelect
                  companies={companies}
                  value={formData.companyId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companyId: value })
                  }
                  className={errors.companyId ? 'border-red-500' : ''}
                />
                {errors.companyId && (
                  <p className="text-sm text-red-500">{errors.companyId}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 名片資料 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                名片資料
              </CardTitle>
              <CardDescription>填寫要印製在名片上的資訊</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameEn">英文名</Label>
                  <Input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) =>
                      setFormData({ ...formData, nameEn: e.target.value })
                    }
                    placeholder="English Name"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">職稱 *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className={errors.title ? 'border-red-500' : ''}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleEn">英文職稱</Label>
                  <Input
                    id="titleEn"
                    value={formData.titleEn}
                    onChange={(e) =>
                      setFormData({ ...formData, titleEn: e.target.value })
                    }
                    placeholder="Job Title"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">部門</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">公司電話</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">手機</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) =>
                      setFormData({ ...formData, mobile: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fax">傳真</Label>
                  <Input
                    id="fax"
                    value={formData.fax}
                    onChange={(e) =>
                      setFormData({ ...formData, fax: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">公司地址</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">數量（盒）*</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className={errors.quantity ? 'border-red-500' : ''}
                  />
                  {errors.quantity && (
                    <p className="text-sm text-red-500">{errors.quantity}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">備註</Label>
                <Textarea
                  id="note"
                  placeholder="如有特殊需求請填寫..."
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 側邊欄 */}
        <div className="space-y-6">
          {/* 名片預覽 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>名片預覽</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white shadow-sm aspect-[1.75/1] flex flex-col justify-between text-xs">
                <div>
                  <div className="font-bold text-sm text-primary">
                    {selectedCompany?.name || '公司名稱'}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold">{formData.name || '姓名'}</div>
                  {formData.nameEn && (
                    <div className="text-muted-foreground">{formData.nameEn}</div>
                  )}
                  <div className="text-muted-foreground">
                    {formData.title || '職稱'}
                    {formData.department && ` | ${formData.department}`}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  {formData.phone && <div>Tel: {formData.phone}</div>}
                  {formData.mobile && <div>Mobile: {formData.mobile}</div>}
                  {formData.email && <div>Email: {formData.email}</div>}
                  {formData.address && <div>{formData.address}</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 操作按鈕 */}
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
