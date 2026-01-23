import type { Address } from 'viem'
import type { KeyringType } from './keyring'

/**
 * Account types
 */

export type AccountType = 'smart' | 'eoa'

export interface Account {
  address: Address
  name: string
  type: AccountType
  keyringType?: KeyringType
  index?: number
  isDeployed?: boolean
  createdAt?: number
}

export interface AccountState {
  accounts: Account[]
  selectedAccount: Address | null
}
