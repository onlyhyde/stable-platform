import type { Address, Hex } from 'viem'

/**
 * Keyring types for key management
 */

export type KeyringType = 'hd' | 'simple' | 'hardware'

export interface KeyringAccount {
  address: Address
  type: KeyringType
  index?: number // HD derivation index
  path?: string // BIP44 path
}

export interface HDKeyringState {
  type: 'hd'
  mnemonic?: string // Only when unlocked
  hdPath: string
  accounts: Address[]
  numberOfAccounts: number
}

export interface SimpleKeyringState {
  type: 'simple'
  privateKeys?: Hex[] // Only when unlocked
  accounts: Address[]
}

export type KeyringState = HDKeyringState | SimpleKeyringState

/**
 * Encrypted vault structure
 */
export interface EncryptedVault {
  version: number
  cipher: 'aes-256-gcm'
  ciphertext: string
  iv: string
  salt: string
  iterations: number
  tag: string
}

/**
 * Vault data (decrypted)
 */
export interface VaultData {
  keyrings: SerializedKeyring[]
  selectedAddress?: Address
}

/**
 * Serialized keyring for storage
 */
export interface SerializedKeyring {
  type: KeyringType
  data: HDKeyringData | SimpleKeyringData
}

export interface HDKeyringData {
  mnemonic: string
  hdPath: string
  numberOfAccounts: number
}

export interface SimpleKeyringData {
  privateKeys: Hex[]
}

/**
 * Keyring controller state
 */
export interface KeyringControllerState {
  isUnlocked: boolean
  isInitialized: boolean
  accounts: KeyringAccount[]
  selectedAddress: Address | null
}

/**
 * Keyring controller events
 */
export type KeyringEvent =
  | { type: 'lock' }
  | { type: 'unlock' }
  | { type: 'accountAdded'; account: KeyringAccount }
  | { type: 'accountRemoved'; address: Address }
  | { type: 'selectedAccountChanged'; address: Address }

/**
 * Signing request types
 */
export interface SigningRequest {
  id: string
  type: 'personal_sign' | 'eth_signTypedData_v4' | 'eth_sendTransaction'
  origin: string
  address: Address
  data: unknown
  timestamp: number
}

export interface PersonalSignRequest extends SigningRequest {
  type: 'personal_sign'
  data: {
    message: Hex
  }
}

export interface TypedDataSignRequest extends SigningRequest {
  type: 'eth_signTypedData_v4'
  data: {
    typedData: unknown
  }
}

export interface TransactionSignRequest extends SigningRequest {
  type: 'eth_sendTransaction'
  data: {
    to: Address
    value: bigint
    data?: Hex
    gas?: bigint
    gasPrice?: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
  }
}
