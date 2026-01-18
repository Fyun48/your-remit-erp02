import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET
const LINE_CALLBACK_URL = process.env.LINE_CALLBACK_URL || `${process.env.NEXTAUTH_URL}/api/line/callback`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle error from LINE
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?line_error=${error}`, request.url)
    )
  }

  // Validate parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?line_error=invalid_request', request.url)
    )
  }

  // Check configuration
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?line_error=not_configured', request.url)
    )
  }

  try {
    // Parse state
    let stateData: { userId: string; redirectUrl: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?line_error=invalid_state', request.url)
      )
    }

    // Check state timestamp (max 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(
        new URL(`${stateData.redirectUrl}?line_error=expired`, request.url)
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_CALLBACK_URL,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('LINE token error:', errorData)
      return NextResponse.redirect(
        new URL(`${stateData.redirectUrl}?line_error=token_failed`, request.url)
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, expires_in } = tokenData

    // Get user profile
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!profileResponse.ok) {
      return NextResponse.redirect(
        new URL(`${stateData.redirectUrl}?line_error=profile_failed`, request.url)
      )
    }

    const profile = await profileResponse.json()
    const { userId: lineUserId, displayName } = profile

    // Check if LINE account is already linked to another user
    const existingLink = await prisma.employee.findFirst({
      where: {
        lineUserId,
        id: { not: stateData.userId },
      },
    })

    if (existingLink) {
      return NextResponse.redirect(
        new URL(`${stateData.redirectUrl}?line_error=already_linked`, request.url)
      )
    }

    // Update employee record
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    await prisma.employee.update({
      where: { id: stateData.userId },
      data: {
        lineUserId,
        lineAccessToken: access_token,
        lineTokenExpiresAt: expiresAt,
      },
    })

    // Create audit log
    await createAuditLog({
      entityType: 'Employee',
      entityId: stateData.userId,
      action: 'LINE_LINK',
      operatorId: stateData.userId,
      newValue: { lineUserId, displayName },
    })

    // Redirect with success
    return NextResponse.redirect(
      new URL(`${stateData.redirectUrl}?line_success=true&line_name=${encodeURIComponent(displayName)}`, request.url)
    )
  } catch (error) {
    console.error('LINE callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?line_error=server_error', request.url)
    )
  }
}
