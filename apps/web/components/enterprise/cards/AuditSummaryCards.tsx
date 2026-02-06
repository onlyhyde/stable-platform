'use client'

import { SummaryStatCard } from '../SummaryStatCard'

interface AuditSummaryCardsProps {
  totalActions: number
  uniqueActors: number
  onChainPercentage: string
  complianceStatus: string
}

export function AuditSummaryCards({
  totalActions,
  uniqueActors,
  onChainPercentage,
  complianceStatus,
}: AuditSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <SummaryStatCard label="Total Actions (30d)" value={totalActions} />
      <SummaryStatCard label="Unique Actors" value={uniqueActors} />
      <SummaryStatCard
        label="On-Chain Records"
        value={onChainPercentage}
        valueClassName="text-green-600"
      />
      <SummaryStatCard
        label="Compliance Status"
        value={complianceStatus}
        valueClassName="text-green-600"
      />
    </div>
  )
}
