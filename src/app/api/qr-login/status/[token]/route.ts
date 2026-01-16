import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/qr-login/status/[token]
// Check the status of a QR login token
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const qrToken = await prisma.qrLoginToken.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeNo: true,
          },
        },
      },
    })

    if (!qrToken) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (new Date() > qrToken.expiresAt) {
      // Update status to EXPIRED if not already
      if (qrToken.status === 'PENDING') {
        await prisma.qrLoginToken.update({
          where: { token },
          data: { status: 'EXPIRED' },
        })
      }

      return NextResponse.json({
        status: 'EXPIRED',
        message: 'Token has expired',
      })
    }

    // Return current status
    return NextResponse.json({
      status: qrToken.status,
      employee: qrToken.status === 'AUTHENTICATED' ? qrToken.employee : null,
      expiresAt: qrToken.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Failed to check QR login status:', error)
    return NextResponse.json(
      { error: 'Failed to check token status' },
      { status: 500 }
    )
  }
}
