'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  InfoBanner,
  Input,
} from '@/components/common'

interface ContractSettings {
  entryPoint: string
  accountFactory: string
  paymaster: string
  stealthAnnouncer: string
  stealthRegistry: string
  sessionKeyManager: string
  subscriptionManager: string
  recurringPaymentManager: string
  permissionManager: string
}

const STORAGE_KEY = 'stable-net-contract-settings'

const defaultAddresses: ContractSettings = {
  entryPoint: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  accountFactory: '0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c',
  paymaster: '0x2dd78fd9b8f40659af32ef98555b8b31bc97a351',
  stealthAnnouncer: '0x8fc8cfb7f7362e44e472c690a6e025b80e406458',
  stealthRegistry: '0xc7143d5ba86553c06f5730c8dc9f8187a621a8d4',
  sessionKeyManager: '0x4a679253410272dd5232B3Ff7cF5dbB88f295319',
  subscriptionManager: '0x9d4454B023096f34B160D6B654540c56A1F81688',
  recurringPaymentManager: '0x5678901234567890123456789012345678901234',
  permissionManager: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
}

export function DeveloperSettingsCard() {
  const [contracts, setContracts] = useState<ContractSettings>(defaultAddresses)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const settings: ContractSettings = JSON.parse(saved)
        setContracts({ ...defaultAddresses, ...settings })
      }
    } catch {
      // Use defaults
    }
  }, [])

  const handleChange = (key: keyof ContractSettings, value: string) => {
    setContracts((prev) => ({ ...prev, [key]: value }))
  }

  const isValidAddress = (address: string): boolean => {
    if (!address.trim()) return true
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Validate all addresses
      const invalidFields = Object.entries(contracts).filter(
        ([, value]) => value && !isValidAddress(value)
      )

      if (invalidFields.length > 0) {
        setSaveMessage({
          type: 'error',
          text: `Invalid address format: ${invalidFields.map(([key]) => key).join(', ')}`,
        })
        setIsSaving(false)
        return
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts))
      setSaveMessage({
        type: 'success',
        text: 'Contract addresses saved! Refresh to apply changes.',
      })

      setTimeout(() => setSaveMessage(null), 5000)
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save settings.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setContracts(defaultAddresses)
    localStorage.removeItem(STORAGE_KEY)
    setSaveMessage({ type: 'success', text: 'Contract addresses reset to defaults.' })
    setTimeout(() => setSaveMessage(null), 3000)
  }

  const contractFields: { key: keyof ContractSettings; label: string; hint: string }[] = [
    { key: 'entryPoint', label: 'EntryPoint', hint: 'ERC-4337 EntryPoint contract' },
    { key: 'accountFactory', label: 'Account Factory', hint: 'Smart account factory (Kernel)' },
    { key: 'paymaster', label: 'Paymaster', hint: 'Gas sponsorship paymaster' },
    {
      key: 'sessionKeyManager',
      label: 'Session Key Manager',
      hint: 'Session key validator module',
    },
    {
      key: 'subscriptionManager',
      label: 'Subscription Manager',
      hint: 'Recurring subscription contract',
    },
    {
      key: 'recurringPaymentManager',
      label: 'Recurring Payment Manager',
      hint: 'Recurring payment processor',
    },
    { key: 'permissionManager', label: 'Permission Manager', hint: 'Permission control module' },
    { key: 'stealthAnnouncer', label: 'Stealth Announcer', hint: 'Stealth address announcer' },
    { key: 'stealthRegistry', label: 'Stealth Registry', hint: 'Stealth meta-address registry' },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Contract Addresses</CardTitle>
          <CardDescription className="mb-6">
            Configure deployed contract addresses for the current network. This allows you to update
            addresses after redeploying contracts without restarting the app.
          </CardDescription>

          {saveMessage && (
            <div className="mb-4">
              <InfoBanner
                title={saveMessage.text}
                variant={saveMessage.type === 'success' ? 'info' : 'warning'}
              />
            </div>
          )}

          <div className="space-y-4">
            {contractFields.map(({ key, label, hint }) => (
              <Input
                key={key}
                label={label}
                placeholder="0x..."
                hint={hint}
                value={contracts[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="font-mono text-sm"
              />
            ))}

            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={isSaving}
              >
                Save Contract Addresses
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                Reset to Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Debug Settings</CardTitle>
          <CardDescription className="mb-6">
            Advanced settings for development and debugging.
          </CardDescription>

          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Environment
              </span>
              <span
                className="text-sm font-mono font-medium"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {process.env.NODE_ENV}
              </span>
            </div>
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Build Time
              </span>
              <span
                className="text-sm font-mono font-medium"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {new Date().toISOString().split('T')[0]}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <InfoBanner
        title="Developer Mode"
        description="Changes to contract addresses are stored in browser localStorage. Clear browser data to reset all custom settings."
        variant="info"
      />
    </div>
  )
}
