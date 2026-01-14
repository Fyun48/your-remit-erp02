import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import type { AttendanceStatus } from '@prisma/client'

// 出勤狀態計算邏輯
function calculateAttendanceStatus(
  clockInTime: Date | null,
  clockOutTime: Date | null,
  workStartTime: string,  // "HH:mm"
  workEndTime: string,    // "HH:mm"
  lateGraceMinutes: number,
  earlyLeaveGraceMinutes: number
): { status: AttendanceStatus; lateMinutes: number; earlyLeaveMinutes: number } {
  if (!clockInTime) {
    return { status: 'ABSENT', lateMinutes: 0, earlyLeaveMinutes: 0 }
  }

  // 解析班別時間
  const [startHour, startMin] = workStartTime.split(':').map(Number)
  const [endHour, endMin] = workEndTime.split(':').map(Number)

  // 建立預定上下班時間
  const scheduledStart = new Date(clockInTime)
  scheduledStart.setHours(startHour, startMin, 0, 0)

  const scheduledEnd = new Date(clockInTime)
  scheduledEnd.setHours(endHour, endMin, 0, 0)

  // 計算遲到
  let lateMinutes = 0
  if (clockInTime > scheduledStart) {
    lateMinutes = Math.floor((clockInTime.getTime() - scheduledStart.getTime()) / 60000)
    lateMinutes = Math.max(0, lateMinutes - lateGraceMinutes)
  }

  // 計算早退
  let earlyLeaveMinutes = 0
  if (clockOutTime && clockOutTime < scheduledEnd) {
    earlyLeaveMinutes = Math.floor((scheduledEnd.getTime() - clockOutTime.getTime()) / 60000)
    earlyLeaveMinutes = Math.max(0, earlyLeaveMinutes - earlyLeaveGraceMinutes)
  }

  // 決定狀態
  let status: AttendanceStatus = 'NORMAL'
  if (lateMinutes > 0) status = 'LATE'
  else if (earlyLeaveMinutes > 0) status = 'EARLY_LEAVE'

  return { status, lateMinutes, earlyLeaveMinutes }
}

// 取得今日日期（僅日期部分，不含時間）
function getTodayDate(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// 打卡方式 enum
const clockMethodSchema = z.enum(['WEB', 'APP', 'GPS', 'IP', 'FACE', 'MANUAL'])

export const attendanceRouter = router({
  // 上班打卡
  clockIn: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      method: clockMethodSchema,
      location: z.string().optional(),
      ip: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = getTodayDate()
      const now = new Date()

      // 檢查是否已有今日紀錄
      const existingRecord = await ctx.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_companyId_date: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
          },
        },
      })

      // 如已打過上班卡，拋出錯誤
      if (existingRecord && existingRecord.clockInTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '今日已打過上班卡',
        })
      }

      // 建立或更新 AttendanceRecord
      if (existingRecord) {
        // 更新現有紀錄
        return ctx.prisma.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: {
            clockInTime: now,
            clockInMethod: input.method,
            clockInLocation: input.location,
            clockInIp: input.ip,
            status: 'PENDING',
          },
        })
      } else {
        // 建立新紀錄
        return ctx.prisma.attendanceRecord.create({
          data: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
            clockInTime: now,
            clockInMethod: input.method,
            clockInLocation: input.location,
            clockInIp: input.ip,
            status: 'PENDING',
          },
        })
      }
    }),

  // 下班打卡
  clockOut: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
      method: clockMethodSchema,
      location: z.string().optional(),
      ip: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = getTodayDate()
      const now = new Date()

      // 檢查是否有今日紀錄
      const existingRecord = await ctx.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_companyId_date: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
          },
        },
      })

      // 如尚未打上班卡，拋出錯誤
      if (!existingRecord || !existingRecord.clockInTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '尚未打上班卡，請先完成上班打卡',
        })
      }

      // 如已打過下班卡，拋出錯誤
      if (existingRecord.clockOutTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '今日已打過下班卡',
        })
      }

      // 取得員工班別設定
      const shiftAssignment = await ctx.prisma.shiftAssignment.findFirst({
        where: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          effectiveDate: { lte: today },
          OR: [
            { endDate: null },
            { endDate: { gte: today } },
          ],
        },
        include: { shift: true },
        orderBy: { effectiveDate: 'desc' },
      })

      let status: AttendanceStatus = 'NORMAL'
      let lateMinutes = 0
      let earlyLeaveMinutes = 0
      let workHours: number | null = null

      // 計算工作時數
      if (existingRecord.clockInTime) {
        workHours = (now.getTime() - existingRecord.clockInTime.getTime()) / (1000 * 60 * 60)
        workHours = Math.round(workHours * 100) / 100 // 四捨五入到小數點後兩位
      }

      // 如有班別設定，計算遲到/早退狀態
      if (shiftAssignment && shiftAssignment.shift.workStartTime && shiftAssignment.shift.workEndTime) {
        const calculatedStatus = calculateAttendanceStatus(
          existingRecord.clockInTime,
          now,
          shiftAssignment.shift.workStartTime,
          shiftAssignment.shift.workEndTime,
          shiftAssignment.shift.lateGraceMinutes,
          shiftAssignment.shift.earlyLeaveGraceMinutes
        )
        status = calculatedStatus.status
        lateMinutes = calculatedStatus.lateMinutes
        earlyLeaveMinutes = calculatedStatus.earlyLeaveMinutes
      }

      // 更新 AttendanceRecord
      return ctx.prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          clockOutTime: now,
          clockOutMethod: input.method,
          clockOutLocation: input.location,
          clockOutIp: input.ip,
          status,
          lateMinutes,
          earlyLeaveMinutes,
          workHours,
        },
      })
    }),

  // 取得今日打卡狀態
  getTodayStatus: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const today = getTodayDate()

      return ctx.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_companyId_date: {
            employeeId: input.employeeId,
            companyId: input.companyId,
            date: today,
          },
        },
      })
    }),

  // 取得出勤紀錄列表
  list: publicProcedure
    .input(z.object({
      employeeId: z.string().optional(),
      companyId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.attendanceRecord.findMany({
        where: {
          companyId: input.companyId,
          ...(input.employeeId && { employeeId: input.employeeId }),
          date: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        orderBy: [
          { date: 'desc' },
          { clockInTime: 'desc' },
        ],
      })
    }),

  // 取得部門出勤紀錄（主管用）
  listByDepartment: publicProcedure
    .input(z.object({
      companyId: z.string(),
      departmentId: z.string(),
      date: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // 取得部門所有員工
      const employeeAssignments = await ctx.prisma.employeeAssignment.findMany({
        where: {
          companyId: input.companyId,
          departmentId: input.departmentId,
          status: 'ACTIVE',
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // 取得所有員工的當日出勤紀錄
      const employeeIds = employeeAssignments.map(a => a.employeeId)

      const attendanceRecords = await ctx.prisma.attendanceRecord.findMany({
        where: {
          companyId: input.companyId,
          employeeId: { in: employeeIds },
          date: input.date,
        },
      })

      // 將出勤紀錄對應到員工
      const attendanceMap = new Map(
        attendanceRecords.map(record => [record.employeeId, record])
      )

      return employeeAssignments.map(assignment => ({
        employee: assignment.employee,
        attendance: attendanceMap.get(assignment.employeeId) || null,
      }))
    }),
})
