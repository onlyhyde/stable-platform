'use client'

import type { Address } from 'viem'
import { Button, Card, CardContent } from '@/components/common'
import { DelegateAddressInput } from '../DelegateAddressInput'

interface UpgradeCardProps {
  chainId: number
  selectedDelegate: Address
  onDelegateChange: (address: Address) => void
  onUpgrade: () => void
  isUpgrading: boolean
  isLoading: boolean
  canPerformAction: boolean
}

export function UpgradeCard({
  chainId,
  selectedDelegate,
  onDelegateChange,
  onUpgrade,
  isUpgrading,
  isLoading,
  canPerformAction,
}: UpgradeCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: 'rgb(var(--success))' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            Upgrade to Smart Account
          </h3>
          <p className="max-w-md mx-auto" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Delegate your EOA to a Smart Account using EIP-7702 SetCode transaction.
          </p>
        </div>

        <div className="mb-6">
          <p
            className="block text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground) / 0.8)' }}
          >
            Select Delegate Contract
          </p>
          <DelegateAddressInput
            chainId={chainId}
            value={selectedDelegate}
            onChange={onDelegateChange}
            disabled={isUpgrading || isLoading}
          />
        </div>

        <div className="text-center">
          <Button
            onClick={onUpgrade}
            disabled={isUpgrading || isLoading || !canPerformAction}
            className="min-w-[200px]"
          >
            {isUpgrading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Upgrading...
              </span>
            ) : !canPerformAction ? (
              'Enter Private Key First'
            ) : (
              'Upgrade to Smart Account'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
