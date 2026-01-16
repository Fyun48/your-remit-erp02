import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/qr-login/complete
// Complete the QR login after mobile authentication
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      )
    }

    // Find the QR token
    const qrToken = await prisma.qrLoginToken.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            id: true,
            email: true,
            name: true,
            employeeNo: true,
          },
        },
      },
    })

    if (!qrToken) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Check if token is authenticated
    if (qrToken.status !== 'AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Token not authenticated', status: qrToken.status },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date() > qrToken.expiresAt) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      )
    }

    if (!qrToken.employee) {
      return NextResponse.json(
        { error: 'No employee associated with token' },
        { status: 400 }
      )
    }

    // Mark token as used
    await prisma.qrLoginToken.update({
      where: { token },
      data: { status: 'USED' },
    })

    // Return the employee data needed for NextAuth signIn
    // The client will use this to complete the login
    return NextResponse.json({
      success: true,
      employee: qrToken.employee,
    })
  } catch (error) {
    console.error('Failed to complete QR login:', error)
    return NextResponse.json(
      { error: 'Failed to complete login' },
      { status: 500 }
    )
  }
}
