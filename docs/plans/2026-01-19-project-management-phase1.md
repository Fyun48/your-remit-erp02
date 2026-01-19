# 專案管理模組 Phase 1 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立專案管理模組的基礎架構，包含資料庫結構、API 和基本頁面。

**Architecture:** 使用 Prisma 定義專案相關資料模型，透過 tRPC 建立 CRUD API，前端使用 Next.js App Router 建立列表頁和詳情頁。

**Tech Stack:** Prisma, tRPC, Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui

---

## Task 1: 更新 Prisma Schema - 列舉類型

**Files:**
- Modify: `prisma/schema.prisma` (在檔案末尾新增)

**Step 1: 新增專案相關列舉類型**

在 `prisma/schema.prisma` 檔案末尾新增：

```prisma
// ==================== 專案管理列舉 ====================

enum ProjectType {
  INTERNAL
  CLIENT
}

enum ProjectStatus {
  PLANNING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum ProjectVisibility {
  PRIVATE
  DEPARTMENT
  COMPANY
  CUSTOM
}

enum ProjectRole {
  MANAGER
  MEMBER
  OBSERVER
}

enum PhaseStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  COMPLETED
}

enum TaskPriority {
  HIGH
  MEDIUM
  LOW
}
```

**Step 2: 驗證 Schema 語法**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(project): add project management enums to schema"
```

---

## Task 2: 更新 Prisma Schema - 核心模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增 Project 模型**

在列舉類型之後新增：

```prisma
// ==================== 專案管理 ====================

model Project {
  id              String            @id @default(cuid())
  name            String
  description     String?           @db.Text
  type            ProjectType
  status          ProjectStatus     @default(PLANNING)
  visibility      ProjectVisibility @default(DEPARTMENT)

  plannedStartDate  DateTime?
  plannedEndDate    DateTime?
  actualStartDate   DateTime?
  actualEndDate     DateTime?

  companyId       String
  departmentId    String
  managerId       String
  customerId      String?
  templateId      String?

  qualityScore    Int?

  company         Company           @relation(fields: [companyId], references: [id])
  department      Department        @relation(fields: [departmentId], references: [id])
  manager         Employee          @relation("ProjectManager", fields: [managerId], references: [id])
  customer        Customer?         @relation(fields: [customerId], references: [id])

  phases          ProjectPhase[]
  members         ProjectMember[]
  visibleMembers  ProjectVisibleMember[]
  comments        ProjectComment[]
  attachments     ProjectAttachment[]
  activities      ProjectActivity[]
  auditLogs       ProjectAuditLog[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([companyId])
  @@index([departmentId])
  @@index([managerId])
  @@index([status])
  @@map("projects")
}

model ProjectPhase {
  id              String      @id @default(cuid())
  projectId       String
  name            String
  description     String?     @db.Text
  sortOrder       Int
  status          PhaseStatus @default(PENDING)
  plannedEndDate  DateTime?
  actualEndDate   DateTime?

  project         Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks           ProjectTask[]
  comments        ProjectComment[]
  attachments     ProjectAttachment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId])
  @@map("project_phases")
}

model ProjectTask {
  id              String       @id @default(cuid())
  phaseId         String
  parentId        String?
  name            String
  description     String?      @db.Text
  priority        TaskPriority @default(MEDIUM)
  status          TaskStatus   @default(TODO)

  assigneeId      String?
  estimatedHours  Float?
  actualHours     Float?
  startDate       DateTime?
  dueDate         DateTime?
  completedAt     DateTime?

  phase           ProjectPhase @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  parent          ProjectTask? @relation("SubTasks", fields: [parentId], references: [id])
  children        ProjectTask[] @relation("SubTasks")
  assignee        Employee?    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  comments        ProjectComment[]
  attachments     ProjectAttachment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([phaseId])
  @@index([parentId])
  @@index([assigneeId])
  @@index([status])
  @@map("project_tasks")
}
```

**Step 2: 驗證 Schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(project): add Project, ProjectPhase, ProjectTask models"
```

---

## Task 3: 更新 Prisma Schema - 成員與協作模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增成員與協作相關模型**

繼續在 schema 中新增：

```prisma
model ProjectMember {
  id          String      @id @default(cuid())
  projectId   String
  employeeId  String
  role        ProjectRole @default(MEMBER)
  joinedAt    DateTime    @default(now())
  leftAt      DateTime?

  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  employee    Employee    @relation("ProjectMembership", fields: [employeeId], references: [id])

  @@unique([projectId, employeeId])
  @@index([projectId])
  @@index([employeeId])
  @@map("project_members")
}

model ProjectVisibleMember {
  id          String   @id @default(cuid())
  projectId   String
  employeeId  String

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  employee    Employee @relation("ProjectVisibility", fields: [employeeId], references: [id])

  @@unique([projectId, employeeId])
  @@map("project_visible_members")
}

model ProjectComment {
  id          String    @id @default(cuid())
  projectId   String?
  phaseId     String?
  taskId      String?
  authorId    String
  content     String    @db.Text

  project     Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  phase       ProjectPhase?  @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  task        ProjectTask?   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author      Employee       @relation("ProjectCommentAuthor", fields: [authorId], references: [id])
  attachments ProjectAttachment[]
  mentions    ProjectCommentMention[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId])
  @@index([phaseId])
  @@index([taskId])
  @@index([authorId])
  @@map("project_comments")
}

model ProjectCommentMention {
  id          String         @id @default(cuid())
  commentId   String
  employeeId  String

  comment     ProjectComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  employee    Employee       @relation("ProjectMention", fields: [employeeId], references: [id])

  @@unique([commentId, employeeId])
  @@map("project_comment_mentions")
}

model ProjectAttachment {
  id          String    @id @default(cuid())
  projectId   String?
  phaseId     String?
  taskId      String?
  commentId   String?

  fileName    String
  fileUrl     String
  fileSize    Int
  mimeType    String
  uploaderId  String

  project     Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  phase       ProjectPhase?  @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  task        ProjectTask?   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  comment     ProjectComment? @relation(fields: [commentId], references: [id], onDelete: Cascade)
  uploader    Employee       @relation("ProjectAttachmentUploader", fields: [uploaderId], references: [id])

  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([taskId])
  @@index([uploaderId])
  @@map("project_attachments")
}
```

**Step 2: 驗證 Schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(project): add ProjectMember, Comment, Attachment models"
```

---

## Task 4: 更新 Prisma Schema - 活動與稽核模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增活動與稽核模型**

```prisma
model ProjectActivity {
  id          String   @id @default(cuid())
  projectId   String
  actorId     String
  action      String
  targetType  String
  targetId    String
  summary     String

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actor       Employee @relation("ProjectActivityActor", fields: [actorId], references: [id])

  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([actorId])
  @@index([createdAt])
  @@map("project_activities")
}

model ProjectAuditLog {
  id          String   @id @default(cuid())
  projectId   String
  actorId     String
  action      String
  targetType  String
  targetId    String
  beforeData  Json?
  afterData   Json?
  ipAddress   String?
  userAgent   String?

  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([actorId])
  @@index([createdAt])
  @@map("project_audit_logs")
}
```

**Step 2: 驗證 Schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(project): add ProjectActivity, ProjectAuditLog models"
```

---

## Task 5: 更新 Employee 模型關聯

**Files:**
- Modify: `prisma/schema.prisma` (Employee model)

**Step 1: 在 Employee 模型中新增專案相關關聯**

找到 `model Employee` 區塊，在其關聯欄位區域新增：

```prisma
  // 專案管理關聯
  managedProjects      Project[]              @relation("ProjectManager")
  projectMemberships   ProjectMember[]        @relation("ProjectMembership")
  projectVisibilities  ProjectVisibleMember[] @relation("ProjectVisibility")
  projectComments      ProjectComment[]       @relation("ProjectCommentAuthor")
  projectMentions      ProjectCommentMention[] @relation("ProjectMention")
  projectAttachments   ProjectAttachment[]    @relation("ProjectAttachmentUploader")
  projectActivities    ProjectActivity[]      @relation("ProjectActivityActor")
  assignedTasks        ProjectTask[]          @relation("TaskAssignee")
```

**Step 2: 驗證 Schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(project): add project relations to Employee model"
```

---

## Task 6: 推送資料庫變更

**Files:**
- None (database operation)

**Step 1: 產生並推送 Migration**

Run: `npx prisma db push`
Expected: 成功建立所有新資料表

**Step 2: 產生 Prisma Client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "chore(project): sync database schema"
```

---

## Task 7: 建立專案 tRPC Router - 基本結構

**Files:**
- Create: `src/server/routers/project.ts`

**Step 1: 建立 Router 檔案**

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const projectRouter = router({
  // 取得專案列表
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      type: z.enum(['INTERNAL', 'CLIENT']).optional(),
      departmentId: z.string().optional(),
      managerId: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      }

      if (input.status) where.status = input.status
      if (input.type) where.type = input.type
      if (input.departmentId) where.departmentId = input.departmentId
      if (input.managerId) where.managerId = input.managerId

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ]
      }

      return ctx.prisma.project.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, employeeNo: true } },
          customer: { select: { id: true, name: true } },
          _count: {
            select: {
              phases: true,
              members: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }),

  // 取得單一專案詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, employeeNo: true } },
          customer: { select: { id: true, name: true } },
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                orderBy: { createdAt: 'asc' },
                include: {
                  assignee: { select: { id: true, name: true } },
                  children: {
                    include: {
                      assignee: { select: { id: true, name: true } },
                    },
                  },
                },
                where: { parentId: null }, // 只取頂層任務
              },
            },
          },
          members: {
            include: {
              employee: { select: { id: true, name: true, employeeNo: true } },
            },
          },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      return project
    }),

  // 建立專案
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1, '請輸入專案名稱'),
      description: z.string().optional(),
      type: z.enum(['INTERNAL', 'CLIENT']),
      visibility: z.enum(['PRIVATE', 'DEPARTMENT', 'COMPANY', 'CUSTOM']).default('DEPARTMENT'),
      plannedStartDate: z.date().optional(),
      plannedEndDate: z.date().optional(),
      companyId: z.string(),
      departmentId: z.string(),
      managerId: z.string(),
      customerId: z.string().optional(),
      memberIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { memberIds, ...projectData } = input

      const project = await ctx.prisma.project.create({
        data: {
          ...projectData,
          members: {
            create: [
              // 專案經理自動成為成員
              { employeeId: input.managerId, role: 'MANAGER' },
              // 其他成員
              ...(memberIds || [])
                .filter(id => id !== input.managerId)
                .map(employeeId => ({ employeeId, role: 'MEMBER' as const })),
            ],
          },
        },
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
        },
      })

      // 記錄活動
      await ctx.prisma.projectActivity.create({
        data: {
          projectId: project.id,
          actorId: input.managerId,
          action: 'CREATED',
          targetType: 'PROJECT',
          targetId: project.id,
          summary: `建立了專案「${project.name}」`,
        },
      })

      return project
    }),

  // 更新專案
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      visibility: z.enum(['PRIVATE', 'DEPARTMENT', 'COMPANY', 'CUSTOM']).optional(),
      plannedStartDate: z.date().nullable().optional(),
      plannedEndDate: z.date().nullable().optional(),
      actualStartDate: z.date().nullable().optional(),
      actualEndDate: z.date().nullable().optional(),
      qualityScore: z.number().min(1).max(5).optional(),
      updatedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, updatedById, ...data } = input

      const existing = await ctx.prisma.project.findUnique({ where: { id } })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      const project = await ctx.prisma.project.update({
        where: { id },
        data,
      })

      // 記錄活動
      await ctx.prisma.projectActivity.create({
        data: {
          projectId: id,
          actorId: updatedById,
          action: 'UPDATED',
          targetType: 'PROJECT',
          targetId: id,
          summary: `更新了專案資訊`,
        },
      })

      return project
    }),

  // 刪除專案
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.project.delete({ where: { id: input.id } })
      return { success: true }
    }),
})
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/server/routers/project.ts
git commit -m "feat(project): add project tRPC router with CRUD operations"
```

---

## Task 8: 註冊專案 Router

**Files:**
- Modify: `src/server/routers/_app.ts`

**Step 1: 引入並註冊 projectRouter**

在 imports 區塊新增：

```typescript
import { projectRouter } from './project'
```

在 `appRouter` 中新增：

```typescript
  project: projectRouter,
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/server/routers/_app.ts
git commit -m "feat(project): register project router in app router"
```

---

## Task 9: 建立階段 API

**Files:**
- Modify: `src/server/routers/project.ts`

**Step 1: 新增階段相關 procedures**

在 `projectRouter` 中新增：

```typescript
  // ==================== 階段管理 ====================

  // 建立階段
  createPhase: publicProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1, '請輸入階段名稱'),
      description: z.string().optional(),
      plannedEndDate: z.date().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { actorId, ...data } = input

      // 取得目前最大排序
      const maxOrder = await ctx.prisma.projectPhase.aggregate({
        where: { projectId: input.projectId },
        _max: { sortOrder: true },
      })

      const phase = await ctx.prisma.projectPhase.create({
        data: {
          ...data,
          sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        },
      })

      // 記錄活動
      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId,
          action: 'CREATED',
          targetType: 'PHASE',
          targetId: phase.id,
          summary: `新增了階段「${phase.name}」`,
        },
      })

      return phase
    }),

  // 更新階段
  updatePhase: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
      plannedEndDate: z.date().nullable().optional(),
      actualEndDate: z.date().nullable().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, actorId, ...data } = input

      const phase = await ctx.prisma.projectPhase.update({
        where: { id },
        data,
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: phase.projectId,
          actorId,
          action: 'UPDATED',
          targetType: 'PHASE',
          targetId: phase.id,
          summary: `更新了階段「${phase.name}」`,
        },
      })

      return phase
    }),

  // 刪除階段
  deletePhase: publicProcedure
    .input(z.object({
      id: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const phase = await ctx.prisma.projectPhase.findUnique({
        where: { id: input.id },
      })

      if (!phase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '階段不存在' })
      }

      await ctx.prisma.projectPhase.delete({ where: { id: input.id } })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: phase.projectId,
          actorId: input.actorId,
          action: 'DELETED',
          targetType: 'PHASE',
          targetId: input.id,
          summary: `刪除了階段「${phase.name}」`,
        },
      })

      return { success: true }
    }),

  // 重新排序階段
  reorderPhases: publicProcedure
    .input(z.object({
      projectId: z.string(),
      phaseIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = input.phaseIds.map((id, index) =>
        ctx.prisma.projectPhase.update({
          where: { id },
          data: { sortOrder: index + 1 },
        })
      )

      await ctx.prisma.$transaction(updates)
      return { success: true }
    }),
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/server/routers/project.ts
git commit -m "feat(project): add phase management API"
```

---

## Task 10: 建立任務 API

**Files:**
- Modify: `src/server/routers/project.ts`

**Step 1: 新增任務相關 procedures**

在 `projectRouter` 中新增：

```typescript
  // ==================== 任務管理 ====================

  // 建立任務
  createTask: publicProcedure
    .input(z.object({
      phaseId: z.string(),
      parentId: z.string().optional(),
      name: z.string().min(1, '請輸入任務名稱'),
      description: z.string().optional(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
      assigneeId: z.string().optional(),
      estimatedHours: z.number().optional(),
      startDate: z.date().optional(),
      dueDate: z.date().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { actorId, ...data } = input

      const phase = await ctx.prisma.projectPhase.findUnique({
        where: { id: input.phaseId },
        select: { projectId: true },
      })

      if (!phase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '階段不存在' })
      }

      const task = await ctx.prisma.projectTask.create({
        data,
        include: {
          assignee: { select: { id: true, name: true } },
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: phase.projectId,
          actorId,
          action: 'CREATED',
          targetType: 'TASK',
          targetId: task.id,
          summary: `新增了任務「${task.name}」`,
        },
      })

      return task
    }),

  // 更新任務
  updateTask: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
      assigneeId: z.string().nullable().optional(),
      estimatedHours: z.number().nullable().optional(),
      actualHours: z.number().nullable().optional(),
      startDate: z.date().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, actorId, ...data } = input

      const existing = await ctx.prisma.projectTask.findUnique({
        where: { id },
        include: { phase: { select: { projectId: true } } },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '任務不存在' })
      }

      // 如果狀態變更為完成，自動設定完成時間
      const updateData: Record<string, unknown> = { ...data }
      if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updateData.completedAt = new Date()
      } else if (data.status && data.status !== 'COMPLETED') {
        updateData.completedAt = null
      }

      const task = await ctx.prisma.projectTask.update({
        where: { id },
        data: updateData,
        include: {
          assignee: { select: { id: true, name: true } },
        },
      })

      // 記錄活動
      let summary = `更新了任務「${task.name}」`
      if (data.status === 'COMPLETED') {
        summary = `完成了任務「${task.name}」`
      } else if (data.status === 'IN_PROGRESS' && existing.status === 'TODO') {
        summary = `開始執行任務「${task.name}」`
      }

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: existing.phase.projectId,
          actorId,
          action: data.status ? 'STATUS_CHANGED' : 'UPDATED',
          targetType: 'TASK',
          targetId: task.id,
          summary,
        },
      })

      return task
    }),

  // 刪除任務
  deleteTask: publicProcedure
    .input(z.object({
      id: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.projectTask.findUnique({
        where: { id: input.id },
        include: { phase: { select: { projectId: true } } },
      })

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '任務不存在' })
      }

      await ctx.prisma.projectTask.delete({ where: { id: input.id } })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: task.phase.projectId,
          actorId: input.actorId,
          action: 'DELETED',
          targetType: 'TASK',
          targetId: input.id,
          summary: `刪除了任務「${task.name}」`,
        },
      })

      return { success: true }
    }),
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/server/routers/project.ts
git commit -m "feat(project): add task management API"
```

---

## Task 11: 建立成員 API

**Files:**
- Modify: `src/server/routers/project.ts`

**Step 1: 新增成員相關 procedures**

在 `projectRouter` 中新增：

```typescript
  // ==================== 成員管理 ====================

  // 新增成員
  addMember: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      role: z.enum(['MANAGER', 'MEMBER', 'OBSERVER']).default('MEMBER'),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { actorId, ...data } = input

      // 檢查是否已是成員
      const existing = await ctx.prisma.projectMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
      })

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '該員工已是專案成員' })
      }

      const member = await ctx.prisma.projectMember.create({
        data,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId,
          action: 'MEMBER_ADDED',
          targetType: 'MEMBER',
          targetId: member.id,
          summary: `將「${member.employee.name}」加入專案`,
        },
      })

      return member
    }),

  // 更新成員角色
  updateMemberRole: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      role: z.enum(['MANAGER', 'MEMBER', 'OBSERVER']),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.update({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        data: { role: input.role },
        include: {
          employee: { select: { id: true, name: true } },
        },
      })

      const roleLabels = { MANAGER: '經理', MEMBER: '成員', OBSERVER: '觀察者' }

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId: input.actorId,
          action: 'MEMBER_ROLE_CHANGED',
          targetType: 'MEMBER',
          targetId: member.id,
          summary: `將「${member.employee.name}」的角色變更為${roleLabels[input.role]}`,
        },
      })

      return member
    }),

  // 移除成員
  removeMember: publicProcedure
    .input(z.object({
      projectId: z.string(),
      employeeId: z.string(),
      actorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        include: {
          employee: { select: { name: true } },
        },
      })

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '成員不存在' })
      }

      // 軟刪除：記錄離開時間
      await ctx.prisma.projectMember.update({
        where: {
          projectId_employeeId: {
            projectId: input.projectId,
            employeeId: input.employeeId,
          },
        },
        data: { leftAt: new Date() },
      })

      await ctx.prisma.projectActivity.create({
        data: {
          projectId: input.projectId,
          actorId: input.actorId,
          action: 'MEMBER_REMOVED',
          targetType: 'MEMBER',
          targetId: member.id,
          summary: `將「${member.employee.name}」移出專案`,
        },
      })

      return { success: true }
    }),
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/server/routers/project.ts
git commit -m "feat(project): add member management API"
```

---

## Task 12: 建立專案列表頁面

**Files:**
- Create: `src/app/dashboard/projects/page.tsx`

**Step 1: 建立伺服器端頁面**

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ProjectList } from './project-list'

export default async function ProjectsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id
  const currentCompany = await getCurrentCompany(employeeId)

  if (!currentCompany) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <ProjectList
        companyId={currentCompany.id}
        companyName={currentCompany.name}
        currentUserId={employeeId}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/projects/page.tsx
git commit -m "feat(project): add projects list page"
```

---

## Task 13: 建立專案列表客戶端元件

**Files:**
- Create: `src/app/dashboard/projects/project-list.tsx`

**Step 1: 建立客戶端元件**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trpc } from '@/lib/trpc'
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Calendar,
  Building2,
} from 'lucide-react'

interface ProjectListProps {
  companyId: string
  companyName: string
  currentUserId: string
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PLANNING: { label: '規劃中', color: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: '進行中', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-700' },
}

const typeLabels: Record<string, { label: string; color: string }> = {
  INTERNAL: { label: '內部專案', color: 'bg-purple-100 text-purple-700' },
  CLIENT: { label: '客戶專案', color: 'bg-orange-100 text-orange-700' },
}

export function ProjectList({
  companyId,
  companyName,
  currentUserId,
}: ProjectListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data: projects, isLoading } = trpc.project.list.useQuery({
    companyId,
    status: statusFilter !== 'all' ? statusFilter as 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' : undefined,
    type: typeFilter !== 'all' ? typeFilter as 'INTERNAL' | 'CLIENT' : undefined,
    search: search || undefined,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">專案管理</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增專案
          </Button>
        </Link>
      </div>

      {/* 篩選器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋專案名稱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="PLANNING">規劃中</SelectItem>
                <SelectItem value="IN_PROGRESS">進行中</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部類型</SelectItem>
                <SelectItem value="INTERNAL">內部專案</SelectItem>
                <SelectItem value="CLIENT">客戶專案</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 專案列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">載入中...</div>
      ) : !projects || projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">尚無專案</p>
            <Link href="/dashboard/projects/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                建立第一個專案
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = statusLabels[project.status]
            const type = typeLabels[project.type]

            return (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-1">
                        {project.name}
                      </CardTitle>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                    <Badge variant="outline" className={type.color}>
                      {type.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        <span>{project.department.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{project._count.members} 人</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FolderKanban className="h-4 w-4" />
                        <span>{project._count.phases} 階段</span>
                      </div>
                    </div>
                    {project.plannedEndDate && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          預計完成：
                          {new Date(project.plannedEndDate).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <div className="text-sm">
                        <span className="text-muted-foreground">負責人：</span>
                        {project.manager.name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/app/dashboard/projects/project-list.tsx
git commit -m "feat(project): add project list client component"
```

---

## Task 14: 建立新增專案頁面

**Files:**
- Create: `src/app/dashboard/projects/new/page.tsx`
- Create: `src/app/dashboard/projects/new/project-form.tsx`

**Step 1: 建立伺服器端頁面**

```typescript
// src/app/dashboard/projects/new/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/use-current-company'
import { ProjectForm } from './project-form'

export default async function NewProjectPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employeeId = session.user.id
  const currentCompany = await getCurrentCompany(employeeId)

  if (!currentCompany) {
    redirect('/dashboard')
  }

  return (
    <ProjectForm
      companyId={currentCompany.id}
      companyName={currentCompany.name}
      currentUserId={employeeId}
    />
  )
}
```

**Step 2: Commit page.tsx**

```bash
git add src/app/dashboard/projects/new/page.tsx
git commit -m "feat(project): add new project page"
```

---

## Task 15: 建立新增專案表單元件

**Files:**
- Create: `src/app/dashboard/projects/new/project-form.tsx`

**Step 1: 建立表單元件**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trpc } from '@/lib/trpc'
import { ArrowLeft, FolderKanban } from 'lucide-react'

interface ProjectFormProps {
  companyId: string
  companyName: string
  currentUserId: string
}

export function ProjectForm({
  companyId,
  companyName,
  currentUserId,
}: ProjectFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'INTERNAL' as 'INTERNAL' | 'CLIENT',
    visibility: 'DEPARTMENT' as 'PRIVATE' | 'DEPARTMENT' | 'COMPANY' | 'CUSTOM',
    departmentId: '',
    managerId: currentUserId,
    customerId: '',
    plannedStartDate: '',
    plannedEndDate: '',
  })

  // 取得部門列表
  const { data: departments } = trpc.department.list.useQuery({ companyId })

  // 取得員工列表
  const { data: employees } = trpc.hr.listEmployees.useQuery({
    companyId,
    status: 'ACTIVE',
  })

  // 取得客戶列表
  const { data: customers } = trpc.customer.list.useQuery({ companyId })

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      router.push(`/dashboard/projects/${project.id}`)
    },
    onError: (err) => {
      setError(err.message)
      setIsLoading(false)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError('請輸入專案名稱')
      return
    }

    if (!formData.departmentId) {
      setError('請選擇負責部門')
      return
    }

    setIsLoading(true)

    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      visibility: formData.visibility,
      companyId,
      departmentId: formData.departmentId,
      managerId: formData.managerId,
      customerId: formData.type === 'CLIENT' && formData.customerId ? formData.customerId : undefined,
      plannedStartDate: formData.plannedStartDate ? new Date(formData.plannedStartDate) : undefined,
      plannedEndDate: formData.plannedEndDate ? new Date(formData.plannedEndDate) : undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新增專案</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              專案資訊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">專案類型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'INTERNAL' | 'CLIENT') =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">內部專案</SelectItem>
                    <SelectItem value="CLIENT">客戶專案</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">可見性 *</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: 'PRIVATE' | 'DEPARTMENT' | 'COMPANY' | 'CUSTOM') =>
                    setFormData({ ...formData, visibility: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">私有（僅成員）</SelectItem>
                    <SelectItem value="DEPARTMENT">部門可見</SelectItem>
                    <SelectItem value="COMPANY">公司可見</SelectItem>
                    <SelectItem value="CUSTOM">自訂</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">專案名稱 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入專案名稱"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">專案描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="請輸入專案描述"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departmentId">負責部門 *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, departmentId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇部門" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="managerId">專案經理 *</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, managerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇經理" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.employee.id} value={emp.employee.id}>
                        {emp.employee.name} ({emp.employee.employeeNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'CLIENT' && (
              <div className="space-y-2">
                <Label htmlFor="customerId">客戶</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, customerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇客戶" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plannedStartDate">預計開始日</Label>
                <Input
                  id="plannedStartDate"
                  type="date"
                  value={formData.plannedStartDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedStartDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedEndDate">預計結束日</Label>
                <Input
                  id="plannedEndDate"
                  type="date"
                  value={formData.plannedEndDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedEndDate: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/dashboard/projects">
            <Button type="button" variant="outline" disabled={isLoading}>
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? '建立中...' : '建立專案'}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/app/dashboard/projects/new/project-form.tsx
git commit -m "feat(project): add project form component"
```

---

## Task 16: 新增專案選單到 Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 在選單中新增專案項目**

找到選單項目定義處，新增專案項目：

```typescript
{
  title: '專案管理',
  href: '/dashboard/projects',
  icon: FolderKanban,
},
```

確保 import 包含 `FolderKanban`：

```typescript
import { FolderKanban } from 'lucide-react'
```

**Step 2: 驗證 TypeScript**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(project): add project menu to sidebar"
```

---

## Task 17: 最終驗證

**Step 1: 執行 TypeScript 檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

**Step 2: 執行 ESLint**

Run: `npm run lint`
Expected: 無錯誤或僅有 warning

**Step 3: 啟動開發伺服器測試**

Run: `npm run dev`

測試項目：
1. 訪問 `/dashboard/projects` 確認頁面正常顯示
2. 點擊「新增專案」確認表單正常
3. 建立一個測試專案確認 API 正常

**Step 4: 最終 Commit**

```bash
git add -A
git commit -m "feat(project): complete Phase 1 - project management foundation"
```

---

## 完成總結

Phase 1 完成後，專案將具備：

- ✅ 完整的 Prisma Schema（專案、階段、任務、成員、活動、稽核）
- ✅ tRPC API（CRUD 操作、階段管理、任務管理、成員管理）
- ✅ 專案列表頁面（篩選、搜尋）
- ✅ 新增專案頁面（表單）
- ✅ Sidebar 選單整合

下一階段（Phase 2）將實作：
- 專案詳情頁面
- 階段與任務的 UI 操作
- 進度計算與顯示
