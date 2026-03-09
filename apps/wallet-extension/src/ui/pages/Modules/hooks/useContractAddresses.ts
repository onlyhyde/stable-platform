/**
 * useContractAddresses Hook
 *
 * Provides pre-deployed contract addresses for the currently selected chain,
 * using @stablenet/contracts. Used by module config UIs to auto-populate
 * token, DeFi, and module contract address fields.
 */

import {
  getChainAddresses,
  isChainSupported,
  isZeroAddress,
} from '@stablenet/contracts'
import { MODULE_TYPE } from '@stablenet/core'
import { useMemo } from 'react'
import type { ModuleType } from '@stablenet/core'
import { useSelectedNetwork } from '../../../hooks'

export interface KnownToken {
  symbol: string
  name: string
  address: string
}

export interface KnownContract {
  name: string
  address: string
  description: string
}

export interface KnownModule {
  name: string
  address: string
  type: ModuleType
  description: string
}

export interface ContractAddresses {
  tokens: KnownToken[]
  defi: KnownContract[]
  modules: KnownModule[]
}

/**
 * Returns known token, DeFi, and module contract addresses for the current chain.
 * Returns empty arrays if the chain is not supported.
 */
export function useContractAddresses(): ContractAddresses {
  const network = useSelectedNetwork()

  return useMemo(() => {
    if (!network || !isChainSupported(network.chainId)) {
      return { tokens: [], defi: [], modules: [] }
    }

    const chainId = network.chainId
    const addrs = getChainAddresses(chainId)

    const tokens: KnownToken[] = [
      { symbol: 'USDC', name: 'USD Coin', address: addrs.tokens.usdc },
      { symbol: 'WKRC', name: 'Wrapped KRC', address: addrs.tokens.wkrc },
    ]

    const defi: KnownContract[] = [
      {
        name: 'Lending Pool',
        address: addrs.defi.lendingPool,
        description: 'StableNet DeFi lending protocol',
      },
      {
        name: 'Staking Vault',
        address: addrs.defi.stakingVault,
        description: 'StableNet staking protocol',
      },
      {
        name: 'Swap Router',
        address: addrs.uniswap.swapRouter,
        description: 'Uniswap V3 swap router',
      },
    ]

    // All deployed module addresses from the contracts package
    const allModules: KnownModule[] = [
      {
        name: 'ECDSA Validator',
        address: addrs.validators.ecdsaValidator,
        type: MODULE_TYPE.VALIDATOR,
        description: 'Standard ECDSA signature validation',
      },
      {
        name: 'WebAuthn Validator',
        address: addrs.validators.webAuthnValidator,
        type: MODULE_TYPE.VALIDATOR,
        description: 'Passkey / biometric authentication',
      },
      {
        name: 'MultiSig Validator',
        address: addrs.validators.multiSigValidator,
        type: MODULE_TYPE.VALIDATOR,
        description: 'Multi-signature M-of-N validation',
      },
      {
        name: 'MultiChain Validator',
        address: addrs.validators.multiChainValidator,
        type: MODULE_TYPE.VALIDATOR,
        description: 'Cross-chain signature validation',
      },
      {
        name: 'Session Key Executor',
        address: addrs.executors.sessionKeyExecutor,
        type: MODULE_TYPE.EXECUTOR,
        description: 'Temporary keys with limited permissions',
      },
      {
        name: 'Recurring Payment Executor',
        address: addrs.subscriptions.recurringPaymentExecutor,
        type: MODULE_TYPE.EXECUTOR,
        description: 'Automated recurring payments',
      },
      {
        name: 'Spending Limit Hook',
        address: addrs.hooks.spendingLimitHook,
        type: MODULE_TYPE.HOOK,
        description: 'Limit spending per time period',
      },
      {
        name: 'Token Receiver Fallback',
        address: addrs.fallbacks.tokenReceiverFallback,
        type: MODULE_TYPE.FALLBACK,
        description: 'Handle ERC-777 token callbacks',
      },
      {
        name: 'Flash Loan Fallback',
        address: addrs.fallbacks.flashLoanFallback,
        type: MODULE_TYPE.FALLBACK,
        description: 'Handle flash loan callbacks',
      },
    ].filter((m) => !isZeroAddress(m.address))

    return { tokens, defi, modules: allModules }
  }, [network])
}
