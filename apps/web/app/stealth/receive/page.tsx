'use client'

import { useState } from 'react'
import { useWallet, useStealth } from '@/hooks'
import { PageHeader, ConnectWalletCard } from '@/components/common'
import { StealthMetaAddressCard, IncomingPaymentsCard } from '@/components/stealth'

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
    return (
      <ConnectWalletCard message="Please connect your wallet to receive privately" />
    )
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error.message}</p>
        </div>
      )}
    </div>
  )
}
