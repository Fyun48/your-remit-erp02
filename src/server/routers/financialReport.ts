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
