'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { createWalletClient, http, type Chain } from 'viem'
import type { Address, Hex, SignedAuthorization as ViemSignedAuthorization } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil, sepolia, mainnet } from 'viem/chains'
import { wagmiConfig } from '@/lib/wagmi'
import {
  isDelegatedAccount,
  extractDelegateAddress,
  getDelegatePresets,
  ZERO_ADDRESS,
} from '@/lib/eip7702'

// Contract addresses (local devnet) - can be overridden by user selection
const DEFAULT_KERNEL_IMPLEMENTATION = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as const
const ECDSA_VALIDATOR = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as const
const KERNEL_FACTORY = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as const
const ENTRY_POINT = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as const

// Anvil default test accounts (publicly known private keys for testing)
export const ANVIL_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address,
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as Hex,
  },
] as const

// Smart Account status
export interface SmartAccountStatus {
  isSmartAccount: boolean
  implementation: Address | null
  code: Hex | null
  isLoading: boolean
}

// Authorization info for display
export interface AuthorizationInfo {
  chainId: number
  contractAddress: Address
  nonce: number
}

// Upgrade result
export interface UpgradeResult {
  success: boolean
  txHash?: Hex
  authorization?: AuthorizationInfo
  error?: string
}

// Signing method for EIP-7702 authorization
export type SigningMethod = 'privateKey' | 'stablenet'

// Get chain configuration based on chainId
function getChainConfig(chainId: number): Chain {
  switch (chainId) {
    case 31337:
      return {
        ...anvil,
        rpcUrls: {
          default: { http: ['http://localhost:8545'] },
        },
      }
    case 11155111:
      return sepolia
    case 1:
      return mainnet
    default:
      return anvil
  }
}

/**
 * Hook for EIP-7702 Smart Account management
 * Allows EOA to delegate to Smart Account and revoke delegation
 *
 * Signing methods:
 * - privateKey: Direct signing with private key (for development/testing)
 * - stablenet: Native wallet_signAuthorization via StableNet wallet (recommended)
 */
export function useSmartAccount() {
  const { address, isConnected, isReconnecting } = useAccount()
  const chainId = useChainId()

  const [status, setStatus] = useState<SmartAccountStatus>({
    isSmartAccount: false,
    implementation: null,
    code: null,
    isLoading: false,
  })

  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAuthorization, setLastAuthorization] = useState<AuthorizationInfo | null>(null)
  const [lastTxHash, setLastTxHash] = useState<Hex | null>(null)

  // Get wagmi wallet client for MetaMask/StableNet signing
  const { data: wagmiWalletClient } = useWalletClient()

  // Check if connected wallet is StableNet (supports wallet_signAuthorization)
  const isStableNetWallet = Boolean(
    wagmiWalletClient?.transport &&
    (wagmiWalletClient as unknown as { transport?: { isStableNet?: boolean } })?.transport?.isStableNet
  )

  // Get default delegate address for current chain
  const getDefaultDelegateAddress = useCallback((): Address => {
    const presets = getDelegatePresets(chainId)
    return presets.length > 0 ? presets[0].address : DEFAULT_KERNEL_IMPLEMENTATION
  }, [chainId])

  // Check if address has code (is smart account)
  const checkSmartAccountStatus = useCallback(async () => {
    if (!address || !isConnected) {
      setStatus({
        isSmartAccount: false,
        implementation: null,
        code: null,
        isLoading: false,
      })
      return
    }

    try {
      setStatus((prev) => ({ ...prev, isLoading: true }))

      const publicClient = getPublicClient(wagmiConfig, { chainId })

      if (!publicClient) {
        throw new Error('Public client not available')
      }

      const code = await publicClient.getCode({ address })

      const hasCode = isDelegatedAccount(code)
      const implementation = extractDelegateAddress(code)

      setStatus({
        isSmartAccount: hasCode,
        implementation,
        code: code || null,
        isLoading: false,
      })
    } catch {
      setStatus({
        isSmartAccount: false,
        implementation: null,
        code: null,
        isLoading: false,
      })
    }
  }, [address, isConnected, chainId])

  // Check status when connected
  useEffect(() => {
    if (isConnected && !isReconnecting && address) {
      checkSmartAccountStatus()
    }
  }, [isConnected, isReconnecting, address, checkSmartAccountStatus])

  /**
   * Upgrade EOA to Smart Account using EIP-7702
   * @param privateKey - Private key for signing authorization
   * @param delegateAddress - Smart contract address to delegate to
   */
  const upgradeToSmartAccount = useCallback(
    async (privateKey: Hex, delegateAddress?: Address): Promise<UpgradeResult> => {
      if (!isConnected || !address) {
        setError('Wallet not connected')
        return { success: false, error: 'Wallet not connected' }
      }

      if (status.isSmartAccount) {
        setError('Already a smart account')
        return { success: false, error: 'Already a smart account' }
      }

      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        setError('Invalid private key format')
        return { success: false, error: 'Invalid private key format' }
      }

      const targetDelegate = delegateAddress || getDefaultDelegateAddress()

      setIsUpgrading(true)
      setError(null)

      try {
        const account = privateKeyToAccount(privateKey)

        if (account.address.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            `Private key mismatch. Expected: ${address}, Got: ${account.address}`
          )
        }

        const chain = getChainConfig(chainId)
        const publicClient = getPublicClient(wagmiConfig, { chainId })

        if (!publicClient) {
          throw new Error('Public client not available')
        }

        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(),
        })

        const nonce = await publicClient.getTransactionCount({ address })

        const authorization = await walletClient.signAuthorization({
          contractAddress: targetDelegate,
        })

        const authInfo: AuthorizationInfo = {
          chainId,
          contractAddress: targetDelegate,
          nonce: Number(nonce),
        }
        setLastAuthorization(authInfo)

        const hash = await walletClient.sendTransaction({
          to: address,
          data: '0x',
          authorizationList: [authorization],
        })

        setLastTxHash(hash)

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          await checkSmartAccountStatus()
          return { success: true, txHash: hash, authorization: authInfo }
        }

        throw new Error('Transaction failed')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upgrade'
        setError(errorMessage.split('\n')[0])
        return { success: false, error: errorMessage }
      } finally {
        setIsUpgrading(false)
      }
    },
    [isConnected, address, chainId, status.isSmartAccount, getDefaultDelegateAddress, checkSmartAccountStatus]
  )

  /**
   * Upgrade EOA to Smart Account using StableNet wallet's wallet_signAuthorization
   * This is the most secure method as the private key never leaves the wallet.
   *
   * @param delegateAddress - Smart contract address to delegate to
   * @param relayerPrivateKey - Private key of the relayer account (pays gas)
   */
  const upgradeWithStableNet = useCallback(
    async (delegateAddress?: Address, relayerPrivateKey?: Hex): Promise<UpgradeResult> => {
      if (!isConnected || !address) {
        setError('Wallet not connected')
        return { success: false, error: 'Wallet not connected' }
      }

      if (status.isSmartAccount) {
        setError('Already a smart account')
        return { success: false, error: 'Already a smart account' }
      }

      if (!wagmiWalletClient) {
        setError('Wallet client not available')
        return { success: false, error: 'Wallet client not available' }
      }

      const relayerKey = relayerPrivateKey || ANVIL_ACCOUNTS[0].privateKey
      const targetDelegate = delegateAddress || getDefaultDelegateAddress()

      setIsUpgrading(true)
      setError(null)

      try {
        const chain = getChainConfig(chainId)
        const publicClient = getPublicClient(wagmiConfig, { chainId })

        if (!publicClient) {
          throw new Error('Public client not available')
        }

        // Request authorization signature from StableNet wallet
        // Use raw transport request to bypass wagmi's strict typing
        const transport = wagmiWalletClient.transport as { request?: (args: unknown) => Promise<unknown> }
        if (!transport?.request) {
          throw new Error('Wallet transport not available')
        }

        const result = await transport.request({
          method: 'wallet_signAuthorization',
          params: [{
            account: address,
            contractAddress: targetDelegate,
            chainId,
          }],
        }) as {
          signedAuthorization: {
            chainId: bigint
            address: Address
            nonce: bigint
            v: number
            r: Hex
            s: Hex
          }
          authorizationHash: Hex
        }

        const { signedAuthorization } = result

        // Convert to viem-compatible format
        const viemAuthorization: ViemSignedAuthorization = {
          chainId: Number(signedAuthorization.chainId),
          address: signedAuthorization.address,
          nonce: Number(signedAuthorization.nonce),
          r: signedAuthorization.r,
          s: signedAuthorization.s,
          v: BigInt(signedAuthorization.v === 0 ? 27 : signedAuthorization.v === 1 ? 28 : signedAuthorization.v),
        }

        const authInfo: AuthorizationInfo = {
          chainId,
          contractAddress: targetDelegate,
          nonce: Number(signedAuthorization.nonce),
        }
        setLastAuthorization(authInfo)

        // Create relayer wallet client to send the transaction
        const relayerAccount = privateKeyToAccount(relayerKey)
        const relayerWalletClient = createWalletClient({
          account: relayerAccount,
          chain,
          transport: http(),
        })

        // Send EIP-7702 transaction with the authorization
        const hash = await relayerWalletClient.sendTransaction({
          to: address,
          data: '0x',
          authorizationList: [viemAuthorization],
        })

        setLastTxHash(hash)

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          await checkSmartAccountStatus()
          return { success: true, txHash: hash, authorization: authInfo }
        }

        throw new Error('Transaction failed')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upgrade with StableNet'
        setError(errorMessage.split('\n')[0])
        return { success: false, error: errorMessage }
      } finally {
        setIsUpgrading(false)
      }
    },
    [isConnected, address, chainId, status.isSmartAccount, wagmiWalletClient, getDefaultDelegateAddress, checkSmartAccountStatus]
  )

  /**
   * Revoke Smart Account delegation using StableNet wallet's wallet_signAuthorization
   * @param relayerPrivateKey - Private key of the relayer account (pays gas)
   */
  const revokeWithStableNet = useCallback(
    async (relayerPrivateKey?: Hex): Promise<UpgradeResult> => {
      if (!isConnected || !address) {
        setError('Wallet not connected')
        return { success: false, error: 'Wallet not connected' }
      }

      if (!status.isSmartAccount) {
        setError('Not a smart account')
        return { success: false, error: 'Not a smart account' }
      }

      if (!wagmiWalletClient) {
        setError('Wallet client not available')
        return { success: false, error: 'Wallet client not available' }
      }

      const relayerKey = relayerPrivateKey || ANVIL_ACCOUNTS[0].privateKey

      setIsRevoking(true)
      setError(null)

      try {
        const chain = getChainConfig(chainId)
        const publicClient = getPublicClient(wagmiConfig, { chainId })

        if (!publicClient) {
          throw new Error('Public client not available')
        }

        // Request revocation signature from StableNet wallet
        // Use raw transport request to bypass wagmi's strict typing
        const transport = wagmiWalletClient.transport as { request?: (args: unknown) => Promise<unknown> }
        if (!transport?.request) {
          throw new Error('Wallet transport not available')
        }

        const result = await transport.request({
          method: 'wallet_signAuthorization',
          params: [{
            account: address,
            contractAddress: ZERO_ADDRESS,
            chainId,
          }],
        }) as {
          signedAuthorization: {
            chainId: bigint
            address: Address
            nonce: bigint
            v: number
            r: Hex
            s: Hex
          }
          authorizationHash: Hex
        }

        const { signedAuthorization } = result

        const viemAuthorization: ViemSignedAuthorization = {
          chainId: Number(signedAuthorization.chainId),
          address: signedAuthorization.address,
          nonce: Number(signedAuthorization.nonce),
          r: signedAuthorization.r,
          s: signedAuthorization.s,
          v: BigInt(signedAuthorization.v === 0 ? 27 : signedAuthorization.v === 1 ? 28 : signedAuthorization.v),
        }

        const authInfo: AuthorizationInfo = {
          chainId,
          contractAddress: ZERO_ADDRESS,
          nonce: Number(signedAuthorization.nonce),
        }
        setLastAuthorization(authInfo)

        const relayerAccount = privateKeyToAccount(relayerKey)
        const relayerWalletClient = createWalletClient({
          account: relayerAccount,
          chain,
          transport: http(),
        })

        const hash = await relayerWalletClient.sendTransaction({
          to: address,
          data: '0x',
          authorizationList: [viemAuthorization],
        })

        setLastTxHash(hash)

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          await checkSmartAccountStatus()
          return { success: true, txHash: hash, authorization: authInfo }
        }

        throw new Error('Revocation failed')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to revoke with StableNet'
        setError(errorMessage.split('\n')[0])
        return { success: false, error: errorMessage }
      } finally {
        setIsRevoking(false)
      }
    },
    [isConnected, address, chainId, status.isSmartAccount, wagmiWalletClient, checkSmartAccountStatus]
  )

  /**
   * Revoke Smart Account delegation
   * @param privateKey - Private key for signing authorization
   */
  const revokeSmartAccount = useCallback(
    async (privateKey: Hex): Promise<UpgradeResult> => {
      if (!isConnected || !address) {
        setError('Wallet not connected')
        return { success: false, error: 'Wallet not connected' }
      }

      if (!status.isSmartAccount) {
        setError('Not a smart account')
        return { success: false, error: 'Not a smart account' }
      }

      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        setError('Invalid private key format')
        return { success: false, error: 'Invalid private key format' }
      }

      setIsRevoking(true)
      setError(null)

      try {
        const account = privateKeyToAccount(privateKey)

        if (account.address.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            `Private key mismatch. Expected: ${address}, Got: ${account.address}`
          )
        }

        const chain = getChainConfig(chainId)
        const publicClient = getPublicClient(wagmiConfig, { chainId })

        if (!publicClient) {
          throw new Error('Public client not available')
        }

        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(),
        })

        const nonce = await publicClient.getTransactionCount({ address })

        const authorization = await walletClient.signAuthorization({
          contractAddress: ZERO_ADDRESS,
        })

        const authInfo: AuthorizationInfo = {
          chainId,
          contractAddress: ZERO_ADDRESS,
          nonce: Number(nonce),
        }
        setLastAuthorization(authInfo)

        const hash = await walletClient.sendTransaction({
          to: address,
          data: '0x',
          authorizationList: [authorization],
        })

        setLastTxHash(hash)

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'success') {
          await checkSmartAccountStatus()
          return { success: true, txHash: hash, authorization: authInfo }
        }

        throw new Error('Revocation failed')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to revoke'
        setError(errorMessage.split('\n')[0])
        return { success: false, error: errorMessage }
      } finally {
        setIsRevoking(false)
      }
    },
    [isConnected, address, chainId, status.isSmartAccount, checkSmartAccountStatus]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    // Status
    status,
    isConnected,
    isReconnecting,
    address,
    chainId,
    error,

    // Loading states
    isUpgrading,
    isRevoking,

    // Last transaction info
    lastAuthorization,
    lastTxHash,

    // Actions - Private Key method
    upgradeToSmartAccount,
    revokeSmartAccount,

    // Actions - StableNet wallet_signAuthorization method
    upgradeWithStableNet,
    revokeWithStableNet,
    isStableNetWallet,

    // Common actions
    refreshStatus: checkSmartAccountStatus,
    clearError,

    // Helpers
    getDefaultDelegateAddress,

    // Contract addresses
    contracts: {
      defaultKernelImplementation: DEFAULT_KERNEL_IMPLEMENTATION,
      ecdsaValidator: ECDSA_VALIDATOR,
      kernelFactory: KERNEL_FACTORY,
      entryPoint: ENTRY_POINT,
    },

    // Anvil test accounts
    anvilAccounts: ANVIL_ACCOUNTS,
  }
}
