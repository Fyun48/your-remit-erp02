import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Stamp, FileText, CreditCard, Package, Clock, AlertTriangle, Printer, TrendingUp } from 'lucide-react'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const assignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      isPrimary: true,
      status: 'ACTIVE',
    },
    include: { company: true },
  })

  if (!assignment) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">行政管理</h1>
        <p className="text-muted-foreground mt-2">您尚未被指派到任何公司</p>
      </div>
    )
  }

  // 取得統計數據
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    pendingSeal,
    overdueReturn,
    pendingCard,
    printingCard,
    pendingStationery,
    approvedStationery,
    lowStockCount,
    sealThisMonth,
    cardThisMonth,
    stationeryThisMonth,
  ] = await Promise.all([
    // 用印申請待審核
    prisma.sealRequest.count({
      where: { companyId: assignment.companyId, status: 'PENDING' },
    }),
    // 逾期未歸還
    prisma.sealRequest.count({
      where: {
        companyId: assignment.companyId,
        isCarryOut: true,
        status: { in: ['APPROVED', 'PROCESSING', 'COMPLETED'] },
        actualReturn: null,
        expectedReturn: { lt: now },
      },
    }),
    // 名片待審核
    prisma.businessCardRequest.count({
      where: { companyId: assignment.companyId, status: 'PENDING' },
    }),
    // 名片印刷中
    prisma.businessCardRequest.count({
      where: { companyId: assignment.companyId, status: 'PRINTING' },
    }),
    // 文具待審核
    prisma.stationeryRequest.count({
      where: { companyId: assignment.companyId, status: 'PENDING' },
    }),
    // 文具待發放
    prisma.stationeryRequest.count({
      where: { companyId: assignment.companyId, status: 'APPROVED' },
    }),
    // 文具低庫存 - 先取得所有文具項目再計算
    prisma.stationeryItem.findMany({
      where: {
        companyId: assignment.companyId,
        isActive: true,
      },
      select: { stock: true, alertLevel: true },
    }).then((items) => items.filter((item) => item.stock <= item.alertLevel).length),
    // 本月用印
    prisma.sealRequest.count({
      where: { companyId: assignment.companyId, createdAt: { gte: startOfMonth } },
    }),
    // 本月名片
    prisma.businessCardRequest.count({
      where: { companyId: assignment.companyId, createdAt: { gte: startOfMonth } },
    }),
    // 本月文具
    prisma.stationeryRequest.count({
      where: { companyId: assignment.companyId, createdAt: { gte: startOfMonth } },
    }),
  ])

  const totalPending = pendingSeal + pendingCard + pendingStationery

  const menuItems = [
    {
      title: '用印申請',
      description: '申請公司印章用印',
      icon: Stamp,
      href: '/dashboard/admin/seal',
      color: 'text-blue-500',
      badge: pendingSeal > 0 ? `${pendingSeal} 待審` : undefined,
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      title: '證件借用',
      description: '借用公司證件文件',
      icon: FileText,
      href: '/dashboard/admin/document',
      color: 'text-green-500',
      disabled: true,
    },
    {
      title: '名片申請',
      description: '申請製作名片',
      icon: CreditCard,
      href: '/dashboard/admin/card',
      color: 'text-purple-500',
      badge: pendingCard > 0 ? `${pendingCard} 待審` : printingCard > 0 ? `${printingCard} 印刷中` : undefined,
      badgeColor: pendingCard > 0 ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700',
    },
    {
      title: '文具申請',
      description: '申請辦公文具用品',
      icon: Package,
      href: '/dashboard/admin/stationery',
      color: 'text-orange-500',
      badge: pendingStationery > 0 ? `${pendingStationery} 待審` : approvedStationery > 0 ? `${approvedStationery} 待發放` : undefined,
      badgeColor: pendingStationery > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">行政管理</h1>
        <p className="text-muted-foreground">{assignment.company.name}</p>
      </div>

      {/* 綜合統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待處理申請</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalPending}</div>
            <p className="text-xs text-muted-foreground">
              用印 {pendingSeal} / 名片 {pendingCard} / 文具 {pendingStationery}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月申請</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sealThisMonth + cardThisMonth + stationeryThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              用印 {sealThisMonth} / 名片 {cardThisMonth} / 文具 {stationeryThisMonth}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
            <Printer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{printingCard + approvedStationery}</div>
            <p className="text-xs text-muted-foreground">
              名片印刷 {printingCard} / 文具待發放 {approvedStationery}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">庫存警示</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {lowStockCount > 0 ? '項文具需補充' : '庫存充足'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 提醒卡片 */}
      {overdueReturn > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Stamp className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-900">逾期未歸還印章</p>
                <p className="text-sm text-red-700">
                  有 {overdueReturn} 筆攜出印章已逾期未歸還
                </p>
              </div>
              <Link
                href="/dashboard/admin/seal?tab=overdue"
                className="ml-auto text-sm text-red-600 hover:underline"
              >
                查看詳情
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 低庫存警示 */}
      {lowStockCount > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <Package className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-orange-900">文具庫存不足</p>
                <p className="text-sm text-orange-700">
                  有 {lowStockCount} 項文具庫存低於警戒值
                </p>
              </div>
              <Link
                href="/dashboard/admin/stationery?tab=items"
                className="ml-auto text-sm text-orange-600 hover:underline"
              >
                查看詳情
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 功能選單 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.disabled ? '#' : item.href}
            className={item.disabled ? 'cursor-not-allowed' : ''}
          >
            <Card
              className={`h-full transition-colors ${
                item.disabled
                  ? 'opacity-50'
                  : 'hover:bg-accent/50 cursor-pointer'
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                    <span className="text-lg">{item.title}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                {item.disabled && (
                  <p className="text-xs text-muted-foreground mt-2">
                    (即將推出)
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
