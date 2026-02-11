'use client'

import { useState } from 'react'
import { ConnectWalletCard, PageHeader } from '@/components/common'
import { IncomingPaymentsCard, StealthMetaAddressCard } from '@/components/stealth'
import { useStealth, useWallet } from '@/hooks'

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

  const [isRegistering, setIsRegistering] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

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
    return <ConnectWalletCard message="Please connect your wallet to receive privately" />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Private Receive"
        description="Generate and share your stealth meta-address"
      />

      <StealthMetaAddressCard
        stealthMetaAddress={stealthMetaAddress}
        isLoading={isLoading}
        onRegister={handleRegister}
        isRegistering={isRegistering}
      />

      <IncomingPaymentsCard
        announcements={announcements}
        isScanning={isScanning}
        onScan={handleScan}
      />

      {error && (
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderColor: 'rgb(var(--destructive) / 0.3)',
          }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
            {error.message}
          </p>
        </div>
      )}
    </div>
  )
}
