import type { Address, Chain, Hex, Transport } from 'viem'
import type { UserOperation, UserOperationGasEstimation } from './userOperation'

/**
 * Smart Account interface
 * @description Represents a smart contract account that can execute UserOperations
 */
export interface SmartAccount {
  /** The address of the smart account */
  address: Address
  /** The EntryPoint address this account is compatible with */
  entryPoint: Address
  /** Get the account's nonce */
  getNonce: () => Promise<bigint>
  /** Get the account's init code (factory + factoryData) */
  getInitCode: () => Promise<Hex>
  /** Encode a call to the account */
  encodeCallData: (calls: Call | Call[]) => Promise<Hex>
  /** Sign a UserOperation hash */
  signUserOperation: (userOpHash: Hex) => Promise<Hex>
  /** Get the account's factory address */
  getFactory: () => Promise<Address | undefined>
  /** Get the account's factory data */
  getFactoryData: () => Promise<Hex | undefined>
  /** Check if the account is deployed */
  isDeployed: () => Promise<boolean>
}

/**
 * A call to execute
 */
export interface Call {
  to: Address
  value?: bigint
  data?: Hex
}

/**
 * Smart Account Client configuration
 */
export interface SmartAccountClientConfig<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends SmartAccount = SmartAccount,
> {
  /** The smart account instance */
  account: TAccount
  /** The chain to connect to */
  chain: TChain
  /** The transport to use */
  transport: TTransport
  /** The bundler URL */
  bundlerTransport?: TTransport
  /** Paymaster configuration */
  paymaster?: PaymasterClient
  /** User operation middleware */
  userOperation?: UserOperationMiddleware
}

/**
 * Paymaster client interface
 */
export interface PaymasterClient {
  /** Get paymaster stub data for gas estimation */
  getPaymasterStubData: (
    userOperation: UserOperation,
    entryPoint: Address,
    chainId: bigint
  ) => Promise<PaymasterStubData>
  /** Get paymaster data for signing */
  getPaymasterData: (
    userOperation: UserOperation,
    entryPoint: Address,
    chainId: bigint
  ) => Promise<PaymasterData>
}

/**
 * Paymaster stub data (for gas estimation)
 */
export interface PaymasterStubData {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
}

/**
 * Paymaster data (for signing)
 */
export interface PaymasterData {
  paymaster: Address
  paymasterData: Hex
}

/**
 * User operation middleware
 */
export interface UserOperationMiddleware {
  /** Modify the user operation before gas estimation */
  gasEstimation?: (userOperation: UserOperation) => Promise<UserOperationGasEstimation>
  /** Modify the user operation before sponsorship */
  sponsorship?: (userOperation: UserOperation) => Promise<UserOperation>
  /** Modify the user operation before signing */
  signature?: (userOperation: UserOperation) => Promise<UserOperation>
}

/**
 * Validator interface (ERC-7579)
 */
export interface Validator {
  /** The validator module address */
  address: Address
  /** The validator type */
  type: 'validator'
  /** Initialize the validator */
  getInitData: () => Promise<Hex>
  /** Sign a hash with this validator */
  signHash: (hash: Hex) => Promise<Hex>
  /** Get the signer address */
  getSignerAddress: () => Address
}

/**
 * Kernel account configuration
 */
export interface KernelAccountConfig {
  /** The validator to use */
  validator: Validator
  /** The EntryPoint address */
  entryPoint: Address
  /** The Kernel factory address */
  factoryAddress?: Address
  /** Optional index for counterfactual address */
  index?: bigint
  /** Optional initial call to execute during deployment */
  initCall?: Call
}

/**
 * Signer types supported
 */
export type SignerType = 'local' | 'privateKey' | 'webauthn' | 'multisig'

/**
 * Account factory configuration
 */
export interface AccountFactoryConfig {
  /** Factory contract address */
  address: Address
  /** Create account call data generator */
  getCreateAccountData: (validator: Validator, index?: bigint) => Promise<Hex>
}
