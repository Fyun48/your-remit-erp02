'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Settings2, CheckCircle, Users, Briefcase, User } from 'lucide-react'
import type { FlowAssigneeType, FlowModuleType } from '@prisma/client'

interface FlowStep {
  id: string
  stepOrder: number
  name: string
  assigneeType: FlowAssigneeType
  isRequired: boolean
  position: { id: string; name: string } | null
  specificEmployee: { id: string; name: string; employeeNo: string } | null
}

interface FlowTemplate {
  id: string
  moduleType: FlowModuleType
  name: string
  description: string | null
  version: number
  steps: FlowStep[]
  createdBy: { id: string; name: string } | null
}

interface FlowTemplateListProps {
  companyId: string
  companyName: string
  userId: string
  templates: FlowTemplate[]
}

const moduleTypeLabels: Record<FlowModuleType, string> = {
  LEAVE: '請假申請',
  EXPENSE: '費用核銷',
  SEAL: '用印申請',
  CARD: '名片申請',
  STATIONERY: '文具申請',
  OVERTIME: '加班申請',
  BUSINESS_TRIP: '出差申請',
}

const assigneeTypeLabels: Record<FlowAssigneeType, string> = {
  DIRECT_SUPERVISOR: '直屬主管',
  POSITION: '指定職位',
  SPECIFIC_PERSON: '指定人員',
}

const assigneeTypeIcons: Record<FlowAssigneeType, typeof Users> = {
  DIRECT_SUPERVISOR: Users,
  POSITION: Briefcase,
  SPECIFIC_PERSON: User,
}

export function FlowTemplateList({ companyName, templates }: FlowTemplateListProps) {
  // 列出所有模組類型，不論是否已有範本
  const allModuleTypes: FlowModuleType[] = ['LEAVE', 'EXPENSE', 'SEAL', 'CARD', 'STATIONERY', 'OVERTIME', 'BUSINESS_TRIP']

  const templateMap = new Map(templates.map(t => [t.moduleType, t]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/workflow">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">審核流程設定</h1>
            <p className="text-muted-foreground">{companyName}</p>
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <p>設定各申請類型的審核流程，最多可設定 4 層審核關卡。審核人可指定為直屬主管、特定職位或特定人員。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {allModuleTypes.map((moduleType) => {
          const template = templateMap.get(moduleType)
          const hasTemplate = !!template

          return (
            <Card key={moduleType} className={hasTemplate ? '' : 'border-dashed'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    {moduleTypeLabels[moduleType]}
                  </CardTitle>
                  {hasTemplate ? (
                    <Badge variant="default" className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      已設定
                    </Badge>
                  ) : (
                    <Badge variant="secondary">未設定</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasTemplate && template ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {template.description || template.name}
                    </p>
                    <div className="space-y-2">
                      {template.steps.map((step, index) => {
                        const Icon = assigneeTypeIcons[step.assigneeType]
                        return (
                          <div key={step.id} className="flex items-center gap-2 text-sm">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {index + 1}
                            </span>
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{step.name}</span>
                            <span className="text-muted-foreground">
                              ({assigneeTypeLabels[step.assigneeType]}
                              {step.assigneeType === 'POSITION' && step.position && ` - ${step.position.name}`}
                              {step.assigneeType === 'SPECIFIC_PERSON' && step.specificEmployee && ` - ${step.specificEmployee.name}`}
                              )
                            </span>
                            {!step.isRequired && (
                              <Badge variant="outline" className="text-xs">可跳過</Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Link href={`/dashboard/workflow/templates/${template.id}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          編輯流程
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      尚未設定此申請類型的審核流程
                    </p>
                    <Link href={`/dashboard/workflow/templates/new?module=${moduleType}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        設定流程
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
