# ERP 系統 Phase 1：基礎架構 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 ERP 系統的基礎架構，包含 Next.js 14 + tRPC + Prisma + PostgreSQL + NextAuth.js

**Architecture:** 使用 Next.js 14 App Router 作為前端和 API 層，tRPC 提供型別安全的 API，Prisma 作為 ORM 連接 PostgreSQL，NextAuth.js 處理認證。

**Tech Stack:** Next.js 14, TypeScript, tRPC, Prisma, PostgreSQL, NextAuth.js, TailwindCSS, shadcn/ui, Redis

**Prerequisites:**
- Node.js 18+
- PostgreSQL 安裝並運行
- Redis 安裝並運行（可選，開發階段可跳過）

---

## Task 1: 初始化 Next.js 專案

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Step 1: 建立 Next.js 專案**

```bash
cd C:/ClaudeCode/your-remit-erp02/.worktrees/initial-setup
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: 專案初始化完成，出現 Next.js 歡迎訊息

**Step 2: 驗證專案結構**

```bash
ls -la src/app/
```

Expected: 看到 `layout.tsx`, `page.tsx`, `globals.css`

**Step 3: 啟動開發伺服器測試**

```bash
npm run dev
```

Expected: 伺服器在 http://localhost:3000 啟動，無錯誤

**Step 4: 停止開發伺服器，提交初始化**

```bash
git add -A
git commit -m "feat: 初始化 Next.js 14 專案

- 使用 App Router
- TypeScript + TailwindCSS + ESLint
- 專案基礎結構

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 安裝核心依賴

**Files:**
- Modify: `package.json`

**Step 1: 安裝 tRPC 相關套件**

```bash
npm install @trpc/server@next @trpc/client@next @trpc/react-query@next @trpc/next@next @tanstack/react-query@^5 superjson zod
```

Expected: 安裝成功，無 peer dependency 錯誤

**Step 2: 安裝 Prisma**

```bash
npm install prisma @prisma/client
npm install -D prisma
```

Expected: 安裝成功

**Step 3: 安裝 NextAuth.js**

```bash
npm install next-auth@beta @auth/prisma-adapter
```

Expected: 安裝成功

**Step 4: 安裝 UI 相關套件**

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install -D @types/node
```

Expected: 安裝成功

**Step 5: 提交依賴安裝**

```bash
git add package.json package-lock.json
git commit -m "chore: 安裝核心依賴

- tRPC (型別安全 API)
- Prisma (ORM)
- NextAuth.js (認證)
- UI 工具套件

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 初始化 Prisma

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env`
- Create: `.env.example`

**Step 1: 初始化 Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: 建立 `prisma/schema.prisma` 和 `.env`

**Step 2: 更新 .gitignore 排除 .env**

在 `.gitignore` 末尾加入：

```
# Environment
.env
.env.local
.env.*.local

# Prisma
prisma/migrations/**/migration_lock.toml
```

**Step 3: 建立 .env.example**

```bash
# .env.example
DATABASE_URL="postgresql://username:password@localhost:5432/erp_db?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

**Step 4: 設定實際的 .env**

```bash
# .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/erp_db?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-secret-key-change-in-production"
```

**Step 5: 提交 Prisma 初始化**

```bash
git add prisma/schema.prisma .gitignore .env.example
git commit -m "chore: 初始化 Prisma

- PostgreSQL 資料來源設定
- 環境變數範例檔

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 設計核心資料模型 - 組織架構

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 定義 Group, Company, Department, Position 模型**

更新 `prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 組織架構 ====================

model Group {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  companies Company[]

  @@map("groups")
}

model Company {
  id        String   @id @default(cuid())
  groupId   String
  name      String
  code      String   @unique
  taxId     String?  // 統一編號
  address   String?
  phone     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  group       Group        @relation(fields: [groupId], references: [id])
  departments Department[]
  positions   Position[]
  employees   EmployeeAssignment[]

  @@map("companies")
}

model Department {
  id        String   @id @default(cuid())
  companyId String
  parentId  String?
  name      String
  code      String
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company    Company      @relation(fields: [companyId], references: [id])
  parent     Department?  @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children   Department[] @relation("DepartmentHierarchy")
  employees  EmployeeAssignment[]

  @@unique([companyId, code])
  @@map("departments")
}

model Position {
  id        String   @id @default(cuid())
  companyId String
  name      String
  code      String
  level     Int      @default(0) // 職級，用於審核流程
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company   Company    @relation(fields: [companyId], references: [id])
  employees EmployeeAssignment[]

  @@unique([companyId, code])
  @@map("positions")
}
```

**Step 2: 驗證 schema 格式**

```bash
npx prisma format
```

Expected: Schema 格式化成功，無錯誤

**Step 3: 提交組織架構模型**

```bash
git add prisma/schema.prisma
git commit -m "feat: 定義組織架構資料模型

- Group (集團)
- Company (公司)
- Department (部門，支援階層)
- Position (職位)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 設計核心資料模型 - 員工與權限

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 定義 Employee, EmployeeAssignment, Role, Permission 模型**

在 `prisma/schema.prisma` 加入：

```prisma
// ==================== 員工 ====================

model Employee {
  id              String   @id @default(cuid())
  employeeNo      String   @unique // 員工編號
  email           String   @unique
  passwordHash    String
  name            String
  idNumber        String?  // 身分證字號
  gender          Gender?
  birthDate       DateTime?
  phone           String?
  address         String?
  emergencyContact String?
  emergencyPhone  String?
  hireDate        DateTime
  resignDate      DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  assignments     EmployeeAssignment[]
  permissions     EmployeePermission[]
  sessions        Session[]
  accounts        Account[]

  @@map("employees")
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

model EmployeeAssignment {
  id           String   @id @default(cuid())
  employeeId   String
  companyId    String
  departmentId String
  positionId   String
  supervisorId String?  // 直屬主管
  isPrimary    Boolean  @default(false) // 是否為主要任職公司
  startDate    DateTime
  endDate      DateTime?
  status       AssignmentStatus @default(ACTIVE)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  employee   Employee    @relation(fields: [employeeId], references: [id])
  company    Company     @relation(fields: [companyId], references: [id])
  department Department  @relation(fields: [departmentId], references: [id])
  position   Position    @relation(fields: [positionId], references: [id])
  supervisor EmployeeAssignment? @relation("Supervision", fields: [supervisorId], references: [id])
  subordinates EmployeeAssignment[] @relation("Supervision")

  @@unique([employeeId, companyId])
  @@map("employee_assignments")
}

enum AssignmentStatus {
  ACTIVE      // 在職
  ON_LEAVE    // 留停
  RESIGNED    // 離職
}

// ==================== 權限 ====================

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false) // 系統角色不可刪除
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  permissions RolePermission[]
  employees   EmployeeAssignment[] @relation("EmployeeRole")

  @@map("roles")
}

model Permission {
  id          String   @id @default(cuid())
  code        String   @unique // e.g., "attendance.clock", "leave.apply"
  name        String
  module      String   // e.g., "attendance", "leave", "expense"
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  roles       RolePermission[]
  employees   EmployeePermission[]

  @@map("permissions")
}

model RolePermission {
  id           String   @id @default(cuid())
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

model EmployeePermission {
  id           String    @id @default(cuid())
  employeeId   String
  companyId    String
  permissionId String
  grantType    GrantType
  grantedById  String?   // 誰授權的
  grantedAt    DateTime  @default(now())
  expiresAt    DateTime? // 權限過期時間（可選）

  employee   Employee   @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([employeeId, companyId, permissionId])
  @@map("employee_permissions")
}

enum GrantType {
  GRANT   // 授予
  REVOKE  // 移除
}
```

**Step 2: 更新 EmployeeAssignment 加入 Role 關聯**

在 `EmployeeAssignment` 模型中加入：

```prisma
model EmployeeAssignment {
  // ... 現有欄位 ...
  roleId       String?

  // ... 現有關聯 ...
  role         Role?       @relation("EmployeeRole", fields: [roleId], references: [id])
}
```

**Step 3: 驗證 schema**

```bash
npx prisma format
npx prisma validate
```

Expected: 驗證成功，無錯誤

**Step 4: 提交員工與權限模型**

```bash
git add prisma/schema.prisma
git commit -m "feat: 定義員工與權限資料模型

- Employee (員工主檔)
- EmployeeAssignment (任職關係，多對多)
- Role (角色)
- Permission (權限項目)
- RolePermission (角色權限)
- EmployeePermission (個人權限調整)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 設計 NextAuth.js 認證模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 加入 NextAuth.js 所需模型**

在 `prisma/schema.prisma` 加入：

```prisma
// ==================== NextAuth.js ====================

model Account {
  id                String  @id @default(cuid())
  userId            String  @map("employee_id")
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user Employee @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String   @map("employee_id")
  expires      DateTime

  user Employee @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

**Step 2: 驗證完整 schema**

```bash
npx prisma format
npx prisma validate
```

Expected: 驗證成功

**Step 3: 提交認證模型**

```bash
git add prisma/schema.prisma
git commit -m "feat: 加入 NextAuth.js 認證模型

- Account (OAuth 帳號)
- Session (Session 管理)
- VerificationToken (驗證 Token)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 建立資料庫與執行 Migration

**Files:**
- Create: `prisma/migrations/` (自動產生)

**Step 1: 建立 PostgreSQL 資料庫**

```bash
# 使用 psql 或資料庫管理工具建立資料庫
# 確認 DATABASE_URL 在 .env 中設定正確
```

**Step 2: 執行 Prisma Migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration 成功，建立所有資料表

**Step 3: 產生 Prisma Client**

```bash
npx prisma generate
```

Expected: Prisma Client 產生成功

**Step 4: 驗證資料庫結構**

```bash
npx prisma studio
```

Expected: Prisma Studio 開啟，可看到所有資料表

**Step 5: 提交 Migration**

```bash
git add prisma/migrations/
git commit -m "feat: 初始資料庫 migration

建立所有基礎資料表：
- 組織架構 (groups, companies, departments, positions)
- 員工管理 (employees, employee_assignments)
- 權限系統 (roles, permissions, role_permissions, employee_permissions)
- 認證 (accounts, sessions, verification_tokens)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 建立 Prisma Client 工具

**Files:**
- Create: `src/lib/prisma.ts`

**Step 1: 建立 Prisma Client 單例**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
```

**Step 2: 提交**

```bash
git add src/lib/prisma.ts
git commit -m "feat: 建立 Prisma Client 工具

- 單例模式避免開發時連線過多
- 開發環境顯示查詢日誌

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: 設定 tRPC

**Files:**
- Create: `src/server/trpc.ts`
- Create: `src/server/routers/_app.ts`
- Create: `src/server/routers/health.ts`
- Create: `src/app/api/trpc/[trpc]/route.ts`
- Create: `src/lib/trpc.ts`

**Step 1: 建立 tRPC 初始化**

```typescript
// src/server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { prisma } from '@/lib/prisma'

export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    prisma,
    ...opts,
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createCallerFactory = t.createCallerFactory
export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
```

**Step 2: 建立 Health Router**

```typescript
// src/server/routers/health.ts
import { router, publicProcedure } from '../trpc'

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    // 檢查資料庫連線
    await ctx.prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }),
})
```

**Step 3: 建立 App Router**

```typescript
// src/server/routers/_app.ts
import { router } from '../trpc'
import { healthRouter } from './health'

export const appRouter = router({
  health: healthRouter,
})

export type AppRouter = typeof appRouter
```

**Step 4: 建立 API Route Handler**

```typescript
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(`❌ tRPC error on ${path}:`, error)
          }
        : undefined,
  })

export { handler as GET, handler as POST }
```

**Step 5: 建立 Client-side tRPC**

```typescript
// src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

export const trpc = createTRPCReact<AppRouter>()
```

**Step 6: 提交 tRPC 設定**

```bash
git add src/server/ src/app/api/trpc/ src/lib/trpc.ts
git commit -m "feat: 設定 tRPC

- tRPC 初始化與 context
- Health check router
- API route handler
- Client-side tRPC hook

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: 設定 tRPC Provider

**Files:**
- Create: `src/components/providers/trpc-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: 建立 tRPC Provider**

```typescript
// src/components/providers/trpc-provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { trpc } from '@/lib/trpc'

function getBaseUrl() {
  if (typeof window !== 'undefined') return ''
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

**Step 2: 更新 Layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/components/providers/trpc-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '集團 ERP 系統',
  description: '企業資源規劃系統',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  )
}
```

**Step 3: 驗證 tRPC 運作**

更新 `src/app/page.tsx` 測試：

```typescript
// src/app/page.tsx
'use client'

import { trpc } from '@/lib/trpc'

export default function Home() {
  const health = trpc.health.check.useQuery()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">集團 ERP 系統</h1>
      <div className="text-lg">
        {health.isLoading && <p>檢查系統狀態...</p>}
        {health.isError && <p className="text-red-500">系統錯誤</p>}
        {health.data && (
          <p className="text-green-500">
            系統狀態: {health.data.status} ({health.data.timestamp})
          </p>
        )}
      </div>
    </main>
  )
}
```

**Step 4: 執行測試**

```bash
npm run dev
# 開啟 http://localhost:3000 確認顯示「系統狀態: ok」
```

Expected: 頁面顯示「系統狀態: ok」與時間戳

**Step 5: 提交**

```bash
git add src/components/providers/ src/app/layout.tsx src/app/page.tsx
git commit -m "feat: 設定 tRPC Provider 與測試頁面

- TRPCProvider 包裝 QueryClient
- 更新 Layout 使用 Provider
- 首頁顯示系統健康狀態

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: 設定 NextAuth.js

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1: 建立 Auth 設定**

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const employee = await prisma.employee.findUnique({
          where: { email: credentials.email as string },
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                company: true,
                department: true,
                position: true,
                role: true,
              },
            },
          },
        })

        if (!employee || !employee.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          employee.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          employeeNo: employee.employeeNo,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.employeeNo = (user as any).employeeNo
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        (session.user as any).employeeNo = token.employeeNo
      }
      return session
    },
  },
})
```

**Step 2: 安裝 bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Step 3: 建立 Auth API Route**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

**Step 4: 建立 Auth 類型定義**

```typescript
// src/types/next-auth.d.ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      employeeNo: string
    } & DefaultSession['user']
  }
}
```

**Step 5: 提交**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/types/ package.json package-lock.json
git commit -m "feat: 設定 NextAuth.js 認證

- Credentials Provider (Email/Password)
- JWT Session 策略
- Prisma Adapter
- 自訂 Session 類型

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: 建立 Seed 資料

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: 建立 Seed Script**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 開始建立種子資料...')

  // 1. 建立集團
  const group = await prisma.group.upsert({
    where: { code: 'YOUR_REMIT' },
    update: {},
    create: {
      name: '金優匯集團',
      code: 'YOUR_REMIT',
    },
  })
  console.log('✅ 集團已建立:', group.name)

  // 2. 建立公司
  const company1 = await prisma.company.upsert({
    where: { code: 'YR001' },
    update: {},
    create: {
      groupId: group.id,
      name: '金優匯股份有限公司',
      code: 'YR001',
      taxId: '12345678',
    },
  })

  const company2 = await prisma.company.upsert({
    where: { code: 'YR002' },
    update: {},
    create: {
      groupId: group.id,
      name: '金優科技股份有限公司',
      code: 'YR002',
      taxId: '87654321',
    },
  })
  console.log('✅ 公司已建立:', company1.name, company2.name)

  // 3. 建立部門
  const adminDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'ADMIN' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '管理部',
      code: 'ADMIN',
    },
  })

  const financeDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'FINANCE' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '財務部',
      code: 'FINANCE',
    },
  })

  const itDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'IT' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '資訊部',
      code: 'IT',
    },
  })
  console.log('✅ 部門已建立')

  // 4. 建立職位
  const gmPosition = await prisma.position.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'GM' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '總經理',
      code: 'GM',
      level: 10,
    },
  })

  const managerPosition = await prisma.position.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'MGR' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '經理',
      code: 'MGR',
      level: 5,
    },
  })

  const staffPosition = await prisma.position.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'STAFF' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '專員',
      code: 'STAFF',
      level: 1,
    },
  })
  console.log('✅ 職位已建立')

  // 5. 建立角色
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: '集團最高管理員',
      isSystem: true,
    },
  })

  const companyAdminRole = await prisma.role.upsert({
    where: { name: 'COMPANY_ADMIN' },
    update: {},
    create: {
      name: 'COMPANY_ADMIN',
      description: '公司管理員',
      isSystem: true,
    },
  })

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: '主管',
      isSystem: true,
    },
  })

  const employeeRole = await prisma.role.upsert({
    where: { name: 'EMPLOYEE' },
    update: {},
    create: {
      name: 'EMPLOYEE',
      description: '一般員工',
      isSystem: true,
    },
  })
  console.log('✅ 角色已建立')

  // 6. 建立權限
  const permissions = [
    { code: 'attendance.clock', name: '打卡', module: 'attendance' },
    { code: 'attendance.view_self', name: '查看自己出勤', module: 'attendance' },
    { code: 'attendance.view_department', name: '查看部門出勤', module: 'attendance' },
    { code: 'attendance.exempt', name: '免打卡', module: 'attendance' },
    { code: 'leave.apply', name: '申請請假', module: 'leave' },
    { code: 'leave.approve', name: '審核請假', module: 'leave' },
    { code: 'expense.submit', name: '提交支出申請', module: 'expense' },
    { code: 'expense.approve', name: '審核支出申請', module: 'expense' },
    { code: 'expense.finance_review', name: '財務審核', module: 'expense' },
    { code: 'seal.apply', name: '申請用印', module: 'seal' },
    { code: 'seal.approve', name: '審核用印', module: 'seal' },
    { code: 'seal.admin_review', name: '管理部審核用印', module: 'seal' },
    { code: 'can_consult', name: '照會權限', module: 'approval' },
    { code: 'hr.view', name: '查看人事資料', module: 'hr' },
    { code: 'hr.manage', name: '管理人事資料', module: 'hr' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    })
  }
  console.log('✅ 權限已建立')

  // 7. 建立測試員工
  const passwordHash = await bcrypt.hash('admin123', 10)

  const adminEmployee = await prisma.employee.upsert({
    where: { email: 'admin@yourremit.com' },
    update: {},
    create: {
      employeeNo: 'EMP001',
      email: 'admin@yourremit.com',
      passwordHash,
      name: '系統管理員',
      hireDate: new Date('2020-01-01'),
    },
  })

  const managerEmployee = await prisma.employee.upsert({
    where: { email: 'manager@yourremit.com' },
    update: {},
    create: {
      employeeNo: 'EMP002',
      email: 'manager@yourremit.com',
      passwordHash,
      name: '王經理',
      gender: 'MALE',
      hireDate: new Date('2021-03-15'),
    },
  })

  const staffEmployee = await prisma.employee.upsert({
    where: { email: 'staff@yourremit.com' },
    update: {},
    create: {
      employeeNo: 'EMP003',
      email: 'staff@yourremit.com',
      passwordHash,
      name: '李小明',
      gender: 'MALE',
      hireDate: new Date('2023-06-01'),
    },
  })
  console.log('✅ 員工已建立')

  // 8. 建立任職關係
  await prisma.employeeAssignment.upsert({
    where: { employeeId_companyId: { employeeId: adminEmployee.id, companyId: company1.id } },
    update: {},
    create: {
      employeeId: adminEmployee.id,
      companyId: company1.id,
      departmentId: adminDept.id,
      positionId: gmPosition.id,
      roleId: superAdminRole.id,
      isPrimary: true,
      startDate: new Date('2020-01-01'),
    },
  })

  await prisma.employeeAssignment.upsert({
    where: { employeeId_companyId: { employeeId: managerEmployee.id, companyId: company1.id } },
    update: {},
    create: {
      employeeId: managerEmployee.id,
      companyId: company1.id,
      departmentId: financeDept.id,
      positionId: managerPosition.id,
      roleId: managerRole.id,
      isPrimary: true,
      startDate: new Date('2021-03-15'),
    },
  })

  const managerAssignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: managerEmployee.id, companyId: company1.id },
  })

  await prisma.employeeAssignment.upsert({
    where: { employeeId_companyId: { employeeId: staffEmployee.id, companyId: company1.id } },
    update: {},
    create: {
      employeeId: staffEmployee.id,
      companyId: company1.id,
      departmentId: financeDept.id,
      positionId: staffPosition.id,
      roleId: employeeRole.id,
      supervisorId: managerAssignment?.id,
      isPrimary: true,
      startDate: new Date('2023-06-01'),
    },
  })
  console.log('✅ 任職關係已建立')

  console.log('')
  console.log('🎉 種子資料建立完成！')
  console.log('')
  console.log('測試帳號：')
  console.log('  管理員: admin@yourremit.com / admin123')
  console.log('  經理: manager@yourremit.com / admin123')
  console.log('  員工: staff@yourremit.com / admin123')
}

main()
  .catch((e) => {
    console.error('❌ Seed 錯誤:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: 更新 package.json**

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

**Step 3: 安裝 ts-node**

```bash
npm install -D ts-node
```

**Step 4: 執行 Seed**

```bash
npx prisma db seed
```

Expected: 顯示種子資料建立成功訊息

**Step 5: 提交**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat: 建立種子資料

- 集團、公司、部門、職位
- 角色與權限
- 測試帳號 (admin/manager/staff)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 13: 建立登入頁面

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/lib/utils.ts`

**Step 1: 建立 utils**

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 2: 初始化 shadcn/ui**

```bash
npx shadcn-ui@latest init
```

選擇：
- Style: Default
- Base color: Slate
- CSS variables: Yes

**Step 3: 安裝 UI 元件**

```bash
npx shadcn-ui@latest add button input label card
```

**Step 4: 建立登入頁面**

```typescript
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('帳號或密碼錯誤')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      setError('登入時發生錯誤')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            集團 ERP 系統
          </CardTitle>
          <CardDescription className="text-center">
            請輸入您的帳號密碼登入
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登入中...' : '登入'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 5: 測試登入頁面**

```bash
npm run dev
# 開啟 http://localhost:3000/login
```

Expected: 顯示登入表單，可輸入帳號密碼

**Step 6: 提交**

```bash
git add src/app/login/ src/components/ui/ src/lib/utils.ts components.json tailwind.config.ts
git commit -m "feat: 建立登入頁面

- shadcn/ui 初始化
- 登入表單元件
- NextAuth credentials 認證

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 14: 建立 Dashboard 基礎結構

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/middleware.ts`

**Step 1: 建立 Middleware 保護路由**

```typescript
// src/middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard')
  const isOnLogin = req.nextUrl.pathname === '/login'

  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 2: 建立 Sidebar**

```typescript
// src/components/layout/sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  FileText,
  CreditCard,
  Settings,
} from 'lucide-react'

const navigation = [
  { name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { name: '人事管理', href: '/dashboard/hr', icon: Users },
  { name: '出勤管理', href: '/dashboard/attendance', icon: Clock },
  { name: '請假管理', href: '/dashboard/leave', icon: Calendar },
  { name: '審核中心', href: '/dashboard/approval', icon: FileText },
  { name: '財務會計', href: '/dashboard/finance', icon: CreditCard },
  { name: '系統設定', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">集團 ERP</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

**Step 3: 建立 Header**

```typescript
// src/components/layout/header.tsx
'use client'

import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold">歡迎使用 ERP 系統</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>{session?.user?.name || '使用者'}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          登出
        </Button>
      </div>
    </header>
  )
}
```

**Step 4: 建立 Dashboard Layout**

```typescript
// src/app/dashboard/layout.tsx
import { SessionProvider } from 'next-auth/react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-gray-100 p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
```

**Step 5: 建立 Dashboard 首頁**

```typescript
// src/app/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, Calendar, FileText } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()

  const stats = [
    { name: '待審核申請', value: '12', icon: FileText, color: 'text-blue-600' },
    { name: '本月出勤天數', value: '18', icon: Clock, color: 'text-green-600' },
    { name: '剩餘特休', value: '7 天', icon: Calendar, color: 'text-orange-600' },
    { name: '部門人數', value: '25', icon: Users, color: 'text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          歡迎回來，{session?.user?.name}
        </h1>
        <p className="text-gray-500">這是您的儀表板概覽</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近活動</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">暫無活動記錄</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>待辦事項</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">暫無待辦事項</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 6: 更新首頁導向**

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function Home() {
  const session = await auth()

  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
```

**Step 7: 測試完整流程**

```bash
npm run dev
# 1. 開啟 http://localhost:3000 → 應自動導向 /login
# 2. 使用 admin@yourremit.com / admin123 登入
# 3. 成功後應導向 /dashboard
# 4. 點擊登出應回到 /login
```

**Step 8: 提交**

```bash
git add src/app/dashboard/ src/components/layout/ src/middleware.ts src/app/page.tsx
git commit -m "feat: 建立 Dashboard 基礎結構

- 路由保護 middleware
- Sidebar 導航
- Header 使用者資訊與登出
- Dashboard 首頁統計卡片

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 1 完成檢查清單

- [ ] Next.js 14 專案初始化
- [ ] tRPC 設定完成並可呼叫
- [ ] Prisma 設定與 Migration 完成
- [ ] NextAuth.js 認證可運作
- [ ] 登入/登出流程正常
- [ ] Dashboard 基礎結構完成
- [ ] 所有測試帳號可登入

---

## 下一階段預告

**Phase 2: 人事管理模組**
- 員工 CRUD
- 部門管理
- 職位管理
- 權限設定介面

**Phase 3: 出勤模組**
- 班別設定
- 打卡功能
- 出勤紀錄查詢

**Phase 4: 請假模組**
- 假別設定
- 請假申請
- 餘額計算

**Phase 5: 審核流程**
- 流程設定
- 審核介面
- 照會功能

**Phase 6: 財務會計**
- 科目表
- 傳票管理
- 報表產出
