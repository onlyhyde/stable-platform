'use client'

import { useCallback, useState } from 'react'
import { ConnectWalletCard, PageHeader, useToast } from '@/components/common'
import { IncomingPaymentsCard, StealthMetaAddressCard } from '@/components/stealth'
import { useStealth, useWallet } from '@/hooks'
import type { Announcement } from '@/types'

export default function StealthReceivePage() {
  const { isConnected } = useWallet()
  const { addToast, updateToast } = useToast()
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

  const handleWithdraw = useCallback(async (announcement: Announcement) => {
    const toastId = addToast({
      type: 'loading',
      title: 'Withdrawing',
      message: `Withdrawing ${(Number(announcement.value) / 1e18).toFixed(4)} ETH from stealth address...`,
      persistent: true,
    })
    try {
      // TODO: ECDH key derivation to compute stealth private key
      // For now, simulate the withdrawal process
      await new Promise((resolve) => setTimeout(resolve, 2000))
      updateToast(toastId, {
        type: 'info',
        title: 'Withdrawal Pending',
        message: 'Stealth withdrawal requires ECDH key derivation (coming soon)',
        persistent: false,
      })
    } catch {
      updateToast(toastId, {
        type: 'error',
        title: 'Withdrawal Failed',
        message: 'Could not withdraw from stealth address',
        persistent: false,
      })
    }
  }, [addToast, updateToast])

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
        onWithdraw={handleWithdraw}
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
