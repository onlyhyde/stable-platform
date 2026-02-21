/**
 * Chain 8283 (StableNet) precompiled / system contract addresses
 *
 * These are embedded in the chain genesis and do NOT change with deployments.
 * Source: go-stablenet/systemcontracts
 */

import type { Address } from 'viem'
import type { PrecompiledAddresses, SystemContractAddresses, SystemPrecompileAddresses } from './types'

// ─── System Contracts (governance, native coin) ─────────────────────────────

/** NativeCoinAdapter - WKRC fiat token adapter (supply, minting, metadata) */
export const NATIVE_COIN_ADAPTER_ADDRESS: Address = '0x0000000000000000000000000000000000001000'

/** GovValidator - WBFT validator set governance (validators, BLS keys, gas tip) */
export const GOV_VALIDATOR_ADDRESS: Address = '0x0000000000000000000000000000000000001001'

/** GovMasterMinter - Master minter governance (minter registration, allowances) */
export const GOV_MASTER_MINTER_ADDRESS: Address = '0x0000000000000000000000000000000000001002'

/** GovMinter - Minter governance (mint/burn operations, deposits) */
export const GOV_MINTER_ADDRESS: Address = '0x0000000000000000000000000000000000001003'

/** GovCouncil - Council governance (blacklist, authorized accounts) */
export const GOV_COUNCIL_ADDRESS: Address = '0x0000000000000000000000000000000000001004'

// ─── System Precompiles (low-level chain primitives) ────────────────────────

/** BLS PoP Precompile - BLS signature verification for WBFT consensus */
export const BLS_POP_PRECOMPILE_ADDRESS: Address = '0x0000000000000000000000000000000000B00001'

/** NativeCoinManager - Native coin management */
export const NATIVE_COIN_MANAGER_ADDRESS: Address = '0x0000000000000000000000000000000000B00002'

/** AccountManager - Account management */
export const ACCOUNT_MANAGER_ADDRESS: Address = '0x0000000000000000000000000000000000B00003'

// ─── Grouped constants ──────────────────────────────────────────────────────

export const SYSTEM_CONTRACTS: SystemContractAddresses = {
  nativeCoinAdapter: NATIVE_COIN_ADAPTER_ADDRESS,
  govValidator: GOV_VALIDATOR_ADDRESS,
  govMasterMinter: GOV_MASTER_MINTER_ADDRESS,
  govMinter: GOV_MINTER_ADDRESS,
  govCouncil: GOV_COUNCIL_ADDRESS,
} as const

export const SYSTEM_PRECOMPILES: SystemPrecompileAddresses = {
  blsPopPrecompile: BLS_POP_PRECOMPILE_ADDRESS,
  nativeCoinManager: NATIVE_COIN_MANAGER_ADDRESS,
  accountManager: ACCOUNT_MANAGER_ADDRESS,
} as const

export const PRECOMPILED_ADDRESSES: PrecompiledAddresses = {
  systemContracts: SYSTEM_CONTRACTS,
  systemPrecompiles: SYSTEM_PRECOMPILES,
} as const

/**
 * Chain ID → precompiled addresses mapping.
 * Only chain 8283 has precompiles; other chains return undefined.
 */
export const CHAIN_PRECOMPILES: Record<number, PrecompiledAddresses> = {
  8283: PRECOMPILED_ADDRESSES,
}
