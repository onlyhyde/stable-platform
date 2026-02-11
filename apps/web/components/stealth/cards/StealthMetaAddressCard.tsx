'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { copyToClipboard } from '@/lib/utils'
import type { StealthMetaAddress } from '@/types'

interface StealthMetaAddressCardProps {
  stealthMetaAddress: StealthMetaAddress | null
  isLoading: boolean
  onRegister: () => void
  isRegistering: boolean
  onGenerate?: () => void
}

export function StealthMetaAddressCard({
  stealthMetaAddress,
  isLoading,
  onRegister,
  isRegistering,
  onGenerate,
}: StealthMetaAddressCardProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!stealthMetaAddress) return
    const formattedAddress = `st:eth:${stealthMetaAddress.spendingPubKey}${stealthMetaAddress.viewingPubKey.slice(2)}`
    const success = await copyToClipboard(formattedAddress)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Stealth Meta-Address</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stealthMetaAddress ? (
          <>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Share this address to receive private payments
              </p>
              <code
                className="text-sm break-all block"
                style={{ color: 'rgb(var(--foreground) / 0.8)' }}
              >
                st:eth:{stealthMetaAddress.spendingPubKey.slice(0, 20)}...
                {stealthMetaAddress.viewingPubKey.slice(-16)}
              </code>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCopy}
                variant={copied ? 'secondary' : 'primary'}
                className="flex-1"
              >
                {copied ? (
                  <>
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
                    Copied!
                  </>
                ) : (
                  <>
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
                    Copy Address
                  </>
                )}
              </Button>
              <Button
                onClick={onRegister}
                variant="secondary"
                isLoading={isRegistering}
                className="flex-1"
              >
                Register On-Chain
              </Button>
            </div>

            <p className="text-xs text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Registering on-chain allows senders to look up your address automatically
            </p>
          </>
        ) : (
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
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
              No stealth meta-address generated
            </p>
            <Button isLoading={isLoading} onClick={onGenerate} disabled={isLoading}>
              Generate Meta-Address
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
