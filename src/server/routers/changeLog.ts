import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// 異動類型對照
const changeTypeLabels: Record<string, string> = {
  ONBOARD: '入職',
  OFFBOARD: '離職',
  REINSTATE: '復職',
  TRANSFER: '調動',
  ON_LEAVE: '留停',
  RETURN_FROM_LEAVE: '留停復職',
}

export const changeLogRouter = router({
  // 取得異動紀錄列表
  list: publicProcedure
    .input(z.object({
      // 篩選條件
      changeTypes: z.array(z.enum(['ONBOARD', 'OFFBOARD', 'REINSTATE', 'TRANSFER', 'ON_LEAVE', 'RETURN_FROM_LEAVE'])).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      employeeSearch: z.string().optional(),
      // 排序
      sortBy: z.enum(['changeDate', 'createdAt', 'employeeNo', 'employeeName', 'changeType']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      // 分頁
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { changeTypes, startDate, endDate, employeeSearch, sortBy, sortOrder, page, pageSize } = input

      // 建立 where 條件
      const where: Record<string, unknown> = {}

      if (changeTypes && changeTypes.length > 0) {
        where.changeType = { in: changeTypes }
      }

      if (startDate || endDate) {
        where.changeDate = {}
        if (startDate) (where.changeDate as Record<string, unknown>).gte = startDate
        if (endDate) (where.changeDate as Record<string, unknown>).lte = endDate
      }

      if (employeeSearch) {
        where.employee = {
          OR: [
            { name: { contains: employeeSearch, mode: 'insensitive' } },
            { employeeNo: { contains: employeeSearch, mode: 'insensitive' } },
          ],
        }
      }

      // 建立 orderBy
      let orderBy: Record<string, unknown>
      switch (sortBy) {
        case 'employeeNo':
          orderBy = { employee: { employeeNo: sortOrder } }
          break
        case 'employeeName':
          orderBy = { employee: { name: sortOrder } }
          break
        default:
          orderBy = { [sortBy]: sortOrder }
      }

      const [logs, total] = await Promise.all([
        ctx.prisma.employeeChangeLog.findMany({
          where,
          include: {
            employee: {
              select: { id: true, name: true, employeeNo: true },
            },
            createdBy: {
              select: { id: true, name: true },
            },
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.employeeChangeLog.count({ where }),
      ])

      // 取得部門、職位名稱
      const departmentIds = new Set<string>()
      const positionIds = new Set<string>()
      const companyIds = new Set<string>()

      logs.forEach((log) => {
        if (log.fromDepartmentId) departmentIds.add(log.fromDepartmentId)
        if (log.toDepartmentId) departmentIds.add(log.toDepartmentId)
        if (log.fromPositionId) positionIds.add(log.fromPositionId)
        if (log.toPositionId) positionIds.add(log.toPositionId)
        if (log.fromCompanyId) companyIds.add(log.fromCompanyId)
        if (log.toCompanyId) companyIds.add(log.toCompanyId)
      })

      const [departments, positions, companies] = await Promise.all([
        ctx.prisma.department.findMany({
          where: { id: { in: Array.from(departmentIds) } },
          select: { id: true, name: true },
        }),
        ctx.prisma.position.findMany({
          where: { id: { in: Array.from(positionIds) } },
          select: { id: true, name: true },
        }),
        ctx.prisma.company.findMany({
          where: { id: { in: Array.from(companyIds) } },
          select: { id: true, name: true },
        }),
      ])

      const departmentMap = new Map(departments.map((d) => [d.id, d.name]))
      const positionMap = new Map(positions.map((p) => [p.id, p.name]))
      const companyMap = new Map(companies.map((c) => [c.id, c.name]))

      // 格式化回傳資料
      const formattedLogs = logs.map((log) => ({
        id: log.id,
        employee: log.employee,
        changeType: log.changeType,
        changeTypeLabel: changeTypeLabels[log.changeType] || log.changeType,
        changeDate: log.changeDate,
        fromCompany: log.fromCompanyId ? companyMap.get(log.fromCompanyId) : null,
        toCompany: log.toCompanyId ? companyMap.get(log.toCompanyId) : null,
        fromDepartment: log.fromDepartmentId ? departmentMap.get(log.fromDepartmentId) : null,
        toDepartment: log.toDepartmentId ? departmentMap.get(log.toDepartmentId) : null,
        fromPosition: log.fromPositionId ? positionMap.get(log.fromPositionId) : null,
        toPosition: log.toPositionId ? positionMap.get(log.toPositionId) : null,
        reason: log.reason,
        note: log.note,
        createdBy: log.createdBy,
        createdAt: log.createdAt,
      }))

      return {
        logs: formattedLogs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    }),

  // 刪除異動紀錄（需要 SUPER_ADMIN 角色/權限 或 DELETE_CHANGE_LOG 權限）
  delete: publicProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string(), // 操作者 ID
    }))
    .mutation(async ({ ctx, input }) => {
      // 檢查權限（同時檢查 GroupPermission 和 Role）
      const [superAdminPermission, superAdminRole, deletePermission] = await Promise.all([
        ctx.prisma.groupPermission.findFirst({
          where: {
            employeeId: input.userId,
            permission: 'SUPER_ADMIN',
          },
        }),
        ctx.prisma.employeeAssignment.findFirst({
          where: {
            employeeId: input.userId,
            status: 'ACTIVE',
            role: { name: 'SUPER_ADMIN' },
          },
        }),
        ctx.prisma.groupPermission.findFirst({
          where: {
            employeeId: input.userId,
            permission: 'DELETE_CHANGE_LOG',
          },
        }),
      ])

      if (!superAdminPermission && !superAdminRole && !deletePermission) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您沒有權限刪除異動紀錄',
        })
      }

      // 直接刪除，不記錄 audit
      await ctx.prisma.employeeChangeLog.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),

  // 取得員工的異動紀錄
  getByEmployee: publicProcedure
    .input(z.object({
      employeeId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.prisma.employeeChangeLog.findMany({
        where: { employeeId: input.employeeId },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { changeDate: 'desc' },
      })

      // 取得相關的部門、職位、公司名稱
      const departmentIds = new Set<string>()
      const positionIds = new Set<string>()
      const companyIds = new Set<string>()

      logs.forEach((log) => {
        if (log.fromDepartmentId) departmentIds.add(log.fromDepartmentId)
        if (log.toDepartmentId) departmentIds.add(log.toDepartmentId)
        if (log.fromPositionId) positionIds.add(log.fromPositionId)
        if (log.toPositionId) positionIds.add(log.toPositionId)
        if (log.fromCompanyId) companyIds.add(log.fromCompanyId)
        if (log.toCompanyId) companyIds.add(log.toCompanyId)
      })

      const [departments, positions, companies] = await Promise.all([
        ctx.prisma.department.findMany({
          where: { id: { in: Array.from(departmentIds) } },
          select: { id: true, name: true },
        }),
        ctx.prisma.position.findMany({
          where: { id: { in: Array.from(positionIds) } },
          select: { id: true, name: true },
        }),
        ctx.prisma.company.findMany({
          where: { id: { in: Array.from(companyIds) } },
          select: { id: true, name: true },
        }),
      ])

      const departmentMap = new Map(departments.map((d) => [d.id, d.name]))
      const positionMap = new Map(positions.map((p) => [p.id, p.name]))
      const companyMap = new Map(companies.map((c) => [c.id, c.name]))

      return logs.map((log) => ({
        id: log.id,
        changeType: log.changeType,
        changeTypeLabel: changeTypeLabels[log.changeType] || log.changeType,
        changeDate: log.changeDate,
        fromCompany: log.fromCompanyId ? companyMap.get(log.fromCompanyId) : null,
        toCompany: log.toCompanyId ? companyMap.get(log.toCompanyId) : null,
        fromDepartment: log.fromDepartmentId ? departmentMap.get(log.fromDepartmentId) : null,
        toDepartment: log.toDepartmentId ? departmentMap.get(log.toDepartmentId) : null,
        fromPosition: log.fromPositionId ? positionMap.get(log.fromPositionId) : null,
        toPosition: log.toPositionId ? positionMap.get(log.toPositionId) : null,
        reason: log.reason,
        note: log.note,
        createdBy: log.createdBy,
        createdAt: log.createdAt,
      }))
    }),
})
