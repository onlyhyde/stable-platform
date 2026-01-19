'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress } from 'viem'
import { useWallet, useBalance, useUserOp } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/common'
import { formatTokenAmount } from '@/lib/utils'

export default function SendPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const { balance, decimals, symbol } = useBalance({ address })
  const { sendTransaction, isLoading, error } = useUserOp()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  const isValidRecipient = recipient === '' || isAddress(recipient)
  const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)
  const canSend = isAddress(recipient) && Number(amount) > 0 && isConnected && address

  async function handleSend() {
    if (!canSend || !address) return

    const result = await sendTransaction(address, recipient as `0x${string}`, amount)
    if (result?.success) {
      router.push('/payment/history')
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to send payments</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Send</h1>
        <p className="text-gray-500">Transfer tokens to another address</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Available Balance</p>
            <p className="text-xl font-semibold text-gray-900">
              {formatTokenAmount(balance, decimals)} {symbol}
            </p>
          </div>

          {/* Recipient */}
          <Input
            label="Recipient Address"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            error={!isValidRecipient ? 'Invalid address' : undefined}
          />

          {/* Amount */}
          <Input
            label={`Amount (${symbol})`}
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={!isValidAmount ? 'Invalid amount' : undefined}
            rightElement={
              <button
                type="button"
                onClick={() => setAmount(formatTokenAmount(balance, decimals))}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                MAX
              </button>
            }
          />

          {/* Gas Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">
              Gas fees will be sponsored by the Paymaster
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => router.back()}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              isLoading={isLoading}
              className="flex-1"
            >
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
