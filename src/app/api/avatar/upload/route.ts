import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const employeeId = formData.get('employeeId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'No employeeId provided' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP' },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      )
    }

    // Get file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'

    // Create unique filename
    const filename = `${employeeId}-${Date.now()}.${ext}`

    // Ensure avatars directory exists
    const avatarsDir = path.join(process.cwd(), 'public', 'avatars')
    try {
      await mkdir(avatarsDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer())
    const filepath = path.join(avatarsDir, filename)
    await writeFile(filepath, buffer)

    // Update employee avatar URL in database
    const avatarUrl = `/avatars/${filename}`
    await prisma.employee.update({
      where: { id: employeeId },
      data: { avatarUrl },
    })

    return NextResponse.json({ url: avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    )
  }
}
