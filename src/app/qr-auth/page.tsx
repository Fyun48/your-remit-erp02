'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Smartphone } from 'lucide-react'

type Status = 'loading' | 'ready' | 'authenticating' | 'success' | 'error' | 'invalid' | 'expired'

export default function QrAuthPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  // Verify token on load
  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/qr-login/status/${token}`)
        if (!response.ok) {
          setStatus('invalid')
          return
        }

        const data = await response.json()

        if (data.status === 'EXPIRED') {
          setStatus('expired')
        } else if (data.status === 'PENDING') {
          setStatus('ready')
        } else {
          setStatus('invalid')
        }
      } catch {
        setStatus('error')
        setError('Failed to verify token')
      }
    }

    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('authenticating')
    setError('')

    try {
      const response = await fetch('/api/qr-login/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Authentication failed')
        setStatus('ready')
        return
      }

      setStatus('success')
    } catch {
      setError('Authentication failed')
      setStatus('ready')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            QR Code 登入驗證
          </CardTitle>
          <CardDescription className="text-center">
            驗證您的身份以完成登入
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground mt-4">驗證中...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center py-8">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive mt-4">無效的 QR Code</p>
              <p className="text-muted-foreground text-sm mt-2">
                請重新掃描有效的 QR Code
              </p>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex flex-col items-center py-8">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive mt-4">QR Code 已過期</p>
              <p className="text-muted-foreground text-sm mt-2">
                請在電腦上重新產生 QR Code
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-green-600 font-medium mt-4">驗證成功</p>
              <p className="text-muted-foreground text-sm mt-2">
                電腦端將自動完成登入，您可以關閉此頁面
              </p>
            </div>
          )}

          {(status === 'ready' || status === 'authenticating') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'authenticating'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={status === 'authenticating'}
                />
              </div>
              {error && (
                <div className="text-red-500 text-sm text-center">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={status === 'authenticating'}
              >
                {status === 'authenticating' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    驗證中...
                  </>
                ) : (
                  '確認登入'
                )}
              </Button>
            </form>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center py-8">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive mt-4">{error || '發生錯誤'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
