'use client'

import type { Address } from 'viem'
import { Card, CardContent } from '@/components/common'
import { formatAddress } from '@/lib/utils'

interface ContractAddressesCardProps {
  contracts: {
    defaultKernelImplementation: Address
    ecdsaValidator: Address
    kernelFactory: Address
    entryPoint: Address
  }
  currentDelegate: Address | null
  selectedDelegate: Address
  isSmartAccount: boolean
}

export function ContractAddressesCard({
  contracts,
  currentDelegate,
  selectedDelegate,
  isSmartAccount,
}: ContractAddressesCardProps) {
  const addressList = [
    ...(isSmartAccount && currentDelegate
      ? [{ label: 'Current Delegate (On-chain)', address: currentDelegate, highlight: true }]
      : []),
    ...(!isSmartAccount
      ? [{ label: 'Delegate to Apply', address: selectedDelegate, highlight: false }]
      : []),
    { label: 'Default Kernel', address: contracts.defaultKernelImplementation, highlight: false },
    { label: 'ECDSA Validator', address: contracts.ecdsaValidator, highlight: false },
    { label: 'Kernel Factory', address: contracts.kernelFactory, highlight: false },
    { label: 'EntryPoint', address: contracts.entryPoint, highlight: false },
  ]

  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
          Contract Addresses
        </h3>
        <div className="space-y-3 text-sm">
          {addressList.map((item, index) => (
            <div
              key={item.label}
              className="flex justify-between items-center py-2 -mx-4 px-4 rounded"
              style={{
                borderBottom:
                  index < addressList.length - 1 ? '1px solid rgb(var(--border))' : 'none',
                backgroundColor: item.highlight ? 'rgb(var(--success) / 0.1)' : 'transparent',
              }}
            >
              <span
                className={item.highlight ? 'font-medium' : ''}
                style={{
                  color: item.highlight ? 'rgb(var(--success))' : 'rgb(var(--muted-foreground))',
                }}
              >
                {item.label}
              </span>
              <span
                className="font-mono"
                style={{ color: item.highlight ? 'rgb(var(--success))' : 'rgb(var(--foreground))' }}
              >
                {formatAddress(item.address, 6)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
