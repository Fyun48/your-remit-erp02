import { prisma } from './prisma'
import { TRPCError } from '@trpc/server'
import { createNotification } from '@/lib/notification-service'

// 類型定義
export interface StartWorkflowInput {
  definitionId: string
  requestType: string
  requestId: string
  applicantId: string
  companyId: string
  requestData?: Record<string, unknown> // 用於條件判斷的資料
}

export interface ProcessApprovalInput {
  instanceId: string
  recordId: string
  action: 'APPROVE' | 'REJECT' | 'RETURN'
  comment?: string
  signerId: string // 實際簽核人（可能是代理人）
}

// 取得適用的流程定義
export async function getApplicableDefinition(
  employeeId: string,
  companyId: string,
  requestType: string
) {
  const now = new Date()

  // 優先權 1：員工特殊路徑
  const employeeWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      scopeType: 'EMPLOYEE',
      employeeId,
      isActive: true,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
    },
    include: { nodes: true, edges: true },
  })

  if (employeeWorkflow) return employeeWorkflow

  // 優先權 2：申請類型流程
  const typeWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      scopeType: 'REQUEST_TYPE',
      requestType,
      companyId,
      isActive: true,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
    },
    include: { nodes: true, edges: true },
  })

  if (typeWorkflow) return typeWorkflow

  // 優先權 3：預設流程
  const defaultWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      scopeType: 'DEFAULT',
      companyId,
      isActive: true,
    },
    include: { nodes: true, edges: true },
  })

  return defaultWorkflow
}

// 啟動流程實例
export async function startWorkflow(input: StartWorkflowInput) {
  const { definitionId, requestType, requestId, applicantId, companyId, requestData } = input

  // 取得流程定義
  const definition = await prisma.workflowDefinition.findUnique({
    where: { id: definitionId },
    include: { nodes: true, edges: true },
  })

  if (!definition) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '找不到流程定義' })
  }

  // 找到開始節點
  const startNode = definition.nodes.find(n => n.nodeType === 'START')
  if (!startNode) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '流程缺少開始節點' })
  }

  // 建立流程實例
  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId,
      requestType,
      requestId,
      applicantId,
      companyId,
      status: 'PENDING',
      currentNodeId: startNode.id,
      submittedAt: new Date(),
    },
  })

  // 推進到下一個節點
  await advanceWorkflow(instance.id, startNode.id, requestData)

  return instance
}

// 推進流程
export async function advanceWorkflow(
  instanceId: string,
  fromNodeId: string,
  requestData?: Record<string, unknown>
) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      definition: { include: { nodes: true, edges: true } },
      applicant: {
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              department: true,
              position: true,
              supervisor: true,
            },
          },
        },
      },
    },
  })

  if (!instance) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '找不到流程實例' })
  }

  const { nodes, edges } = instance.definition

  // 找到從當前節點出發的邊
  const outgoingEdges = edges
    .filter(e => e.fromNodeId === fromNodeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (outgoingEdges.length === 0) {
    return // 沒有後續節點
  }

  // 決定下一個節點
  let nextEdge = outgoingEdges.find(e => e.isDefault)

  // 如果有條件邊，評估條件
  for (const edge of outgoingEdges) {
    if (edge.conditionField && edge.conditionOperator && requestData) {
      const value = requestData[edge.conditionField]
      if (evaluateCondition(value, edge.conditionOperator, edge.conditionValue)) {
        nextEdge = edge
        break
      }
    }
  }

  if (!nextEdge) {
    nextEdge = outgoingEdges[0]
  }

  const nextNode = nodes.find(n => n.id === nextEdge!.toNodeId)
  if (!nextNode) return

  // 更新當前節點
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { currentNodeId: nextNode.id },
  })

  // 根據節點類型處理
  switch (nextNode.nodeType) {
    case 'APPROVAL':
      await createApprovalRecord(instance, nextNode)
      break
    case 'END':
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'APPROVED', completedAt: new Date() },
      })

      // 通知申請人流程已完成核准
      {
        const requestTypeMap: Record<string, { title: string; linkPrefix: string; refType: string }> = {
          leave: { title: '請假申請已核准', linkPrefix: '/dashboard/leave/', refType: 'LeaveRequest' },
          expense: { title: '費用報銷已核准', linkPrefix: '/dashboard/expense/', refType: 'ExpenseRequest' },
          seal: { title: '用印申請已核准', linkPrefix: '/dashboard/admin/seal/', refType: 'SealRequest' },
        }

        const typeConfig = requestTypeMap[instance.requestType] || {
          title: '申請已核准',
          linkPrefix: '/dashboard/',
          refType: instance.requestType,
        }

        try {
          await createNotification({
            userId: instance.applicantId,
            type: 'REQUEST_APPROVED',
            title: typeConfig.title,
            message: `您的申請已核准`,
            link: `${typeConfig.linkPrefix}${instance.requestId}`,
            refType: typeConfig.refType,
            refId: instance.requestId,
          })
        } catch (error) {
          console.error('Failed to create notification for workflow completion:', error)
        }
      }
      break
    case 'CONDITION':
      // 條件節點直接推進
      await advanceWorkflow(instanceId, nextNode.id, requestData)
      break
    case 'PARALLEL_START':
      await handleParallelStart(instance, nextNode)
      break
    default:
      break
  }
}

// 建立簽核紀錄
async function createApprovalRecord(
  instance: NonNullable<Awaited<ReturnType<typeof prisma.workflowInstance.findUnique>>> & {
    applicant: {
      assignments: Array<{
        supervisor?: { id: string } | null
        department?: { id: string } | null
      }>
    }
  },
  node: {
    id: string
    approverType: string | null
    approverId: string | null
    orgRelation: string | null
    orgLevelUp: number | null
    customFieldName: string | null
  }
) {
  if (!instance) return

  let approverId: string | null = null

  switch (node.approverType) {
    case 'SPECIFIC_EMPLOYEE':
      approverId = node.approverId
      break
    case 'ORG_RELATION':
      // 從組織關係找簽核人
      const primaryAssignment = instance.applicant.assignments.find(a => a.supervisor)
      if (node.orgRelation === 'DIRECT_SUPERVISOR' && primaryAssignment?.supervisor) {
        approverId = primaryAssignment.supervisor.id
      }
      // TODO: 處理其他組織關係
      break
    case 'DEPARTMENT_HEAD':
      // TODO: 找部門主管
      break
    default:
      break
  }

  if (approverId) {
    await prisma.workflowApprovalRecord.create({
      data: {
        instanceId: instance.id,
        nodeId: node.id,
        approverId,
        status: 'PENDING',
      },
    })

    // 更新實例狀態
    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { status: 'IN_PROGRESS' },
    })

    // 通知審核者有新的申請待審核
    const applicantName = instance.applicant?.assignments?.[0]
      ? (await prisma.employee.findUnique({
          where: { id: instance.applicantId },
          select: { name: true },
        }))?.name
      : '員工'

    // 根據申請類型決定通知內容和連結
    const requestTypeMap: Record<string, { title: string; linkPrefix: string; refType: string }> = {
      leave: { title: '有新的請假申請待審核', linkPrefix: '/dashboard/leave/', refType: 'LeaveRequest' },
      expense: { title: '有新的費用報銷待審核', linkPrefix: '/dashboard/expense/', refType: 'ExpenseRequest' },
      seal: { title: '有新的用印申請待審核', linkPrefix: '/dashboard/admin/seal/', refType: 'SealRequest' },
    }

    const typeConfig = requestTypeMap[instance.requestType] || {
      title: '有新的申請待審核',
      linkPrefix: '/dashboard/',
      refType: instance.requestType,
    }

    try {
      await createNotification({
        userId: approverId,
        type: 'APPROVAL_NEEDED',
        title: typeConfig.title,
        message: `${applicantName || '員工'} 提出了申請`,
        link: `${typeConfig.linkPrefix}${instance.requestId}`,
        refType: typeConfig.refType,
        refId: instance.requestId,
      })
    } catch (error) {
      console.error('Failed to create notification for workflow approver:', error)
    }
  }
}

// 處理並行開始
async function handleParallelStart(
  instance: NonNullable<Awaited<ReturnType<typeof prisma.workflowInstance.findUnique>>>,
  node: { id: string }
) {
  // TODO: 實作並行分支
  console.log('Parallel start:', instance.id, node.id)
}

// 評估條件
function evaluateCondition(
  value: unknown,
  operator: string,
  conditionValue: string | null
): boolean {
  if (conditionValue === null) return false

  switch (operator) {
    case 'EQUALS':
      return String(value) === conditionValue
    case 'NOT_EQUALS':
      return String(value) !== conditionValue
    case 'GREATER_THAN':
      return Number(value) > Number(conditionValue)
    case 'LESS_THAN':
      return Number(value) < Number(conditionValue)
    case 'GREATER_OR_EQUAL':
      return Number(value) >= Number(conditionValue)
    case 'LESS_OR_EQUAL':
      return Number(value) <= Number(conditionValue)
    case 'CONTAINS':
      return String(value).includes(conditionValue)
    case 'IN':
      return conditionValue.split(',').map(s => s.trim()).includes(String(value))
    case 'NOT_IN':
      return !conditionValue.split(',').map(s => s.trim()).includes(String(value))
    default:
      return false
  }
}

// 檢查是否為有效的代理人
async function isValidDelegate(
  principalId: string,
  delegateId: string,
  requestType?: string,
  companyId?: string
): Promise<boolean> {
  const now = new Date()

  const delegate = await prisma.workflowApprovalDelegate.findFirst({
    where: {
      principalId,
      delegateId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  })

  if (!delegate) return false

  // 檢查代理範圍
  if (requestType && delegate.requestTypes.length > 0) {
    if (!delegate.requestTypes.includes(requestType)) {
      return false
    }
  }

  if (companyId && delegate.companyIds.length > 0) {
    if (!delegate.companyIds.includes(companyId)) {
      return false
    }
  }

  return true
}

// 處理簽核
export async function processApproval(input: ProcessApprovalInput) {
  const { instanceId, recordId, action, comment, signerId } = input

  const record = await prisma.workflowApprovalRecord.findUnique({
    where: { id: recordId },
    include: {
      instance: {
        include: {
          definition: { include: { nodes: true, edges: true } },
        },
      },
    },
  })

  if (!record) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '找不到簽核紀錄' })
  }

  if (record.status !== 'PENDING') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '此簽核紀錄已處理' })
  }

  // 驗證簽核權限：原審批人或有效代理人
  const isOriginalApprover = record.approverId === signerId
  const isDelegate = await isValidDelegate(
    record.approverId,
    signerId,
    record.instance.requestType,
    record.instance.companyId
  )

  if (!isOriginalApprover && !isDelegate) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '您沒有權限簽核此項目' })
  }

  // 更新簽核紀錄
  await prisma.workflowApprovalRecord.update({
    where: { id: recordId },
    data: {
      status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'PENDING',
      action: action as 'APPROVE' | 'REJECT' | 'RETURN',
      actualSignerId: signerId,
      comment,
      actionAt: new Date(),
    },
  })

  if (action === 'APPROVE') {
    // 推進到下一個節點
    await advanceWorkflow(instanceId, record.nodeId)
  } else if (action === 'REJECT') {
    // 拒絕流程
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'REJECTED', completedAt: new Date() },
    })

    // 通知申請人申請已駁回
    const requestTypeMap: Record<string, { title: string; linkPrefix: string; refType: string }> = {
      leave: { title: '請假申請已駁回', linkPrefix: '/dashboard/leave/', refType: 'LeaveRequest' },
      expense: { title: '費用報銷已駁回', linkPrefix: '/dashboard/expense/', refType: 'ExpenseRequest' },
      seal: { title: '用印申請已駁回', linkPrefix: '/dashboard/admin/seal/', refType: 'SealRequest' },
    }

    const typeConfig = requestTypeMap[record.instance.requestType] || {
      title: '申請已駁回',
      linkPrefix: '/dashboard/',
      refType: record.instance.requestType,
    }

    try {
      await createNotification({
        userId: record.instance.applicantId,
        type: 'REQUEST_REJECTED',
        title: typeConfig.title,
        message: `您的申請已被駁回`,
        link: `${typeConfig.linkPrefix}${record.instance.requestId}`,
        refType: typeConfig.refType,
        refId: record.instance.requestId,
      })
    } catch (error) {
      console.error('Failed to create notification for workflow rejection:', error)
    }
  }

  return { success: true }
}

// 取得待簽核項目（包含代理）
export async function getPendingApprovals(approverId: string) {
  const now = new Date()

  // 找出我正在代理的人
  const activeDelegates = await prisma.workflowApprovalDelegate.findMany({
    where: {
      delegateId: approverId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  })

  // 建立代理人 ID 列表
  const principalIds = activeDelegates.map(d => d.principalId)

  // 查詢待簽核項目：我的 + 我代理的
  const records = await prisma.workflowApprovalRecord.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { approverId },
        { approverId: { in: principalIds } },
      ],
    },
    include: {
      instance: {
        include: {
          applicant: { select: { id: true, name: true, employeeNo: true } },
          company: { select: { id: true, name: true } },
          definition: { select: { id: true, name: true, requestType: true } },
        },
      },
      node: { select: { id: true, name: true, nodeType: true } },
      approver: { select: { id: true, name: true, employeeNo: true } },
    },
    orderBy: { assignedAt: 'asc' },
  })

  // 過濾代理項目：確認代理範圍
  const filteredRecords = records.filter(record => {
    // 如果是我自己的，直接保留
    if (record.approverId === approverId) {
      return true
    }

    // 找到對應的代理設定
    const delegate = activeDelegates.find(d => d.principalId === record.approverId)
    if (!delegate) return false

    // 檢查申請類型是否在代理範圍內
    if (delegate.requestTypes.length > 0) {
      if (!delegate.requestTypes.includes(record.instance.requestType)) {
        return false
      }
    }

    // 檢查公司是否在代理範圍內
    if (delegate.companyIds.length > 0) {
      if (!delegate.companyIds.includes(record.instance.companyId)) {
        return false
      }
    }

    return true
  })

  // 標記是否為代理項目
  return filteredRecords.map(record => ({
    ...record,
    isDelegated: record.approverId !== approverId,
    originalApprover: record.approverId !== approverId ? record.approver : null,
  }))
}
