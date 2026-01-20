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

  // 更新傳票
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      voucherDate: z.date().optional(),
      voucherType: z.enum(['RECEIPT', 'PAYMENT', 'TRANSFER']).optional(),
      description: z.string().optional(),
      lines: z.array(voucherLineSchema).min(2).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const voucher = await ctx.prisma.voucher.findUnique({
        where: { id: input.id },
        include: { period: true },
      })

      if (!voucher) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '傳票不存在' })
      }
      if (voucher.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿狀態的傳票可以修改' })
      }
      if (voucher.period.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '會計期間已關閉，無法修改傳票' })
      }

      // 如果有更新分錄
      if (input.lines) {
        // 計算借貸合計
        let totalDebit = 0
        let totalCredit = 0
        input.lines.forEach((line, index) => {
          totalDebit += line.debitAmount
          totalCredit += line.creditAmount
          if (line.debitAmount > 0 && line.creditAmount > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `第 ${index + 1} 行不能同時有借方和貸方金額` })
          }
        })

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `借貸不平衡：借方 ${totalDebit}，貸方 ${totalCredit}` })
        }

        // 如果有變更日期，檢查新期間
        let newPeriodId = voucher.periodId
        if (input.voucherDate) {
          const newPeriod = await ctx.prisma.accountingPeriod.findFirst({
            where: {
              companyId: voucher.companyId,
              startDate: { lte: input.voucherDate },
              endDate: { gte: input.voucherDate },
              status: 'OPEN',
            },
          })
          if (!newPeriod) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '無有效的會計期間' })
          }
          newPeriodId = newPeriod.id
        }

        // 刪除舊分錄，建立新分錄
        await ctx.prisma.voucherLine.deleteMany({
          where: { voucherId: input.id },
        })

        return ctx.prisma.voucher.update({
          where: { id: input.id },
          data: {
            voucherDate: input.voucherDate,
            voucherType: input.voucherType,
            description: input.description,
            periodId: newPeriodId,
            totalDebit,
            totalCredit,
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
      }

      // 只更新基本欄位
      return ctx.prisma.voucher.update({
        where: { id: input.id },
        data: {
          voucherDate: input.voucherDate,
          voucherType: input.voucherType,
          description: input.description,
        },
      })
    }),

  // 刪除傳票
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const voucher = await ctx.prisma.voucher.findUnique({
        where: { id: input.id },
        include: { period: true },
      })

      if (!voucher) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '傳票不存在' })
      }
      if (voucher.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿狀態的傳票可以刪除' })
      }
      if (voucher.period.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '會計期間已關閉，無法刪除傳票' })
      }

      // 先刪除分錄，再刪除傳票
      await ctx.prisma.voucherLine.deleteMany({
        where: { voucherId: input.id },
      })

      return ctx.prisma.voucher.delete({
        where: { id: input.id },
      })
    }),
})
