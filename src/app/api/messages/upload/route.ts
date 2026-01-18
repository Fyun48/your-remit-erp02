import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// 允許的檔案類型
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

// 最大檔案大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
    }

    // 檢查檔案類型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '不支援的檔案格式。支援：圖片、PDF、Word、Excel、文字檔' },
        { status: 400 }
      )
    }

    // 檢查檔案大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '檔案大小不能超過 10MB' },
        { status: 400 }
      )
    }

    // 建立儲存目錄
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'messages')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 產生唯一檔名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = file.name.split('.').pop() || ''
    const fileName = `${timestamp}-${randomStr}.${ext}`
    const filePath = join(uploadDir, fileName)

    // 儲存檔案
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 回傳檔案資訊
    return NextResponse.json({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileUrl: `/uploads/messages/${fileName}`,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: '上傳失敗' }, { status: 500 })
  }
}
