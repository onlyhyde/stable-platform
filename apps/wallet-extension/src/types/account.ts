import type { Address } from 'viem'

/**
 * Account types
 */

export type AccountType = 'smart' | 'eoa'

export interface Account {
  address: Address
  name: string
  type: AccountType
  isDeployed?: boolean
  createdAt?: number
}

export interface AccountState {
  accounts: Account[]
  selectedAccount: Address | null
}
