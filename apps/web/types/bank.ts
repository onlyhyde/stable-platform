// ============================================================================
// Bank Account Types
// ============================================================================

export type BankAccountStatus = 'active' | 'frozen' | 'closed'
export type BankAccountType = 'checking' | 'savings'

export interface LinkedBankAccount {
  id: string
  accountNo: string
  accountType: BankAccountType
  ownerName: string
  linkedAt: number
  lastSynced?: number
  balance?: number
}

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
