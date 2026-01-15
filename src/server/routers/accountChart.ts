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
            category: acc.category as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
            accountType: acc.accountType as 'DEBIT' | 'CREDIT',
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
