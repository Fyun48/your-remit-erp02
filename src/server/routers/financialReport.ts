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

  // 現金流量表
  cashFlow: publicProcedure
    .input(z.object({
      companyId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // 取得期間內所有已過帳傳票
      const vouchers = await ctx.prisma.voucher.findMany({
        where: {
          companyId: input.companyId,
          voucherDate: { gte: input.startDate, lte: input.endDate },
          status: 'POSTED',
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      })

      // 分類現金流量
      const operating = {
        inflows: [] as { description: string; amount: number }[],
        outflows: [] as { description: string; amount: number }[],
      }
      const investing = {
        inflows: [] as { description: string; amount: number }[],
        outflows: [] as { description: string; amount: number }[],
      }
      const financing = {
        inflows: [] as { description: string; amount: number }[],
        outflows: [] as { description: string; amount: number }[],
      }

      // 現金相關科目代碼（1101-1199）
      const isCashAccount = (code: string) => code.startsWith('11')

      vouchers.forEach(voucher => {
        voucher.lines.forEach(line => {
          // 只處理現金科目的變動
          if (!isCashAccount(line.account.code)) return

          const cashChange = Number(line.debitAmount) - Number(line.creditAmount)
          if (cashChange === 0) return

          // 找出對應科目來判斷現金流量類型
          const counterpartyLines = voucher.lines.filter(l => l.id !== line.id)

          counterpartyLines.forEach(counter => {
            const counterCode = counter.account.code
            const description = `${voucher.description || counter.account.name}`

            // 營業活動：收入(4xxx)、費用(5xxx)、應收(12xx)、應付(21xx)、存貨(13xx)
            if (counterCode.startsWith('4') || counterCode.startsWith('5') ||
                counterCode.startsWith('12') || counterCode.startsWith('21') ||
                counterCode.startsWith('13')) {
              if (cashChange > 0) {
                operating.inflows.push({ description, amount: Math.abs(cashChange) })
              } else {
                operating.outflows.push({ description, amount: Math.abs(cashChange) })
              }
            }
            // 投資活動：固定資產(15xx)、長期投資(14xx)
            else if (counterCode.startsWith('15') || counterCode.startsWith('14')) {
              if (cashChange > 0) {
                investing.inflows.push({ description, amount: Math.abs(cashChange) })
              } else {
                investing.outflows.push({ description, amount: Math.abs(cashChange) })
              }
            }
            // 籌資活動：長期負債(22xx)、股本(31xx)、保留盈餘(32xx)
            else if (counterCode.startsWith('22') || counterCode.startsWith('31') ||
                     counterCode.startsWith('32')) {
              if (cashChange > 0) {
                financing.inflows.push({ description, amount: Math.abs(cashChange) })
              } else {
                financing.outflows.push({ description, amount: Math.abs(cashChange) })
              }
            }
          })
        })
      })

      // 彙總計算
      const operatingTotal = operating.inflows.reduce((s, i) => s + i.amount, 0)
        - operating.outflows.reduce((s, i) => s + i.amount, 0)
      const investingTotal = investing.inflows.reduce((s, i) => s + i.amount, 0)
        - investing.outflows.reduce((s, i) => s + i.amount, 0)
      const financingTotal = financing.inflows.reduce((s, i) => s + i.amount, 0)
        - financing.outflows.reduce((s, i) => s + i.amount, 0)

      // 取得期初現金餘額
      const cashAccounts = await ctx.prisma.accountChart.findMany({
        where: {
          companyId: input.companyId,
          code: { startsWith: '11' },
          isDetail: true,
        },
      })
      const beginningCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.openingBalance), 0)

      // 計算期初前的現金變動
      const priorLines = await ctx.prisma.voucherLine.findMany({
        where: {
          voucher: {
            companyId: input.companyId,
            voucherDate: { lt: input.startDate },
            status: 'POSTED',
          },
          account: { code: { startsWith: '11' } },
        },
      })
      const priorCashChange = priorLines.reduce((sum, line) =>
        sum + Number(line.debitAmount) - Number(line.creditAmount), 0)

      const actualBeginningCash = beginningCash + priorCashChange

      return {
        period: { startDate: input.startDate, endDate: input.endDate },
        operating: {
          inflows: operating.inflows,
          outflows: operating.outflows,
          netCash: operatingTotal,
        },
        investing: {
          inflows: investing.inflows,
          outflows: investing.outflows,
          netCash: investingTotal,
        },
        financing: {
          inflows: financing.inflows,
          outflows: financing.outflows,
          netCash: financingTotal,
        },
        summary: {
          beginningCash: actualBeginningCash,
          netChange: operatingTotal + investingTotal + financingTotal,
          endingCash: actualBeginningCash + operatingTotal + investingTotal + financingTotal,
        },
      }
    }),

  // 401 營業稅申報書
  vat401: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
      period: z.number(), // 1-6 代表 1-2月, 3-4月, 5-6月, 7-8月, 9-10月, 11-12月
    }))
    .query(async ({ ctx, input }) => {
      // 計算期間的起訖日期
      const startMonth = (input.period - 1) * 2 + 1
      const endMonth = startMonth + 1
      const startDate = new Date(input.year, startMonth - 1, 1)
      const endDate = new Date(input.year, endMonth, 0) // 月底

      // 取得公司資料
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
      })

      // 取得期間內所有已過帳的銷售與採購傳票
      const vouchers = await ctx.prisma.voucher.findMany({
        where: {
          companyId: input.companyId,
          voucherDate: { gte: startDate, lte: endDate },
          status: 'POSTED',
        },
        include: {
          lines: { include: { account: true } },
        },
      })

      // 銷項資料 (4xxx 收入科目相關)
      const sales = {
        taxable: 0,      // 應稅銷售額 (稅率5%)
        zeroRated: 0,    // 零稅率銷售額
        exempt: 0,       // 免稅銷售額
        outputTax: 0,    // 銷項稅額
        invoiceCount: 0, // 發票張數
      }

      // 進項資料 (進貨、費用相關)
      const purchases = {
        deductible: 0,      // 可扣抵進項
        nonDeductible: 0,   // 不可扣抵進項
        inputTax: 0,        // 進項稅額
        fixedAssets: 0,     // 固定資產進項
        invoiceCount: 0,    // 發票張數
      }

      // 分析傳票
      vouchers.forEach(voucher => {
        voucher.lines.forEach(line => {
          const code = line.account.code
          const amount = Number(line.creditAmount) - Number(line.debitAmount)

          // 銷售收入 (4xxx)
          if (code.startsWith('4')) {
            // 假設都是應稅銷售
            if (amount > 0) {
              sales.taxable += amount
              sales.invoiceCount++
            }
          }

          // 銷項稅額 (通常記錄在負債科目 2171)
          if (code === '2171' || code.includes('銷項稅額')) {
            sales.outputTax += Math.abs(amount)
          }

          // 進項稅額 (通常記錄在資產科目 1171 或類似)
          if (code === '1171' || code.includes('進項稅額')) {
            purchases.inputTax += Math.abs(Number(line.debitAmount) - Number(line.creditAmount))
          }

          // 進貨成本 (5xxx 費用科目)
          if (code.startsWith('5')) {
            const purchaseAmount = Number(line.debitAmount) - Number(line.creditAmount)
            if (purchaseAmount > 0) {
              purchases.deductible += purchaseAmount
              purchases.invoiceCount++
            }
          }

          // 固定資產 (15xx)
          if (code.startsWith('15')) {
            const assetAmount = Number(line.debitAmount) - Number(line.creditAmount)
            if (assetAmount > 0) {
              purchases.fixedAssets += assetAmount
            }
          }
        })
      })

      // 如果沒有獨立的稅額科目，以5%估算
      if (sales.outputTax === 0 && sales.taxable > 0) {
        sales.outputTax = Math.round(sales.taxable * 0.05)
      }
      if (purchases.inputTax === 0 && purchases.deductible > 0) {
        purchases.inputTax = Math.round(purchases.deductible * 0.05)
      }

      // 計算應繳(退)稅額
      const taxPayable = sales.outputTax - purchases.inputTax

      return {
        company: {
          id: company?.id || '',
          name: company?.name || '',
          taxId: company?.taxId || '',
          address: company?.address || '',
        },
        period: {
          year: input.year,
          periodNo: input.period,
          startDate,
          endDate,
          rocYear: input.year - 1911,
          periodLabel: `${startMonth}-${endMonth}月`,
        },
        sales: {
          ...sales,
          total: sales.taxable + sales.zeroRated + sales.exempt,
        },
        purchases: {
          ...purchases,
          total: purchases.deductible + purchases.nonDeductible,
        },
        summary: {
          outputTax: sales.outputTax,
          inputTax: purchases.inputTax,
          taxPayable,
          isRefund: taxPayable < 0,
        },
      }
    }),
})
