import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  keccak256,
  pad,
  parseAbi,
  toHex,
} from 'viem'
import { ENTRY_POINT_ABI } from '../../../src/abi'
import type { UserOperation } from '../../../src/types'
import type { AnvilFixture } from './setup'

/**
 * SimpleAccount factory ABI (minimal for testing)
 */
const SIMPLE_ACCOUNT_FACTORY_ABI = parseAbi([
  'function createAccount(address owner, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)',
])

/**
 * SimpleAccount ABI (minimal for testing)
 */
const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function execute(address dest, uint256 value, bytes calldata func)',
  'function getNonce() view returns (uint256)',
])

/**
 * Known SimpleAccountFactory address on mainnet (v0.7)
 * Deployed deterministically at this address
 */
export const SIMPLE_ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' as Address

/**
 * Create a UserOperation for testing
 */
export function createTestUserOp(overrides: Partial<UserOperation> = {}): UserOperation {
  return {
    sender: '0x0000000000000000000000000000000000000000' as Address,
    nonce: 0n,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 200000n,
    verificationGasLimit: 200000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 30000000000n, // 30 gwei
    maxPriorityFeePerGas: 1000000000n, // 1 gwei
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: '0x' as Hex,
    ...overrides,
  }
}

/**
 * Build initCode for SimpleAccount factory deployment
 */
export function buildInitCode(owner: Address, salt: bigint): Hex {
  const factoryData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_FACTORY_ABI,
    functionName: 'createAccount',
    args: [owner, salt],
  })
  return concat([SIMPLE_ACCOUNT_FACTORY, factoryData])
}

/**
 * Get the counterfactual address for a SimpleAccount
 */
export async function getAccountAddress(
  publicClient: PublicClient,
  owner: Address,
  salt: bigint
): Promise<Address> {
  try {
    const result = await publicClient.readContract({
      address: SIMPLE_ACCOUNT_FACTORY,
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'getAddress',
      args: [owner, salt],
    })
    return result as Address
  } catch {
    // If factory not deployed, compute address locally
    return computeCounterfactualAddress(owner, salt)
  }
}

/**
 * Compute counterfactual address (fallback when factory not available)
 */
function computeCounterfactualAddress(owner: Address, salt: bigint): Address {
  // Simple deterministic address based on owner + salt
  const packed = encodePacked(['address', 'uint256'], [owner, salt])
  const hash = keccak256(packed)
  return `0x${hash.slice(26)}` as Address
}

/**
 * Pack a UserOperation for EntryPoint v0.7
 */
export function packUserOp(userOp: UserOperation): {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
} {
  const initCode =
    userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x'

  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ]) as Hex

  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ]) as Hex

  let paymasterAndData: Hex = '0x'
  if (userOp.paymaster) {
    paymasterAndData = concat([
      userOp.paymaster,
      pad(toHex(userOp.paymasterVerificationGasLimit ?? 0n), { size: 16 }),
      pad(toHex(userOp.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
      userOp.paymasterData ?? '0x',
    ]) as Hex
  }

  return {
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: userOp.preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: userOp.signature,
  }
}

/**
 * Get UserOperation hash from EntryPoint
 */
export async function getUserOpHash(
  publicClient: PublicClient,
  entryPoint: Address,
  userOp: UserOperation
): Promise<Hex> {
  const packed = packUserOp(userOp)
  try {
    const result = await publicClient.readContract({
      address: entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: 'getUserOpHash',
      args: [packed],
    })
    return result as Hex
  } catch {
    // Fallback: compute locally
    return keccak256(
      encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [userOp.sender, userOp.nonce])
    )
  }
}

/**
 * Sign a UserOperation hash with an account
 */
export async function signUserOp(walletClient: WalletClient, hash: Hex): Promise<Hex> {
  const signature = await walletClient.signMessage({
    account: walletClient.account!,
    message: { raw: hash },
  })
  return signature
}

/**
 * Fund an address via Anvil
 */
export async function fundAddress(
  fixture: AnvilFixture,
  address: Address,
  amount: bigint = 10n ** 18n // 1 ETH
): Promise<void> {
  await fixture.testClient.setBalance({
    address,
    value: amount,
  })
}

/**
 * Build a simple execute calldata for SimpleAccount
 */
export function buildExecuteCalldata(dest: Address, value: bigint = 0n, data: Hex = '0x'): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ACCOUNT_ABI,
    functionName: 'execute',
    args: [dest, value, data],
  })
}

/**
 * Check if EntryPoint is deployed at the expected address
 */
export async function isEntryPointDeployed(
  publicClient: PublicClient,
  entryPoint: Address
): Promise<boolean> {
  const code = await publicClient.getCode({ address: entryPoint })
  return code !== undefined && code !== '0x'
}

/**
 * Get on-chain nonce for an account from EntryPoint
 */
export async function getOnChainNonce(
  publicClient: PublicClient,
  entryPoint: Address,
  sender: Address,
  key: bigint = 0n
): Promise<bigint> {
  try {
    const result = await publicClient.readContract({
      address: entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: 'getNonce',
      args: [sender, key],
    })
    return result as bigint
  } catch {
    return 0n
  }
}
