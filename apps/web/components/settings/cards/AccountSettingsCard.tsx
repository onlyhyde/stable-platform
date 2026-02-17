'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Input,
  useToast,
} from '@/components/common'
import { MODULE_TYPES, useModule } from '@/hooks/useModule'
import { useSmartAccount } from '@/hooks/useSmartAccount'

const ACCOUNT_NAME_KEY = 'stablenet_account_name'

interface AccountSettingsCardProps {
  isConnected: boolean
  address?: string
  onDisconnect: () => void
}

export function AccountSettingsCard({
  isConnected,
  address,
  onDisconnect,
}: AccountSettingsCardProps) {
  const { addToast } = useToast()
  const { status: saStatus, contracts } = useSmartAccount()
  const { isModuleInstalled } = useModule()
  const [accountName, setAccountName] = useState('My Account')
  const [copied, setCopied] = useState(false)
  const [installedModules, setInstalledModules] = useState<string[]>([])
  const [modulesChecked, setModulesChecked] = useState(false)

  // Load account name from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ACCOUNT_NAME_KEY)
    if (stored) setAccountName(stored)
  }, [])

  // Check installed modules when smart account is detected
  useEffect(() => {
    if (!saStatus.isSmartAccount || !address || modulesChecked) return

    const checkModules = async () => {
      const addr = address as Address
      const modules: string[] = []

      const ecdsaInstalled = await isModuleInstalled(
        addr,
        MODULE_TYPES.VALIDATOR,
        contracts.ecdsaValidator as Address
      )
      if (ecdsaInstalled) modules.push('ECDSA Validator')

      setInstalledModules(modules.length > 0 ? modules : ['None detected'])
      setModulesChecked(true)
    }

    checkModules()
  }, [
    saStatus.isSmartAccount,
    address,
    contracts.ecdsaValidator,
    isModuleInstalled,
    modulesChecked,
  ])

  // Persist account name to localStorage on change
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAccountName(value)
    localStorage.setItem(ACCOUNT_NAME_KEY, value)
  }, [])

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      addToast({ type: 'success', title: 'Copied', message: 'Address copied to clipboard' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast({ type: 'error', title: 'Copy Failed', message: 'Could not copy address' })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Connected Account</CardTitle>

          {isConnected && address ? (
            <div className="space-y-4">
              <div
                className="flex items-center gap-4 p-4 rounded-lg"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {accountName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                    {accountName}
                  </p>
                  <p
                    className="text-sm font-mono"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    {formatAddress(address)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="p-2 transition-colors"
                  style={{ color: copied ? 'rgb(var(--success))' : 'rgb(var(--muted-foreground))' }}
                  title={copied ? 'Copied!' : 'Copy address'}
                >
                  {copied ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <div>
                <Input
                  label="Account Name"
                  value={accountName}
                  onChange={handleNameChange}
                  hint="A friendly name for this account"
                />
              </div>

              <div className="pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <Button
                  variant="secondary"
                  onClick={onDisconnect}
                  style={{ color: 'rgb(var(--destructive))' }}
                >
                  Disconnect Wallet
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <svg
                  className="w-8 h-8"
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                No wallet connected
              </p>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}>
                Connect a wallet to manage your account settings
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Smart Account</CardTitle>
          <CardDescription className="mb-6">
            Your smart account provides enhanced features like gas sponsorship and batch
            transactions.
          </CardDescription>

          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Account Type
              </span>
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                Kernel v3 (ERC-4337)
              </span>
            </div>
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Deployment Status
              </span>
              <span
                className="text-sm font-medium"
                style={{
                  color: saStatus.isLoading
                    ? 'rgb(var(--muted-foreground))'
                    : saStatus.isSmartAccount
                      ? 'rgb(var(--success))'
                      : 'rgb(var(--warning))',
                }}
              >
                {saStatus.isLoading
                  ? 'Checking...'
                  : saStatus.isSmartAccount
                    ? 'Deployed'
                    : 'Not Deployed'}
              </span>
            </div>
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Modules
              </span>
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {saStatus.isLoading
                  ? 'Checking...'
                  : !saStatus.isSmartAccount
                    ? 'N/A'
                    : !modulesChecked
                      ? 'Loading...'
                      : installedModules.join(', ')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
