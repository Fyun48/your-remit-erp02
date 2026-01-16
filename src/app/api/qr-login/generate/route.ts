import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

// POST /api/qr-login/generate
// Generate a new QR login token
export async function POST(request: Request) {
  try {
    // Get IP and User-Agent from request
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Generate a secure random token
    const token = randomBytes(32).toString('hex')

    // Set expiration time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    // Clean up old expired tokens
    await prisma.qrLoginToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    // Create the token
    const qrToken = await prisma.qrLoginToken.create({
      data: {
        token,
        status: 'PENDING',
        ipAddress,
        userAgent,
        expiresAt,
      },
    })

    return NextResponse.json({
      token: qrToken.token,
      expiresAt: qrToken.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Failed to generate QR login token:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR login token' },
      { status: 500 }
    )
  }
}
