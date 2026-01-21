import type { Address, Hex } from 'viem'
import {
  encodeFunctionData,
  encodeAbiParameters,
  concat,
  pad,
  toHex,
  keccak256,
} from 'viem'
import type {
  UserOperation,
  PackedUserOperation,
  UserOpBuilderOptions,
  ExecutionCall,
} from './types'

/**
 * UserOperation Builder for ERC-4337 v0.7
 */

// EntryPoint v0.7 address
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const

// Default gas values
const DEFAULT_VERIFICATION_GAS_LIMIT = BigInt(100000)
const DEFAULT_CALL_GAS_LIMIT = BigInt(100000)
const DEFAULT_PRE_VERIFICATION_GAS = BigInt(21000)

export class UserOpBuilder {
  private userOp: Partial<UserOperation> = {}
  private entryPoint: Address = ENTRY_POINT_V07

  /**
   * Create a new builder
   */
  static create(): UserOpBuilder {
    return new UserOpBuilder()
  }

  /**
   * Set the sender address
   */
  setSender(sender: Address): this {
    this.userOp.sender = sender
    return this
  }

  /**
   * Set the nonce
   */
  setNonce(nonce: bigint): this {
    this.userOp.nonce = nonce
    return this
  }

  /**
   * Set factory for account deployment
   */
  setFactory(factory: Address, factoryData: Hex): this {
    this.userOp.factory = factory
    this.userOp.factoryData = factoryData
    return this
  }

  /**
   * Set the call data
   */
  setCallData(callData: Hex): this {
    this.userOp.callData = callData
    return this
  }

  /**
   * Set a single execution call
   */
  setSingleExecution(to: Address, value: bigint, data: Hex): this {
    // Encode as execute(address,uint256,bytes)
    const callData = encodeFunctionData({
      abi: [
        {
          name: 'execute',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
          outputs: [],
        },
      ],
      functionName: 'execute',
      args: [to, value, data],
    })

    this.userOp.callData = callData
    return this
  }

  /**
   * Set batch execution calls
   */
  setBatchExecution(calls: ExecutionCall[]): this {
    // Encode as executeBatch((address,uint256,bytes)[])
    const callData = encodeFunctionData({
      abi: [
        {
          name: 'executeBatch',
          type: 'function',
          inputs: [
            {
              name: 'calls',
              type: 'tuple[]',
              components: [
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'data', type: 'bytes' },
              ],
            },
          ],
          outputs: [],
        },
      ],
      functionName: 'executeBatch',
      args: [calls.map((c) => ({ to: c.to, value: c.value, data: c.data }))],
    })

    this.userOp.callData = callData
    return this
  }

  /**
   * Set gas limits
   */
  setGasLimits(
    verificationGasLimit: bigint,
    callGasLimit: bigint,
    preVerificationGas: bigint
  ): this {
    this.userOp.verificationGasLimit = verificationGasLimit
    this.userOp.callGasLimit = callGasLimit
    this.userOp.preVerificationGas = preVerificationGas
    return this
  }

  /**
   * Set gas prices
   */
  setGasPrices(maxFeePerGas: bigint, maxPriorityFeePerGas: bigint): this {
    this.userOp.maxFeePerGas = maxFeePerGas
    this.userOp.maxPriorityFeePerGas = maxPriorityFeePerGas
    return this
  }

  /**
   * Set paymaster
   */
  setPaymaster(
    paymaster: Address,
    paymasterData: Hex = '0x',
    verificationGasLimit?: bigint,
    postOpGasLimit?: bigint
  ): this {
    this.userOp.paymaster = paymaster
    this.userOp.paymasterData = paymasterData
    this.userOp.paymasterVerificationGasLimit = verificationGasLimit
    this.userOp.paymasterPostOpGasLimit = postOpGasLimit
    return this
  }

  /**
   * Set signature
   */
  setSignature(signature: Hex): this {
    this.userOp.signature = signature
    return this
  }

  /**
   * Build the UserOperation
   */
  build(): UserOperation {
    if (!this.userOp.sender) {
      throw new Error('Sender is required')
    }
    if (!this.userOp.callData) {
      throw new Error('CallData is required')
    }

    return {
      sender: this.userOp.sender,
      nonce: this.userOp.nonce ?? BigInt(0),
      factory: this.userOp.factory,
      factoryData: this.userOp.factoryData,
      callData: this.userOp.callData,
      callGasLimit: this.userOp.callGasLimit ?? DEFAULT_CALL_GAS_LIMIT,
      verificationGasLimit:
        this.userOp.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT,
      preVerificationGas:
        this.userOp.preVerificationGas ?? DEFAULT_PRE_VERIFICATION_GAS,
      maxFeePerGas: this.userOp.maxFeePerGas ?? BigInt(0),
      maxPriorityFeePerGas: this.userOp.maxPriorityFeePerGas ?? BigInt(0),
      paymaster: this.userOp.paymaster,
      paymasterVerificationGasLimit: this.userOp.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: this.userOp.paymasterPostOpGasLimit,
      paymasterData: this.userOp.paymasterData,
      signature: this.userOp.signature ?? '0x',
    }
  }

  /**
   * Build from options
   */
  static fromOptions(options: UserOpBuilderOptions): UserOperation {
    const builder = new UserOpBuilder()
    builder.setSender(options.sender)

    if (options.nonce !== undefined) {
      builder.setNonce(options.nonce)
    }

    if (options.factory && options.factoryData) {
      builder.setFactory(options.factory, options.factoryData)
    }

    builder.setCallData(options.callData)

    if (
      options.verificationGasLimit &&
      options.callGasLimit &&
      options.preVerificationGas
    ) {
      builder.setGasLimits(
        options.verificationGasLimit,
        options.callGasLimit,
        options.preVerificationGas
      )
    }

    if (options.maxFeePerGas && options.maxPriorityFeePerGas) {
      builder.setGasPrices(options.maxFeePerGas, options.maxPriorityFeePerGas)
    }

    if (options.paymaster) {
      builder.setPaymaster(
        options.paymaster,
        options.paymasterData,
        options.paymasterVerificationGasLimit,
        options.paymasterPostOpGasLimit
      )
    }

    return builder.build()
  }
}

/**
 * Pack UserOperation for bundler submission
 */
export function packUserOperation(userOp: UserOperation): PackedUserOperation {
  // Pack initCode
  const initCode =
    userOp.factory && userOp.factoryData
      ? concat([userOp.factory, userOp.factoryData])
      : '0x'

  // Pack accountGasLimits (verificationGasLimit || callGasLimit)
  const accountGasLimits = concat([
    pad(toHex(userOp.verificationGasLimit), { size: 16 }),
    pad(toHex(userOp.callGasLimit), { size: 16 }),
  ])

  // Pack gasFees (maxPriorityFeePerGas || maxFeePerGas)
  const gasFees = concat([
    pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }),
    pad(toHex(userOp.maxFeePerGas), { size: 16 }),
  ])

  // Pack paymasterAndData
  let paymasterAndData: Hex = '0x'
  if (userOp.paymaster) {
    const paymasterGasLimits = concat([
      pad(toHex(userOp.paymasterVerificationGasLimit ?? BigInt(0)), { size: 16 }),
      pad(toHex(userOp.paymasterPostOpGasLimit ?? BigInt(0)), { size: 16 }),
    ])
    paymasterAndData = concat([
      userOp.paymaster,
      paymasterGasLimits,
      userOp.paymasterData ?? '0x',
    ])
  }

  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode,
    callData: userOp.callData,
    accountGasLimits,
    preVerificationGas: toHex(userOp.preVerificationGas),
    gasFees,
    paymasterAndData,
    signature: userOp.signature,
  }
}

/**
 * Get UserOperation hash for signing
 */
export function getUserOpHash(
  userOp: UserOperation,
  entryPoint: Address = ENTRY_POINT_V07,
  chainId: number
): Hex {
  const packed = packUserOperation(userOp)

  // Hash the packed userOp
  const userOpPacked = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
    ],
    [
      packed.sender,
      BigInt(packed.nonce),
      keccak256(packed.initCode),
      keccak256(packed.callData),
      packed.accountGasLimits as Hex,
      BigInt(packed.preVerificationGas),
      packed.gasFees as Hex,
      keccak256(packed.paymasterAndData),
    ]
  )

  const userOpHash = keccak256(userOpPacked)

  // Final hash with entryPoint and chainId
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [userOpHash, entryPoint, BigInt(chainId)]
    )
  )
}
