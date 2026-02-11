'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Hex } from 'viem'
import { ConnectWalletCard, PageHeader } from '@/components/common'
import { StealthTransferCard } from '@/components/stealth'
import { useBalance, useStealth, useWallet } from '@/hooks'
import { formatTokenAmount } from '@/lib/utils'

export default function StealthSendPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const { balance, decimals, symbol } = useBalance({ address })
  const { generateStealthAddress, sendToStealthAddress, isLoading, error } = useStealth()

  const [stealthMetaAddress, setStealthMetaAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(null)
  const [ephemeralPubKey, setEphemeralPubKey] = useState<Hex | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const canGenerate = stealthMetaAddress.startsWith('st:eth:') && Number(amount) > 0 && isConnected

  async function handleGenerate() {
    if (!canGenerate) return

    const result = await generateStealthAddress(stealthMetaAddress)
    if (result?.stealthAddress) {
      setGeneratedAddress(result.stealthAddress)
      setEphemeralPubKey(result.ephemeralPubKey)
    }
  }

  async function handleSend() {
    if (!generatedAddress || !ephemeralPubKey) return

    setIsSending(true)
    try {
      const amountInWei = BigInt(Math.floor(Number(amount) * 10 ** decimals))
      const result = await sendToStealthAddress({
        stealthAddress: generatedAddress as `0x${string}`,
        ephemeralPubKey,
        value: amountInWei,
      })

      if (result?.hash) {
        setTxHash(result.hash)
        // Navigate to stealth page after successful transaction
        setTimeout(() => router.push('/stealth'), 2000)
      }
    } finally {
      setIsSending(false)
    }
  }

  function handleStealthMetaAddressChange(value: string) {
    setStealthMetaAddress(value)
    setGeneratedAddress(null)
  }

  if (!isConnected) {
    return <ConnectWalletCard message="Please connect your wallet to send privately" />
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <PageHeader title="Private Send" description="Send tokens to a stealth meta-address" />

      <StealthTransferCard
        balance={balance}
        decimals={decimals}
        symbol={symbol}
        stealthMetaAddress={stealthMetaAddress}
        onStealthMetaAddressChange={handleStealthMetaAddressChange}
        amount={amount}
        onAmountChange={setAmount}
        generatedAddress={generatedAddress}
        isLoading={isLoading}
        isSending={isSending}
        canGenerate={canGenerate}
        onGenerate={handleGenerate}
        onSend={handleSend}
        onCancel={() => router.back()}
        error={error}
        txHash={txHash}
        formatTokenAmount={formatTokenAmount}
      />
    </div>
  )
}
