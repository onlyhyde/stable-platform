import { useCallback, useState } from 'react'
import { isAddress } from 'viem'
import type { Address, Hash } from 'viem'

import { useSelectedNetwork, useWalletStore } from '../../hooks'

// ============================================================================
// Types
// ============================================================================

interface DelegateSetupProps {
  account: Address
  onComplete: () => void
  onCancel: () => void
}

type SetupStep = 'input' | 'confirm' | 'pending' | 'success' | 'error'

// ============================================================================
// Component
// ============================================================================

export function DelegateSetup({ account, onComplete, onCancel }: DelegateSetupProps) {
  const [delegateAddress, setDelegateAddress] = useState('')
  const [step, setStep] = useState<SetupStep>('input')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hash | null>(null)

  const currentNetwork = useSelectedNetwork()
  const { syncWithBackground } = useWalletStore()

  const isValidDelegate = delegateAddress !== '' && isAddress(delegateAddress)

  const handleSubmit = useCallback(async () => {
    if (!isValidDelegate || !currentNetwork) return

    try {
      setStep('pending')
      setError(null)

      // Step 1: Sign the EIP-7702 authorization via wallet_signAuthorization
      const authResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `auth-7702-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'wallet_signAuthorization',
          params: [
            {
              account,
              contractAddress: delegateAddress as Address,
              chainId: currentNetwork.chainId,
            },
          ],
        },
      })

      if (authResponse?.payload?.error) {
        throw new Error(authResponse.payload.error.message || 'Authorization signing failed')
      }

      const { signedAuthorization } = authResponse.payload.result as {
        signedAuthorization: {
          chainId: bigint
          address: Address
          nonce: bigint
          v: number
          r: string
          s: string
        }
      }

      // Step 2: Send the EIP-7702 SetCode transaction with the authorization
      const txResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `send-7702-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_sendTransaction',
          params: [
            {
              from: account,
              to: account, // Self-referencing for delegation setup
              value: '0x0',
              data: '0x',
              type: '0x04', // EIP-7702 SetCode transaction type
              authorizationList: [signedAuthorization],
            },
          ],
        },
      })

      if (txResponse?.payload?.error) {
        throw new Error(txResponse.payload.error.message || 'Transaction failed')
      }

      const hash = txResponse?.payload?.result as Hash
      setTxHash(hash)
      setStep('success')

      // Sync wallet state to pick up account type change
      await syncWithBackground()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delegation setup failed')
      setStep('error')
    }
  }, [account, delegateAddress, isValidDelegate, currentNetwork, syncWithBackground])

  // Input Step: Enter delegate contract address
  if (step === 'input' || step === 'confirm') {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={onCancel}
            className="p-1"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            Enable Smart Account
          </h2>
        </div>

        {/* Info Banner */}
        <div
          className="p-3 rounded-lg mb-4"
          style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--primary))' }}>
            EIP-7702 delegates your EOA to a smart contract, enabling modules, gas sponsorship, and
            batch transactions while keeping your existing address.
          </p>
        </div>

        {/* Account */}
        <div className="mb-4">
          <span
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Account
          </span>
          <div
            className="p-3 rounded-lg font-mono text-sm break-all"
            style={{ backgroundColor: 'rgb(var(--secondary))', color: 'rgb(var(--foreground))' }}
          >
            {account}
          </div>
        </div>

        {/* Delegate Address Input */}
        <div className="mb-4">
          <label
            htmlFor="delegate-contract-address"
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Delegate Contract Address
          </label>
          <input
            id="delegate-contract-address"
            type="text"
            value={delegateAddress}
            onChange={(e) => {
              setDelegateAddress(e.target.value)
              setError(null)
            }}
            placeholder="0x... (Kernel, Safe, etc.)"
            className="w-full p-3 rounded-lg text-sm font-mono"
            style={{
              backgroundColor: 'rgb(var(--secondary))',
              color: 'rgb(var(--foreground))',
              border: '1px solid rgb(var(--border))',
            }}
          />
          {delegateAddress && !isValidDelegate && (
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
              Invalid address format
            </p>
          )}
        </div>

        {/* Network Info */}
        {currentNetwork && (
          <div className="mb-4">
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              Network
            </span>
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgb(var(--secondary))', color: 'rgb(var(--foreground))' }}
            >
              {currentNetwork.name} (Chain ID: {currentNetwork.chainId})
            </div>
          </div>
        )}

        {/* Warning */}
        <div
          className="p-3 rounded-lg mb-6"
          style={{ backgroundColor: 'rgb(var(--warning) / 0.1)' }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
            This will send a type 0x04 (SetCode) transaction. Gas fee is required. The delegation is
            reversible.
          </p>
        </div>

        {error && (
          <div
            className="p-3 rounded-lg mb-4"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValidDelegate}
          className={`w-full py-3 rounded-lg font-medium ${isValidDelegate ? 'btn-primary' : ''}`}
          style={
            !isValidDelegate
              ? {
                  backgroundColor: 'rgb(var(--secondary))',
                  color: 'rgb(var(--muted-foreground))',
                  cursor: 'not-allowed',
                }
              : undefined
          }
        >
          Delegate Account
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 rounded-lg font-medium mt-2 btn-ghost"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Pending Step
  if (step === 'pending') {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div
            className="w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Setting up Smart Account...
          </p>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Signing authorization and sending SetCode transaction
          </p>
        </div>
      </div>
    )
  }

  // Success Step
  if (step === 'success') {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
          >
            <span className="text-2xl" style={{ color: 'rgb(var(--success))' }}>
              ✓
            </span>
          </div>
          <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--success))' }}>
            Smart Account Enabled!
          </h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Your EOA has been delegated to the smart contract.
          </p>
          {txHash && (
            <p
              className="text-xs mt-2 font-mono break-all"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              Tx: {txHash}
            </p>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="mt-6 px-6 py-3 rounded-lg font-medium btn-primary"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  // Error Step
  return (
    <div className="p-4">
      <div className="text-center py-8">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--destructive) / 0.1)' }}
        >
          <span className="text-2xl" style={{ color: 'rgb(var(--destructive))' }}>
            ✗
          </span>
        </div>
        <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--destructive))' }}>
          Delegation Failed
        </h3>
        <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {error}
        </p>
        <div className="flex gap-2 mt-6 justify-center">
          <button
            type="button"
            onClick={() => setStep('input')}
            className="px-6 py-3 rounded-lg font-medium btn-ghost"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-lg font-medium btn-ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
