import { prisma } from './prisma'
import type { FlowModuleType, FlowExecutionStatus, FlowApprovalDecision } from '@prisma/client'

/**
 * 審核流程引擎
 * 處理申請的審核流程建立、審核人決定、審核決策等
 */

// 系統設定 key 常數
const CC_EMPLOYEE_IDS_KEY = 'FLOW_CC_EMPLOYEE_IDS'

/**
 * 更新原始申請的狀態（當審核流程完成時）
 */
async function updateSourceRequestStatus(
  moduleType: FlowModuleType,
  referenceId: string,
  newStatus: 'APPROVED' | 'REJECTED',
  approverId?: string,
  comment?: string
): Promise<void> {
  const now = new Date()

  try {
    switch (moduleType) {
      case 'LEAVE':
        await prisma.leaveRequest.update({
          where: { id: referenceId },
          data: {
            status: newStatus,
            processedAt: now,
            ...(newStatus === 'APPROVED'
              ? { approvedById: approverId }
              : { rejectedById: approverId }),
            approvalComment: comment,
          },
        })
        // 如果核准，更新假別餘額
        if (newStatus === 'APPROVED') {
          const request = await prisma.leaveRequest.findUnique({
            where: { id: referenceId },
          })
          if (request) {
            const year = new Date().getFullYear()
            await prisma.leaveBalance.upsert({
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
          }
        }
        break

      case 'EXPENSE':
        await prisma.expenseRequest.update({
          where: { id: referenceId },
          data: {
            status: newStatus,
            processedAt: now,
            ...(newStatus === 'APPROVED'
              ? { approvedById: approverId }
              : { rejectedById: approverId }),
          },
        })
        break

      case 'SEAL':
        // SealRequest 使用 processedById 而非 approvedById
        await prisma.sealRequest.update({
          where: { id: referenceId },
          data: {
            status: newStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            processedAt: now,
            processedById: approverId,
          },
        })
        break

      case 'CARD':
        // BusinessCardRequest 只有 approvedById 和 approvedAt
        await prisma.businessCardRequest.update({
          where: { id: referenceId },
          data: {
            status: newStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            ...(newStatus === 'APPROVED' ? {
              approvedById: approverId,
              approvedAt: now,
            } : {}),
          },
        })
        break

      case 'STATIONERY':
        // StationeryRequest 只有 approvedById 和 approvedAt
        await prisma.stationeryRequest.update({
          where: { id: referenceId },
          data: {
            status: newStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            ...(newStatus === 'APPROVED' ? {
              approvedById: approverId,
              approvedAt: now,
            } : {}),
          },
        })
        break

      case 'OVERTIME':
        // 加班申請可能沒有這個 model，先跳過
        console.log('OVERTIME 更新狀態尚未實作')
        break

      case 'BUSINESS_TRIP':
        // 出差申請可能沒有這個 model，先跳過
        console.log('BUSINESS_TRIP 更新狀態尚未實作')
        break

      default:
        console.warn(`未知的模組類型: ${moduleType}`)
    }
  } catch (error) {
    console.error(`更新 ${moduleType} 狀態失敗:`, error)
    // 不拋出錯誤，避免影響主流程
  }
}

/**
 * 取得審核完成抄送員工 IDs（支援多人）
 */
async function getCCEmployeeIds(): Promise<string[]> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: CC_EMPLOYEE_IDS_KEY },
  })
  if (!setting?.value) return []

  try {
    const ids = JSON.parse(setting.value)
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

/**
 * 發送抄送通知給指定員工（僅在最終核准時）
 */
async function sendCCNotification(
  executionId: string,
  applicantName: string,
  moduleType: FlowModuleType
): Promise<void> {
  const ccEmployeeIds = await getCCEmployeeIds()
  if (!ccEmployeeIds || ccEmployeeIds.length === 0) return

  // 確認員工存在
  const employees = await prisma.employee.findMany({
    where: { id: { in: ccEmployeeIds } },
    select: { id: true },
  })
  if (employees.length === 0) return

  const moduleTypeName = getModuleTypeName(moduleType)

  // 為每位抄送員工建立通知
  await prisma.notification.createMany({
    data: employees.map(emp => ({
      userId: emp.id,
      type: 'APPROVAL_CC',
      title: `審核完成通知（抄送）`,
      message: `${applicantName} 的${moduleTypeName}申請已核准`,
      refType: 'FlowExecution',
      refId: executionId,
      link: `/dashboard/approval`,
    })),
  })
}

interface StartFlowParams {
  companyId: string
  moduleType: FlowModuleType
  referenceId: string
  applicantId: string
}

interface StartFlowResult {
  success: boolean
  executionId?: string
  error?: string
}

/**
 * 啟動審核流程
 * 當申請提交時呼叫，建立 FlowExecution 和所有 FlowApprovalRecord
 */
export async function startFlow(params: StartFlowParams): Promise<StartFlowResult> {
  const { companyId, moduleType, referenceId, applicantId } = params

  // 1. 查找對應的流程範本
  const template = await prisma.flowTemplate.findUnique({
    where: {
      companyId_moduleType: { companyId, moduleType },
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: {
          position: true,
          specificEmployee: true,
        },
      },
    },
  })

  if (!template || template.steps.length === 0) {
    return {
      success: false,
      error: '找不到對應的審核流程範本，請先設定審核流程',
    }
  }

  // 2. 取得申請人的任職資訊（用於判斷直屬主管）
  const applicantAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: applicantId,
      companyId,
      status: 'ACTIVE',
    },
    include: {
      supervisor: {
        include: {
          employee: true,
        },
      },
    },
  })

  // 3. 建立審核記錄，決定每個關卡的審核人
  const approvalRecords = []

  for (const step of template.steps) {
    let assigneeId: string | null = null

    switch (step.assigneeType) {
      case 'DIRECT_SUPERVISOR':
        // 直屬主管
        assigneeId = applicantAssignment?.supervisor?.employeeId || null
        break
      case 'POSITION':
        // 指定職位 - 找該職位的任一在職人員
        if (step.positionId) {
          const positionHolder = await prisma.employeeAssignment.findFirst({
            where: {
              companyId,
              positionId: step.positionId,
              status: 'ACTIVE',
            },
          })
          assigneeId = positionHolder?.employeeId || null
        }
        break
      case 'SPECIFIC_PERSON':
        // 指定人員
        assigneeId = step.specificEmployeeId
        break
    }

    // 如果找不到審核人但是必要關卡，則回傳錯誤
    if (!assigneeId && step.isRequired) {
      return {
        success: false,
        error: `無法決定第 ${step.stepOrder} 關「${step.name}」的審核人`,
      }
    }

    // 只有找到審核人或是非必要關卡才加入記錄
    if (assigneeId) {
      approvalRecords.push({
        stepOrder: step.stepOrder,
        stepName: step.name,
        assigneeId,
      })
    }
  }

  if (approvalRecords.length === 0) {
    return {
      success: false,
      error: '無法建立審核流程，所有關卡都找不到審核人',
    }
  }

  // 4. 建立 FlowExecution 和所有 FlowApprovalRecord
  const execution = await prisma.flowExecution.create({
    data: {
      templateId: template.id,
      companyId,
      moduleType,
      referenceId,
      applicantId,
      currentStep: 1,
      status: 'PENDING',
      approvals: {
        create: approvalRecords,
      },
    },
  })

  // 5. 發送通知給第一位審核人
  const firstRecord = approvalRecords[0]
  if (firstRecord) {
    const applicant = await prisma.employee.findUnique({
      where: { id: applicantId },
      select: { name: true },
    })

    await prisma.notification.create({
      data: {
        userId: firstRecord.assigneeId,
        type: 'APPROVAL_REQUEST',
        title: '新的審核申請',
        message: `${applicant?.name || '員工'} 提交了${getModuleTypeName(moduleType)}申請，請審核`,
        refType: 'FlowExecution',
        refId: execution.id,
        link: `/dashboard/approval`,
      },
    })
  }

  return {
    success: true,
    executionId: execution.id,
  }
}

interface ProcessDecisionParams {
  executionId: string
  approverId: string
  decision: FlowApprovalDecision
  comment?: string
  proxyDelegationId?: string
}

interface ProcessDecisionResult {
  success: boolean
  newStatus?: FlowExecutionStatus
  error?: string
}

/**
 * 處理審核決策
 */
export async function processDecision(params: ProcessDecisionParams): Promise<ProcessDecisionResult> {
  const { executionId, approverId, decision, comment, proxyDelegationId } = params

  // 1. 查找執行記錄
  const execution = await prisma.flowExecution.findUnique({
    where: { id: executionId },
    include: {
      approvals: {
        orderBy: { stepOrder: 'asc' },
      },
      applicant: {
        select: { id: true, name: true },
      },
    },
  })

  if (!execution) {
    return { success: false, error: '找不到審核流程' }
  }

  if (execution.status !== 'PENDING') {
    return { success: false, error: '此流程已結束' }
  }

  // 2. 找到目前關卡的審核記錄
  const currentRecord = execution.approvals.find(
    (r) => r.stepOrder === execution.currentStep
  )

  if (!currentRecord) {
    return { success: false, error: '找不到目前關卡的審核記錄' }
  }

  // 3. 驗證審核人身份（包含代理）
  let actualApproverId = approverId
  let isProxy = false

  if (currentRecord.assigneeId !== approverId) {
    // 檢查是否有代理權限
    if (proxyDelegationId) {
      const delegation = await prisma.delegation.findFirst({
        where: {
          id: proxyDelegationId,
          delegateId: approverId,
          delegatorId: currentRecord.assigneeId,
          status: 'ACCEPTED',
          startDate: { lte: new Date() },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } },
          ],
        },
      })

      if (delegation) {
        isProxy = true
        actualApproverId = approverId
      } else {
        return { success: false, error: '您沒有代理此人審核的權限' }
      }
    } else {
      return { success: false, error: '您不是此關卡的審核人' }
    }
  }

  // 4. 更新審核記錄
  await prisma.flowApprovalRecord.update({
    where: { id: currentRecord.id },
    data: {
      decision,
      comment,
      decidedAt: new Date(),
      actualApproverId: isProxy ? actualApproverId : null,
      delegationId: isProxy ? proxyDelegationId : null,
    },
  })

  // 5. 決定下一步
  let newStatus: FlowExecutionStatus = 'PENDING'

  if (decision === 'REJECTED') {
    // 拒絕 -> 流程結束
    newStatus = 'REJECTED'

    await prisma.flowExecution.update({
      where: { id: executionId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
    })

    // 通知申請人被拒絕
    await prisma.notification.create({
      data: {
        userId: execution.applicantId,
        type: 'APPROVAL_REJECTED',
        title: '申請被拒絕',
        message: `您的${getModuleTypeName(execution.moduleType)}申請已被拒絕${comment ? `，原因：${comment}` : ''}`,
        refType: 'FlowExecution',
        refId: executionId,
        link: `/dashboard/approval`,
      },
    })

    // 更新原始申請狀態
    await updateSourceRequestStatus(
      execution.moduleType,
      execution.referenceId,
      'REJECTED',
      approverId,
      comment
    )
  } else {
    // 核准 -> 檢查是否還有下一關
    const nextStep = execution.currentStep + 1
    const nextRecord = execution.approvals.find((r) => r.stepOrder === nextStep)

    if (nextRecord) {
      // 還有下一關
      await prisma.flowExecution.update({
        where: { id: executionId },
        data: { currentStep: nextStep },
      })

      // 通知下一位審核人
      await prisma.notification.create({
        data: {
          userId: nextRecord.assigneeId,
          type: 'APPROVAL_REQUEST',
          title: '新的審核申請',
          message: `${execution.applicant.name} 的${getModuleTypeName(execution.moduleType)}申請已通過前一關審核，請審核`,
          refType: 'FlowExecution',
          refId: executionId,
          link: `/dashboard/approval`,
        },
      })
    } else {
      // 所有關卡都通過
      newStatus = 'APPROVED'

      await prisma.flowExecution.update({
        where: { id: executionId },
        data: {
          status: 'APPROVED',
          completedAt: new Date(),
        },
      })

      // 通知申請人已核准
      await prisma.notification.create({
        data: {
          userId: execution.applicantId,
          type: 'APPROVAL_APPROVED',
          title: '申請已核准',
          message: `您的${getModuleTypeName(execution.moduleType)}申請已全部核准`,
          refType: 'FlowExecution',
          refId: executionId,
          link: `/dashboard/approval`,
        },
      })

      // 抄送通知給指定員工（僅核准時）
      await sendCCNotification(
        executionId,
        execution.applicant.name,
        execution.moduleType
      )

      // 更新原始申請狀態
      await updateSourceRequestStatus(
        execution.moduleType,
        execution.referenceId,
        'APPROVED',
        approverId,
        comment
      )
    }
  }

  return {
    success: true,
    newStatus,
  }
}

/**
 * 取消審核流程
 */
export async function cancelFlow(executionId: string): Promise<{ success: boolean; error?: string }> {
  const execution = await prisma.flowExecution.findUnique({
    where: { id: executionId },
  })

  if (!execution) {
    return { success: false, error: '找不到審核流程' }
  }

  if (execution.status !== 'PENDING') {
    return { success: false, error: '此流程已結束，無法取消' }
  }

  await prisma.flowExecution.update({
    where: { id: executionId },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  })

  return { success: true }
}

/**
 * 取得待審核的流程（用於審核中心）
 */
export async function getPendingApprovals(employeeId: string) {
  // 找出員工是審核人的待審核記錄
  const pendingRecords = await prisma.flowApprovalRecord.findMany({
    where: {
      assigneeId: employeeId,
      decision: null,
      execution: {
        status: 'PENDING',
      },
    },
    include: {
      execution: {
        include: {
          applicant: {
            select: { id: true, name: true, employeeNo: true },
          },
          template: {
            select: { name: true },
          },
          approvals: {
            select: { id: true },
          },
        },
      },
    },
  })

  // 過濾出目前輪到此人審核的記錄
  return pendingRecords.filter(
    (record) => record.execution.currentStep === record.stepOrder
  )
}

/**
 * 取得員工可代理審核的流程
 */
export async function getProxyPendingApprovals(employeeId: string) {
  // 找出員工有代理權限的委託人
  const activeDelegations = await prisma.delegation.findMany({
    where: {
      delegateId: employeeId,
      status: 'ACCEPTED',
      startDate: { lte: new Date() },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
      permissions: {
        some: {
          permissionType: {
            in: ['APPROVE_LEAVE', 'APPROVE_EXPENSE', 'APPROVE_SEAL', 'APPROVE_CARD', 'APPROVE_STATIONERY'],
          },
        },
      },
    },
    include: {
      delegator: {
        select: { id: true, name: true },
      },
      permissions: true,
    },
  })

  if (activeDelegations.length === 0) {
    return []
  }

  const delegatorIds = activeDelegations.map((d) => d.delegatorId)

  // 找出這些委託人的待審核記錄
  const pendingRecords = await prisma.flowApprovalRecord.findMany({
    where: {
      assigneeId: { in: delegatorIds },
      decision: null,
      execution: {
        status: 'PENDING',
      },
    },
    include: {
      execution: {
        include: {
          applicant: {
            select: { id: true, name: true, employeeNo: true },
          },
          template: {
            select: { name: true },
          },
          approvals: {
            select: { id: true },
          },
        },
      },
    },
  })

  // 過濾出目前輪到審核的記錄，並附上代理資訊
  return pendingRecords
    .filter((record) => record.execution.currentStep === record.stepOrder)
    .map((record) => {
      const delegation = activeDelegations.find((d) => d.delegatorId === record.assigneeId)
      return {
        ...record,
        delegation,
      }
    })
}

function getModuleTypeName(moduleType: FlowModuleType): string {
  const names: Record<FlowModuleType, string> = {
    LEAVE: '請假',
    EXPENSE: '費用核銷',
    SEAL: '用印',
    CARD: '名片',
    STATIONERY: '文具',
    OVERTIME: '加班',
    BUSINESS_TRIP: '出差',
  }
  return names[moduleType] || moduleType
}
