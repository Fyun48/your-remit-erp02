# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-company ERP system (集團企業 ERP) built with Next.js 14, supporting group-level management across multiple companies. The system includes HR management, attendance tracking, leave management, expense reimbursement, financial accounting, and administrative functions.

## Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build (runs prisma generate first)
npm run lint             # ESLint

# Database
npm run db:push          # Push schema to database
npm run db:generate      # Generate Prisma Client
npm run db:seed          # Seed initial data
npm run db:studio        # Open Prisma Studio
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 (beta) with JWT strategy + QR code login
- **API**: tRPC v10 with React Query
- **UI**: Tailwind CSS + shadcn/ui + Radix UI

## Architecture

### Multi-Tenancy Model

The system uses a hierarchical organization structure:
- **Group** → **Company** → **Department** → **Position**
- Employees have **EmployeeAssignment** records linking them to companies with department/position
- Users can have assignments in multiple companies simultaneously

### Permission System (`src/lib/permission.ts`)

Three-tier permission model:
1. **Basic permissions**: All employees get profile view, clock-in, leave apply, expense apply
2. **Company managers**: Department name contains "管理" AND position level >= 7 → all company permissions
3. **Group admins**: `GROUP_ADMIN` in GroupPermission → all permissions across all companies
4. **Special permissions**: Individual grants via EmployeePermission table

### tRPC API Structure

- **Server setup**: `src/server/trpc.ts` (context, procedures)
- **Router root**: `src/server/routers/_app.ts`
- **Client**: `src/lib/trpc.ts` + `src/components/providers/trpc-provider.tsx`

All routers are in `src/server/routers/` and use `publicProcedure` (auth handled at page level).

### Page Structure

Dashboard pages follow the pattern:
- Server Component (`page.tsx`): Auth check, data fetching, permission check
- Client Component (e.g., `*-list.tsx`, `*-form.tsx`): Interactive UI with tRPC hooks

### Key Directories

```
src/
├── app/
│   ├── api/                 # API routes (auth, trpc, uploads)
│   ├── dashboard/           # Protected dashboard pages
│   │   ├── admin/           # Administrative (seal, card, stationery)
│   │   ├── attendance/      # Clock in/out
│   │   ├── expense/         # Expense reimbursement
│   │   ├── finance/         # Accounting (vouchers, AR/AP)
│   │   ├── hr/              # HR management
│   │   ├── leave/           # Leave requests
│   │   ├── reports/         # Various reports
│   │   ├── settings/        # System settings
│   │   └── system/          # System admin (companies, permissions, audit)
│   └── login/               # Login page
├── components/
│   ├── layout/              # Sidebar, header
│   ├── providers/           # Session, tRPC providers
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── permission.ts        # Permission checking utilities
│   ├── group-permission.ts  # Group admin utilities
│   ├── audit.ts             # Audit logging
│   ├── email.ts             # Email utilities (nodemailer)
│   ├── prisma.ts            # Prisma client singleton
│   └── trpc.ts              # tRPC client setup
└── server/
    ├── trpc.ts              # tRPC server setup
    └── routers/             # All tRPC routers
```

## Database Schema Highlights

Key models in `prisma/schema.prisma`:
- **Employee**: Core user entity with auth credentials
- **EmployeeAssignment**: Links employees to companies with department/position/role
- **GroupPermission**: Group-level permissions (GROUP_ADMIN, etc.)
- **EmployeePermission**: Company-specific special permissions
- **Voucher/VoucherLine**: Accounting vouchers with double-entry
- **LeaveRequest/LeaveBalance**: Leave management
- **ExpenseRequest/ExpenseItem**: Expense reimbursement
- **ApprovalFlow/ApprovalInstance**: Configurable approval workflows

## Environment Variables

Required in `.env`:
```
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
AUTH_SECRET="..."
```

Optional SMTP for email:
```
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
```

## Language

This is a Traditional Chinese (繁體中文) application. UI text, comments, and variable naming conventions often use Chinese terminology. The codebase mixes English and Chinese:
- Code identifiers: English
- UI labels and user-facing text: Chinese
- Comments: Mix of Chinese and English

## Claude Code 協作規則

以下為與 Claude Code 協作時的重要原則：

### 回應語言
- 請盡可能使用**繁體中文**回應所有訊息

### 開發伺服器管理
- 當 `npm run dev` 發現埠號 (port 3000) 被佔用時，**不要**自動切換到其他埠號
- 應先終止佔用該埠號的舊程序，再重新啟動開發伺服器
- 操作步驟：
  1. 使用 `netstat -ano | findstr :3000` 找出佔用程序的 PID
  2. 使用 `cmd //c "taskkill /PID {PID} /F"` 終止該程序
  3. 重新執行 `npm run dev`

### 檔案編輯
- 編輯檔案前，若有正在執行的開發伺服器，請先停止後再編輯

### Git 操作
- 只有在使用者明確說「git push」時才執行推送
- 本地測試階段不主動推送到遠端
