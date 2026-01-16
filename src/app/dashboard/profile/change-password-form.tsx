'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Check, X } from 'lucide-react'
import { trpc } from '@/lib/trpc'

// Password validation rules
const PASSWORD_RULES = [
  { label: '至少 8 個字元', test: (p: string) => p.length >= 8 },
  { label: '包含大寫字母 (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: '包含小寫字母 (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: '包含數字 (0-9)', test: (p: string) => /[0-9]/.test(p) },
]

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const passed = PASSWORD_RULES.filter(rule => rule.test(password)).length
  if (passed === 0) return { score: 0, label: '', color: '' }
  if (passed === 1) return { score: 1, label: '弱', color: 'bg-red-500' }
  if (passed === 2) return { score: 2, label: '普通', color: 'bg-orange-500' }
  if (passed === 3) return { score: 3, label: '中等', color: 'bg-yellow-500' }
  return { score: 4, label: '強', color: 'bg-green-500' }
}

interface ChangePasswordFormProps {
  employeeId: string
}

export function ChangePasswordForm({ employeeId }: ChangePasswordFormProps) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const changePassword = trpc.hr.changePassword.useMutation({
    onSuccess: () => {
      setSuccessMessage('密碼已成功變更！')
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setIsSubmitting(false)
      // 3 秒後清除成功訊息
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error) => {
      alert(error.message)
      setIsSubmitting(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.currentPassword) {
      alert('請輸入目前密碼')
      return
    }

    if (!formData.newPassword) {
      alert('請輸入新密碼')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      alert('新密碼與確認密碼不一致')
      return
    }

    // 驗證密碼規則
    const failedRules = PASSWORD_RULES.filter(rule => !rule.test(formData.newPassword))
    if (failedRules.length > 0) {
      alert(`新密碼不符合規則：\n${failedRules.map(r => r.label).join('\n')}`)
      return
    }

    setIsSubmitting(true)
    changePassword.mutate({
      employeeId,
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
      confirmPassword: formData.confirmPassword,
    })
  }

  const update = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const passwordsMatch = formData.confirmPassword && formData.newPassword === formData.confirmPassword

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          變更密碼
        </CardTitle>
        <CardDescription>
          為確保帳號安全，建議定期變更密碼
        </CardDescription>
      </CardHeader>
      <CardContent>
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2">
            <Check className="h-4 w-4" />
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">目前密碼</Label>
            <Input
              id="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={(e) => update('currentPassword', e.target.value)}
              placeholder="請輸入目前密碼"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">新密碼</Label>
            <Input
              id="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={(e) => update('newPassword', e.target.value)}
              placeholder="請輸入新密碼"
            />
            {formData.newPassword && (
              <div className="space-y-2 mt-2">
                {/* Password strength bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getPasswordStrength(formData.newPassword).color}`}
                      style={{ width: `${(getPasswordStrength(formData.newPassword).score / 4) * 100}%` }}
                    />
                  </div>
                  {getPasswordStrength(formData.newPassword).label && (
                    <span className="text-xs text-muted-foreground min-w-[3rem]">
                      {getPasswordStrength(formData.newPassword).label}
                    </span>
                  )}
                </div>
                {/* Password rules */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {PASSWORD_RULES.map((rule, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1 ${
                        rule.test(formData.newPassword)
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {rule.test(formData.newPassword) ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      {rule.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">確認新密碼</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              placeholder="請再次輸入新密碼"
            />
            {formData.confirmPassword && (
              <div className={`text-xs flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                {passwordsMatch ? (
                  <>
                    <Check className="h-3 w-3" />
                    密碼一致
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    密碼不一致
                  </>
                )}
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            {isSubmitting ? '處理中...' : '變更密碼'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
