/**
 * 薪資計算引擎
 * 依據台灣勞動基準法與相關法規計算薪資
 */

export interface PayrollSetting {
  laborInsuranceRate: number // 勞保費率
  laborInsuranceEmpShare: number // 勞保員工自付比例
  healthInsuranceRate: number // 健保費率
  healthInsuranceEmpShare: number // 健保員工自付比例
  laborPensionRate: number // 勞退提撥率
  overtimeRate1: number // 加班費倍率（前2小時）
  overtimeRate2: number // 加班費倍率（超過2小時）
  overtimeRateHoliday: number // 休息日/假日加班倍率
  minimumWage: number // 基本工資
  withholdingThreshold: number // 扣繳起扣點
}

export interface EmployeeSalaryData {
  baseSalary: number // 底薪
  allowances: { name: string; amount: number }[] // 津貼
  laborInsuranceGrade: number // 勞保投保級距
  healthInsuranceGrade: number // 健保投保級距
  laborPensionGrade: number // 勞退提繳級距
  employeePensionRate: number // 員工自提勞退率 (0-0.06)
  dependents: number // 扶養親屬數
}

export interface OvertimeData {
  regularHours1: number // 平日加班前2小時
  regularHours2: number // 平日加班超過2小時
  holidayHours: number // 休息日/假日加班時數
}

export interface PayrollCalculationInput {
  setting: PayrollSetting
  employee: EmployeeSalaryData
  overtime: OvertimeData
  bonus?: number // 獎金
  otherIncome?: number // 其他收入
  otherDeduction?: number // 其他扣除
}

export interface PayrollCalculationResult {
  // 應發項目
  baseSalary: number
  totalAllowances: number
  overtimePay: number
  bonus: number
  otherIncome: number
  grossPay: number

  // 扣除項目
  laborInsurance: number
  healthInsurance: number
  laborPension: number // 員工自提
  incomeTax: number
  otherDeduction: number
  totalDeduction: number

  // 實發
  netPay: number

  // 雇主負擔（不影響員工薪資，供報表用）
  employerLaborInsurance: number
  employerHealthInsurance: number
  employerPension: number

  // 明細
  overtimeDetails: {
    regularHours1: number
    regularHours2: number
    holidayHours: number
    regularPay1: number
    regularPay2: number
    holidayPay: number
  }
}

/**
 * 計算時薪
 */
export function calculateHourlyRate(baseSalary: number): number {
  // 依勞基法規定，月薪制員工以每月 30 天、每日 8 小時計算
  // 時薪 = 月薪 / 30 / 8 = 月薪 / 240
  return baseSalary / 240
}

/**
 * 計算加班費
 */
export function calculateOvertimePay(
  baseSalary: number,
  overtime: OvertimeData,
  setting: PayrollSetting
): { total: number; details: PayrollCalculationResult['overtimeDetails'] } {
  const hourlyRate = calculateHourlyRate(baseSalary)

  const regularPay1 = hourlyRate * overtime.regularHours1 * setting.overtimeRate1
  const regularPay2 = hourlyRate * overtime.regularHours2 * setting.overtimeRate2
  const holidayPay = hourlyRate * overtime.holidayHours * setting.overtimeRateHoliday

  return {
    total: Math.round(regularPay1 + regularPay2 + holidayPay),
    details: {
      regularHours1: overtime.regularHours1,
      regularHours2: overtime.regularHours2,
      holidayHours: overtime.holidayHours,
      regularPay1: Math.round(regularPay1),
      regularPay2: Math.round(regularPay2),
      holidayPay: Math.round(holidayPay),
    },
  }
}

/**
 * 計算勞保自付額
 * 公式：投保級距 × 勞保費率 × 員工自付比例
 */
export function calculateLaborInsurance(
  insuranceGrade: number,
  rate: number,
  empShare: number
): number {
  return Math.round(insuranceGrade * rate * empShare)
}

/**
 * 計算健保自付額
 * 公式：投保級距 × 健保費率 × 員工自付比例 × (1 + 眷屬人數)
 * 注：眷屬最多計 3 人
 */
export function calculateHealthInsurance(
  insuranceGrade: number,
  rate: number,
  empShare: number,
  dependents: number
): number {
  const adjustedDependents = Math.min(dependents, 3) // 眷屬最多計 3 人
  return Math.round(insuranceGrade * rate * empShare * (1 + adjustedDependents))
}

/**
 * 計算勞退自提
 * 公式：提繳工資 × 自提率
 */
export function calculateLaborPension(
  pensionGrade: number,
  employeePensionRate: number
): number {
  return Math.round(pensionGrade * employeePensionRate)
}

/**
 * 計算所得稅預扣
 * 依據薪資所得扣繳辦法
 */
export function calculateIncomeTax(
  taxableIncome: number,
  withholdingThreshold: number,
  dependents: number
): number {
  // 如果月薪未超過起扣點，不扣繳
  if (taxableIncome <= withholdingThreshold) {
    return 0
  }

  // 簡化計算：超過起扣點的部分按 5% 扣繳
  // 實際應依照扣繳稅額表或 5% 擇一
  // 這裡採用簡化版本
  const taxBase = taxableIncome - withholdingThreshold

  // 扶養親屬減免（每人每月約 8,000 元）
  const dependentDeduction = dependents * 8000
  const adjustedTaxBase = Math.max(0, taxBase - dependentDeduction)

  return Math.round(adjustedTaxBase * 0.05)
}

/**
 * 計算雇主勞保負擔
 * 公式：投保級距 × 勞保費率 × 70%
 */
export function calculateEmployerLaborInsurance(
  insuranceGrade: number,
  rate: number
): number {
  return Math.round(insuranceGrade * rate * 0.7)
}

/**
 * 計算雇主健保負擔
 * 公式：投保級距 × 健保費率 × 60% × (1 + 平均眷屬數)
 * 注：平均眷屬數依規定為 0.61
 */
export function calculateEmployerHealthInsurance(
  insuranceGrade: number,
  rate: number
): number {
  const avgDependents = 0.61 // 依法定平均眷屬數
  return Math.round(insuranceGrade * rate * 0.6 * (1 + avgDependents))
}

/**
 * 計算雇主勞退提撥
 * 公式：提繳工資 × 6%
 */
export function calculateEmployerPension(
  pensionGrade: number,
  rate: number
): number {
  return Math.round(pensionGrade * rate)
}

/**
 * 計算完整薪資
 */
export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const { setting, employee, overtime, bonus = 0, otherIncome = 0, otherDeduction = 0 } = input

  // 計算津貼總額
  const totalAllowances = employee.allowances.reduce((sum, a) => sum + a.amount, 0)

  // 計算加班費
  const overtimeResult = calculateOvertimePay(employee.baseSalary, overtime, setting)

  // 應發總額
  const grossPay = employee.baseSalary + totalAllowances + overtimeResult.total + bonus + otherIncome

  // 勞保自付
  const laborInsurance = calculateLaborInsurance(
    employee.laborInsuranceGrade,
    setting.laborInsuranceRate,
    setting.laborInsuranceEmpShare
  )

  // 健保自付
  const healthInsurance = calculateHealthInsurance(
    employee.healthInsuranceGrade,
    setting.healthInsuranceRate,
    setting.healthInsuranceEmpShare,
    employee.dependents
  )

  // 勞退自提
  const laborPension = calculateLaborPension(
    employee.laborPensionGrade,
    employee.employeePensionRate
  )

  // 所得稅（應稅所得 = 應發總額 - 勞保 - 健保 - 勞退自提）
  const taxableIncome = grossPay - laborInsurance - healthInsurance - laborPension
  const incomeTax = calculateIncomeTax(taxableIncome, setting.withholdingThreshold, employee.dependents)

  // 扣除總額
  const totalDeduction = laborInsurance + healthInsurance + laborPension + incomeTax + otherDeduction

  // 實發金額
  const netPay = grossPay - totalDeduction

  // 雇主負擔
  const employerLaborInsurance = calculateEmployerLaborInsurance(
    employee.laborInsuranceGrade,
    setting.laborInsuranceRate
  )
  const employerHealthInsurance = calculateEmployerHealthInsurance(
    employee.healthInsuranceGrade,
    setting.healthInsuranceRate
  )
  const employerPension = calculateEmployerPension(
    employee.laborPensionGrade,
    setting.laborPensionRate
  )

  return {
    // 應發
    baseSalary: employee.baseSalary,
    totalAllowances,
    overtimePay: overtimeResult.total,
    bonus,
    otherIncome,
    grossPay,

    // 扣除
    laborInsurance,
    healthInsurance,
    laborPension,
    incomeTax,
    otherDeduction,
    totalDeduction,

    // 實發
    netPay,

    // 雇主負擔
    employerLaborInsurance,
    employerHealthInsurance,
    employerPension,

    // 加班明細
    overtimeDetails: overtimeResult.details,
  }
}

/**
 * 批次計算多位員工薪資
 */
export function calculateBatchPayroll(
  setting: PayrollSetting,
  employees: Array<{
    employeeId: string
    salaryData: EmployeeSalaryData
    overtime: OvertimeData
    bonus?: number
    otherIncome?: number
    otherDeduction?: number
  }>
): Array<{ employeeId: string; result: PayrollCalculationResult }> {
  return employees.map(emp => ({
    employeeId: emp.employeeId,
    result: calculatePayroll({
      setting,
      employee: emp.salaryData,
      overtime: emp.overtime,
      bonus: emp.bonus,
      otherIncome: emp.otherIncome,
      otherDeduction: emp.otherDeduction,
    }),
  }))
}
