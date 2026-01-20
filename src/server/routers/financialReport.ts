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

  // 進銷項發票明細
  invoiceDetail: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
      period: z.number(), // 1-6 代表雙月期
      type: z.enum(['SALES', 'PURCHASE', 'ALL']),
    }))
    .query(async ({ ctx, input }) => {
      // 計算期間的起訖日期
      const startMonth = (input.period - 1) * 2 + 1
      const endMonth = startMonth + 1
      const startDate = new Date(input.year, startMonth - 1, 1)
      const endDate = new Date(input.year, endMonth, 0)

      // 取得銷項發票資料 (從應收帳款)
      const salesInvoices: {
        date: Date
        voucherNo: string
        invoiceNo: string | null
        counterparty: string
        description: string
        amount: number
        tax: number
        total: number
      }[] = []

      const purchaseInvoices: {
        date: Date
        voucherNo: string
        invoiceNo: string | null
        counterparty: string
        description: string
        amount: number
        tax: number
        total: number
      }[] = []

      if (input.type === 'SALES' || input.type === 'ALL') {
        const receivables = await ctx.prisma.accountReceivable.findMany({
          where: {
            companyId: input.companyId,
            arDate: { gte: startDate, lte: endDate },
          },
          include: {
            customer: true,
          },
          orderBy: { arDate: 'asc' },
        })

        receivables.forEach(ar => {
          const amount = Number(ar.amount)
          const tax = Math.round(amount * 0.05) // 5% 營業稅
          salesInvoices.push({
            date: ar.arDate,
            voucherNo: ar.arNo,
            invoiceNo: ar.invoiceNo,
            counterparty: ar.customer.name,
            description: ar.description || '',
            amount: amount,
            tax: tax,
            total: amount + tax,
          })
        })
      }

      // 取得進項發票資料 (從應付帳款)
      if (input.type === 'PURCHASE' || input.type === 'ALL') {
        const payables = await ctx.prisma.accountPayable.findMany({
          where: {
            companyId: input.companyId,
            apDate: { gte: startDate, lte: endDate },
          },
          include: {
            vendor: true,
          },
          orderBy: { apDate: 'asc' },
        })

        payables.forEach(ap => {
          const amount = Number(ap.amount)
          const tax = Math.round(amount * 0.05) // 5% 營業稅
          purchaseInvoices.push({
            date: ap.apDate,
            voucherNo: ap.apNo,
            invoiceNo: ap.invoiceNo,
            counterparty: ap.vendor.name,
            description: ap.description || '',
            amount: amount,
            tax: tax,
            total: amount + tax,
          })
        })
      }

      // 彙總
      const salesSummary = {
        count: salesInvoices.length,
        totalAmount: salesInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        totalTax: salesInvoices.reduce((sum, inv) => sum + inv.tax, 0),
        grandTotal: salesInvoices.reduce((sum, inv) => sum + inv.total, 0),
      }

      const purchaseSummary = {
        count: purchaseInvoices.length,
        totalAmount: purchaseInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        totalTax: purchaseInvoices.reduce((sum, inv) => sum + inv.tax, 0),
        grandTotal: purchaseInvoices.reduce((sum, inv) => sum + inv.total, 0),
      }

      return {
        period: {
          year: input.year,
          periodNo: input.period,
          startDate,
          endDate,
          rocYear: input.year - 1911,
          periodLabel: `${startMonth}-${endMonth}月`,
        },
        salesInvoices,
        purchaseInvoices,
        salesSummary,
        purchaseSummary,
      }
    }),

  // 扣繳憑單彙總
  withholdingSummary: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, 0, 1)
      const endDate = new Date(input.year, 11, 31)

      // 取得公司資料
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.companyId },
      })

      // 扣繳資料彙總 (按所得人)
      const withholdingMap = new Map<string, {
        payeeId: string
        payeeName: string
        payeeType: 'EMPLOYEE' | 'VENDOR'
        taxId: string
        incomeType: string
        incomeTypeName: string
        grossAmount: number
        taxWithheld: number
        netAmount: number
        paymentCount: number
      }>()

      // 1. 從薪資單取得員工薪資所得
      const payrollSlips = await ctx.prisma.payrollSlip.findMany({
        where: {
          companyId: input.companyId,
          period: {
            year: input.year,
            status: 'PAID',
          },
        },
        include: {
          employee: true,
        },
      })

      payrollSlips.forEach(slip => {
        const key = `EMPLOYEE-${slip.employeeId}`
        const existing = withholdingMap.get(key) || {
          payeeId: slip.employeeId,
          payeeName: slip.employee.name,
          payeeType: 'EMPLOYEE' as const,
          taxId: slip.employee.idNumber || '',
          incomeType: '50',
          incomeTypeName: '薪資所得',
          grossAmount: 0,
          taxWithheld: 0,
          netAmount: 0,
          paymentCount: 0,
        }
        existing.grossAmount += Number(slip.grossPay)
        existing.taxWithheld += Number(slip.incomeTax)
        existing.paymentCount++
        withholdingMap.set(key, existing)
      })

      // 2. 從應付帳款取得廠商付款（勞務費、租金等）
      const payables = await ctx.prisma.accountPayable.findMany({
        where: {
          companyId: input.companyId,
          apDate: { gte: startDate, lte: endDate },
          status: { in: ['PAID', 'PARTIAL'] },
        },
        include: {
          vendor: true,
        },
      })

      payables.forEach(ap => {
        const vendor = ap.vendor
        const description = ap.description?.toLowerCase() || ''

        // 判斷所得類型
        let incomeType = '9A'
        let incomeTypeName = '執行業務所得'

        if (description.includes('租金') || description.includes('房租')) {
          incomeType = '92'
          incomeTypeName = '租賃所得'
        } else if (description.includes('稿費') || description.includes('版稅')) {
          incomeType = '9B'
          incomeTypeName = '稿費所得'
        }

        const key = `VENDOR-${incomeType}-${vendor.id}`
        const existing = withholdingMap.get(key) || {
          payeeId: vendor.id,
          payeeName: vendor.name,
          payeeType: 'VENDOR' as const,
          taxId: vendor.taxId || '',
          incomeType,
          incomeTypeName,
          grossAmount: 0,
          taxWithheld: 0,
          netAmount: 0,
          paymentCount: 0,
        }
        existing.grossAmount += Number(ap.paidAmount)
        existing.paymentCount++
        withholdingMap.set(key, existing)
      })

      // 計算扣繳稅額 (依所得類型)
      const withholdingRates: Record<string, number> = {
        '50': 0.05,  // 薪資 5%（超過起扣點）
        '9A': 0.10,  // 執行業務 10%
        '9B': 0.10,  // 稿費 10%
        '92': 0.10,  // 租金 10%
      }

      const withholdingThreshold = 88501 // 2026年起扣點

      withholdingMap.forEach((record) => {
        const rate = withholdingRates[record.incomeType] || 0.10

        if (record.incomeType === '50') {
          // 薪資：月給付超過起扣點才扣繳
          // 這裡簡化處理，實際應按月計算
          if (record.grossAmount / 12 > withholdingThreshold) {
            record.taxWithheld = Math.round(record.grossAmount * rate)
          }
        } else {
          // 其他所得：單筆超過 $20,000 或累計超過起扣點
          record.taxWithheld = Math.round(record.grossAmount * rate)
        }

        record.netAmount = record.grossAmount - record.taxWithheld
      })

      const records = Array.from(withholdingMap.values())
        .sort((a, b) => a.incomeType.localeCompare(b.incomeType) || b.grossAmount - a.grossAmount)

      // 彙總統計
      const summary = {
        totalPayees: records.length,
        totalGross: records.reduce((sum, r) => sum + r.grossAmount, 0),
        totalTax: records.reduce((sum, r) => sum + r.taxWithheld, 0),
        totalNet: records.reduce((sum, r) => sum + r.netAmount, 0),
        byIncomeType: Object.entries(
          records.reduce((acc, r) => {
            if (!acc[r.incomeType]) {
              acc[r.incomeType] = {
                incomeType: r.incomeType,
                incomeTypeName: r.incomeTypeName,
                count: 0,
                grossAmount: 0,
                taxWithheld: 0,
              }
            }
            acc[r.incomeType].count++
            acc[r.incomeType].grossAmount += r.grossAmount
            acc[r.incomeType].taxWithheld += r.taxWithheld
            return acc
          }, {} as Record<string, { incomeType: string; incomeTypeName: string; count: number; grossAmount: number; taxWithheld: number }>)
        ).map(([, v]) => v),
      }

      return {
        company: {
          id: company?.id || '',
          name: company?.name || '',
          taxId: company?.taxId || '',
        },
        year: input.year,
        rocYear: input.year - 1911,
        records,
        summary,
      }
    }),

  // 損益表歷年比較
  incomeStatementComparison: publicProcedure
    .input(z.object({
      companyId: z.string(),
      years: z.array(z.number()).min(2).max(3), // 2-3 年比較
    }))
    .query(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.years.map(async (year) => {
          const startDate = new Date(year, 0, 1)
          const endDate = new Date(year, 11, 31)

          // 營業收入科目 (4xxx)
          const revenueLines = await ctx.prisma.voucherLine.findMany({
            where: {
              voucher: {
                companyId: input.companyId,
                voucherDate: { gte: startDate, lte: endDate },
                status: 'POSTED',
              },
              account: { code: { startsWith: '4' } },
            },
            include: { account: true },
          })

          // 營業費用科目 (5xxx, 6xxx)
          const expenseLines = await ctx.prisma.voucherLine.findMany({
            where: {
              voucher: {
                companyId: input.companyId,
                voucherDate: { gte: startDate, lte: endDate },
                status: 'POSTED',
              },
              account: {
                OR: [
                  { code: { startsWith: '5' } },
                  { code: { startsWith: '6' } },
                ],
              },
            },
            include: { account: true },
          })

          // 計算收入 (貸方 - 借方)
          const revenue = revenueLines.reduce((sum, line) => {
            return sum + (Number(line.creditAmount) - Number(line.debitAmount))
          }, 0)

          // 計算費用 (借方 - 貸方)
          const expenses = expenseLines.reduce((sum, line) => {
            return sum + (Number(line.debitAmount) - Number(line.creditAmount))
          }, 0)

          return {
            year,
            revenue: Math.round(revenue),
            expenses: Math.round(expenses),
            netIncome: Math.round(revenue - expenses),
          }
        })
      )

      // 計算年增減
      const comparisons = results.map((current, index) => {
        if (index === 0) {
          return {
            ...current,
            revenueChange: null,
            revenueChangePercent: null,
            expensesChange: null,
            expensesChangePercent: null,
            netIncomeChange: null,
            netIncomeChangePercent: null,
          }
        }

        const previous = results[index - 1]
        return {
          ...current,
          revenueChange: current.revenue - previous.revenue,
          revenueChangePercent: previous.revenue !== 0
            ? Math.round(((current.revenue - previous.revenue) / Math.abs(previous.revenue)) * 1000) / 10
            : null,
          expensesChange: current.expenses - previous.expenses,
          expensesChangePercent: previous.expenses !== 0
            ? Math.round(((current.expenses - previous.expenses) / Math.abs(previous.expenses)) * 1000) / 10
            : null,
          netIncomeChange: current.netIncome - previous.netIncome,
          netIncomeChangePercent: previous.netIncome !== 0
            ? Math.round(((current.netIncome - previous.netIncome) / Math.abs(previous.netIncome)) * 1000) / 10
            : null,
        }
      })

      return {
        years: input.years,
        data: comparisons,
      }
    }),

  // 資產負債表歷年比較
  balanceSheetComparison: publicProcedure
    .input(z.object({
      companyId: z.string(),
      years: z.array(z.number()).min(2).max(3),
    }))
    .query(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.years.map(async (year) => {
          const asOfDate = new Date(year, 11, 31)

          // 資產科目 (1xxx)
          const assetLines = await ctx.prisma.voucherLine.findMany({
            where: {
              voucher: {
                companyId: input.companyId,
                voucherDate: { lte: asOfDate },
                status: 'POSTED',
              },
              account: { code: { startsWith: '1' } },
            },
            include: { account: true },
          })

          // 負債科目 (2xxx)
          const liabilityLines = await ctx.prisma.voucherLine.findMany({
            where: {
              voucher: {
                companyId: input.companyId,
                voucherDate: { lte: asOfDate },
                status: 'POSTED',
              },
              account: { code: { startsWith: '2' } },
            },
            include: { account: true },
          })

          // 權益科目 (3xxx)
          const equityLines = await ctx.prisma.voucherLine.findMany({
            where: {
              voucher: {
                companyId: input.companyId,
                voucherDate: { lte: asOfDate },
                status: 'POSTED',
              },
              account: { code: { startsWith: '3' } },
            },
            include: { account: true },
          })

          // 計算資產 (借方 - 貸方)
          const assets = assetLines.reduce((sum, line) => {
            return sum + (Number(line.debitAmount) - Number(line.creditAmount))
          }, 0)

          // 計算負債 (貸方 - 借方)
          const liabilities = liabilityLines.reduce((sum, line) => {
            return sum + (Number(line.creditAmount) - Number(line.debitAmount))
          }, 0)

          // 計算權益 (貸方 - 借方)
          const equity = equityLines.reduce((sum, line) => {
            return sum + (Number(line.creditAmount) - Number(line.debitAmount))
          }, 0)

          return {
            year,
            assets: Math.round(assets),
            liabilities: Math.round(liabilities),
            equity: Math.round(equity),
          }
        })
      )

      // 計算年增減
      const comparisons = results.map((current, index) => {
        if (index === 0) {
          return {
            ...current,
            assetsChange: null,
            assetsChangePercent: null,
            liabilitiesChange: null,
            liabilitiesChangePercent: null,
            equityChange: null,
            equityChangePercent: null,
          }
        }

        const previous = results[index - 1]
        return {
          ...current,
          assetsChange: current.assets - previous.assets,
          assetsChangePercent: previous.assets !== 0
            ? Math.round(((current.assets - previous.assets) / Math.abs(previous.assets)) * 1000) / 10
            : null,
          liabilitiesChange: current.liabilities - previous.liabilities,
          liabilitiesChangePercent: previous.liabilities !== 0
            ? Math.round(((current.liabilities - previous.liabilities) / Math.abs(previous.liabilities)) * 1000) / 10
            : null,
          equityChange: current.equity - previous.equity,
          equityChangePercent: previous.equity !== 0
            ? Math.round(((current.equity - previous.equity) / Math.abs(previous.equity)) * 1000) / 10
            : null,
        }
      })

      return {
        years: input.years,
        data: comparisons,
      }
    }),
})
