import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'

// Allowed file types and their MIME types
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 5

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const requestNo = formData.get('requestNo') as string | null

    // Generate a temporary ID if no requestNo provided (for new requests)
    const folderName = requestNo || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `最多只能上傳 ${MAX_FILES} 個檔案` },
        { status: 400 }
      )
    }

    const uploadedFiles: { name: string; url: string; size: number }[] = []
    const errors: string[] = []

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'seal-documents', folderName)
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    for (const file of files) {
      // Validate file type
      const isValidType = Object.keys(ALLOWED_TYPES).includes(file.type)
      if (!isValidType) {
        errors.push(`${file.name}: 不支援的檔案格式`)
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: 檔案大小超過 5MB 限制`)
        continue
      }

      // Create safe filename with timestamp to avoid conflicts
      const safeName = file.name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
        .replace(/_{2,}/g, '_')
      const timestamp = Date.now()
      const filename = `${timestamp}-${safeName}`

      // Save file
      const buffer = Buffer.from(await file.arrayBuffer())
      const filepath = path.join(uploadDir, filename)
      await writeFile(filepath, buffer)

      const fileUrl = `/seal-documents/${folderName}/${filename}`
      uploadedFiles.push({
        name: file.name,
        url: fileUrl,
        size: file.size,
      })
    }

    if (uploadedFiles.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: errors.join('; ') },
        { status: 400 }
      )
    }

    return NextResponse.json({
      files: uploadedFiles,
      folderName,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Seal document upload error:', error)
    return NextResponse.json(
      { error: '檔案上傳失敗' },
      { status: 500 }
    )
  }
}
