import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Allowed file types and their MIME types
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_FILES = 10

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const projectId = formData.get('projectId') as string | null
    const phaseId = formData.get('phaseId') as string | null
    const taskId = formData.get('taskId') as string | null

    if (!projectId) {
      return NextResponse.json({ error: '缺少專案 ID' }, { status: 400 })
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `最多只能上傳 ${MAX_FILES} 個檔案` },
        { status: 400 }
      )
    }

    const uploadedFiles: { id: string; name: string; url: string; size: number; mimeType: string }[] = []
    const errors: string[] = []

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'project-files', projectId)
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
        errors.push(`${file.name}: 檔案大小超過 20MB 限制`)
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

      const fileUrl = `/project-files/${projectId}/${filename}`

      // Create database record
      const attachment = await prisma.projectAttachment.create({
        data: {
          projectId: taskId ? null : (phaseId ? null : projectId),
          phaseId: taskId ? null : phaseId,
          taskId,
          fileName: file.name,
          fileUrl,
          fileSize: file.size,
          mimeType: file.type,
          uploaderId: session.user.id,
        },
      })

      uploadedFiles.push({
        id: attachment.id,
        name: file.name,
        url: fileUrl,
        size: file.size,
        mimeType: file.type,
      })
    }

    // Log activity
    if (uploadedFiles.length > 0) {
      let targetType = 'PROJECT'
      let targetId = projectId
      let summary = `上傳了 ${uploadedFiles.length} 個附件`

      if (taskId) {
        const task = await prisma.projectTask.findUnique({
          where: { id: taskId },
          select: { name: true },
        })
        targetType = 'TASK'
        targetId = taskId
        summary = `在任務「${task?.name}」上傳了 ${uploadedFiles.length} 個附件`
      } else if (phaseId) {
        const phase = await prisma.projectPhase.findUnique({
          where: { id: phaseId },
          select: { name: true },
        })
        targetType = 'PHASE'
        targetId = phaseId
        summary = `在階段「${phase?.name}」上傳了 ${uploadedFiles.length} 個附件`
      }

      await prisma.projectActivity.create({
        data: {
          projectId,
          actorId: session.user.id,
          action: 'UPLOADED',
          targetType,
          targetId,
          summary,
        },
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
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Project attachment upload error:', error)
    return NextResponse.json(
      { error: '檔案上傳失敗' },
      { status: 500 }
    )
  }
}
