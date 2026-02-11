'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { formatAddress } from '@/lib/utils'
import type { Announcement } from '@/types'

interface IncomingPaymentsCardProps {
  announcements: Announcement[]
  isScanning: boolean
  onScan: () => void
  onWithdraw?: (announcement: Announcement) => Promise<void>
}

export function IncomingPaymentsCard({
  announcements,
  isScanning,
  onScan,
  onWithdraw,
}: IncomingPaymentsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Incoming Payments</CardTitle>
        <Button variant="secondary" size="sm" onClick={onScan} isLoading={isScanning}>
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Scan
        </Button>
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p style={{ color: 'rgb(var(--muted-foreground))' }}>No incoming payments detected</p>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}>
              Click &quot;Scan&quot; to check for new announcements
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {announcements.map((announcement) => (
              <AnnouncementItem
                key={announcement.stealthAddress}
                announcement={announcement}
                onWithdraw={onWithdraw}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface AnnouncementItemProps {
  announcement: Announcement
  onWithdraw?: (announcement: Announcement) => Promise<void>
}

function AnnouncementItem({ announcement, onWithdraw }: AnnouncementItemProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  async function handleWithdraw() {
    setIsWithdrawing(true)
    try {
      if (onWithdraw) {
        await onWithdraw(announcement)
      }
    } finally {
      setIsWithdrawing(false)
    }
  }

  return (
    <div className="py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Stealth Payment
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            To: {formatAddress(announcement.stealthAddress)}
          </p>
        </div>
      </div>
      <div className="text-right flex items-center gap-4">
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {(Number(announcement.value) / 1e18).toFixed(4)} ETH
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Block #{announcement.blockNumber.toString()}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleWithdraw} isLoading={isWithdrawing}>
          Withdraw
        </Button>
      </div>
    </div>
  )
}
