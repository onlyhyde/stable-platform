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
import { supportedChains } from '@/lib/chains'
import type { RpcSettings } from '@/lib/utils'

interface NetworkSettingsCardProps {
  currentChainId: number
  onSwitchChain: (chainId: number) => void
}

const STORAGE_KEY = 'stable-net-rpc-settings'

export function NetworkSettingsCard({ currentChainId, onSwitchChain }: NetworkSettingsCardProps) {
  const [rpcUrl, setRpcUrl] = useState('')
  const [bundlerUrl, setBundlerUrl] = useState('')
  const [paymasterUrl, setPaymasterUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Load saved settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const settings: RpcSettings = JSON.parse(saved)
        setRpcUrl(settings.rpcUrl || '')
        setBundlerUrl(settings.bundlerUrl || '')
        setPaymasterUrl(settings.paymasterUrl || '')
      }
    } catch {
      // Silently fail - will use empty strings as defaults
    }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Validate URLs if provided
      if (rpcUrl && !isValidUrl(rpcUrl)) {
        setSaveMessage({ type: 'error', text: 'Invalid RPC URL format' })
        setIsSaving(false)
        return
      }
      if (bundlerUrl && !isValidUrl(bundlerUrl)) {
        setSaveMessage({ type: 'error', text: 'Invalid Bundler URL format' })
        setIsSaving(false)
        return
      }
      if (paymasterUrl && !isValidUrl(paymasterUrl)) {
        setSaveMessage({ type: 'error', text: 'Invalid Paymaster URL format' })
        setIsSaving(false)
        return
      }

      // Save to localStorage
      const settings: RpcSettings = {
        rpcUrl: rpcUrl.trim(),
        bundlerUrl: bundlerUrl.trim(),
        paymasterUrl: paymasterUrl.trim(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))

      setSaveMessage({
        type: 'success',
        text: 'RPC settings saved! Refresh the page to apply changes.',
      })

      // Clear message after 5 seconds
      setTimeout(() => {
        setSaveMessage(null)
      }, 5000)
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return true // Empty is valid (will use default)
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Network Selection</CardTitle>
          <CardDescription className="mb-6">
            Choose which network to connect to. Different networks may have different features and
            token availability.
          </CardDescription>

          <div className="space-y-3">
            {supportedChains.map((chain) => (
              <button
                key={chain.id}
                type="button"
                onClick={() => onSwitchChain(chain.id)}
                className="w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors"
                style={{
                  borderColor:
                    currentChainId === chain.id ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                  backgroundColor:
                    currentChainId === chain.id ? 'rgb(var(--primary) / 0.1)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (currentChainId !== chain.id) {
                    e.currentTarget.style.backgroundColor = 'rgb(var(--secondary))'
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentChainId !== chain.id) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor:
                        currentChainId === chain.id
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--secondary))',
                    }}
                  >
                    <svg
                      className="w-5 h-5"
                      style={{
                        color:
                          currentChainId === chain.id ? 'white' : 'rgb(var(--muted-foreground))',
                      }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      {chain.name}
                    </p>
                    <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      Chain ID: {chain.id}
                    </p>
                  </div>
                </div>
                {currentChainId === chain.id && (
                  <span className="text-sm font-medium" style={{ color: 'rgb(var(--primary))' }}>
                    Connected
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">RPC Configuration</CardTitle>
          <CardDescription className="mb-6">
            Configure custom RPC endpoints for advanced users.
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
            <Input
              label="RPC URL"
              placeholder="https://rpc.example.com"
              hint="Leave empty to use default RPC endpoint"
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
            />
            <Input
              label="Bundler URL"
              placeholder="https://bundler.example.com"
              hint="ERC-4337 bundler endpoint for UserOperations"
              value={bundlerUrl}
              onChange={(e) => setBundlerUrl(e.target.value)}
            />
            <Input
              label="Paymaster URL"
              placeholder="https://paymaster.example.com"
              hint="Paymaster endpoint for gas sponsorship"
              value={paymasterUrl}
              onChange={(e) => setPaymasterUrl(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={isSaving}
            >
              Save RPC Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
