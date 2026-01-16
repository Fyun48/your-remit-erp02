import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST /api/qr-login/authenticate
// Called by mobile app after scanning QR code to authenticate
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, email, password } = body

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: token, email, password' },
        { status: 400 }
      )
    }

    // Find the QR token
    const qrToken = await prisma.qrLoginToken.findUnique({
      where: { token },
    })

    if (!qrToken) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Check if token is still pending
    if (qrToken.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Token has already been used or expired' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date() > qrToken.expiresAt) {
      await prisma.qrLoginToken.update({
        where: { token },
        data: { status: 'EXPIRED' },
      })

      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      )
    }

    // Authenticate user with email/password
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            company: true,
            department: true,
            position: true,
          },
        },
      },
    })

    if (!employee || !employee.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, employee.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Update token status to AUTHENTICATED
    await prisma.qrLoginToken.update({
      where: { token },
      data: {
        status: 'AUTHENTICATED',
        employeeId: employee.id,
        authenticatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'QR login authenticated successfully',
      employee: {
        name: employee.name,
        email: employee.email,
        employeeNo: employee.employeeNo,
      },
    })
  } catch (error) {
    console.error('Failed to authenticate QR login:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
