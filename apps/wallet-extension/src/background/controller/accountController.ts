import type { Address, Hex } from 'viem'
import { createPublicClient, http } from 'viem'
import { encodeFunctionData, encodePacked, getAddress, keccak256 } from 'viem/utils'
import { KERNEL_FACTORY_ABI as CORE_FACTORY_ABI } from '@stablenet/core'
import type { Account } from '../../types'
import { walletState } from '../state/store'

/**
 * Kernel factory ABI for getAccountAddress view function.
 * Used to compute counterfactual smart account addresses.
 */
const KERNEL_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getAccountAddress',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

/**
 * Account Controller
 * Manages smart accounts and their state
 */
export class AccountController {
  /**
   * Create a new smart account
   */
  async createSmartAccount(
    ownerAddress: Address,
    name?: string,
    factoryAddress?: Address
  ): Promise<Account> {
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw new Error('No network selected')
    }

    const index = BigInt(walletState.getState().accounts.accounts.length)
    const salt = keccak256(encodePacked(['address', 'uint256'], [ownerAddress, index]))
    // initData: the owner address is the minimum initialization data for ECDSA validator
    const initData = encodePacked(['address'], [ownerAddress])

    let address: Address | null = null

    // Primary path: call factory's getAccountAddress(initData, salt) view function
    if (factoryAddress) {
      try {
        const client = createPublicClient({
          transport: http(network.rpcUrl),
        })

        address = await client.readContract({
          address: factoryAddress,
          abi: KERNEL_FACTORY_ABI,
          functionName: 'getAccountAddress',
          args: [initData as Hex, salt as `0x${string}`],
        })
      } catch {
        // Factory not deployed or call failed, fall through to CREATE2 fallback
      }
    }

    // Fallback: local CREATE2 address computation
    if (!address) {
      // CREATE2: keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))
      // When no factory is available, derive a deterministic address from owner + index
      // using a proper hash that includes the full salt context
      const deterministicHash = keccak256(
        encodePacked(
          ['bytes1', 'address', 'bytes32', 'bytes32'],
          [
            '0xff',
            factoryAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
            salt as `0x${string}`,
            keccak256(initData as Hex),
          ]
        )
      )
      address = getAddress(`0x${deterministicHash.slice(26)}`) as Address
    }

    // Compute factoryData for ERC-4337 account deployment (initCode = factory + factoryData)
    const computedFactoryData = factoryAddress
      ? encodeFunctionData({
          abi: CORE_FACTORY_ABI,
          functionName: 'createAccount',
          args: [initData as Hex, salt as `0x${string}`],
        })
      : undefined

    const account: Account = {
      address,
      name: name ?? `Account ${walletState.getState().accounts.accounts.length + 1}`,
      type: 'smart',
      isDeployed: false,
      factoryAddress: factoryAddress,
      factoryData: computedFactoryData as `0x${string}` | undefined,
      ownerAddress: ownerAddress,
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
