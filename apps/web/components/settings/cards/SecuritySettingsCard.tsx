'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  InfoBanner,
  Input,
  ToggleCard,
} from '@/components/common'

export function SecuritySettingsCard() {
  const [sessionKeyEnabled, setSessionKeyEnabled] = useState(false)
  const [txConfirmation, setTxConfirmation] = useState(true)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Transaction Settings</CardTitle>

          <div className="space-y-4">
            <ToggleCard
              title="Require Confirmation"
              description="Always confirm transactions before signing"
              checked={txConfirmation}
              onChange={setTxConfirmation}
            />

            <ToggleCard
              title="Session Keys"
              description="Allow temporary keys for seamless transactions"
              checked={sessionKeyEnabled}
              onChange={setSessionKeyEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Spending Limits</CardTitle>
          <CardDescription className="mb-6">
            Set daily spending limits to protect your account from unauthorized transactions.
          </CardDescription>

          <div className="space-y-4">
            <Input
              label="Daily ETH Limit"
              type="number"
              placeholder="1.0"
              hint="Maximum ETH that can be spent per day"
            />
            <Input
              label="Daily Token Limit (USD)"
              type="number"
              placeholder="1000"
              hint="Maximum USD value of tokens that can be spent per day"
            />
            <Button variant="secondary">Update Limits</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Recovery Options</CardTitle>
          <CardDescription className="mb-6">
            Configure account recovery methods in case you lose access to your wallet.
          </CardDescription>

          <div className="space-y-3">
            <RecoveryOption icon={<EmailIcon />} title="Email Recovery" status="Not configured" />
            <RecoveryOption icon={<SocialIcon />} title="Social Recovery" status="Not configured" />
          </div>
        </CardContent>
      </Card>

      <InfoBanner
        title="Security Best Practices"
        description="Never share your private keys or seed phrase. StableNet will never ask for this information. Consider setting up recovery options to protect your account."
        variant="warning"
      />
    </div>
  )
}

interface RecoveryOptionProps {
  icon: React.ReactNode
  title: string
  status: string
}

function RecoveryOption({ icon, title, status }: RecoveryOptionProps) {
  return (
    <div
      className="flex items-center justify-between p-4 border rounded-lg"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          {icon}
        </div>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {title}
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {status}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm">
        Setup
      </Button>
    </div>
  )
}

function EmailIcon() {
  return (
    <svg
      className="w-5 h-5"
      style={{ color: 'rgb(var(--muted-foreground))' }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

function SocialIcon() {
  return (
    <svg
      className="w-5 h-5"
      style={{ color: 'rgb(var(--muted-foreground))' }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  )
}
