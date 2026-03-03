import type { Address } from 'viem'
import type { KeyringType } from './keyring'

/**
 * Account types
 */

export type AccountType = 'smart' | 'eoa' | 'delegated'

export interface Account {
  address: Address
  name: string
  type: AccountType
  keyringType?: KeyringType
  index?: number
  /** Delegate contract address (Kernel) for EIP-7702 delegated accounts */
  delegateAddress?: Address
  isDeployed?: boolean
  createdAt?: number
  /** Factory address for account deployment (ERC-4337 initCode) */
  factoryAddress?: Address
  /** Factory calldata (encoded createAccount call) */
  factoryData?: `0x${string}`
  /** Owner EOA address that controls this smart account */
  ownerAddress?: Address
}

export interface AccountState {
  accounts: Account[]
  selectedAccount: Address | null
}
