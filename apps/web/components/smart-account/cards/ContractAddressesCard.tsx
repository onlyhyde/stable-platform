'use client'

import { Card, CardContent } from '@/components/common'
import { formatAddress } from '@/lib/utils'
import type { Address } from 'viem'

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
  isSmartAccount
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Addresses</h3>
        <div className="space-y-3 text-sm">
          {addressList.map((item, index) => (
            <div
              key={item.label}
              className={`flex justify-between items-center py-2 ${
                index < addressList.length - 1 ? 'border-b border-gray-100' : ''
              } ${item.highlight ? 'bg-green-50 -mx-4 px-4 rounded' : ''}`}
            >
              <span className={item.highlight ? 'text-green-700 font-medium' : 'text-gray-500'}>
                {item.label}
              </span>
              <span className={`font-mono ${item.highlight ? 'text-green-800' : 'text-gray-900'}`}>
                {formatAddress(item.address, 6)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
