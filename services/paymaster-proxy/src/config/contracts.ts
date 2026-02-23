import type { Address } from 'viem'
import { getChainAddresses, isChainSupported } from '@stablenet/contracts'

export interface ResolvedContractAddresses {
  verifying: Address
  erc20: Address
  permit2: Address
  sponsor: Address
  oracle: Address
  permit2Contract: Address
}

/**
 * Resolve contract addresses from @stablenet/contracts for a given chain.
 * Returns null if the chain is not supported.
 */
export function resolveContractAddresses(chainId: number): ResolvedContractAddresses | null {
  if (!isChainSupported(chainId)) return null

  const addrs = getChainAddresses(chainId)
  return {
    verifying: addrs.paymasters.verifyingPaymaster,
    erc20: addrs.paymasters.erc20Paymaster,
    permit2: addrs.paymasters.permit2Paymaster,
    sponsor: addrs.paymasters.sponsorPaymaster,
    oracle: addrs.defi.priceOracle,
    permit2Contract: addrs.defi.permit2,
  }
}
