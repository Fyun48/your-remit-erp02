import { z } from 'zod'
import { publicProcedure, router } from '../trpc'
import { TRPCError } from '@trpc/server'

export const projectKpiRouter = router({
  // ==================== KPI 設定 ====================

  // 取得公司 KPI 設定
  getSettings: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.prisma.projectKpiSetting.findUnique({
        where: { companyId: input.companyId },
      })

      // 如果沒有設定，回傳預設值
      if (!settings) {
        return {
          id: null,
          companyId: input.companyId,
          completionWeight: 0.4,
          onTimeWeight: 0.35,
          qualityWeight: 0.25,
        }
      }

      return settings
    }),

  // 更新 KPI 設定
  updateSettings: publicProcedure
    .input(z.object({
      companyId: z.string(),
      completionWeight: z.number().min(0).max(1),
      onTimeWeight: z.number().min(0).max(1),
      qualityWeight: z.number().min(0).max(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, ...weights } = input

      // 驗證權重總和為 1
      const total = weights.completionWeight + weights.onTimeWeight + weights.qualityWeight
      if (Math.abs(total - 1) > 0.01) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '權重總和必須等於 100%',
        })
      }

      return ctx.prisma.projectKpiSetting.upsert({
        where: { companyId },
        create: {
          companyId,
          ...weights,
        },
        update: weights,
      })
    }),

  // ==================== KPI 計算 ====================

  // 計算專案 KPI
  calculateProjectKpi: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          phases: {
            include: {
              tasks: true,
            },
          },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '專案不存在' })
      }

      // 計算任務統計
      let totalTasks = 0
      let completedTasks = 0
      let onTimeTasks = 0

      project.phases.forEach(phase => {
        phase.tasks.forEach(task => {
          totalTasks++
          if (task.status === 'COMPLETED') {
            completedTasks++
            // 檢查是否準時完成
            if (task.dueDate && task.completedAt) {
              if (new Date(task.completedAt) <= new Date(task.dueDate)) {
                onTimeTasks++
              }
            } else {
              // 沒有設定截止日期的任務視為準時
              onTimeTasks++
            }
          }
        })
      })

      // 計算各項指標
      const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0
      const onTimeRate = completedTasks > 0 ? onTimeTasks / completedTasks : 0
      const qualityScore = project.qualityScore ? project.qualityScore / 5 : 0

      // 取得權重設定
      const settings = await ctx.prisma.projectKpiSetting.findUnique({
        where: { companyId: project.companyId },
      })

      const weights = {
        completion: settings?.completionWeight ?? 0.4,
        onTime: settings?.onTimeWeight ?? 0.35,
        quality: settings?.qualityWeight ?? 0.25,
      }

      // 計算綜合分數
      const overallScore =
        completionRate * weights.completion +
        onTimeRate * weights.onTime +
        qualityScore * weights.quality

      return {
        projectId: project.id,
        projectName: project.name,
        totalTasks,
        completedTasks,
        onTimeTasks,
        completionRate: Math.round(completionRate * 100),
        onTimeRate: Math.round(onTimeRate * 100),
        qualityScore: project.qualityScore ?? null,
        qualityScorePercent: Math.round(qualityScore * 100),
        overallScore: Math.round(overallScore * 100),
        weights,
      }
    }),

  // 計算部門 KPI 彙整
  calculateDepartmentKpi: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { companyId, departmentId, year, month } = input

      // 取得該月份的專案
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59)

      const projects = await ctx.prisma.project.findMany({
        where: {
          companyId,
          departmentId,
          OR: [
            // 專案在該月份內有活動
            { createdAt: { gte: startDate, lte: endDate } },
            { actualEndDate: { gte: startDate, lte: endDate } },
            // 或者專案跨越該月份
            {
              AND: [
                { createdAt: { lte: endDate } },
                {
                  OR: [
                    { actualEndDate: null },
                    { actualEndDate: { gte: startDate } },
                  ],
                },
              ],
            },
          ],
        },
        include: {
          phases: {
            include: {
              tasks: true,
            },
          },
        },
      })

      // 計算彙整數據
      let totalCompletionRate = 0
      let totalOnTimeRate = 0
      let totalQualityScore = 0
      let qualityCount = 0
      let completedCount = 0

      projects.forEach(project => {
        // 計算單個專案指標
        let totalTasks = 0
        let completedTasks = 0
        let onTimeTasks = 0

        project.phases.forEach(phase => {
          phase.tasks.forEach(task => {
            totalTasks++
            if (task.status === 'COMPLETED') {
              completedTasks++
              if (task.dueDate && task.completedAt) {
                if (new Date(task.completedAt) <= new Date(task.dueDate)) {
                  onTimeTasks++
                }
              } else {
                onTimeTasks++
              }
            }
          })
        })

        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0
        const onTimeRate = completedTasks > 0 ? onTimeTasks / completedTasks : 0

        totalCompletionRate += completionRate
        totalOnTimeRate += onTimeRate

        if (project.qualityScore) {
          totalQualityScore += project.qualityScore / 5
          qualityCount++
        }

        if (project.status === 'COMPLETED') {
          completedCount++
        }
      })

      const projectCount = projects.length
      const avgCompletion = projectCount > 0 ? totalCompletionRate / projectCount : 0
      const avgOnTime = projectCount > 0 ? totalOnTimeRate / projectCount : 0
      const avgQuality = qualityCount > 0 ? totalQualityScore / qualityCount : 0

      // 取得權重設定
      const settings = await ctx.prisma.projectKpiSetting.findUnique({
        where: { companyId },
      })

      const weights = {
        completion: settings?.completionWeight ?? 0.4,
        onTime: settings?.onTimeWeight ?? 0.35,
        quality: settings?.qualityWeight ?? 0.25,
      }

      const overallScore =
        avgCompletion * weights.completion +
        avgOnTime * weights.onTime +
        avgQuality * weights.quality

      return {
        companyId,
        departmentId,
        year,
        month,
        projectCount,
        completedCount,
        avgCompletion: Math.round(avgCompletion * 100),
        avgOnTime: Math.round(avgOnTime * 100),
        avgQuality: Math.round(avgQuality * 100),
        overallScore: Math.round(overallScore * 100),
        weights,
      }
    }),

  // 儲存部門 KPI 彙整
  saveDepartmentKpiSummary: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string(),
      year: z.number(),
      month: z.number(),
      targetScore: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, departmentId, year, month, targetScore } = input

      // 先計算 KPI
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59)

      const projects = await ctx.prisma.project.findMany({
        where: {
          companyId,
          departmentId,
          OR: [
            { createdAt: { gte: startDate, lte: endDate } },
            { actualEndDate: { gte: startDate, lte: endDate } },
            {
              AND: [
                { createdAt: { lte: endDate } },
                {
                  OR: [
                    { actualEndDate: null },
                    { actualEndDate: { gte: startDate } },
                  ],
                },
              ],
            },
          ],
        },
        include: {
          phases: {
            include: {
              tasks: true,
            },
          },
        },
      })

      // 計算彙整數據
      let totalCompletionRate = 0
      let totalOnTimeRate = 0
      let totalQualityScore = 0
      let qualityCount = 0
      let completedCount = 0

      projects.forEach(project => {
        let totalTasks = 0
        let completedTasks = 0
        let onTimeTasks = 0

        project.phases.forEach(phase => {
          phase.tasks.forEach(task => {
            totalTasks++
            if (task.status === 'COMPLETED') {
              completedTasks++
              if (task.dueDate && task.completedAt) {
                if (new Date(task.completedAt) <= new Date(task.dueDate)) {
                  onTimeTasks++
                }
              } else {
                onTimeTasks++
              }
            }
          })
        })

        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0
        const onTimeRate = completedTasks > 0 ? onTimeTasks / completedTasks : 0

        totalCompletionRate += completionRate
        totalOnTimeRate += onTimeRate

        if (project.qualityScore) {
          totalQualityScore += project.qualityScore / 5
          qualityCount++
        }

        if (project.status === 'COMPLETED') {
          completedCount++
        }
      })

      const projectCount = projects.length
      const avgCompletion = projectCount > 0 ? totalCompletionRate / projectCount : 0
      const avgOnTime = projectCount > 0 ? totalOnTimeRate / projectCount : 0
      const avgQuality = qualityCount > 0 ? totalQualityScore / qualityCount : 0

      // 取得權重設定
      const settings = await ctx.prisma.projectKpiSetting.findUnique({
        where: { companyId },
      })

      const weights = {
        completion: settings?.completionWeight ?? 0.4,
        onTime: settings?.onTimeWeight ?? 0.35,
        quality: settings?.qualityWeight ?? 0.25,
      }

      const overallScore =
        avgCompletion * weights.completion +
        avgOnTime * weights.onTime +
        avgQuality * weights.quality

      // 儲存或更新彙整
      return ctx.prisma.projectKpiSummary.upsert({
        where: {
          companyId_departmentId_year_month: {
            companyId,
            departmentId,
            year,
            month,
          },
        },
        create: {
          companyId,
          departmentId,
          year,
          month,
          projectCount,
          completedCount,
          avgCompletion,
          avgOnTime,
          avgQuality,
          overallScore,
          targetScore,
        },
        update: {
          projectCount,
          completedCount,
          avgCompletion,
          avgOnTime,
          avgQuality,
          overallScore,
          targetScore,
        },
      })
    }),

  // ==================== KPI 查詢 ====================

  // 取得部門 KPI 歷史
  getDepartmentKpiHistory: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string(),
      startYear: z.number(),
      startMonth: z.number(),
      endYear: z.number(),
      endMonth: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { companyId, departmentId, startYear, startMonth, endYear, endMonth } = input

      return ctx.prisma.projectKpiSummary.findMany({
        where: {
          companyId,
          departmentId,
          OR: [
            // 同年份，月份在範圍內
            {
              year: startYear,
              month: { gte: startMonth },
            },
            // 中間年份
            {
              year: { gt: startYear, lt: endYear },
            },
            // 結束年份
            {
              year: endYear,
              month: { lte: endMonth },
            },
          ].filter(() => startYear !== endYear || startMonth <= endMonth),
        },
        orderBy: [
          { year: 'asc' },
          { month: 'asc' },
        ],
      })
    }),

  // 取得公司所有部門 KPI 排行
  getCompanyKpiRanking: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { companyId, year, month } = input

      const summaries = await ctx.prisma.projectKpiSummary.findMany({
        where: {
          companyId,
          year,
          month,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          overallScore: 'desc',
        },
      })

      return summaries.map((summary, index) => ({
        rank: index + 1,
        departmentId: summary.departmentId,
        departmentName: summary.department.name,
        departmentCode: summary.department.code,
        projectCount: summary.projectCount,
        completedCount: summary.completedCount,
        avgCompletion: Math.round(summary.avgCompletion * 100),
        avgOnTime: Math.round(summary.avgOnTime * 100),
        avgQuality: Math.round(summary.avgQuality * 100),
        overallScore: Math.round(summary.overallScore * 100),
        targetScore: summary.targetScore ? Math.round(summary.targetScore * 100) : null,
        achievedTarget: summary.targetScore ? summary.overallScore >= summary.targetScore : null,
      }))
    }),

  // 取得公司 KPI 總覽
  getCompanyKpiOverview: publicProcedure
    .input(z.object({
      companyId: z.string(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { companyId, year, month } = input

      // 取得該月份所有部門的 KPI
      const summaries = await ctx.prisma.projectKpiSummary.findMany({
        where: { companyId, year, month },
      })

      if (summaries.length === 0) {
        return {
          totalProjects: 0,
          totalCompleted: 0,
          avgCompletion: 0,
          avgOnTime: 0,
          avgQuality: 0,
          avgOverallScore: 0,
          departmentCount: 0,
          topPerformerCount: 0,
          underPerformerCount: 0,
        }
      }

      const totalProjects = summaries.reduce((sum, s) => sum + s.projectCount, 0)
      const totalCompleted = summaries.reduce((sum, s) => sum + s.completedCount, 0)
      const avgCompletion = summaries.reduce((sum, s) => sum + s.avgCompletion, 0) / summaries.length
      const avgOnTime = summaries.reduce((sum, s) => sum + s.avgOnTime, 0) / summaries.length
      const avgQuality = summaries.reduce((sum, s) => sum + s.avgQuality, 0) / summaries.length
      const avgOverallScore = summaries.reduce((sum, s) => sum + s.overallScore, 0) / summaries.length

      // 計算達標與未達標部門數
      const topPerformerCount = summaries.filter(s =>
        s.targetScore && s.overallScore >= s.targetScore
      ).length
      const underPerformerCount = summaries.filter(s =>
        s.targetScore && s.overallScore < s.targetScore
      ).length

      return {
        totalProjects,
        totalCompleted,
        avgCompletion: Math.round(avgCompletion * 100),
        avgOnTime: Math.round(avgOnTime * 100),
        avgQuality: Math.round(avgQuality * 100),
        avgOverallScore: Math.round(avgOverallScore * 100),
        departmentCount: summaries.length,
        topPerformerCount,
        underPerformerCount,
      }
    }),
})
