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
import { dashboardRouter } from './dashboard'
import { reportRouter } from './report'
import { accountChartRouter } from './accountChart'
import { voucherRouter } from './voucher'
import { accountingPeriodRouter } from './accountingPeriod'
import { customerRouter } from './customer'
import { vendorRouter } from './vendor'
import { financialReportRouter } from './financialReport'
import { departmentRouter } from './department'
import { positionRouter } from './position'
import { hrRouter } from './hr'
import { companyRouter } from './company'
import { groupPermissionRouter } from './groupPermission'
import { auditLogRouter } from './auditLog'
import { sealRequestRouter } from './sealRequest'
import { businessCardRouter } from './businessCard'
import { stationeryRouter } from './stationery'
import { groupRouter } from './group'
import { permissionRouter } from './permission'
import { orgChartRouter } from './orgChart'
import { workflowRouter } from './workflow'
import { delegateRouter } from './delegate'

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
  dashboard: dashboardRouter,
  report: reportRouter,
  accountChart: accountChartRouter,
  voucher: voucherRouter,
  accountingPeriod: accountingPeriodRouter,
  customer: customerRouter,
  vendor: vendorRouter,
  financialReport: financialReportRouter,
  department: departmentRouter,
  position: positionRouter,
  hr: hrRouter,
  company: companyRouter,
  groupPermission: groupPermissionRouter,
  auditLog: auditLogRouter,
  sealRequest: sealRequestRouter,
  businessCard: businessCardRouter,
  stationery: stationeryRouter,
  group: groupRouter,
  permission: permissionRouter,
  orgChart: orgChartRouter,
  workflow: workflowRouter,
  delegate: delegateRouter,
})

export type AppRouter = typeof appRouter
