import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { isGroupAdmin } from '@/lib/group-permission'
import { isCompanyManager } from '@/lib/permission'

export const leaveTypeTemplateRouter = router({
  // 取得範本列表
  list: publicProcedure
    .input(z.object({
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveTypeTemplate.findMany({
        where: input.year ? { year: input.year } : {},
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得單一範本
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveTypeTemplate.findUnique({
        where: { id: input.id },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      })
    }),

  // 從現有公司假別建立範本
  createFromCompany: publicProcedure
    .input(z.object({
      companyId: z.string(),
      name: z.string().min(1, '請輸入範本名稱'),
      description: z.string().optional(),
      year: z.number().optional(),
      createdById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查權限
      const groupAdmin = await isGroupAdmin(input.createdById)
      const companyManager = await isCompanyManager(input.createdById, input.companyId)

      if (!groupAdmin && !companyManager) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您沒有權限建立假別範本',
        })
      }

      // 取得公司的假別
      const leaveTypes = await ctx.prisma.leaveType.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            { companyId: input.companyId },
          ],
        },
        orderBy: { sortOrder: 'asc' },
      })

      if (leaveTypes.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '該公司沒有可用的假別',
        })
      }

      // 建立範本
      return ctx.prisma.leaveTypeTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          year: input.year,
          sourceCompanyId: input.companyId,
          createdById: input.createdById,
          items: {
            create: leaveTypes.map((lt, index) => ({
              code: lt.code,
              name: lt.name,
              category: lt.category,
              requiresReason: lt.requiresReason,
              requiresAttachment: lt.requiresAttachment,
              attachmentAfterDays: lt.attachmentAfterDays,
              minUnit: lt.minUnit,
              quotaType: lt.quotaType,
              annualQuotaDays: lt.annualQuotaDays,
              canCarryOver: lt.canCarryOver,
              carryOverLimitDays: lt.carryOverLimitDays,
              canCashOut: lt.canCashOut,
              cashOutRate: lt.cashOutRate,
              advanceDaysRequired: lt.advanceDaysRequired,
              maxConsecutiveDays: lt.maxConsecutiveDays,
              genderRestriction: lt.genderRestriction,
              applicableAfterDays: lt.applicableAfterDays,
              sortOrder: index,
            })),
          },
        },
        include: {
          items: true,
        },
      })
    }),

  // 套用範本到目標公司
  applyToCompany: publicProcedure
    .input(z.object({
      templateId: z.string(),
      targetCompanyId: z.string(),
      appliedById: z.string(),
      overwrite: z.boolean().default(false), // 是否覆蓋現有假別
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查權限
      const groupAdmin = await isGroupAdmin(input.appliedById)
      const companyManager = await isCompanyManager(input.appliedById, input.targetCompanyId)

      if (!groupAdmin && !companyManager) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您沒有權限套用假別範本',
        })
      }

      // 取得範本
      const template = await ctx.prisma.leaveTypeTemplate.findUnique({
        where: { id: input.templateId },
        include: {
          items: true,
        },
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '範本不存在',
        })
      }

      // 如果需要覆蓋，先將現有假別設為非啟用
      if (input.overwrite) {
        await ctx.prisma.leaveType.updateMany({
          where: { companyId: input.targetCompanyId },
          data: { isActive: false },
        })
      }

      // 建立或更新假別
      const results = []
      for (const item of template.items) {
        // 檢查是否已存在相同代碼的假別
        const existing = await ctx.prisma.leaveType.findUnique({
          where: {
            companyId_code: {
              companyId: input.targetCompanyId,
              code: item.code,
            },
          },
        })

        if (existing) {
          // 更新現有假別
          const updated = await ctx.prisma.leaveType.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              category: item.category,
              requiresReason: item.requiresReason,
              requiresAttachment: item.requiresAttachment,
              attachmentAfterDays: item.attachmentAfterDays,
              minUnit: item.minUnit,
              quotaType: item.quotaType,
              annualQuotaDays: item.annualQuotaDays,
              canCarryOver: item.canCarryOver,
              carryOverLimitDays: item.carryOverLimitDays,
              canCashOut: item.canCashOut,
              cashOutRate: item.cashOutRate,
              advanceDaysRequired: item.advanceDaysRequired,
              maxConsecutiveDays: item.maxConsecutiveDays,
              genderRestriction: item.genderRestriction,
              applicableAfterDays: item.applicableAfterDays,
              sortOrder: item.sortOrder,
              isActive: true,
            },
          })
          results.push({ action: 'updated', leaveType: updated })
        } else {
          // 建立新假別
          const created = await ctx.prisma.leaveType.create({
            data: {
              companyId: input.targetCompanyId,
              code: item.code,
              name: item.name,
              category: item.category,
              requiresReason: item.requiresReason,
              requiresAttachment: item.requiresAttachment,
              attachmentAfterDays: item.attachmentAfterDays,
              minUnit: item.minUnit,
              quotaType: item.quotaType,
              annualQuotaDays: item.annualQuotaDays,
              canCarryOver: item.canCarryOver,
              carryOverLimitDays: item.carryOverLimitDays,
              canCashOut: item.canCashOut,
              cashOutRate: item.cashOutRate,
              advanceDaysRequired: item.advanceDaysRequired,
              maxConsecutiveDays: item.maxConsecutiveDays,
              genderRestriction: item.genderRestriction,
              applicableAfterDays: item.applicableAfterDays,
              sortOrder: item.sortOrder,
            },
          })
          results.push({ action: 'created', leaveType: created })
        }
      }

      return {
        templateId: template.id,
        templateName: template.name,
        targetCompanyId: input.targetCompanyId,
        results,
      }
    }),

  // 刪除範本
  delete: publicProcedure
    .input(z.object({
      id: z.string(),
      deletedById: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查權限（只有集團管理員可刪除範本）
      const groupAdmin = await isGroupAdmin(input.deletedById)
      if (!groupAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '只有集團管理員可以刪除假別範本',
        })
      }

      // 刪除範本（cascade 會自動刪除項目）
      return ctx.prisma.leaveTypeTemplate.delete({
        where: { id: input.id },
      })
    }),
})
