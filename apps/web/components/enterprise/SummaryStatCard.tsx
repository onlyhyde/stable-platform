'use client'

import { Card, CardContent } from '@/components/common'

interface SummaryStatCardProps {
  label: string
  value: string | number
  valueClassName?: string
}

export function SummaryStatCard({ label, value, valueClassName }: SummaryStatCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {label}
        </p>
        <p
          className={`text-2xl font-bold ${valueClassName || ''}`}
          style={!valueClassName ? { color: 'rgb(var(--foreground))' } : undefined}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
