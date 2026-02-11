'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import { useWallet } from '@/hooks'
import { copyToClipboard } from '@/lib/utils'

export default function ReceivePage() {
  const { address, isConnected } = useWallet()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!address) return
    const success = await copyToClipboard(address)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to receive payments
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Receive
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Share your address to receive payments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code Placeholder */}
          <div className="flex justify-center">
            <div
              className="w-48 h-48 border-2 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: 'rgb(var(--card))',
                borderColor: 'rgb(var(--border))',
              }}
            >
              <div className="text-center p-4">
                <svg
                  className="w-24 h-24 mx-auto"
                  style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M3 11V3h8v8H3zm2-6v4h4V5H5zM3 21v-8h8v8H3zm2-6v4h4v-4H5zm8-10h8v8h-8V3zm2 6h4V5h-4v4zm-2 10h2v-2h-2v2zm0-4h2v-2h-2v2zm2 4h2v-2h-2v2zm2-4h2v-2h-2v2zm2 4h2v-2h-2v2zm-2-8h2v-2h-2v2zm2 0h2v-2h-2v2z" />
                </svg>
                <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  QR Code
                </p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Wallet Address
            </p>
            <code
              className="text-sm break-all block"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              {address}
            </code>
          </div>

          {/* Copy Button */}
          <Button
            onClick={handleCopy}
            variant={copied ? 'secondary' : 'primary'}
            className="w-full"
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

          {/* Warning */}
          <p className="text-xs text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Only send assets on the same network. Sending to a different network may result in loss
            of funds.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
