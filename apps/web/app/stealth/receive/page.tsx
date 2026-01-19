'use client'

import { useState } from 'react'
import { useWallet, useStealth } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/common'
import { copyToClipboard, formatAddress } from '@/lib/utils'
import type { Announcement } from '@/types'

export default function StealthReceivePage() {
  const { isConnected } = useWallet()
  const {
    stealthMetaAddress,
    announcements,
    isLoading,
    error,
    registerStealthMetaAddress,
    scanAnnouncements,
  } = useStealth()

  const [copied, setCopied] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  async function handleCopy() {
    if (!stealthMetaAddress) return
    // Format the stealth meta-address for sharing
    const formattedAddress = `st:eth:${stealthMetaAddress.spendingPubKey}${stealthMetaAddress.viewingPubKey.slice(2)}`
    const success = await copyToClipboard(formattedAddress)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleRegister() {
    if (!stealthMetaAddress) return
    setIsRegistering(true)
    await registerStealthMetaAddress()
    setIsRegistering(false)
  }

  async function handleScan() {
    setIsScanning(true)
    await scanAnnouncements()
    setIsScanning(false)
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to receive privately</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Private Receive</h1>
        <p className="text-gray-500">Generate and share your stealth meta-address</p>
      </div>

      {/* Stealth Meta-Address Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Stealth Meta-Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stealthMetaAddress ? (
            <>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Share this address to receive private payments</p>
                <code className="text-sm text-gray-700 break-all block">
                  st:eth:{stealthMetaAddress.spendingPubKey.slice(0, 20)}...{stealthMetaAddress.viewingPubKey.slice(-16)}
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
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Address
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRegister}
                  variant="secondary"
                  isLoading={isRegistering}
                  className="flex-1"
                >
                  Register On-Chain
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Registering on-chain allows senders to look up your address automatically
              </p>
            </>
          ) : (
            <div className="text-center py-8">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
              <p className="text-gray-500 mb-4">No stealth meta-address generated</p>
              <Button isLoading={isLoading}>
                Generate Meta-Address
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan for Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Incoming Payments</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleScan}
            isLoading={isScanning}
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Scan
          </Button>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
              <p className="text-gray-500">No incoming payments detected</p>
              <p className="text-sm text-gray-400 mt-1">
                Click &quot;Scan&quot; to check for new announcements
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {announcements.map((announcement) => (
                <AnnouncementItem key={announcement.stealthAddress} announcement={announcement} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error.message}</p>
        </div>
      )}
    </div>
  )
}

interface AnnouncementItemProps {
  announcement: Announcement
}

function AnnouncementItem({ announcement }: AnnouncementItemProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  async function handleWithdraw() {
    setIsWithdrawing(true)
    // In production, this would initiate the withdrawal process
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsWithdrawing(false)
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
          <p className="font-medium text-gray-900">
            Stealth Payment
          </p>
          <p className="text-sm text-gray-500">
            To: {formatAddress(announcement.stealthAddress)}
          </p>
        </div>
      </div>
      <div className="text-right flex items-center gap-4">
        <div>
          <p className="font-medium text-gray-900">
            {(Number(announcement.value) / 1e18).toFixed(4)} ETH
          </p>
          <p className="text-xs text-gray-500">
            Block #{announcement.blockNumber.toString()}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleWithdraw}
          isLoading={isWithdrawing}
        >
          Withdraw
        </Button>
      </div>
    </div>
  )
}
