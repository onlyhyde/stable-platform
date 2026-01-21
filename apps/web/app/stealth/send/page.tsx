'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet, useBalance, useStealth } from '@/hooks'
import { PageHeader, ConnectWalletCard } from '@/components/common'
import { StealthTransferCard } from '@/components/stealth'
import { formatTokenAmount } from '@/lib/utils'

export default function StealthSendPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const { balance, decimals, symbol } = useBalance({ address })
  const { generateStealthAddress, isLoading, error } = useStealth()

  const [stealthMetaAddress, setStealthMetaAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(null)

  const canGenerate = stealthMetaAddress.startsWith('st:eth:') && Number(amount) > 0 && isConnected

  async function handleGenerate() {
    if (!canGenerate) return

    const result = await generateStealthAddress(stealthMetaAddress)
    if (result?.stealthAddress) {
      setGeneratedAddress(result.stealthAddress)
    }
  }

  async function handleSend() {
    if (!generatedAddress) return
    // In production, this would send the transaction to the generated stealth address
    router.push('/stealth')
  }

  function handleStealthMetaAddressChange(value: string) {
    setStealthMetaAddress(value)
    setGeneratedAddress(null)
  }

  if (!isConnected) {
    return (
      <ConnectWalletCard message="Please connect your wallet to send privately" />
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <PageHeader
        title="Private Send"
        description="Send tokens to a stealth meta-address"
      />

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
        canGenerate={canGenerate}
        onGenerate={handleGenerate}
        onSend={handleSend}
        onCancel={() => router.back()}
        error={error}
        formatTokenAmount={formatTokenAmount}
      />
    </div>
  )
}
