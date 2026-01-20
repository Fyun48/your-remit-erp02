/**
 * 刪除吳奉運的測試資料
 * 執行方式: npx tsx scripts/delete-test-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteTestData() {
  console.log('開始刪除吳奉運的測試資料...')

  // 查找員工
  const employee = await prisma.employee.findFirst({
    where: { name: '吳奉運' },
  })

  if (!employee) {
    console.log('找不到員工「吳奉運」')
    return
  }

  console.log(`找到員工: ${employee.name} (ID: ${employee.id})`)

  // 開始刪除資料
  const results = {
    leaveRequests: 0,
    leaveBalances: 0,
    flowExecutions: 0,
  }

  // 刪除請假申請
  const leaveRequestsDeleted = await prisma.leaveRequest.deleteMany({
    where: { employeeId: employee.id },
  })
  results.leaveRequests = leaveRequestsDeleted.count
  console.log(`已刪除 ${leaveRequestsDeleted.count} 筆請假申請`)

  // 刪除假別餘額
  const leaveBalancesDeleted = await prisma.leaveBalance.deleteMany({
    where: { employeeId: employee.id },
  })
  results.leaveBalances = leaveBalancesDeleted.count
  console.log(`已刪除 ${leaveBalancesDeleted.count} 筆假別餘額`)

  // 刪除審核流程執行紀錄
  const flowExecutionsDeleted = await prisma.flowExecution.deleteMany({
    where: { applicantId: employee.id },
  })
  results.flowExecutions = flowExecutionsDeleted.count
  console.log(`已刪除 ${flowExecutionsDeleted.count} 筆審核流程紀錄`)

  console.log('\n刪除完成!')
  console.log('總計刪除:')
  console.log(`- 請假申請: ${results.leaveRequests} 筆`)
  console.log(`- 假別餘額: ${results.leaveBalances} 筆`)
  console.log(`- 審核流程: ${results.flowExecutions} 筆`)
}

deleteTestData()
  .catch((e) => {
    console.error('刪除失敗:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
