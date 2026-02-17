'use client'

import { QRCodeSVG } from 'qrcode.react'
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
          {/* QR Code */}
          <div className="flex justify-center">
            <div
              className="p-4 border-2 rounded-2xl"
              style={{
                backgroundColor: '#ffffff',
                borderColor: 'rgb(var(--border))',
              }}
            >
              {address && <QRCodeSVG value={address} size={176} level="M" includeMargin={false} />}
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
