'use client'

import { useState, useMemo } from 'react'
import { useSmartAccount, useWallet } from '@/hooks'
import { Card, CardContent, PageHeader, InfoBanner, ConnectWalletCard } from '@/components/common'
import {
  AccountStatusCard,
  PrivateKeyCard,
  UpgradeCard,
  RevokeCard,
  AuthorizationDetailsCard,
  FeatureComparisonCard,
  ContractAddressesCard,
} from '@/components/smart-account'
import { getDelegatePresets } from '@/lib/eip7702'
import type { Address, Hex } from 'viem'

export default function SmartAccountPage() {
  const { connect, isConnecting } = useWallet()
  const {
    status,
    isConnected,
    isReconnecting,
    address,
    chainId,
    isUpgrading,
    isRevoking,
    error,
    lastAuthorization,
    lastTxHash,
    upgradeToSmartAccount,
    revokeSmartAccount,
    refreshStatus,
    contracts,
    anvilAccounts,
  } = useSmartAccount()

  // State for selected delegate address
  const [selectedDelegate, setSelectedDelegate] = useState<Address>(() => {
    const presets = getDelegatePresets(31337)
    return presets.length > 0 ? presets[0].address : contracts.defaultKernelImplementation
  })

  // State for private key (required for EIP-7702 signing)
  const [privateKey, setPrivateKey] = useState<Hex | ''>('')

  // Find matching Anvil account based on connected address
  const matchingAnvilAccount = useMemo(() => {
    if (!address) return null
    return anvilAccounts.find(
      (acc) => acc.address.toLowerCase() === address.toLowerCase()
    )
  }, [address, anvilAccounts])

  // Auto-fill private key if connected to an Anvil account
  const handleAutoFillPrivateKey = () => {
    if (matchingAnvilAccount) {
      setPrivateKey(matchingAnvilAccount.privateKey)
    }
  }

  // Handle upgrade with selected delegate
  const handleUpgrade = () => {
    if (privateKey) {
      upgradeToSmartAccount(privateKey as Hex, selectedDelegate)
    }
  }

  // Handle revoke
  const handleRevoke = () => {
    if (privateKey) {
      revokeSmartAccount(privateKey as Hex)
    }
  }

  // Check if action is allowed (requires private key)
  const canPerformAction = !!privateKey

  // Show loading while reconnecting
  if (isReconnecting) {
    return (
      <div className="space-y-6">
        <PageHeader title="Smart Account" description="Manage your EIP-7702 Smart Account" />
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
            <p className="text-gray-500">Reconnecting wallet...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Smart Account" description="Manage your EIP-7702 Smart Account" />

      <InfoBanner
        title="What is EIP-7702?"
        description="EIP-7702 allows your regular wallet (EOA) to temporarily act as a Smart Account. This enables features like gas sponsorship, batched transactions, and session keys while keeping your private key secure."
        variant="info"
      />

      {!isConnected ? (
        <ConnectWalletCard
          onConnect={connect}
          isConnecting={isConnecting}
          description="Connect your wallet to manage your Smart Account"
        />
      ) : (
        <>
          <AccountStatusCard
            address={address}
            status={status}
            error={error}
            onRefresh={refreshStatus}
          />

          <PrivateKeyCard
            privateKey={privateKey}
            onPrivateKeyChange={setPrivateKey}
            matchingAnvilAccount={matchingAnvilAccount}
            onAutoFill={handleAutoFillPrivateKey}
            anvilAccounts={anvilAccounts}
          />

          {!status.isSmartAccount ? (
            <UpgradeCard
              chainId={chainId}
              selectedDelegate={selectedDelegate}
              onDelegateChange={setSelectedDelegate}
              onUpgrade={handleUpgrade}
              isUpgrading={isUpgrading}
              isLoading={status.isLoading}
              canPerformAction={canPerformAction}
            />
          ) : (
            <RevokeCard
              onRevoke={handleRevoke}
              isRevoking={isRevoking}
              isLoading={status.isLoading}
              canPerformAction={canPerformAction}
            />
          )}

          {lastAuthorization && (
            <AuthorizationDetailsCard
              authorization={lastAuthorization}
              txHash={lastTxHash}
            />
          )}

          <FeatureComparisonCard />

          <ContractAddressesCard
            contracts={contracts}
            currentDelegate={status.implementation}
            selectedDelegate={selectedDelegate}
            isSmartAccount={status.isSmartAccount}
          />
        </>
      )}
    </div>
  )
}
