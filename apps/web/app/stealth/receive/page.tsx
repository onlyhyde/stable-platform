'use client'

import { useCallback, useState } from 'react'
import type { Hex } from 'viem'
import { concat, keccak256, toHex } from 'viem'
import { useSignMessage } from 'wagmi'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConnectWalletCard,
  PageHeader,
  useToast,
} from '@/components/common'
import { IncomingPaymentsCard, StealthMetaAddressCard } from '@/components/stealth'
import { useStealth, useWallet } from '@/hooks'
import type { Announcement } from '@/types'

const STEALTH_KEY_DERIVATION_MESSAGE = 'Generate StableNet Stealth Keys v1'

export default function StealthReceivePage() {
  const { address, isConnected } = useWallet()
  const { addToast, updateToast } = useToast()
  const { signMessageAsync } = useSignMessage()
  const {
    stealthMetaAddress,
    announcements,
    isLoading,
    error,
    registerStealthMetaAddress,
    scanAnnouncements,
    withdrawFromStealthAddress,
  } = useStealth()

  const [isRegistering, setIsRegistering] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [stealthKeys, setStealthKeys] = useState<{
    spending: Hex
    viewing: Hex
  } | null>(null)
  const [isDeriving, setIsDeriving] = useState(false)

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

  async function handleDeriveKeys() {
    setIsDeriving(true)
    try {
      const signature = await signMessageAsync({
        message: STEALTH_KEY_DERIVATION_MESSAGE,
      })
      // Derive spending and viewing private keys deterministically from signature
      const spendingPrivateKey = keccak256(concat([signature, toHex(0, { size: 1 })]))
      const viewingPrivateKey = keccak256(concat([signature, toHex(1, { size: 1 })]))
      setStealthKeys({ spending: spendingPrivateKey, viewing: viewingPrivateKey })
      addToast({
        type: 'success',
        title: 'Keys Derived',
        message: 'Stealth keys are ready. You can now withdraw from stealth addresses.',
      })
    } catch {
      addToast({
        type: 'error',
        title: 'Key Derivation Failed',
        message: 'Could not derive stealth keys. Please try signing again.',
      })
    } finally {
      setIsDeriving(false)
    }
  }

  const handleWithdraw = useCallback(
    async (announcement: Announcement) => {
      if (!stealthKeys || !address) {
        addToast({
          type: 'error',
          title: 'Keys Required',
          message: 'Please derive your stealth keys first by clicking "Unlock Stealth Keys".',
        })
        return
      }

      const toastId = addToast({
        type: 'loading',
        title: 'Withdrawing',
        message: `Withdrawing ${(Number(announcement.value) / 1e18).toFixed(4)} ETH from stealth address...`,
        persistent: true,
      })

      try {
        const result = await withdrawFromStealthAddress({
          announcement,
          recipientAddress: address,
          spendingKey: stealthKeys.spending,
          viewingKey: stealthKeys.viewing,
        })

        if (result?.hash) {
          updateToast(toastId, {
            type: 'success',
            title: 'Withdrawal Sent',
            message: `Transaction submitted: ${result.hash.slice(0, 10)}...`,
            persistent: false,
          })
        } else {
          updateToast(toastId, {
            type: 'error',
            title: 'Withdrawal Failed',
            message: error?.message ?? 'Could not withdraw from stealth address',
            persistent: false,
          })
        }
      } catch {
        updateToast(toastId, {
          type: 'error',
          title: 'Withdrawal Failed',
          message: 'Could not withdraw from stealth address',
          persistent: false,
        })
      }
    },
    [addToast, updateToast, stealthKeys, address, withdrawFromStealthAddress, error]
  )

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

      {/* Stealth Key Derivation Card */}
      <Card>
        <CardHeader>
          <CardTitle>Stealth Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {stealthKeys ? (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'rgb(var(--success, 34 197 94))' }}
              />
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Stealth keys are unlocked. You can withdraw from stealth addresses.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Sign a message with your wallet to derive your stealth private keys. This is
                required to withdraw funds from stealth addresses.
              </p>
              <Button onClick={handleDeriveKeys} isLoading={isDeriving}>
                Unlock Stealth Keys
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
