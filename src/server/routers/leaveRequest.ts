import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { createNotification, createNotifications } from '@/lib/notification-service'
import { startFlow } from '@/lib/flow-engine'

// 產生申請單號
function generateRequestNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LV${date}${random}`
}

// 計算請假時數
function calculateLeaveHours(
  startDate: Date,
  startPeriod: string,
  endDate: Date,
  endPeriod: string,
  workHoursPerDay: number = 8
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // 計算天數差
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  if (diffDays === 1) {
    // 同一天
    if (startPeriod === 'FULL_DAY') return workHoursPerDay
    return workHoursPerDay / 2 // AM 或 PM
  }

  // 多天
  let totalHours = (diffDays - 2) * workHoursPerDay // 中間天數

  // 第一天
  if (startPeriod === 'FULL_DAY') totalHours += workHoursPerDay
  else if (startPeriod === 'PM') totalHours += workHoursPerDay / 2
  else totalHours += workHoursPerDay // AM 開始算全天

  // 最後一天
  if (endPeriod === 'FULL_DAY') totalHours += workHoursPerDay
  else if (endPeriod === 'AM') totalHours += workHoursPerDay / 2
  else totalHours += workHoursPerDay // PM 結束算全天

  return totalHours
}

// 根據天數計算結束日期
function calculateEndDateFromDays(
  startDate: Date,
  leaveDays: number
): Date {
  const end = new Date(startDate)
  // leaveDays 包含起始日，所以要減 1
  end.setDate(end.getDate() + Math.floor(leaveDays) - 1)
  return end
}

// 驗證最小請假單位
function validateMinUnit(
  startPeriod: string,
  endPeriod: string,
  minUnit: string
): { valid: boolean; message?: string } {
  if (minUnit === 'DAY') {
    // 假別最小單位為「天」，只能選全天
    if (startPeriod !== 'FULL_DAY' || endPeriod !== 'FULL_DAY') {
      return {
        valid: false,
        message: '此假別最小請假單位為「天」，只能選擇全天',
      }
    }
  } else if (minUnit === 'HALF_DAY') {
    // 假別最小單位為「半天」，可選全天或半天
    // 這個已經在 LeavePeriod enum 中處理了
  }
  // HOUR 最小單位暫不驗證（未來可擴展）
  return { valid: true }
}

export const leaveRequestRouter = router({
  // 建立請假申請
  create: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      leaveTypeId: z.string(),
      startDate: z.date(),
      startPeriod: z.enum(['FULL_DAY', 'AM', 'PM']).default('FULL_DAY'),
      endDate: z.date().optional(), // 改為可選
      endPeriod: z.enum(['FULL_DAY', 'AM', 'PM']).default('FULL_DAY'),
      leaveDays: z.number().positive().optional(), // 新增：請假天數
      reason: z.string().optional(),
      proxyEmployeeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 驗證假別
      const leaveType = await ctx.prisma.leaveType.findUnique({
        where: { id: input.leaveTypeId },
      })

      if (!leaveType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '假別不存在' })
      }

      // 檢查是否需要事由
      if (leaveType.requiresReason && !input.reason) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此假別需要填寫請假事由' })
      }

      // 計算結束日期（如果使用天數輸入模式）
      let endDate = input.endDate
      let endPeriod = input.endPeriod

      if (input.leaveDays && !input.endDate) {
        // 使用天數計算結束日期
        if (input.leaveDays === 0.5) {
          // 半天請假
          endDate = input.startDate
          endPeriod = input.startPeriod // 同一天的同一個時段
        } else {
          endDate = calculateEndDateFromDays(input.startDate, input.leaveDays)
          // 如果天數包含半天（如 1.5 天），調整結束時段
          if (input.leaveDays % 1 === 0.5) {
            endPeriod = 'AM' // 最後一天只請上午
          } else {
            endPeriod = 'FULL_DAY'
          }
        }
      }

      // 驗證必須有結束日期
      if (!endDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '請選擇結束日期或輸入請假天數',
        })
      }

      // 驗證最小請假單位
      const minUnitValidation = validateMinUnit(
        input.startPeriod,
        endPeriod,
        leaveType.minUnit
      )
      if (!minUnitValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: minUnitValidation.message || '不符合最小請假單位限制',
        })
      }

      // 計算請假時數
      const totalHours = calculateLeaveHours(
        input.startDate,
        input.startPeriod,
        endDate,
        endPeriod
      )

      // 取得直屬主管作為審核者
      const assignment = await ctx.prisma.employeeAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          status: 'ACTIVE',
        },
      })

      return ctx.prisma.leaveRequest.create({
        data: {
          requestNo: generateRequestNo(),
          employeeId: input.employeeId,
          companyId: input.companyId,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          startPeriod: input.startPeriod,
          endDate: endDate,
          endPeriod: endPeriod,
          totalHours,
          reason: input.reason,
          proxyEmployeeId: input.proxyEmployeeId,
          status: 'DRAFT',
          currentApproverId: assignment?.supervisorId,
        },
      })
    }),

  // 送出申請
  submit: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'DRAFT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以送出' })
      }

      // 更新請假申請狀態
      const updatedRequest = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
        },
      })

      // 使用新的審核流程系統
      const flowResult = await startFlow({
        companyId: request.companyId,
        moduleType: 'LEAVE',
        referenceId: request.id,
        applicantId: request.employeeId,
      })

      if (!flowResult.success) {
        // 如果新流程系統失敗，嘗試舊的審核流程（向後相容）
        console.warn('新審核流程啟動失敗:', flowResult.error)

        // 計算請假天數
        const totalDays = request.totalHours / 8

        // 匹配適用的審核流程（舊系統）
        const flows = await ctx.prisma.approvalFlow.findMany({
          where: {
            module: 'leave',
            isActive: true,
            OR: [
              { companyId: null },
              { companyId: request.companyId },
            ],
          },
          include: {
            steps: { orderBy: { stepOrder: 'asc' } },
          },
          orderBy: [{ companyId: 'desc' }, { sortOrder: 'asc' }],
        })

        // 找到匹配的流程
        let matchedFlow = null
        for (const flow of flows) {
          if (!flow.conditions) {
            if (flow.isDefault) {
              matchedFlow = flow
              break
            }
            continue
          }

          try {
            const conditions = JSON.parse(flow.conditions)
            let match = true

            if (conditions.minDays && totalDays < conditions.minDays) match = false
            if (conditions.maxDays && totalDays > conditions.maxDays) match = false
            if (conditions.leaveTypes && !conditions.leaveTypes.includes(request.leaveType.code)) match = false

            if (match) {
              matchedFlow = flow
              break
            }
          } catch {
            continue
          }
        }

        if (!matchedFlow) {
          matchedFlow = flows.find(f => f.isDefault) || flows[0]
        }

        // 如果有審核流程，建立審核實例（舊系統）
        if (matchedFlow && matchedFlow.steps.length > 0) {
          const firstStep = matchedFlow.steps[0]

          // 解析第一關審核者
          const assignment = await ctx.prisma.employeeAssignment.findFirst({
            where: { employeeId: request.employeeId, companyId: request.companyId, status: 'ACTIVE' },
          })

          let approvers: string[] = []
          if (firstStep.approverType === 'SUPERVISOR' && assignment?.supervisorId) {
            approvers = [assignment.supervisorId]
          }

          // 建立審核實例
          const instance = await ctx.prisma.approvalInstance.create({
            data: {
              flowId: matchedFlow.id,
              module: 'leave',
              referenceId: request.id,
              applicantId: request.employeeId,
              companyId: request.companyId,
              status: 'IN_PROGRESS',
              currentStep: 1,
            },
          })

          // 建立第一個關卡實例
          await ctx.prisma.approvalStepInstance.create({
            data: {
              instanceId: instance.id,
              stepId: firstStep.id,
              stepOrder: 1,
              assignedTo: JSON.stringify(approvers),
              status: 'PENDING',
            },
          })

          // 更新請假申請的當前審核者
          await ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: { currentApproverId: approvers[0] || null },
          })

          // 通知審核者有新的請假申請待審核
          if (approvers.length > 0) {
            const employee = await ctx.prisma.employee.findUnique({
              where: { id: request.employeeId },
              select: { name: true },
            })

            try {
              await createNotifications(
                approvers.map(approverId => ({
                  userId: approverId,
                  type: 'APPROVAL_NEEDED' as const,
                  title: '有新的請假申請待審核',
                  message: `${employee?.name || '員工'} 提出了請假申請`,
                  link: `/dashboard/leave/${request.id}`,
                  refType: 'LeaveRequest',
                  refId: request.id,
                }))
              )
            } catch (error) {
              console.error('Failed to create notification for leave request approvers:', error)
            }
          }
        }
      }

      return updatedRequest
    }),

  // 審核（核准/拒絕）
  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      action: z.enum(['APPROVE', 'REJECT']),
      approverId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法審核' })
      }

      // 查找審核實例
      const instance = await ctx.prisma.approvalInstance.findUnique({
        where: {
          module_referenceId: {
            module: 'leave',
            referenceId: input.id,
          },
        },
        include: {
          flow: {
            include: {
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          stepInstances: {
            where: { status: 'PENDING' },
            include: { step: true },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      if (instance && instance.stepInstances.length > 0) {
        const currentStepInstance = instance.stepInstances[0]

        // 記錄審核動作
        await ctx.prisma.approvalAction.create({
          data: {
            stepInstanceId: currentStepInstance.id,
            actorId: input.approverId,
            action: input.action,
            comment: input.comment,
          },
        })

        if (input.action === 'REJECT') {
          // 拒絕：結束審核流程
          await ctx.prisma.approvalStepInstance.update({
            where: { id: currentStepInstance.id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })

          await ctx.prisma.approvalInstance.update({
            where: { id: instance.id },
            data: { status: 'REJECTED', completedAt: new Date() },
          })

          const rejectedRequest = await ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: {
              status: 'REJECTED',
              processedAt: new Date(),
              rejectedById: input.approverId,
              approvalComment: input.comment,
            },
          })

          // 通知申請人申請已駁回
          try {
            await createNotification({
              userId: request.employeeId,
              type: 'REQUEST_REJECTED',
              title: '請假申請已駁回',
              message: `您的請假申請 ${request.requestNo} 已被駁回`,
              link: `/dashboard/leave/${request.id}`,
              refType: 'LeaveRequest',
              refId: request.id,
            })
          } catch (error) {
            console.error('Failed to create notification for rejected leave request:', error)
          }

          return rejectedRequest
        }

        // 核准當前關卡
        await ctx.prisma.approvalStepInstance.update({
          where: { id: currentStepInstance.id },
          data: { status: 'APPROVED', completedAt: new Date() },
        })

        // 檢查是否有下一關
        const nextStep = instance.flow.steps.find(s => s.stepOrder === instance.currentStep + 1)

        if (nextStep) {
          // 有下一關，建立下一關卡實例
          const assignment = await ctx.prisma.employeeAssignment.findFirst({
            where: { employeeId: request.employeeId, companyId: request.companyId, status: 'ACTIVE' },
          })

          let nextApprovers: string[] = []
          if (nextStep.approverType === 'SUPERVISOR' && assignment?.supervisorId) {
            // 找上一層主管
            const supervisor = await ctx.prisma.employeeAssignment.findUnique({
              where: { id: assignment.supervisorId },
            })
            if (supervisor?.supervisorId) {
              nextApprovers = [supervisor.supervisorId]
            }
          }

          await ctx.prisma.approvalStepInstance.create({
            data: {
              instanceId: instance.id,
              stepId: nextStep.id,
              stepOrder: nextStep.stepOrder,
              assignedTo: JSON.stringify(nextApprovers),
              status: 'PENDING',
            },
          })

          await ctx.prisma.approvalInstance.update({
            where: { id: instance.id },
            data: { currentStep: nextStep.stepOrder },
          })

          // 通知下一關審核者
          if (nextApprovers.length > 0) {
            const employee = await ctx.prisma.employee.findUnique({
              where: { id: request.employeeId },
              select: { name: true },
            })

            try {
              await createNotifications(
                nextApprovers.map(approverId => ({
                  userId: approverId,
                  type: 'APPROVAL_NEEDED' as const,
                  title: '有新的請假申請待審核',
                  message: `${employee?.name || '員工'} 提出了請假申請`,
                  link: `/dashboard/leave/${request.id}`,
                  refType: 'LeaveRequest',
                  refId: request.id,
                }))
              )
            } catch (error) {
              console.error('Failed to create notification for next leave request approvers:', error)
            }
          }

          // 更新請假申請的當前審核者
          return ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: { currentApproverId: nextApprovers[0] || null },
          })
        }

        // 無下一關，流程完成
        await ctx.prisma.approvalInstance.update({
          where: { id: instance.id },
          data: { status: 'APPROVED', completedAt: new Date() },
        })
      }

      // 更新請假申請為已核准
      const updated = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          approvedById: input.approverId,
          approvalComment: input.comment,
        },
      })

      // 更新假別餘額
      const year = new Date().getFullYear()
      await ctx.prisma.leaveBalance.upsert({
        where: {
          employeeId_companyId_leaveTypeId_year: {
            employeeId: request.employeeId,
            companyId: request.companyId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        update: {
          usedHours: { increment: request.totalHours },
        },
        create: {
          employeeId: request.employeeId,
          companyId: request.companyId,
          leaveTypeId: request.leaveTypeId,
          year,
          usedHours: request.totalHours,
        },
      })

      // 通知申請人申請已核准
      try {
        await createNotification({
          userId: request.employeeId,
          type: 'REQUEST_APPROVED',
          title: '請假申請已核准',
          message: `您的請假申請 ${request.requestNo} 已核准`,
          link: `/dashboard/leave/${request.id}`,
          refType: 'LeaveRequest',
          refId: request.id,
        })
      } catch (error) {
        console.error('Failed to create notification for approved leave request:', error)
      }

      return updated
    }),

  // 取消申請
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
      })

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '申請單不存在' })
      }

      if (!['DRAFT', 'PENDING'].includes(request.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請單無法取消' })
      }

      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),

  // 取得我的請假列表
  listMine: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31)

      return ctx.prisma.leaveRequest.findMany({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          startDate: { gte: startOfYear, lte: endOfYear },
        },
        include: { leaveType: true },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // 取得待審核列表（主管用）
  listPending: publicProcedure
    .input(z.object({ approverId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 取得此主管的下屬
      const subordinates = await ctx.prisma.employeeAssignment.findMany({
        where: { supervisorId: input.approverId, status: 'ACTIVE' },
        select: { employeeId: true, companyId: true },
      })

      if (subordinates.length === 0) return []

      return ctx.prisma.leaveRequest.findMany({
        where: {
          status: 'PENDING',
          OR: subordinates.map(s => ({
            employeeId: s.employeeId,
            companyId: s.companyId,
          })),
        },
        include: { leaveType: true },
        orderBy: { submittedAt: 'asc' },
      })
    }),

  // 取得單一申請詳情
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { leaveType: true },
      })
    }),
})
