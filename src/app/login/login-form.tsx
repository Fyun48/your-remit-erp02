'use client'

import { useState, useEffect, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, RefreshCw, QrCode, KeyRound, Smartphone } from 'lucide-react'

interface LoginFormProps {
  groupName: string
}

export function LoginForm({ groupName }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // QR Login state
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrExpiry, setQrExpiry] = useState<Date | null>(null)
  const [qrStatus, setQrStatus] = useState<'loading' | 'ready' | 'authenticated' | 'expired' | 'error'>('loading')
  const [qrError, setQrError] = useState('')

  // Generate QR code
  const generateQrCode = useCallback(async () => {
    setQrStatus('loading')
    setQrError('')
    try {
      const response = await fetch('/api/qr-login/generate', {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to generate QR code')
      }
      const data = await response.json()
      setQrToken(data.token)
      setQrExpiry(new Date(data.expiresAt))
      setQrStatus('ready')
    } catch {
      setQrStatus('error')
      setQrError('Failed to generate QR code')
    }
  }, [])

  // Poll for QR login status
  useEffect(() => {
    if (!qrToken || qrStatus !== 'ready') return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/qr-login/status/${qrToken}`)
        if (!response.ok) return

        const data = await response.json()

        if (data.status === 'AUTHENTICATED') {
          setQrStatus('authenticated')
          clearInterval(pollInterval)

          // Complete the login
          const completeResponse = await fetch('/api/qr-login/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: qrToken }),
          })

          if (completeResponse.ok) {
            const completeData = await completeResponse.json()
            // Sign in using credentials provider with QR token
            const result = await signIn('credentials', {
              email: completeData.employee.email,
              qrToken: qrToken,
              redirect: false,
            })

            if (result?.error) {
              console.error('QR login error:', result.error)
            }
            router.push('/dashboard')
            router.refresh()
          }
        } else if (data.status === 'EXPIRED') {
          setQrStatus('expired')
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [qrToken, qrStatus, router])

  // Check if QR is expired
  useEffect(() => {
    if (!qrExpiry || qrStatus !== 'ready') return

    const checkExpiry = setInterval(() => {
      if (new Date() > qrExpiry) {
        setQrStatus('expired')
        clearInterval(checkExpiry)
      }
    }, 1000)

    return () => clearInterval(checkExpiry)
  }, [qrExpiry, qrStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('帳號或密碼錯誤')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('登入時發生錯誤')
    } finally {
      setIsLoading(false)
    }
  }

  // Get remaining time for QR code
  const getRemainingTime = () => {
    if (!qrExpiry) return '0:00'
    const diff = Math.max(0, qrExpiry.getTime() - Date.now())
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Generate QR code URL (pointing to mobile app or web auth page)
  const getQrUrl = () => {
    if (typeof window === 'undefined') return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/qr-auth?token=${qrToken}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {groupName} ERP 系統
          </CardTitle>
          <CardDescription className="text-center">
            選擇登入方式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                密碼登入
              </TabsTrigger>
              <TabsTrigger
                value="qr"
                className="flex items-center gap-2"
                onClick={() => {
                  if (!qrToken) generateQrCode()
                }}
              >
                <QrCode className="h-4 w-4" />
                QR Code
              </TabsTrigger>
            </TabsList>

            {/* Password Login */}
            <TabsContent value="password">
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
                  />
                </div>
                {error && (
                  <div className="text-red-500 text-sm text-center">{error}</div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? '登入中...' : '登入'}
                </Button>
              </form>
            </TabsContent>

            {/* QR Code Login */}
            <TabsContent value="qr">
              <div className="flex flex-col items-center space-y-4 mt-4">
                {qrStatus === 'loading' && (
                  <div className="w-48 h-48 flex items-center justify-center bg-muted rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {qrStatus === 'ready' && qrToken && (
                  <>
                    <div className="p-4 bg-white rounded-lg shadow-sm">
                      <QRCodeSVG
                        value={getQrUrl()}
                        size={180}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        使用手機 App 掃描 QR Code 登入
                      </p>
                      <p className="text-xs text-muted-foreground">
                        有效時間：{getRemainingTime()}
                      </p>
                    </div>
                  </>
                )}

                {qrStatus === 'authenticated' && (
                  <div className="w-48 h-48 flex flex-col items-center justify-center bg-green-50 rounded-lg">
                    <Smartphone className="h-12 w-12 text-green-600 mb-2" />
                    <p className="text-green-600 font-medium">已驗證</p>
                    <Loader2 className="h-4 w-4 animate-spin text-green-600 mt-2" />
                    <p className="text-sm text-green-600">登入中...</p>
                  </div>
                )}

                {qrStatus === 'expired' && (
                  <div className="w-48 h-48 flex flex-col items-center justify-center bg-muted rounded-lg">
                    <p className="text-muted-foreground mb-4">QR Code 已過期</p>
                    <Button
                      variant="outline"
                      onClick={generateQrCode}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      重新產生
                    </Button>
                  </div>
                )}

                {qrStatus === 'error' && (
                  <div className="w-48 h-48 flex flex-col items-center justify-center bg-red-50 rounded-lg">
                    <p className="text-red-600 mb-4">{qrError}</p>
                    <Button
                      variant="outline"
                      onClick={generateQrCode}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      重試
                    </Button>
                  </div>
                )}

                {qrStatus === 'ready' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateQrCode}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    重新產生
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
