'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex, SignedAuthorization as ViemSignedAuthorization } from 'viem'
import { type Chain, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil, mainnet, sepolia } from 'viem/chains'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import {
  isChainSupported,
  getEntryPoint,
  getKernel,
  getKernelFactory,
  getEcdsaValidator,
  ENTRY_POINT_ADDRESS,
} from '@stablenet/contracts'
import { getConfigByChainId } from '@/lib/config'
import {
  extractDelegateAddress,
  getDelegatePresets,
  isDelegatedAccount,
  ZERO_ADDRESS,
} from '@/lib/eip7702'
import { wagmiConfig } from '@/lib/wagmi'

// Anvil fallback addresses — used only when chain is not in @stablenet/contracts
const ANVIL_KERNEL_IMPLEMENTATION = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as const
const ANVIL_ECDSA_VALIDATOR = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as const
const ANVIL_KERNEL_FACTORY = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as const
const ANVIL_ENTRY_POINT = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as const

/**
 * Resolve Smart Account contract addresses for a given chain.
 * Uses @stablenet/contracts for supported chains, falls back to Anvil devnet addresses.
 */
export function getSmartAccountAddresses(chainId: number): {
  entryPoint: Address
  kernel: Address
  kernelFactory: Address
  ecdsaValidator: Address
} {
  if (isChainSupported(chainId)) {
    return {
      entryPoint: getEntryPoint(chainId),
      kernel: getKernel(chainId),
      kernelFactory: getKernelFactory(chainId),
      ecdsaValidator: getEcdsaValidator(chainId),
    }
  }

  // Fallback for unsupported chains (Anvil local dev, unknown chains)
  return {
    entryPoint: (chainId === 31337 ? ANVIL_ENTRY_POINT : ENTRY_POINT_ADDRESS) as Address,
    kernel: ANVIL_KERNEL_IMPLEMENTATION as Address,
    kernelFactory: ANVIL_KERNEL_FACTORY as Address,
    ecdsaValidator: ANVIL_ECDSA_VALIDATOR as Address,
  }
}

// Anvil default test accounts — ONLY available in development builds.
// In production, this array is empty and private keys are never bundled.
export const ANVIL_ACCOUNTS: readonly { address: Address; privateKey: Hex }[] =
  process.env.NODE_ENV === 'development'
    ? [
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
      ]
    : []

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
// Uses user's custom RPC settings from Settings page if available
function getChainConfig(chainId: number): Chain {
  // Try to get user's custom RPC settings
  const networkConfig = getConfigByChainId(chainId)
  const customRpcUrl = networkConfig?.rpcUrl

  switch (chainId) {
    case 31337:
      return {
        ...anvil,
        rpcUrls: {
          default: { http: [customRpcUrl || 'http://localhost:8545'] },
        },
      }
    case 8283: // StableNet Local
      return {
        id: 8283,
        name: 'StableNet Local',
        nativeCurrency: { decimals: 18, name: 'Wrapped KRW Coin', symbol: 'WKRC' },
        rpcUrls: {
          default: { http: [customRpcUrl || 'http://127.0.0.1:8501'] },
        },
      }
    case 82830: // StableNet Testnet
      return {
        id: 82830,
        name: 'StableNet Testnet',
        nativeCurrency: { decimals: 18, name: 'Wrapped KRW Coin', symbol: 'WKRC' },
        rpcUrls: {
          default: { http: [customRpcUrl || 'https://rpc.testnet.stablenet.dev'] },
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

  const fetchIdRef = useRef(0)

  // Get wagmi wallet client for MetaMask/StableNet signing
  const { data: wagmiWalletClient } = useWalletClient()

  // Check if connected wallet is StableNet (supports wallet_signAuthorization)
  const isStableNetWallet = Boolean(
    wagmiWalletClient?.transport &&
      typeof wagmiWalletClient.transport === 'object' &&
      'isStableNet' in (wagmiWalletClient.transport as object) &&
      (wagmiWalletClient.transport as Record<string, unknown>).isStableNet === true
  )

  // Resolve contract addresses for current chain
  const contractAddresses = getSmartAccountAddresses(chainId)

  // Get default delegate address for current chain
  const getDefaultDelegateAddress = useCallback((): Address => {
    const presets = getDelegatePresets(chainId)
    return presets.length > 0 ? presets[0].address : contractAddresses.kernel
  }, [chainId, contractAddresses.kernel])

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

    const id = ++fetchIdRef.current

    try {
      setStatus((prev) => ({ ...prev, isLoading: true }))

      const publicClient = getPublicClient(wagmiConfig, { chainId })

      if (!publicClient) {
        throw new Error('Public client not available')
      }

      const code = await publicClient.getCode({ address })

      if (id !== fetchIdRef.current) return

      const hasCode = isDelegatedAccount(code)
      const implementation = extractDelegateAddress(code)

      setStatus({
        isSmartAccount: hasCode,
        implementation,
        code: code || null,
        isLoading: false,
      })
    } catch {
      if (id !== fetchIdRef.current) return
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
          throw new Error(`Private key mismatch. Expected: ${address}, Got: ${account.address}`)
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
    [
      isConnected,
      address,
      chainId,
      status.isSmartAccount,
      getDefaultDelegateAddress,
      checkSmartAccountStatus,
    ]
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

      if (!relayerPrivateKey && ANVIL_ACCOUNTS.length === 0) {
        setError('Relayer private key is required in production')
        return { success: false, error: 'Relayer private key is required in production' }
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
        // Re-validate walletClient after async operations (may disconnect mid-flow)
        if (!wagmiWalletClient) {
          throw new Error('Wallet disconnected during operation')
        }
        const transport = wagmiWalletClient.transport as {
          request?: (args: unknown) => Promise<unknown>
        }
        if (!transport?.request) {
          throw new Error('Wallet transport not available')
        }

        const result = (await transport.request({
          method: 'wallet_signAuthorization',
          params: [
            {
              account: address,
              contractAddress: targetDelegate,
              chainId,
            },
          ],
        })) as {
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
          v: BigInt(
            signedAuthorization.v === 0
              ? 27
              : signedAuthorization.v === 1
                ? 28
                : signedAuthorization.v
          ),
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
    [
      isConnected,
      address,
      chainId,
      status.isSmartAccount,
      wagmiWalletClient,
      getDefaultDelegateAddress,
      checkSmartAccountStatus,
    ]
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

      if (!relayerPrivateKey && ANVIL_ACCOUNTS.length === 0) {
        setError('Relayer private key is required in production')
        return { success: false, error: 'Relayer private key is required in production' }
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
        // Re-validate walletClient after async operations (may disconnect mid-flow)
        if (!wagmiWalletClient) {
          throw new Error('Wallet disconnected during operation')
        }
        const transport = wagmiWalletClient.transport as {
          request?: (args: unknown) => Promise<unknown>
        }
        if (!transport?.request) {
          throw new Error('Wallet transport not available')
        }

        const result = (await transport.request({
          method: 'wallet_signAuthorization',
          params: [
            {
              account: address,
              contractAddress: ZERO_ADDRESS,
              chainId,
            },
          ],
        })) as {
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
          v: BigInt(
            signedAuthorization.v === 0
              ? 27
              : signedAuthorization.v === 1
                ? 28
                : signedAuthorization.v
          ),
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
    [
      isConnected,
      address,
      chainId,
      status.isSmartAccount,
      wagmiWalletClient,
      checkSmartAccountStatus,
    ]
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
          throw new Error(`Private key mismatch. Expected: ${address}, Got: ${account.address}`)
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

    // Contract addresses (chain-aware, from @stablenet/contracts)
    contracts: {
      defaultKernelImplementation: contractAddresses.kernel,
      ecdsaValidator: contractAddresses.ecdsaValidator,
      kernelFactory: contractAddresses.kernelFactory,
      entryPoint: contractAddresses.entryPoint,
    },

    // Anvil test accounts
    anvilAccounts: ANVIL_ACCOUNTS,
  }
}
