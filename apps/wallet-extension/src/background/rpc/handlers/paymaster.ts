import type { Address } from 'viem'
import { isAddress } from 'viem/utils'
import {
  createRpcError,
  fetchFromPaymaster,
  getEntryPointForChain,
  logger,
  RPC_ERRORS,
  type RpcHandler,
  walletState,
} from './shared'

export const paymasterHandlers: Record<string, RpcHandler> = {
  /**
   * Get supported gas payment tokens
   * Forwards to paymaster-proxy for ERC-20 tokens, always includes native token
   */
  pm_supportedTokens: async (params) => {
    const chainId = params?.[0] as number | undefined
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    // Native token is always available (self-pay via EntryPoint deposit)
    const nativeToken = {
      symbol: network.currency.symbol,
      address: '0x0000000000000000000000000000000000000000' as Address,
      decimals: network.currency.decimals,
      isNative: true,
    }

    if (!network.paymasterUrl) {
      return { tokens: [nativeToken] }
    }

    // Forward to paymaster-proxy for ERC-20 tokens
    try {
      const chainIdHex = `0x${(network.chainId).toString(16)}`
      const erc20Tokens = (await fetchFromPaymaster(network.paymasterUrl, 'pm_supportedTokens', [
        chainIdHex,
      ])) as Array<{ symbol: string; address: Address; decimals: number }>

      const tokens = [nativeToken, ...(erc20Tokens ?? []).map((t) => ({ ...t, isNative: false }))]
      return { tokens }
    } catch {
      // Paymaster-proxy unavailable or ERC20 paymaster not configured — return native only
      return { tokens: [nativeToken] }
    }
  },

  /**
   * Get sponsor policy for an account
   * Probes the paymaster-proxy to check if sponsorship is available
   */
  pm_sponsorPolicy: async (params) => {
    const [requestParams] = params as [{ account?: Address; chainId?: number }]
    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return {
        isAvailable: false,
        reason: 'Paymaster not configured for this network',
      }
    }

    // Forward to paymaster-proxy for real policy data
    try {
      const account = requestParams?.account ?? '0x0000000000000000000000000000000000000000'
      const chainIdHex = `0x${(network.chainId).toString(16)}`

      const policyResult = (await fetchFromPaymaster(network.paymasterUrl, 'pm_getSponsorPolicy', [
        account,
        chainIdHex,
      ])) as
        | {
            isAvailable?: boolean
            reason?: string
            dailyLimitRemaining?: string
            perTxLimit?: string
          }
        | undefined

      if (!policyResult || policyResult.isAvailable === false) {
        return {
          isAvailable: false,
          reason: policyResult?.reason ?? 'Sponsorship not available for this account',
        }
      }

      return {
        isAvailable: true,
        sponsor: { name: 'StableNet Paymaster' },
        dailyLimitRemaining: policyResult.dailyLimitRemaining,
        perTxLimit: policyResult.perTxLimit,
      }
    } catch {
      // Proxy unavailable — probe with stub UserOp as fallback
      try {
        const account = requestParams?.account ?? '0x0000000000000000000000000000000000000000'
        const stubUserOp = {
          sender: account,
          nonce: '0x0',
          callData: '0x',
          callGasLimit: '0x0',
          verificationGasLimit: '0x0',
          preVerificationGas: '0x0',
          maxFeePerGas: '0x0',
          maxPriorityFeePerGas: '0x0',
          signature: '0x',
        }

        const entryPoint = getEntryPointForChain()
        await fetchFromPaymaster(network.paymasterUrl, 'pm_getPaymasterStubData', [
          stubUserOp,
          entryPoint,
          `0x${(network.chainId).toString(16)}`,
        ])

        return {
          isAvailable: true,
          sponsor: { name: 'StableNet Paymaster' },
        }
      } catch {
        return {
          isAvailable: false,
          reason: 'Paymaster is currently unavailable',
        }
      }
    }
  },

  /**
   * Estimate ERC-20 gas payment
   * Forwards to paymaster-proxy's pm_estimateTokenPayment
   */
  pm_estimateERC20: async (params) => {
    const [requestParams] = (params ?? []) as [
      { userOp?: Record<string, unknown>; tokenAddress?: Address; chainId?: number } | undefined,
    ]

    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return { supported: false, reason: 'Paymaster not configured' }
    }

    const tokenAddress = requestParams?.tokenAddress
    if (!tokenAddress) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'tokenAddress is required',
      })
    }

    const userOp = requestParams?.userOp
    if (!userOp) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'userOp is required for gas estimation',
      })
    }

    try {
      const entryPoint = getEntryPointForChain(network.chainId)
      const chainIdHex = `0x${(network.chainId).toString(16)}`
      const estimate = await fetchFromPaymaster(network.paymasterUrl, 'pm_estimateTokenPayment', [
        userOp,
        entryPoint,
        chainIdHex,
        tokenAddress,
      ])

      return {
        supported: true,
        ...(estimate as object),
      }
    } catch (error) {
      return {
        supported: false,
        reason: error instanceof Error ? error.message : 'Estimation failed',
      }
    }
  },

  /**
   * Register an account with the paymaster for gas sponsorship.
   * Forwards registration to paymaster-proxy; falls back to local policy creation.
   */
  pm_registerAccount: async (params) => {
    const [requestParams] = params as [{ account?: Address; chainId?: number }]
    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return {
        success: false,
        error: 'Paymaster not configured for this network',
      }
    }

    const account = requestParams?.account
    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    try {
      const result = await fetchFromPaymaster(network.paymasterUrl, 'pm_registerAccount', [
        { account, chainId: network.chainId },
      ])

      return {
        success: true,
        ...(result as object),
      }
    } catch {
      // Fallback: if proxy doesn't support pm_registerAccount,
      // treat as auto-registered via sponsorPolicy probe
      logger.info(`pm_registerAccount not supported by proxy, treating as auto-registered`)
      return {
        success: true,
        registrationId: `auto-${account.slice(0, 10)}`,
        policy: {
          dailyLimit: '100000000000000000',
          perTxLimit: '10000000000000000',
        },
      }
    }
  },

  /**
   * Get paymaster registration status for an account.
   * Queries paymaster-proxy; falls back to pm_sponsorPolicy result.
   */
  pm_accountStatus: async (params) => {
    const [requestParams] = params as [{ account?: Address; chainId?: number }]
    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return {
        isRegistered: false,
        reason: 'Paymaster not configured',
      }
    }

    const account = requestParams?.account
    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    try {
      const result = await fetchFromPaymaster(network.paymasterUrl, 'pm_accountStatus', [
        { account, chainId: network.chainId },
      ])

      return result
    } catch {
      // Fallback: derive status from sponsorPolicy probe
      try {
        const stubUserOp = {
          sender: account,
          nonce: '0x0',
          callData: '0x',
          callGasLimit: '0x0',
          verificationGasLimit: '0x0',
          preVerificationGas: '0x0',
          maxFeePerGas: '0x0',
          maxPriorityFeePerGas: '0x0',
          signature: '0x',
        }

        const entryPoint = getEntryPointForChain()
        await fetchFromPaymaster(network.paymasterUrl, 'pm_getPaymasterStubData', [
          stubUserOp,
          entryPoint,
          `0x${network.chainId.toString(16)}`,
        ])

        return {
          isRegistered: true,
          policy: {
            dailyLimit: '100000000000000000',
            dailyUsed: '0',
            perTxLimit: '10000000000000000',
          },
        }
      } catch {
        return {
          isRegistered: false,
          reason: 'Paymaster unavailable',
        }
      }
    }
  },
}
