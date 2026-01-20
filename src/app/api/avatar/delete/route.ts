import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { employeeId } = await request.json()

    if (!employeeId) {
      return NextResponse.json({ error: 'No employeeId provided' }, { status: 400 })
    }

    // Get current avatar URL
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { avatarUrl: true },
    })

    if (!employee?.avatarUrl) {
      return NextResponse.json({ error: 'No avatar to delete' }, { status: 400 })
    }

    // Delete file from disk
    try {
      const filepath = path.join(process.cwd(), 'public', employee.avatarUrl)
      await unlink(filepath)
    } catch {
      // File might not exist, continue anyway
    }

    // Clear avatar URL in database
    await prisma.employee.update({
      where: { id: employeeId },
      data: { avatarUrl: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Avatar delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    )
  }
}
