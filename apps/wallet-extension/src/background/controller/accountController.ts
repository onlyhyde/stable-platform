import type { Address } from 'viem'
import { createPublicClient, encodePacked, getAddress, http, keccak256 } from 'viem'
import type { Account } from '../../types'
import { walletState } from '../state/store'

/**
 * Account Controller
 * Manages smart accounts and their state
 */
export class AccountController {
  /**
   * Create a new smart account
   */
  async createSmartAccount(ownerAddress: Address, name?: string): Promise<Account> {
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw new Error('No network selected')
    }

    // Calculate counterfactual address
    // This is a simplified version - real implementation would use the factory
    const index = BigInt(walletState.getState().accounts.accounts.length)
    const salt = keccak256(encodePacked(['address', 'uint256'], [ownerAddress, index]))

    // For now, use a deterministic address based on owner and index
    // In production, this would call the factory contract
    const address = getAddress(
      `0x${salt.slice(26)}` // Take last 20 bytes
    ) as Address

    const account: Account = {
      address,
      name: name ?? `Account ${walletState.getState().accounts.accounts.length + 1}`,
      type: 'smart',
      isDeployed: false,
    }

    await walletState.addAccount(account)

    return account
  }

  /**
   * Import an existing smart account
   */
  async importSmartAccount(address: Address, name?: string): Promise<Account> {
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw new Error('No network selected')
    }

    // Check if account already exists
    const existing = walletState
      .getState()
      .accounts.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase())

    if (existing) {
      throw new Error('Account already exists')
    }

    // Check if deployed
    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    const code = await client.getCode({ address })
    const isDeployed = code !== undefined && code !== '0x'

    const account: Account = {
      address: getAddress(address),
      name: name ?? `Imported Account ${walletState.getState().accounts.accounts.length + 1}`,
      type: 'smart',
      isDeployed,
    }

    await walletState.addAccount(account)

    return account
  }

  /**
   * Get account balance
   */
  async getBalance(address: Address): Promise<bigint> {
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw new Error('No network selected')
    }

    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    return client.getBalance({ address })
  }

  /**
   * Check if an account is deployed
   */
  async checkDeploymentStatus(address: Address): Promise<boolean> {
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw new Error('No network selected')
    }

    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    const code = await client.getCode({ address })
    const isDeployed = code !== undefined && code !== '0x'

    // Update state
    const accounts = walletState
      .getState()
      .accounts.accounts.map((a) =>
        a.address.toLowerCase() === address.toLowerCase() ? { ...a, isDeployed } : a
      )

    await walletState.setState({
      accounts: {
        ...walletState.getState().accounts,
        accounts,
      },
    })

    return isDeployed
  }

  /**
   * Select an account
   */
  async selectAccount(address: Address): Promise<void> {
    await walletState.selectAccount(address)
  }

  /**
   * Get current account
   */
  getCurrentAccount(): Account | undefined {
    return walletState.getCurrentAccount()
  }

  /**
   * Get all accounts
   */
  getAccounts(): Account[] {
    return walletState.getState().accounts.accounts
  }

  /**
   * Remove an account
   */
  async removeAccount(address: Address): Promise<void> {
    const state = walletState.getState()
    const accounts = state.accounts.accounts.filter(
      (a) => a.address.toLowerCase() !== address.toLowerCase()
    )

    let selectedAccount = state.accounts.selectedAccount

    // If we removed the selected account, select another one
    if (selectedAccount?.toLowerCase() === address.toLowerCase()) {
      selectedAccount = accounts[0]?.address ?? null
    }

    await walletState.setState({
      accounts: {
        accounts,
        selectedAccount,
      },
    })
  }

  /**
   * Rename an account
   */
  async renameAccount(address: Address, name: string): Promise<void> {
    const accounts = walletState
      .getState()
      .accounts.accounts.map((a) =>
        a.address.toLowerCase() === address.toLowerCase() ? { ...a, name } : a
      )

    await walletState.setState({
      accounts: {
        ...walletState.getState().accounts,
        accounts,
      },
    })
  }
}

// Singleton instance
export const accountController = new AccountController()
