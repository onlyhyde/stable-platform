'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  InfoBanner,
  Input,
  ToggleCard,
  useToast,
} from '@/components/common'

const SECURITY_SETTINGS_KEY = 'stablenet_security_settings'

interface SecuritySettings {
  txConfirmation: boolean
  sessionKeyEnabled: boolean
  dailyEthLimit: string
  dailyTokenLimit: string
}

const DEFAULT_SETTINGS: SecuritySettings = {
  txConfirmation: true,
  sessionKeyEnabled: false,
  dailyEthLimit: '',
  dailyTokenLimit: '',
}

export function SecuritySettingsCard() {
  const { addToast } = useToast()
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SECURITY_SETTINGS_KEY)
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  const persistSettings = useCallback((updated: SecuritySettings) => {
    setSettings(updated)
    localStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(updated))
  }, [])

  const handleToggleTxConfirmation = useCallback(
    (checked: boolean) => {
      const updated = { ...settings, txConfirmation: checked }
      persistSettings(updated)
      addToast({
        type: 'info',
        title: 'Setting Updated',
        message: `Transaction confirmation ${checked ? 'enabled' : 'disabled'}`,
      })
    },
    [settings, persistSettings, addToast]
  )

  const handleToggleSessionKeys = useCallback(
    (checked: boolean) => {
      const updated = { ...settings, sessionKeyEnabled: checked }
      persistSettings(updated)
      addToast({
        type: 'info',
        title: 'Setting Updated',
        message: `Session keys ${checked ? 'enabled' : 'disabled'}`,
      })
    },
    [settings, persistSettings, addToast]
  )

  const handleUpdateLimits = useCallback(() => {
    persistSettings(settings)
    addToast({
      type: 'success',
      title: 'Limits Updated',
      message: 'Daily spending limits have been saved',
    })
  }, [settings, persistSettings, addToast])

  const handleSetupRecovery = useCallback(
    (method: string) => {
      addToast({
        type: 'info',
        title: 'Coming Soon',
        message: `${method} recovery setup will be available in a future update`,
      })
    },
    [addToast]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Transaction Settings</CardTitle>

          <div className="space-y-4">
            <ToggleCard
              title="Require Confirmation"
              description="Always confirm transactions before signing"
              checked={settings.txConfirmation}
              onChange={handleToggleTxConfirmation}
            />

            <ToggleCard
              title="Session Keys"
              description="Allow temporary keys for seamless transactions"
              checked={settings.sessionKeyEnabled}
              onChange={handleToggleSessionKeys}
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
              value={settings.dailyEthLimit}
              onChange={(e) => setSettings((s) => ({ ...s, dailyEthLimit: e.target.value }))}
            />
            <Input
              label="Daily Token Limit (USD)"
              type="number"
              placeholder="1000"
              hint="Maximum USD value of tokens that can be spent per day"
              value={settings.dailyTokenLimit}
              onChange={(e) => setSettings((s) => ({ ...s, dailyTokenLimit: e.target.value }))}
            />
            <Button variant="secondary" onClick={handleUpdateLimits}>
              Update Limits
            </Button>
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
            <RecoveryOption
              icon={<EmailIcon />}
              title="Email Recovery"
              status="Not configured"
              onSetup={() => handleSetupRecovery('Email')}
            />
          </div>
          <p className="mt-4 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            For Social Recovery with guardians, see the dedicated section below.
          </p>
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
  onSetup?: () => void
}

function RecoveryOption({ icon, title, status, onSetup }: RecoveryOptionProps) {
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
      <Button variant="secondary" size="sm" onClick={onSetup}>
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

function _SocialIcon() {
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
