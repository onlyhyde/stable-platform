/**
 * Bank simulator types
 */

export type BankAccountStatus = 'active' | 'frozen' | 'closed'
export type BankAccountType = 'checking' | 'savings'

/**
 * Bank account
 */
export interface BankAccount {
  accountNo: string
  accountType: BankAccountType
  status: BankAccountStatus
  balance: number
  currency: string
  ownerName: string
  ownerEmail?: string
  createdAt: string
  updatedAt: string
}

/**
 * Bank transfer
 */
export interface BankTransfer {
  id: string
  fromAccount: string
  toAccount: string
  amount: number
  currency: string
  description?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  failureReason?: string
}

/**
 * Create bank account request
 */
export interface CreateBankAccountRequest {
  accountType: BankAccountType
  ownerName: string
  ownerEmail?: string
  initialDeposit?: number
}

/**
 * Create bank account response
 */
export interface CreateBankAccountResponse {
  account: BankAccount
}

/**
 * Transfer funds request
 */
export interface TransferFundsRequest {
  fromAccount: string
  toAccount: string
  amount: number
  description?: string
}

/**
 * Transfer funds response
 */
export interface TransferFundsResponse {
  transfer: BankTransfer
}

/**
 * Freeze account request
 */
export interface FreezeAccountRequest {
  reason?: string
}

/**
 * Bank account list response
 */
export interface BankAccountListResponse {
  accounts: BankAccount[]
  total: number
}

/**
 * Bank transfer list response
 */
export interface BankTransferListResponse {
  transfers: BankTransfer[]
  total: number
}

/**
 * Bank linked account (stored in wallet)
 */
export interface LinkedBankAccount {
  id: string
  accountNo: string
  accountType: BankAccountType
  ownerName: string
  linkedAt: number
  lastSynced?: number
  balance?: number
}

/**
 * Bank API error
 */
export interface BankApiError {
  code: string
  message: string
  details?: unknown
}
