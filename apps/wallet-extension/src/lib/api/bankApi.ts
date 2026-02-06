import { getApiConfig } from '../../config'
import type {
  BankAccount,
  BankAccountListResponse,
  BankTransfer,
  BankTransferListResponse,
  CreateBankAccountRequest,
  CreateBankAccountResponse,
  FreezeAccountRequest,
  TransferFundsRequest,
  TransferFundsResponse,
} from '../../types'
import { BaseApiClient } from './baseApi'

/**
 * Bank Simulator API Client
 * Provides banking functionality for fiat on/off ramp
 */

export class BankApiClient extends BaseApiClient {
  constructor(baseUrl: string = getApiConfig().bankApiUrl) {
    super(baseUrl)
  }

  /**
   * Create a new bank account
   */
  async createAccount(data: CreateBankAccountRequest): Promise<BankAccount> {
    const response = await this.post<CreateBankAccountResponse>('/accounts', data)
    return response.account
  }

  /**
   * Get all bank accounts
   */
  async getAccounts(): Promise<BankAccount[]> {
    const response = await this.get<BankAccountListResponse>('/accounts')
    return response.accounts
  }

  /**
   * Get a specific bank account
   */
  async getAccount(accountNo: string): Promise<BankAccount> {
    return this.get<BankAccount>(`/accounts/${accountNo}`)
  }

  /**
   * Get account balance
   */
  async getBalance(accountNo: string): Promise<number> {
    const account = await this.getAccount(accountNo)
    return account.balance
  }

  /**
   * Transfer funds between accounts
   */
  async transfer(data: TransferFundsRequest): Promise<BankTransfer> {
    const response = await this.post<TransferFundsResponse>('/transfers', data)
    return response.transfer
  }

  /**
   * Get transfer history for an account
   */
  async getTransferHistory(accountNo: string): Promise<BankTransfer[]> {
    const response = await this.get<BankTransferListResponse>(`/accounts/${accountNo}/transfers`)
    return response.transfers
  }

  /**
   * Get a specific transfer
   */
  async getTransfer(transferId: string): Promise<BankTransfer> {
    return this.get<BankTransfer>(`/transfers/${transferId}`)
  }

  /**
   * Freeze an account
   */
  async freezeAccount(accountNo: string, data?: FreezeAccountRequest): Promise<BankAccount> {
    return this.post<BankAccount>(`/accounts/${accountNo}/freeze`, data)
  }

  /**
   * Unfreeze an account
   */
  async unfreezeAccount(accountNo: string): Promise<BankAccount> {
    return this.post<BankAccount>(`/accounts/${accountNo}/unfreeze`)
  }

  /**
   * Delete an account (close)
   */
  async closeAccount(accountNo: string): Promise<void> {
    await this.delete<void>(`/accounts/${accountNo}`)
  }

  /**
   * Deposit funds to account (simulator only)
   */
  async deposit(accountNo: string, amount: number): Promise<BankAccount> {
    return this.post<BankAccount>(`/accounts/${accountNo}/deposit`, { amount })
  }

  /**
   * Withdraw funds from account (simulator only)
   */
  async withdraw(accountNo: string, amount: number): Promise<BankAccount> {
    return this.post<BankAccount>(`/accounts/${accountNo}/withdraw`, { amount })
  }
}

// Singleton instance with default URL
export const bankApi = new BankApiClient()

/**
 * Create a new bank API client with custom URL
 */
export function createBankApi(baseUrl: string): BankApiClient {
  return new BankApiClient(baseUrl)
}
