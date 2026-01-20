import { redirect } from 'next/navigation'

// 此頁面已移至人事管理模組
export default function ShiftsRedirectPage() {
  redirect('/dashboard/hr/shifts')
}
