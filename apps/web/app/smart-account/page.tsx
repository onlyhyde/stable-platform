'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import {
  Card,
  CardContent,
  ConnectWalletCard,
  InfoBanner,
  PageHeader,
  useToast,
} from '@/components/common'
import {
  AccountStatusCard,
  AuthorizationDetailsCard,
  ContractAddressesCard,
  FeatureComparisonCard,
  PrivateKeyCard,
  RevokeCard,
  SigningMethodCard,
  UpgradeCard,
} from '@/components/smart-account'
import { useSmartAccount, useWallet } from '@/hooks'
import type { SigningMethod, UpgradeResult } from '@/hooks/useSmartAccount'
import { getDelegatePresets } from '@/lib/eip7702'
import { secureKeyStore } from '@/lib/secureKeyStore'
import { sanitizeErrorMessage } from '@/lib/utils'

export default function SmartAccountPage() {
  const { connect, isConnecting, connectors } = useWallet()
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
    upgradeWithStableNet,
    revokeWithStableNet,
    isStableNetWallet,
    refreshStatus,
    clearLastTransaction,
    contracts,
    anvilAccounts,
  } = useSmartAccount()

  const { addToast, updateToast, removeToast } = useToast()

  // State for signing method selection
  const [signingMethod, setSigningMethod] = useState<SigningMethod>('privateKey')

  // State for selected delegate address (synced with chainId)
  const [selectedDelegate, setSelectedDelegate] = useState<Address>(
    contracts.defaultKernelImplementation
  )

  // State for re-delegation mode (change delegate while already smart account)
  const [isRedelegating, setIsRedelegating] = useState(false)

  // Sync selectedDelegate when chainId changes
  useEffect(() => {
    const presets = getDelegatePresets(chainId)
    const defaultAddr = presets.length > 0 ? presets[0].address : contracts.defaultKernelImplementation
    setSelectedDelegate(defaultAddr)
  }, [chainId, contracts.defaultKernelImplementation])

  // SECURITY: Private key stored in SecureKeyStore (XOR-encrypted, auto-clear 60s)
  // Never in React state/ref — invisible to React DevTools
  const [hasPrivateKey, setHasPrivateKey] = useState(false)

  const setPrivateKey = useCallback((value: Hex | '') => {
    if (value) {
      secureKeyStore.store(value)
    } else {
      secureKeyStore.clear()
    }
    setHasPrivateKey(!!value)
  }, [])

  const clearPrivateKey = useCallback(() => {
    secureKeyStore.clear()
    setHasPrivateKey(false)
  }, [])

  // Sync UI when SecureKeyStore auto-clears on timeout
  useEffect(() => {
    secureKeyStore.onClear(() => setHasPrivateKey(false))
    return () => {
      secureKeyStore.onClear(null)
      secureKeyStore.clear()
    }
  }, [])

  // Find matching Anvil account based on connected address
  const matchingAnvilAccount = useMemo(() => {
    if (!address) return null
    return anvilAccounts.find((acc) => acc.address.toLowerCase() === address.toLowerCase())
  }, [address, anvilAccounts])

  // Auto-fill private key if connected to an Anvil account
  const handleAutoFillPrivateKey = () => {
    if (matchingAnvilAccount) {
      setPrivateKey(matchingAnvilAccount.privateKey)
    }
  }

  // Handle upgrade with selected delegate
  const handleUpgrade = async () => {
    // Issue 4: Guard against undefined/null selectedDelegate
    if (!selectedDelegate) {
      addToast({
        type: 'error',
        title: 'No Delegate Selected',
        message: 'Please select a delegate contract address before upgrading.',
      })
      return
    }

    // Issue 3: Clear stale authorization data before new attempt
    clearLastTransaction()

    const toastId = addToast({
      type: 'loading',
      title: 'Upgrading to Smart Account',
      message: 'Signing authorization and sending transaction...',
      persistent: true,
    })

    try {
      let result: UpgradeResult
      if (signingMethod === 'stablenet') {
        result = await upgradeWithStableNet(selectedDelegate)
      } else {
        // SECURITY: Retrieve-and-clear ensures key is wiped immediately after use
        const key = secureKeyStore.retrieveAndClear()
        // Issue 1: Only clear hasPrivateKey after confirming retrieval succeeded
        if (!key) {
          setHasPrivateKey(false)
          removeToast(toastId)
          addToast({
            type: 'error',
            title: 'Key Expired',
            message: 'Private key expired or was already used. Please re-enter.',
          })
          return
        }
        setHasPrivateKey(false)
        result = await upgradeToSmartAccount(key as Hex, selectedDelegate)
      }

      if (result.success) {
        setIsRedelegating(false)
        updateToast(toastId, {
          type: 'success',
          title: 'Upgrade Successful',
          message: 'Your account is now a Smart Account!',
          txHash: result.txHash,
          persistent: false,
        })
      } else {
        updateToast(toastId, {
          type: 'error',
          title: 'Upgrade Failed',
          message: sanitizeErrorMessage(result.error, 'Failed to upgrade account'),
          persistent: false,
        })
      }
    } catch (err) {
      updateToast(toastId, {
        type: 'error',
        title: 'Upgrade Failed',
        message: sanitizeErrorMessage(err, 'Failed to upgrade account'),
        persistent: false,
      })
    }
  }

  // Handle revoke
  const handleRevoke = async () => {
    // Issue 3: Clear stale authorization data before new attempt
    clearLastTransaction()

    const toastId = addToast({
      type: 'loading',
      title: 'Revoking Smart Account',
      message: 'Signing revocation and sending transaction...',
      persistent: true,
    })

    try {
      let result: UpgradeResult
      if (signingMethod === 'stablenet') {
        result = await revokeWithStableNet()
      } else {
        // SECURITY: Retrieve-and-clear ensures key is wiped immediately after use
        const key = secureKeyStore.retrieveAndClear()
        // Issue 1: Only clear hasPrivateKey after confirming retrieval succeeded
        if (!key) {
          setHasPrivateKey(false)
          removeToast(toastId)
          addToast({
            type: 'error',
            title: 'Key Expired',
            message: 'Private key expired or was already used. Please re-enter.',
          })
          return
        }
        setHasPrivateKey(false)
        result = await revokeSmartAccount(key as Hex)
      }

      if (result.success) {
        updateToast(toastId, {
          type: 'success',
          title: 'Revocation Successful',
          message: 'Your account is now a regular EOA again.',
          txHash: result.txHash,
          persistent: false,
        })
      } else {
        updateToast(toastId, {
          type: 'error',
          title: 'Revocation Failed',
          message: sanitizeErrorMessage(result.error, 'Failed to revoke smart account'),
          persistent: false,
        })
      }
    } catch (err) {
      updateToast(toastId, {
        type: 'error',
        title: 'Revocation Failed',
        message: sanitizeErrorMessage(err, 'Failed to revoke smart account'),
        persistent: false,
      })
    }
  }

  // Check if action is allowed
  const canPerformAction = signingMethod === 'stablenet' || hasPrivateKey

  // Show loading while reconnecting
  if (isReconnecting) {
    return (
      <div className="space-y-6">
        <PageHeader title="Smart Account" description="Manage your EIP-7702 Smart Account" />
        <Card>
          <CardContent className="py-12 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4"
              style={{ borderColor: 'rgb(var(--primary))' }}
            />
            <p style={{ color: 'rgb(var(--muted-foreground))' }}>Reconnecting wallet...</p>
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
          connectors={connectors}
        />
      ) : (
        <>
          <AccountStatusCard
            address={address}
            status={status}
            error={error}
            onRefresh={refreshStatus}
          />

          <SigningMethodCard
            signingMethod={signingMethod}
            onSigningMethodChange={setSigningMethod}
            isStableNetWallet={isStableNetWallet}
          />

          {signingMethod === 'privateKey' && (
            <PrivateKeyCard
              hasPrivateKey={hasPrivateKey}
              onPrivateKeyChange={setPrivateKey}
              onClear={clearPrivateKey}
              matchingAnvilAccount={matchingAnvilAccount}
              onAutoFill={handleAutoFillPrivateKey}
              anvilAccounts={anvilAccounts}
            />
          )}

          {/* Issue 6: Show UpgradeCard when not smart account OR when re-delegating */}
          {(!status.isSmartAccount || isRedelegating) ? (
            <UpgradeCard
              chainId={chainId}
              selectedDelegate={selectedDelegate}
              onDelegateChange={setSelectedDelegate}
              onUpgrade={handleUpgrade}
              isUpgrading={isUpgrading}
              isLoading={status.isLoading}
              canPerformAction={canPerformAction}
              isRedelegating={isRedelegating}
              onCancelRedelegate={() => setIsRedelegating(false)}
            />
          ) : (
            <RevokeCard
              onRevoke={handleRevoke}
              isRevoking={isRevoking}
              isLoading={status.isLoading}
              canPerformAction={canPerformAction}
              onChangeDelegate={() => setIsRedelegating(true)}
            />
          )}

          {lastAuthorization && (
            <AuthorizationDetailsCard authorization={lastAuthorization} txHash={lastTxHash} />
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
