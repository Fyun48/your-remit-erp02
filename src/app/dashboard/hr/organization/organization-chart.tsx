'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Network, Building2, Users, ChevronDown, User } from 'lucide-react'

interface Department {
  id: string
  code: string
  name: string
  sortOrder: number
  parentId: string | null
  parent: { id: string; name: string; code: string } | null
  _count: { employees: number }
}

interface DepartmentHead {
  id: string
  employee: { id: string; name: string; employeeNo: string }
  department: { id: string }
  position: { name: string; level: number }
}

interface OrganizationChartProps {
  companyId: string
  companyName: string
  departments: Department[]
  departmentHeads: DepartmentHead[]
}

interface DepartmentNode {
  department: Department
  heads: DepartmentHead[]
  children: DepartmentNode[]
}

export function OrganizationChart({
  companyName,
  departments,
  departmentHeads,
}: OrganizationChartProps) {
  // 建構樹狀結構
  const buildTree = (): DepartmentNode[] => {
    const nodeMap = new Map<string, DepartmentNode>()

    // 建立節點
    departments.forEach((dept) => {
      const heads = departmentHeads.filter((h) => h.department.id === dept.id)
      nodeMap.set(dept.id, {
        department: dept,
        heads,
        children: [],
      })
    })

    // 建立父子關係
    const rootNodes: DepartmentNode[] = []
    nodeMap.forEach((node) => {
      if (node.department.parentId) {
        const parent = nodeMap.get(node.department.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          rootNodes.push(node)
        }
      } else {
        rootNodes.push(node)
      }
    })

    return rootNodes
  }

  const tree = buildTree()

  const DepartmentCard = ({ node, level = 0 }: { node: DepartmentNode; level?: number }) => {
    const hasChildren = node.children.length > 0
    const topHead = node.heads[0]

    return (
      <div className="flex flex-col items-center">
        {/* 連接線 - 上方 */}
        {level > 0 && <div className="w-px h-4 bg-border" />}

        {/* 部門卡片 */}
        <Card className="w-64 border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              <Badge variant="outline" className="font-mono">
                {node.department.code}
              </Badge>
              {node.department.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topHead ? (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{topHead.employee.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {topHead.position.name}
                </Badge>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">尚無主管</div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{node.department._count.employees} 位員工</span>
            </div>
          </CardContent>
        </Card>

        {/* 連接線 - 下方 */}
        {hasChildren && (
          <>
            <div className="w-px h-4 bg-border" />
            <ChevronDown className="h-4 w-4 text-muted-foreground -my-1" />
            <div className="w-px h-4 bg-border" />
          </>
        )}

        {/* 子部門 */}
        {hasChildren && (
          <div className="relative">
            {/* 水平連接線 */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: '50%',
                  width: `${(node.children.length - 1) * 280}px`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            <div className="flex gap-4">
              {node.children.map((child) => (
                <DepartmentCard key={child.department.id} node={child} level={level + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">組織圖</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">部門總數</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在職人數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {departments.reduce((sum, d) => sum + d._count.employees, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">主管人數</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departmentHeads.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 組織圖 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            組織架構
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tree.length === 0 ? (
            <div className="text-center py-8">
              <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚未建立部門架構</p>
              <Link href="/dashboard/hr/departments">
                <Button variant="outline" className="mt-4">
                  前往建立部門
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex justify-center min-w-max py-4">
                <div className="flex gap-8">
                  {tree.map((node) => (
                    <DepartmentCard key={node.department.id} node={node} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 部門列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            部門列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => {
              const heads = departmentHeads.filter((h) => h.department.id === dept.id)
              return (
                <Card key={dept.id} className="hover:bg-accent/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {dept.code}
                      </Badge>
                      {dept.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {dept.parent && (
                      <div className="text-muted-foreground">
                        上級：{dept.parent.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {dept._count.employees} 位員工
                    </div>
                    {heads.length > 0 && (
                      <div className="pt-2 space-y-1">
                        {heads.slice(0, 2).map((head) => (
                          <div key={head.id} className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{head.employee.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {head.position.name}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
