import { getDefaultGroupName } from '@/lib/group-info'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const groupName = await getDefaultGroupName()

  return <LoginForm groupName={groupName} />
}
