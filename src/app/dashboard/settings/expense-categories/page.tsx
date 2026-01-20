import { redirect } from 'next/navigation'

// 此頁面已移至費用核銷模組
export default function ExpenseCategoriesRedirectPage() {
  redirect('/dashboard/expense/categories')
}
