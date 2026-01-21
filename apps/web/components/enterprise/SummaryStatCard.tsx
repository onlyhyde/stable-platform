'use client'

import { Card, CardContent } from '@/components/common'

interface SummaryStatCardProps {
  label: string
  value: string | number
  valueClassName?: string
}

export function SummaryStatCard({ label, value, valueClassName = 'text-gray-900' }: SummaryStatCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
