# Phase 7: 完整財務會計模組 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立完整的財務會計系統，包含會計科目表、傳票管理、應收應付帳款及財務報表

**Architecture:**
- 新增會計相關 Prisma models (AccountChart, Voucher, VoucherLine, Customer, Vendor, AccountReceivable, AccountPayable, AccountingPeriod)
- 新增 accounting tRPC router 處理會計科目 CRUD
- 新增 voucher tRPC router 處理傳票管理
- 新增 ar/ap tRPC routers 處理應收應付帳款
- 建立財務報表頁面 (試算表、資產負債表、損益表)

**Tech Stack:** Next.js 14, tRPC, Prisma, PostgreSQL, TailwindCSS, shadcn/ui

---

## Task 1: 新增會計相關 Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 新增會計 enums**

```prisma
// 會計科目類別
enum AccountCategory {
  ASSET       // 資產
  LIABILITY   // 負債
  EQUITY      // 權益
  REVENUE     // 收入
  EXPENSE     // 費用
}

// 科目性質
enum AccountType {
  DEBIT       // 借方科目
  CREDIT      // 貸方科目
}

// 傳票類型
enum VoucherType {
  RECEIPT     // 收款傳票
  PAYMENT     // 付款傳票
  TRANSFER    // 轉帳傳票
}

// 傳票來源
enum VoucherSource {
  MANUAL      // 人工輸入
  EXPENSE     // 費用報支
  AR          // 應收帳款
  AP          // 應付帳款
}

// 傳票狀態
enum VoucherStatus {
  DRAFT       // 草稿
  PENDING     // 待審核
  POSTED      // 已過帳
  VOID        // 作廢
}

// 會計期間狀態
enum PeriodStatus {
  OPEN        // 開放
  CLOSED      // 已結帳
  LOCKED      // 已鎖定
}

// 應收應付狀態
enum ARAPStatus {
  OPEN        // 未收付
  PARTIAL     // 部分收付
  PAID        // 已收付
  VOID        // 作廢
}
```

**Step 2: 新增會計科目表 model**

```prisma
model AccountChart {
  id          String          @id @default(cuid())
  companyId   String
  company     Company         @relation(fields: [companyId], references: [id])

  code        String          // 科目代碼 (1101, 2101, etc.)
  name        String          // 科目名稱
  category    AccountCategory // 類別 (資產、負債、權益、收入、費用)
  accountType AccountType     // 性質 (借方、貸方)
  level       Int             // 層級 (1=大類, 2=中類, 3=明細)

  parentId    String?
  parent      AccountChart?   @relation("AccountHierarchy", fields: [parentId], references: [id])
  children    AccountChart[]  @relation("AccountHierarchy")

  isDetail    Boolean         @default(true)  // 是否為明細科目
  isActive    Boolean         @default(true)
  isSystem    Boolean         @default(false) // 系統預設科目不可刪除
  requiresAux Boolean         @default(false) // 是否需要輔助核算

  openingBalance Decimal      @default(0) @db.Decimal(15, 2)

  voucherLines VoucherLine[]

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@unique([companyId, code])
  @@index([companyId, category])
}
```

**Step 3: 新增會計期間 model**

```prisma
model AccountingPeriod {
  id          String        @id @default(cuid())
  companyId   String
  company     Company       @relation(fields: [companyId], references: [id])

  year        Int           // 會計年度
  period      Int           // 期間 (1-12)
  startDate   DateTime
  endDate     DateTime

  status      PeriodStatus  @default(OPEN)
  closedAt    DateTime?
  closedBy    String?

  vouchers    Voucher[]

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([companyId, year, period])
}
```

**Step 4: 新增客戶/供應商 models**

```prisma
model Customer {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id])

  code          String    // 客戶編號
  name          String    // 客戶名稱
  taxId         String?   // 統一編號
  contactName   String?
  contactPhone  String?
  contactEmail  String?
  address       String?
  paymentTerms  Int       @default(30) // 付款條件(天)
  creditLimit   Decimal?  @db.Decimal(15, 2)

  isActive      Boolean   @default(true)

  receivables   AccountReceivable[]
  voucherLines  VoucherLine[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([companyId, code])
}

model Vendor {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id])

  code          String    // 供應商編號
  name          String    // 供應商名稱
  taxId         String?   // 統一編號
  contactName   String?
  contactPhone  String?
  contactEmail  String?
  address       String?
  paymentTerms  Int       @default(30)
  bankName      String?
  bankAccount   String?

  isActive      Boolean   @default(true)

  payables      AccountPayable[]
  voucherLines  VoucherLine[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([companyId, code])
}
```

**Step 5: 新增傳票 models**

```prisma
model Voucher {
  id            String          @id @default(cuid())
  companyId     String
  company       Company         @relation(fields: [companyId], references: [id])

  voucherNo     String          // 傳票號碼
  voucherDate   DateTime
  voucherType   VoucherType
  sourceType    VoucherSource   @default(MANUAL)
  sourceId      String?         // 來源單據 ID

  periodId      String
  period        AccountingPeriod @relation(fields: [periodId], references: [id])

  description   String?
  totalDebit    Decimal         @db.Decimal(15, 2)
  totalCredit   Decimal         @db.Decimal(15, 2)

  status        VoucherStatus   @default(DRAFT)
  postedAt      DateTime?

  createdById   String
  createdBy     Employee        @relation("VoucherCreator", fields: [createdById], references: [id])
  approvedById  String?
  approvedBy    Employee?       @relation("VoucherApprover", fields: [approvedById], references: [id])
  postedById    String?
  postedBy      Employee?       @relation("VoucherPoster", fields: [postedById], references: [id])

  lines         VoucherLine[]

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([companyId, voucherNo])
  @@index([companyId, voucherDate])
  @@index([companyId, status])
}

model VoucherLine {
  id            String        @id @default(cuid())
  voucherId     String
  voucher       Voucher       @relation(fields: [voucherId], references: [id], onDelete: Cascade)

  lineNo        Int
  accountId     String
  account       AccountChart  @relation(fields: [accountId], references: [id])

  debitAmount   Decimal       @default(0) @db.Decimal(15, 2)
  creditAmount  Decimal       @default(0) @db.Decimal(15, 2)
  description   String?

  // 輔助核算
  customerId    String?
  customer      Customer?     @relation(fields: [customerId], references: [id])
  vendorId      String?
  vendor        Vendor?       @relation(fields: [vendorId], references: [id])
  departmentId  String?
  department    Department?   @relation(fields: [departmentId], references: [id])

  createdAt     DateTime      @default(now())

  @@index([voucherId])
}
```

**Step 6: 新增應收應付 models**

```prisma
model AccountReceivable {
  id            String      @id @default(cuid())
  companyId     String
  company       Company     @relation(fields: [companyId], references: [id])

  arNo          String      // 應收單號
  arDate        DateTime
  dueDate       DateTime

  customerId    String
  customer      Customer    @relation(fields: [customerId], references: [id])

  amount        Decimal     @db.Decimal(15, 2)
  paidAmount    Decimal     @default(0) @db.Decimal(15, 2)
  balance       Decimal     @db.Decimal(15, 2)

  invoiceNo     String?
  invoiceDate   DateTime?
  description   String?

  status        ARAPStatus  @default(OPEN)

  voucherId     String?     // 關聯傳票

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([companyId, arNo])
  @@index([companyId, customerId])
  @@index([companyId, status])
}

model AccountPayable {
  id            String      @id @default(cuid())
  companyId     String
  company       Company     @relation(fields: [companyId], references: [id])

  apNo          String      // 應付單號
  apDate        DateTime
  dueDate       DateTime

  vendorId      String
  vendor        Vendor      @relation(fields: [vendorId], references: [id])

  amount        Decimal     @db.Decimal(15, 2)
  paidAmount    Decimal     @default(0) @db.Decimal(15, 2)
  balance       Decimal     @db.Decimal(15, 2)

  invoiceNo     String?
  invoiceDate   DateTime?
  description   String?

  status        ARAPStatus  @default(OPEN)

  voucherId     String?     // 關聯傳票
  expenseRequestId String?  // 關聯費用報支單

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([companyId, apNo])
  @@index([companyId, vendorId])
  @@index([companyId, status])
}
```

**Step 7: 更新 Company model 加入 relations**

在 Company model 加入：
```prisma
accountCharts     AccountChart[]
accountingPeriods AccountingPeriod[]
customers         Customer[]
vendors           Vendor[]
vouchers          Voucher[]
receivables       AccountReceivable[]
payables          AccountPayable[]
```

**Step 8: 更新 Employee model 加入 relations**

在 Employee model 加入：
```prisma
vouchersCreated   Voucher[] @relation("VoucherCreator")
vouchersApproved  Voucher[] @relation("VoucherApprover")
vouchersPosted    Voucher[] @relation("VoucherPoster")
```

**Step 9: 更新 Department model 加入 relation**

在 Department model 加入：
```prisma
voucherLines      VoucherLine[]
```

**Step 10: 執行 Prisma 指令**

```bash
cd C:\ClaudeCode\your-remit-erp02\.worktrees\initial-setup
npx prisma generate
npx prisma db push
```

**Step 11: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(accounting): 新增財務會計 Prisma models

- AccountChart: 會計科目表
- AccountingPeriod: 會計期間
- Customer, Vendor: 客戶/供應商
- Voucher, VoucherLine: 傳票
- AccountReceivable, AccountPayable: 應收應付

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 建立會計科目 tRPC Router

**Files:**
- Create: `src/server/routers/accountChart.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 accountChart router**

建立 `src/server/routers/accountChart.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const accountChartRouter = router({
  // 取得公司所有科目
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
      isDetail: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
        isActive: true,
      }
      if (input.category) where.category = input.category
      if (input.isDetail !== undefined) where.isDetail = input.isDetail

      return ctx.prisma.accountChart.findMany({
        where,
        include: { parent: true },
        orderBy: { code: 'asc' },
      })
    }),

  // 取得單一科目
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.accountChart.findUnique({
        where: { id: input.id },
        include: { parent: true, children: true },
      })
    }),

  // 建立科目
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string(),
      name: z.string(),
      category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
      accountType: z.enum(['DEBIT', 'CREDIT']),
      level: z.number().min(1).max(3),
      parentId: z.string().optional(),
      isDetail: z.boolean().default(true),
      requiresAux: z.boolean().default(false),
      openingBalance: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查代碼是否重複
      const existing = await ctx.prisma.accountChart.findFirst({
        where: { companyId: input.companyId, code: input.code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '科目代碼已存在' })
      }

      return ctx.prisma.accountChart.create({
        data: {
          companyId: input.companyId,
          code: input.code,
          name: input.name,
          category: input.category,
          accountType: input.accountType,
          level: input.level,
          parentId: input.parentId,
          isDetail: input.isDetail,
          requiresAux: input.requiresAux,
          openingBalance: input.openingBalance,
        },
      })
    }),

  // 更新科目
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      isActive: z.boolean().optional(),
      requiresAux: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.accountChart.findUnique({
        where: { id: input.id },
      })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '科目不存在' })
      }

      const { id, ...data } = input
      return ctx.prisma.accountChart.update({
        where: { id },
        data,
      })
    }),

  // 刪除科目 (軟刪除)
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.prisma.accountChart.findUnique({
        where: { id: input.id },
      })
      if (!account) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '科目不存在' })
      }
      if (account.isSystem) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '系統科目無法刪除' })
      }

      // 檢查是否有傳票使用此科目
      const usedCount = await ctx.prisma.voucherLine.count({
        where: { accountId: input.id },
      })
      if (usedCount > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: '此科目已有傳票使用，無法刪除' })
      }

      return ctx.prisma.accountChart.update({
        where: { id: input.id },
        data: { isActive: false },
      })
    }),

  // 初始化預設科目表
  initializeDefaults: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已有科目
      const existingCount = await ctx.prisma.accountChart.count({
        where: { companyId: input.companyId },
      })
      if (existingCount > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: '公司已有科目表，無法重新初始化' })
      }

      const defaultAccounts = [
        // 資產
        { code: '1', name: '資產', category: 'ASSET', accountType: 'DEBIT', level: 1, isDetail: false, isSystem: true },
        { code: '11', name: '流動資產', category: 'ASSET', accountType: 'DEBIT', level: 2, isDetail: false, isSystem: true, parentCode: '1' },
        { code: '1101', name: '現金及約當現金', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11' },
        { code: '1102', name: '銀行存款', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11' },
        { code: '1103', name: '應收帳款', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11', requiresAux: true },
        { code: '1104', name: '預付款項', category: 'ASSET', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '11' },
        // 負債
        { code: '2', name: '負債', category: 'LIABILITY', accountType: 'CREDIT', level: 1, isDetail: false, isSystem: true },
        { code: '21', name: '流動負債', category: 'LIABILITY', accountType: 'CREDIT', level: 2, isDetail: false, isSystem: true, parentCode: '2' },
        { code: '2101', name: '應付帳款', category: 'LIABILITY', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '21', requiresAux: true },
        { code: '2102', name: '應付薪資', category: 'LIABILITY', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '21' },
        { code: '2103', name: '應付稅捐', category: 'LIABILITY', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '21' },
        // 權益
        { code: '3', name: '權益', category: 'EQUITY', accountType: 'CREDIT', level: 1, isDetail: false, isSystem: true },
        { code: '31', name: '股本', category: 'EQUITY', accountType: 'CREDIT', level: 2, isDetail: true, isSystem: true, parentCode: '3' },
        { code: '32', name: '保留盈餘', category: 'EQUITY', accountType: 'CREDIT', level: 2, isDetail: true, isSystem: true, parentCode: '3' },
        // 收入
        { code: '4', name: '收入', category: 'REVENUE', accountType: 'CREDIT', level: 1, isDetail: false, isSystem: true },
        { code: '41', name: '營業收入', category: 'REVENUE', accountType: 'CREDIT', level: 2, isDetail: false, isSystem: true, parentCode: '4' },
        { code: '4101', name: '銷貨收入', category: 'REVENUE', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '41' },
        { code: '4102', name: '服務收入', category: 'REVENUE', accountType: 'CREDIT', level: 3, isDetail: true, isSystem: true, parentCode: '41' },
        // 費用
        { code: '5', name: '費用', category: 'EXPENSE', accountType: 'DEBIT', level: 1, isDetail: false, isSystem: true },
        { code: '51', name: '營業成本', category: 'EXPENSE', accountType: 'DEBIT', level: 2, isDetail: true, isSystem: true, parentCode: '5' },
        { code: '52', name: '營業費用', category: 'EXPENSE', accountType: 'DEBIT', level: 2, isDetail: false, isSystem: true, parentCode: '5' },
        { code: '5201', name: '薪資支出', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
        { code: '5202', name: '租金支出', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
        { code: '5203', name: '交通費', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
        { code: '5204', name: '文具用品', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
        { code: '5205', name: '伙食費', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
        { code: '5206', name: '通訊費', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
        { code: '5299', name: '其他費用', category: 'EXPENSE', accountType: 'DEBIT', level: 3, isDetail: true, isSystem: true, parentCode: '52' },
      ]

      // 先建立所有科目 (不含 parentId)
      const createdAccounts = new Map<string, string>()

      for (const acc of defaultAccounts) {
        const created = await ctx.prisma.accountChart.create({
          data: {
            companyId: input.companyId,
            code: acc.code,
            name: acc.name,
            category: acc.category as any,
            accountType: acc.accountType as any,
            level: acc.level,
            isDetail: acc.isDetail,
            isSystem: acc.isSystem,
            requiresAux: acc.requiresAux || false,
          },
        })
        createdAccounts.set(acc.code, created.id)
      }

      // 更新 parentId
      for (const acc of defaultAccounts) {
        if (acc.parentCode) {
          const parentId = createdAccounts.get(acc.parentCode)
          const accountId = createdAccounts.get(acc.code)
          if (parentId && accountId) {
            await ctx.prisma.accountChart.update({
              where: { id: accountId },
              data: { parentId },
            })
          }
        }
      }

      return { count: defaultAccounts.length }
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { accountChartRouter } from './accountChart'

// 在 router 中加入
accountChart: accountChartRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(accounting): 新增會計科目 tRPC router

- list: 取得科目列表
- getById: 取得單一科目
- create/update/delete: CRUD
- initializeDefaults: 初始化預設科目表

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 建立傳票 tRPC Router

**Files:**
- Create: `src/server/routers/voucher.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 voucher router**

建立 `src/server/routers/voucher.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

const voucherLineSchema = z.object({
  accountId: z.string(),
  debitAmount: z.number().default(0),
  creditAmount: z.number().default(0),
  description: z.string().optional(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  departmentId: z.string().optional(),
})

export const voucherRouter = router({
  // 取得傳票列表
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      periodId: z.string().optional(),
      status: z.enum(['DRAFT', 'PENDING', 'POSTED', 'VOID']).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { companyId: input.companyId }
      if (input.periodId) where.periodId = input.periodId
      if (input.status) where.status = input.status
      if (input.startDate || input.endDate) {
        where.voucherDate = {}
        if (input.startDate) (where.voucherDate as Record<string, unknown>).gte = input.startDate
        if (input.endDate) (where.voucherDate as Record<string, unknown>).lt = input.endDate
      }

      return ctx.prisma.voucher.findMany({
        where,
        include: {
          period: true,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { voucherNo: 'desc' },
      })
    }),

  // 取得單一傳票
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.voucher.findUnique({
        where: { id: input.id },
        include: {
          period: true,
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true } },
          lines: {
            include: {
              account: true,
              customer: true,
              vendor: true,
              department: true,
            },
            orderBy: { lineNo: 'asc' },
          },
        },
      })
    }),

  // 建立傳票
  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      voucherDate: z.date(),
      voucherType: z.enum(['RECEIPT', 'PAYMENT', 'TRANSFER']),
      description: z.string().optional(),
      createdById: z.string(),
      lines: z.array(voucherLineSchema).min(2),
    }))
    .mutation(async ({ ctx, input }) => {
      // 取得當前會計期間
      const period = await ctx.prisma.accountingPeriod.findFirst({
        where: {
          companyId: input.companyId,
          startDate: { lte: input.voucherDate },
          endDate: { gte: input.voucherDate },
          status: 'OPEN',
        },
      })
      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無有效的會計期間，請先建立或開放會計期間' })
      }

      // 計算借貸合計
      let totalDebit = 0
      let totalCredit = 0
      input.lines.forEach((line, index) => {
        totalDebit += line.debitAmount
        totalCredit += line.creditAmount
        // 驗證每行只能有借或貸
        if (line.debitAmount > 0 && line.creditAmount > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `第 ${index + 1} 行不能同時有借方和貸方金額` })
        }
      })

      // 驗證借貸平衡
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `借貸不平衡：借方 ${totalDebit}，貸方 ${totalCredit}` })
      }

      // 產生傳票號碼
      const lastVoucher = await ctx.prisma.voucher.findFirst({
        where: { companyId: input.companyId },
        orderBy: { voucherNo: 'desc' },
      })
      const nextNo = lastVoucher
        ? String(parseInt(lastVoucher.voucherNo.slice(-6)) + 1).padStart(6, '0')
        : '000001'
      const voucherNo = `V${period.year}${String(period.period).padStart(2, '0')}${nextNo}`

      return ctx.prisma.voucher.create({
        data: {
          companyId: input.companyId,
          voucherNo,
          voucherDate: input.voucherDate,
          voucherType: input.voucherType,
          periodId: period.id,
          description: input.description,
          totalDebit,
          totalCredit,
          createdById: input.createdById,
          lines: {
            create: input.lines.map((line, index) => ({
              lineNo: index + 1,
              accountId: line.accountId,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description,
              customerId: line.customerId,
              vendorId: line.vendorId,
              departmentId: line.departmentId,
            })),
          },
        },
        include: { lines: true },
      })
    }),

  // 過帳
  post: publicProcedure
    .input(z.object({
      id: z.string(),
      postedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const voucher = await ctx.prisma.voucher.findUnique({
        where: { id: input.id },
        include: { period: true },
      })

      if (!voucher) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '傳票不存在' })
      }
      if (voucher.status !== 'DRAFT' && voucher.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿或待審核狀態的傳票可以過帳' })
      }
      if (voucher.period.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '會計期間已關閉，無法過帳' })
      }

      return ctx.prisma.voucher.update({
        where: { id: input.id },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedById: input.postedById,
        },
      })
    }),

  // 作廢
  void: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const voucher = await ctx.prisma.voucher.findUnique({
        where: { id: input.id },
      })

      if (!voucher) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '傳票不存在' })
      }
      if (voucher.status === 'VOID') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '傳票已作廢' })
      }

      return ctx.prisma.voucher.update({
        where: { id: input.id },
        data: { status: 'VOID' },
      })
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { voucherRouter } from './voucher'

// 在 router 中加入
voucher: voucherRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(accounting): 新增傳票 tRPC router

- list/getById: 傳票查詢
- create: 建立傳票（含借貸平衡驗證）
- post: 過帳
- void: 作廢

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 建立會計期間 tRPC Router

**Files:**
- Create: `src/server/routers/accountingPeriod.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 accountingPeriod router**

建立 `src/server/routers/accountingPeriod.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const accountingPeriodRouter = router({
  // 取得公司所有會計期間
  list: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { companyId: input.companyId }
      if (input.year) where.year = input.year

      return ctx.prisma.accountingPeriod.findMany({
        where,
        orderBy: [{ year: 'desc' }, { period: 'desc' }],
      })
    }),

  // 取得當前開放期間
  getCurrent: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.accountingPeriod.findFirst({
        where: {
          companyId: input.companyId,
          status: 'OPEN',
        },
        orderBy: [{ year: 'desc' }, { period: 'desc' }],
      })
    }),

  // 初始化年度會計期間
  initializeYear: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查是否已有該年度期間
      const existing = await ctx.prisma.accountingPeriod.findFirst({
        where: { companyId: input.companyId, year: input.year },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: `${input.year}年度會計期間已存在` })
      }

      // 建立 12 個月的期間
      const periods = []
      for (let month = 1; month <= 12; month++) {
        const startDate = new Date(input.year, month - 1, 1)
        const endDate = new Date(input.year, month, 0) // 該月最後一天
        endDate.setHours(23, 59, 59, 999)

        periods.push({
          companyId: input.companyId,
          year: input.year,
          period: month,
          startDate,
          endDate,
          status: 'OPEN' as const,
        })
      }

      await ctx.prisma.accountingPeriod.createMany({ data: periods })
      return { count: 12, year: input.year }
    }),

  // 關閉期間
  close: publicProcedure
    .input(z.object({
      id: z.string(),
      closedBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.accountingPeriod.findUnique({
        where: { id: input.id },
      })
      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '會計期間不存在' })
      }
      if (period.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有開放狀態的期間可以關閉' })
      }

      // 檢查是否有未過帳傳票
      const draftCount = await ctx.prisma.voucher.count({
        where: {
          periodId: input.id,
          status: { in: ['DRAFT', 'PENDING'] },
        },
      })
      if (draftCount > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `還有 ${draftCount} 張傳票未過帳，無法關閉期間` })
      }

      return ctx.prisma.accountingPeriod.update({
        where: { id: input.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: input.closedBy,
        },
      })
    }),

  // 重新開放期間
  reopen: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.accountingPeriod.findUnique({
        where: { id: input.id },
      })
      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '會計期間不存在' })
      }
      if (period.status === 'LOCKED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '已鎖定的期間無法重新開放' })
      }

      return ctx.prisma.accountingPeriod.update({
        where: { id: input.id },
        data: { status: 'OPEN', closedAt: null, closedBy: null },
      })
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { accountingPeriodRouter } from './accountingPeriod'

// 在 router 中加入
accountingPeriod: accountingPeriodRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(accounting): 新增會計期間 tRPC router

- list/getCurrent: 期間查詢
- initializeYear: 初始化年度期間
- close/reopen: 期間關閉與重開

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 建立客戶/供應商 tRPC Router

**Files:**
- Create: `src/server/routers/customer.ts`
- Create: `src/server/routers/vendor.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 customer router**

建立 `src/server/routers/customer.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const customerRouter = router({
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findMany({
        where: { companyId: input.companyId, isActive: true },
        orderBy: { code: 'asc' },
      })
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findUnique({
        where: { id: input.id },
        include: { receivables: { take: 10, orderBy: { arDate: 'desc' } } },
      })
    }),

  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string(),
      name: z.string(),
      taxId: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.number().default(30),
      creditLimit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.customer.findFirst({
        where: { companyId: input.companyId, code: input.code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '客戶編號已存在' })
      }
      return ctx.prisma.customer.create({ data: input })
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      taxId: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.number().optional(),
      creditLimit: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.customer.update({ where: { id }, data })
    }),
})
```

**Step 2: 建立 vendor router**

建立 `src/server/routers/vendor.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const vendorRouter = router({
  list: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.vendor.findMany({
        where: { companyId: input.companyId, isActive: true },
        orderBy: { code: 'asc' },
      })
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.vendor.findUnique({
        where: { id: input.id },
        include: { payables: { take: 10, orderBy: { apDate: 'desc' } } },
      })
    }),

  create: publicProcedure
    .input(z.object({
      companyId: z.string(),
      code: z.string(),
      name: z.string(),
      taxId: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.number().default(30),
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.vendor.findFirst({
        where: { companyId: input.companyId, code: input.code },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '供應商編號已存在' })
      }
      return ctx.prisma.vendor.create({ data: input })
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      taxId: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.number().optional(),
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return ctx.prisma.vendor.update({ where: { id }, data })
    }),
})
```

**Step 3: 更新 _app.ts**

```typescript
import { customerRouter } from './customer'
import { vendorRouter } from './vendor'

// 在 router 中加入
customer: customerRouter,
vendor: vendorRouter,
```

**Step 4: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/server/routers/
git commit -m "feat(accounting): 新增客戶/供應商 tRPC router

- customer: 客戶 CRUD
- vendor: 供應商 CRUD

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: 建立財務報表 tRPC Router

**Files:**
- Create: `src/server/routers/financialReport.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: 建立 financialReport router**

建立 `src/server/routers/financialReport.ts`：

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const financialReportRouter = router({
  // 試算表
  trialBalance: publicProcedure
    .input(z.object({
      companyId: z.string(),
      periodId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // 取得該期間所有已過帳傳票的分錄
      const lines = await ctx.prisma.voucherLine.findMany({
        where: {
          voucher: {
            companyId: input.companyId,
            periodId: input.periodId,
            status: 'POSTED',
          },
        },
        include: { account: true },
      })

      // 按科目彙總
      const accountTotals = new Map<string, {
        account: typeof lines[0]['account'],
        debit: number,
        credit: number,
      }>()

      lines.forEach(line => {
        const existing = accountTotals.get(line.accountId) || {
          account: line.account,
          debit: 0,
          credit: 0,
        }
        existing.debit += Number(line.debitAmount)
        existing.credit += Number(line.creditAmount)
        accountTotals.set(line.accountId, existing)
      })

      const data = Array.from(accountTotals.values())
        .map(item => ({
          accountCode: item.account.code,
          accountName: item.account.name,
          category: item.account.category,
          debitTotal: item.debit,
          creditTotal: item.credit,
          balance: item.account.accountType === 'DEBIT'
            ? item.debit - item.credit
            : item.credit - item.debit,
        }))
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))

      const totalDebit = data.reduce((sum, d) => sum + d.debitTotal, 0)
      const totalCredit = data.reduce((sum, d) => sum + d.creditTotal, 0)

      return {
        data,
        summary: {
          totalDebit,
          totalCredit,
          isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        },
      }
    }),

  // 資產負債表
  balanceSheet: publicProcedure
    .input(z.object({
      companyId: z.string(),
      asOfDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // 取得截至指定日期所有已過帳傳票
      const lines = await ctx.prisma.voucherLine.findMany({
        where: {
          voucher: {
            companyId: input.companyId,
            voucherDate: { lte: input.asOfDate },
            status: 'POSTED',
          },
        },
        include: { account: true },
      })

      // 彙總資產、負債、權益
      const categoryTotals = {
        ASSET: 0,
        LIABILITY: 0,
        EQUITY: 0,
      }

      const accountDetails = new Map<string, number>()

      lines.forEach(line => {
        const cat = line.account.category
        if (cat === 'ASSET' || cat === 'LIABILITY' || cat === 'EQUITY') {
          const amount = line.account.accountType === 'DEBIT'
            ? Number(line.debitAmount) - Number(line.creditAmount)
            : Number(line.creditAmount) - Number(line.debitAmount)
          categoryTotals[cat] += amount

          const key = `${line.account.code}-${line.account.name}`
          accountDetails.set(key, (accountDetails.get(key) || 0) + amount)
        }
      })

      // 加入期初餘額
      const accounts = await ctx.prisma.accountChart.findMany({
        where: {
          companyId: input.companyId,
          category: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
          isDetail: true,
        },
      })

      accounts.forEach(acc => {
        const balance = Number(acc.openingBalance)
        if (balance !== 0) {
          categoryTotals[acc.category as keyof typeof categoryTotals] += balance
          const key = `${acc.code}-${acc.name}`
          accountDetails.set(key, (accountDetails.get(key) || 0) + balance)
        }
      })

      return {
        asOfDate: input.asOfDate,
        assets: {
          total: categoryTotals.ASSET,
          details: Array.from(accountDetails.entries())
            .filter(([key]) => key.startsWith('1'))
            .map(([key, value]) => ({ account: key, balance: value })),
        },
        liabilities: {
          total: categoryTotals.LIABILITY,
          details: Array.from(accountDetails.entries())
            .filter(([key]) => key.startsWith('2'))
            .map(([key, value]) => ({ account: key, balance: value })),
        },
        equity: {
          total: categoryTotals.EQUITY,
          details: Array.from(accountDetails.entries())
            .filter(([key]) => key.startsWith('3'))
            .map(([key, value]) => ({ account: key, balance: value })),
        },
        isBalanced: Math.abs(categoryTotals.ASSET - categoryTotals.LIABILITY - categoryTotals.EQUITY) < 0.01,
      }
    }),

  // 損益表
  incomeStatement: publicProcedure
    .input(z.object({
      companyId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const lines = await ctx.prisma.voucherLine.findMany({
        where: {
          voucher: {
            companyId: input.companyId,
            voucherDate: { gte: input.startDate, lte: input.endDate },
            status: 'POSTED',
          },
        },
        include: { account: true },
      })

      let totalRevenue = 0
      let totalExpense = 0
      const revenueDetails: { account: string; amount: number }[] = []
      const expenseDetails: { account: string; amount: number }[] = []

      const accountTotals = new Map<string, number>()

      lines.forEach(line => {
        const cat = line.account.category
        const amount = line.account.accountType === 'CREDIT'
          ? Number(line.creditAmount) - Number(line.debitAmount)
          : Number(line.debitAmount) - Number(line.creditAmount)

        if (cat === 'REVENUE') {
          totalRevenue += Number(line.creditAmount) - Number(line.debitAmount)
          const key = `${line.account.code}-${line.account.name}`
          accountTotals.set(key, (accountTotals.get(key) || 0) + (Number(line.creditAmount) - Number(line.debitAmount)))
        } else if (cat === 'EXPENSE') {
          totalExpense += Number(line.debitAmount) - Number(line.creditAmount)
          const key = `${line.account.code}-${line.account.name}`
          accountTotals.set(key, (accountTotals.get(key) || 0) + (Number(line.debitAmount) - Number(line.creditAmount)))
        }
      })

      accountTotals.forEach((amount, key) => {
        if (key.startsWith('4')) {
          revenueDetails.push({ account: key, amount })
        } else if (key.startsWith('5')) {
          expenseDetails.push({ account: key, amount })
        }
      })

      return {
        period: { startDate: input.startDate, endDate: input.endDate },
        revenue: {
          total: totalRevenue,
          details: revenueDetails.sort((a, b) => a.account.localeCompare(b.account)),
        },
        expenses: {
          total: totalExpense,
          details: expenseDetails.sort((a, b) => a.account.localeCompare(b.account)),
        },
        netIncome: totalRevenue - totalExpense,
      }
    }),
})
```

**Step 2: 更新 _app.ts**

```typescript
import { financialReportRouter } from './financialReport'

// 在 router 中加入
financialReport: financialReportRouter,
```

**Step 3: 驗證編譯**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/
git commit -m "feat(accounting): 新增財務報表 tRPC router

- trialBalance: 試算表
- balanceSheet: 資產負債表
- incomeStatement: 損益表

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 建立會計設定頁面

**Files:**
- Create: `src/app/dashboard/finance/accounting/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: 建立會計管理首頁**

建立 `src/app/dashboard/finance/accounting/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, FileText, Users, Building2, Calendar, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default async function AccountingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const menuItems = [
    {
      title: '會計科目表',
      description: '管理會計科目，初始化預設科目',
      href: '/dashboard/finance/accounting/chart',
      icon: BookOpen,
    },
    {
      title: '會計期間',
      description: '管理會計年度期間，結帳控制',
      href: '/dashboard/finance/accounting/periods',
      icon: Calendar,
    },
    {
      title: '傳票管理',
      description: '建立、審核、過帳會計傳票',
      href: '/dashboard/finance/accounting/vouchers',
      icon: FileText,
    },
    {
      title: '客戶管理',
      description: '管理客戶資料，應收帳款對象',
      href: '/dashboard/finance/accounting/customers',
      icon: Users,
    },
    {
      title: '供應商管理',
      description: '管理供應商資料，應付帳款對象',
      href: '/dashboard/finance/accounting/vendors',
      icon: Building2,
    },
    {
      title: '財務報表',
      description: '試算表、資產負債表、損益表',
      href: '/dashboard/finance/accounting/reports',
      icon: BarChart3,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">會計管理</h1>
        <p className="text-muted-foreground">財務會計系統設定與操作</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary">進入管理 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: 更新 sidebar 加入會計管理選單**

在 sidebar.tsx 的 navItems 中加入：
```typescript
{
  name: '會計管理',
  href: '/dashboard/finance/accounting',
  icon: BookOpen,
},
```

Import `BookOpen` from lucide-react。

**Step 3: 驗證編譯**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/dashboard/finance/ src/components/layout/
git commit -m "feat(accounting): 建立會計管理首頁

- 會計功能選單
- sidebar 選單

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 建立會計科目表頁面

**Files:**
- Create: `src/app/dashboard/finance/accounting/chart/page.tsx`

**Step 1: 建立科目表頁面**

建立 `src/app/dashboard/finance/accounting/chart/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen } from 'lucide-react'

export default async function AccountChartPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const companyId = employee.assignments[0].companyId

  // 取得科目表
  const accounts = await prisma.accountChart.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: 'asc' },
  })

  // 按類別分組
  const categories = {
    ASSET: accounts.filter(a => a.category === 'ASSET'),
    LIABILITY: accounts.filter(a => a.category === 'LIABILITY'),
    EQUITY: accounts.filter(a => a.category === 'EQUITY'),
    REVENUE: accounts.filter(a => a.category === 'REVENUE'),
    EXPENSE: accounts.filter(a => a.category === 'EXPENSE'),
  }

  const categoryNames = {
    ASSET: '資產',
    LIABILITY: '負債',
    EQUITY: '權益',
    REVENUE: '收入',
    EXPENSE: '費用',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">會計科目表</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
        {accounts.length === 0 && (
          <form action="/api/accounting/init-chart" method="POST">
            <input type="hidden" name="companyId" value={companyId} />
            <Button type="submit">
              <Plus className="h-4 w-4 mr-2" />
              初始化預設科目
            </Button>
          </form>
        )}
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立會計科目表</p>
              <p className="text-sm text-muted-foreground mt-2">
                點擊「初始化預設科目」建立符合 IFRS 的標準科目表
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(Object.keys(categories) as Array<keyof typeof categories>).map((cat) => (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {categoryNames[cat]} ({categories[cat].length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 w-24">代碼</th>
                        <th className="text-left py-2 px-2">名稱</th>
                        <th className="text-center py-2 px-2 w-20">層級</th>
                        <th className="text-center py-2 px-2 w-24">性質</th>
                        <th className="text-center py-2 px-2 w-24">明細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories[cat].map((account) => (
                        <tr key={account.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{account.code}</td>
                          <td className="py-2 px-2" style={{ paddingLeft: `${(account.level - 1) * 20 + 8}px` }}>
                            {account.name}
                          </td>
                          <td className="py-2 px-2 text-center">{account.level}</td>
                          <td className="py-2 px-2 text-center">
                            {account.accountType === 'DEBIT' ? '借' : '貸'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {account.isDetail ? '✓' : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/finance/accounting/chart/
git commit -m "feat(accounting): 建立會計科目表頁面

- 按類別分組顯示科目
- 科目層級縮排
- 初始化預設科目按鈕

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: 建立傳票列表頁面

**Files:**
- Create: `src/app/dashboard/finance/accounting/vouchers/page.tsx`

**Step 1: 建立傳票列表頁面**

建立 `src/app/dashboard/finance/accounting/vouchers/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function VouchersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const companyId = employee.assignments[0].companyId

  // 取得傳票列表
  const vouchers = await prisma.voucher.findMany({
    where: { companyId },
    include: {
      period: true,
      createdBy: { select: { name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { voucherNo: 'desc' },
    take: 50,
  })

  const statusConfig = {
    DRAFT: { label: '草稿', icon: Clock, color: 'text-gray-500' },
    PENDING: { label: '待審核', icon: Clock, color: 'text-blue-500' },
    POSTED: { label: '已過帳', icon: CheckCircle, color: 'text-green-500' },
    VOID: { label: '作廢', icon: XCircle, color: 'text-red-500' },
  }

  const typeLabels = {
    RECEIPT: '收款',
    PAYMENT: '付款',
    TRANSFER: '轉帳',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">傳票管理</h1>
          <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
        </div>
        <Link href="/dashboard/finance/accounting/vouchers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增傳票
          </Button>
        </Link>
      </div>

      {vouchers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立任何傳票</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>傳票列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">傳票號碼</th>
                    <th className="text-left py-3 px-2">日期</th>
                    <th className="text-left py-3 px-2">類型</th>
                    <th className="text-left py-3 px-2">摘要</th>
                    <th className="text-right py-3 px-2">金額</th>
                    <th className="text-center py-3 px-2">分錄</th>
                    <th className="text-center py-3 px-2">狀態</th>
                    <th className="text-left py-3 px-2">製單人</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const status = statusConfig[voucher.status]
                    const StatusIcon = status.icon
                    return (
                      <tr key={voucher.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <Link
                            href={`/dashboard/finance/accounting/vouchers/${voucher.id}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {voucher.voucherNo}
                          </Link>
                        </td>
                        <td className="py-3 px-2">
                          {new Date(voucher.voucherDate).toLocaleDateString('zh-TW')}
                        </td>
                        <td className="py-3 px-2">{typeLabels[voucher.voucherType]}</td>
                        <td className="py-3 px-2 max-w-xs truncate">
                          {voucher.description || '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          ${Number(voucher.totalDebit).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center">{voucher._count.lines}</td>
                        <td className="py-3 px-2">
                          <div className={`flex items-center justify-center gap-1 ${status.color}`}>
                            <StatusIcon className="h-4 w-4" />
                            <span>{status.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">{voucher.createdBy.name}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/finance/accounting/vouchers/
git commit -m "feat(accounting): 建立傳票列表頁面

- 傳票列表顯示
- 狀態標示
- 連結到新增頁面

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: 建立財務報表頁面

**Files:**
- Create: `src/app/dashboard/finance/accounting/reports/page.tsx`

**Step 1: 建立財務報表頁面**

建立 `src/app/dashboard/finance/accounting/reports/page.tsx`：

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, FileText, Scale } from 'lucide-react'
import Link from 'next/link'

export default async function AccountingReportsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: { company: true },
      },
    },
  })

  if (!employee || employee.assignments.length === 0) {
    redirect('/dashboard')
  }

  const reportItems = [
    {
      title: '試算表',
      description: '各科目借貸餘額，確認借貸平衡',
      href: '/dashboard/finance/accounting/reports/trial-balance',
      icon: Scale,
    },
    {
      title: '資產負債表',
      description: '資產、負債、權益彙總報表',
      href: '/dashboard/finance/accounting/reports/balance-sheet',
      icon: BarChart3,
    },
    {
      title: '損益表',
      description: '收入、費用、淨利報表',
      href: '/dashboard/finance/accounting/reports/income-statement',
      icon: FileText,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">財務報表</h1>
        <p className="text-muted-foreground">{employee.assignments[0].company.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reportItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <span className="text-sm text-primary mt-4 block">查看報表 &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: 驗證編譯**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/dashboard/finance/accounting/reports/
git commit -m "feat(accounting): 建立財務報表頁面

- 試算表、資產負債表、損益表選單

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: 測試與部署

**Step 1: 驗證編譯**

```bash
npm run build
```

**Step 2: 合併到 master**

```bash
cd C:\ClaudeCode\your-remit-erp02
git checkout master
git merge --no-edit feature/initial-setup
git push origin master
```

**Step 3: 確認 Netlify 部署完成**

---

## Summary

Phase 7 完整財務會計模組包含：

| 功能 | 說明 |
|-----|------|
| 會計科目表 | 符合 IFRS 的標準科目表，支援階層結構 |
| 會計期間 | 年度期間管理，結帳控制 |
| 傳票管理 | 傳票建立、審核、過帳、作廢 |
| 客戶管理 | 應收帳款對象管理 |
| 供應商管理 | 應付帳款對象管理 |
| 財務報表 | 試算表、資產負債表、損益表 |

**新增 Prisma Models：**
- AccountChart (會計科目表)
- AccountingPeriod (會計期間)
- Customer, Vendor (客戶/供應商)
- Voucher, VoucherLine (傳票)
- AccountReceivable, AccountPayable (應收/應付)

**新增 tRPC Routers：**
- accountChart, accountingPeriod
- voucher, customer, vendor
- financialReport

**新增頁面：**
- `/dashboard/finance/accounting` - 會計管理首頁
- `/dashboard/finance/accounting/chart` - 科目表
- `/dashboard/finance/accounting/vouchers` - 傳票列表
- `/dashboard/finance/accounting/reports` - 財務報表
