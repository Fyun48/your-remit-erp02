import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 開始建立種子資料...')

  // 1. 建立集團
  const group = await prisma.group.upsert({
    where: { code: 'YOUR_REMIT' },
    update: {},
    create: {
      name: '金優匯集團',
      code: 'YOUR_REMIT',
    },
  })
  console.log('✅ 集團已建立:', group.name)

  // 2. 建立公司
  const company1 = await prisma.company.upsert({
    where: { code: 'YR001' },
    update: {},
    create: {
      groupId: group.id,
      name: '金優匯股份有限公司',
      code: 'YR001',
      taxId: '12345678',
    },
  })

  const company2 = await prisma.company.upsert({
    where: { code: 'YR002' },
    update: {},
    create: {
      groupId: group.id,
      name: '金優科技股份有限公司',
      code: 'YR002',
      taxId: '87654321',
    },
  })
  console.log('✅ 公司已建立:', company1.name, company2.name)

  // 3. 建立部門
  const adminDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'ADMIN' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '管理部',
      code: 'ADMIN',
    },
  })

  const financeDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'FINANCE' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '財務部',
      code: 'FINANCE',
    },
  })

  const itDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'IT' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '資訊部',
      code: 'IT',
    },
  })
  console.log('✅ 部門已建立')

  // 4. 建立職位
  const gmPosition = await prisma.position.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'GM' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '總經理',
      code: 'GM',
      level: 10,
    },
  })

  const managerPosition = await prisma.position.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'MGR' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '經理',
      code: 'MGR',
      level: 5,
    },
  })

  const staffPosition = await prisma.position.upsert({
    where: { companyId_code: { companyId: company1.id, code: 'STAFF' } },
    update: {},
    create: {
      companyId: company1.id,
      name: '專員',
      code: 'STAFF',
      level: 1,
    },
  })
  console.log('✅ 職位已建立')

  // 5. 建立角色
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: '集團最高管理員',
      isSystem: true,
    },
  })

  const companyAdminRole = await prisma.role.upsert({
    where: { name: 'COMPANY_ADMIN' },
    update: {},
    create: {
      name: 'COMPANY_ADMIN',
      description: '公司管理員',
      isSystem: true,
    },
  })

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: '主管',
      isSystem: true,
    },
  })

  const employeeRole = await prisma.role.upsert({
    where: { name: 'EMPLOYEE' },
    update: {},
    create: {
      name: 'EMPLOYEE',
      description: '一般員工',
      isSystem: true,
    },
  })
  console.log('✅ 角色已建立')

  // 6. 建立權限
  const permissions = [
    { code: 'attendance.clock', name: '打卡', module: 'attendance' },
    { code: 'attendance.view_self', name: '查看自己出勤', module: 'attendance' },
    { code: 'attendance.view_department', name: '查看部門出勤', module: 'attendance' },
    { code: 'attendance.exempt', name: '免打卡', module: 'attendance' },
    { code: 'leave.apply', name: '申請請假', module: 'leave' },
    { code: 'leave.approve', name: '審核請假', module: 'leave' },
    { code: 'expense.submit', name: '提交支出申請', module: 'expense' },
    { code: 'expense.approve', name: '審核支出申請', module: 'expense' },
    { code: 'expense.finance_review', name: '財務審核', module: 'expense' },
    { code: 'seal.apply', name: '申請用印', module: 'seal' },
    { code: 'seal.approve', name: '審核用印', module: 'seal' },
    { code: 'seal.admin_review', name: '管理部審核用印', module: 'seal' },
    { code: 'can_consult', name: '照會權限', module: 'approval' },
    { code: 'hr.view', name: '查看人事資料', module: 'hr' },
    { code: 'hr.manage', name: '管理人事資料', module: 'hr' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    })
  }
  console.log('✅ 權限已建立')

  // 7. 建立測試員工
  const passwordHash = await bcrypt.hash('admin123', 10)

  const adminEmployee = await prisma.employee.upsert({
    where: { email: 'admin@yourremit.com' },
    update: {},
    create: {
      employeeNo: 'EMP001',
      email: 'admin@yourremit.com',
      passwordHash,
      name: '系統管理員',
      hireDate: new Date('2020-01-01'),
    },
  })

  const managerEmployee = await prisma.employee.upsert({
    where: { email: 'manager@yourremit.com' },
    update: {},
    create: {
      employeeNo: 'EMP002',
      email: 'manager@yourremit.com',
      passwordHash,
      name: '王經理',
      gender: 'MALE',
      hireDate: new Date('2021-03-15'),
    },
  })

  const staffEmployee = await prisma.employee.upsert({
    where: { email: 'staff@yourremit.com' },
    update: {},
    create: {
      employeeNo: 'EMP003',
      email: 'staff@yourremit.com',
      passwordHash,
      name: '李小明',
      gender: 'MALE',
      hireDate: new Date('2023-06-01'),
    },
  })
  console.log('✅ 員工已建立')

  // 8. 建立任職關係
  await prisma.employeeAssignment.upsert({
    where: { employeeId_companyId: { employeeId: adminEmployee.id, companyId: company1.id } },
    update: {},
    create: {
      employeeId: adminEmployee.id,
      companyId: company1.id,
      departmentId: adminDept.id,
      positionId: gmPosition.id,
      roleId: superAdminRole.id,
      isPrimary: true,
      startDate: new Date('2020-01-01'),
    },
  })

  await prisma.employeeAssignment.upsert({
    where: { employeeId_companyId: { employeeId: managerEmployee.id, companyId: company1.id } },
    update: {},
    create: {
      employeeId: managerEmployee.id,
      companyId: company1.id,
      departmentId: financeDept.id,
      positionId: managerPosition.id,
      roleId: managerRole.id,
      isPrimary: true,
      startDate: new Date('2021-03-15'),
    },
  })

  const managerAssignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: managerEmployee.id, companyId: company1.id },
  })

  await prisma.employeeAssignment.upsert({
    where: { employeeId_companyId: { employeeId: staffEmployee.id, companyId: company1.id } },
    update: {},
    create: {
      employeeId: staffEmployee.id,
      companyId: company1.id,
      departmentId: financeDept.id,
      positionId: staffPosition.id,
      roleId: employeeRole.id,
      supervisorId: managerAssignment?.id,
      isPrimary: true,
      startDate: new Date('2023-06-01'),
    },
  })
  console.log('✅ 任職關係已建立')

  console.log('')
  console.log('🎉 種子資料建立完成！')
  console.log('')
  console.log('測試帳號：')
  console.log('  管理員: admin@yourremit.com / admin123')
  console.log('  經理: manager@yourremit.com / admin123')
  console.log('  員工: staff@yourremit.com / admin123')
}

main()
  .catch((e) => {
    console.error('❌ Seed 錯誤:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
