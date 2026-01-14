import { router } from '../trpc'
import { healthRouter } from './health'
import { workShiftRouter } from './workShift'
import { attendanceRouter } from './attendance'
import { leaveTypeRouter } from './leaveType'
import { leaveRequestRouter } from './leaveRequest'
import { leaveBalanceRouter } from './leaveBalance'
import { approvalFlowRouter } from './approvalFlow'
import { approvalInstanceRouter } from './approvalInstance'
import { expenseCategoryRouter } from './expenseCategory'
import { expenseRequestRouter } from './expenseRequest'

export const appRouter = router({
  health: healthRouter,
  workShift: workShiftRouter,
  attendance: attendanceRouter,
  leaveType: leaveTypeRouter,
  leaveRequest: leaveRequestRouter,
  leaveBalance: leaveBalanceRouter,
  approvalFlow: approvalFlowRouter,
  approvalInstance: approvalInstanceRouter,
  expenseCategory: expenseCategoryRouter,
  expenseRequest: expenseRequestRouter,
})

export type AppRouter = typeof appRouter
