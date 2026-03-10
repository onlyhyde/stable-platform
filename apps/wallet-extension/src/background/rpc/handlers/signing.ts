import type { Address, Hex } from 'viem'
import { isAddress } from 'viem/utils'
import {
  approvalController,
  BASE_TRANSFER_GAS,
  createAuthorization,
  createAuthorizationHash,
  createRpcError,
  createSignedAuthorization,
  cryptoHex,
  EIP7702_AUTH_GAS,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  GAS_PER_AUTHORIZATION,
  getPublicClient,
  handleApprovalError,
  keyringController,
  logger,
  RPC_ERRORS,
  type RpcHandler,
  typedDataValidator,
  walletState,
} from './shared'

export const signingHandlers: Record<string, RpcHandler> = {
  /**
   * Sign a message (personal_sign)
   * EIP-191 personal message signing
   */
  personal_sign: async (params, origin) => {
    const [message, address] = params as [Hex, Address]

    // Validate address format
    if (!isAddress(address)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid address format',
      })
    }

    // Verify account is connected (case-insensitive comparison)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAddress = address.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAddress)
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Check if wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Request user approval
    try {
      const approval = await approvalController.requestSignMessage({
        origin,
        message,
        address,
        method: 'personal_sign',
      })

      if (!approval.approved) {
        throw createRpcError(RPC_ERRORS.USER_REJECTED)
      }
    } catch (error) {
      handleApprovalError(error, { method: 'personal_sign', origin })
    }

    // Sign the message
    try {
      const signature = await keyringController.signMessage(address, message)
      return signature
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Signing failed',
      })
    }
  },

  /**
   * Sign typed data (EIP-712)
   */
  eth_signTypedData_v4: async (params, origin) => {
    const [address, typedDataString] = params as [Address, string]

    // Validate address format
    if (!isAddress(address)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid address format',
      })
    }

    // Parse typed data
    let typedData: unknown
    try {
      typedData = JSON.parse(typedDataString)
    } catch {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid typed data: must be valid JSON',
      })
    }

    // Verify account is connected (case-insensitive)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAddress = address.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAddress)
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Check if wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Validate typed data domain (SEC-5)
    const currentNetwork = walletState.getCurrentNetwork()
    const currentChainId = currentNetwork?.chainId ?? 1
    const domainValidation = typedDataValidator.validateTypedData(typedData, currentChainId, origin)

    // Reject if typed data structure is invalid
    if (!domainValidation.isValid) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: `Invalid typed data: ${domainValidation.errors.join(', ')}`,
      })
    }

    // Get risk level and formatted warnings for approval UI
    const riskLevel = typedDataValidator.getRiskLevel(domainValidation.warnings)
    const warningMessages = typedDataValidator.formatWarningsForDisplay(domainValidation.warnings)

    // Request user approval with domain validation results
    try {
      const approval = await approvalController.requestSignTypedData({
        origin,
        address,
        typedData,
        method: 'eth_signTypedData_v4',
        domainValidation: {
          warnings: domainValidation.warnings,
          riskLevel,
          warningMessages,
        },
      })

      if (!approval.approved) {
        throw createRpcError(RPC_ERRORS.USER_REJECTED)
      }
    } catch (error) {
      handleApprovalError(error, { method: 'eth_signTypedData_v4', origin })
    }

    // Sign the typed data
    try {
      const signature = await keyringController.signTypedData(address, typedData)
      return signature
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Signing failed',
      })
    }
  },

  /**
   * Sign EIP-7702 Authorization (wallet_signAuthorization)
   * Allows EOAs to delegate to smart contract implementations
   */
  wallet_signAuthorization: async (params, origin, isExtension) => {
    const [authRequest] = params as [
      {
        account: Address
        contractAddress: Address
        chainId?: number | string
        nonce?: number | string
      },
    ]

    if (!authRequest || !authRequest.account || !authRequest.contractAddress) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required parameters: account and contractAddress',
      })
    }

    const { account, contractAddress } = authRequest

    // Validate address formats
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address format',
      })
    }

    if (!isAddress(contractAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid contract address format',
      })
    }

    // Verify account is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAccount = account.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAccount)
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Check if wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Get chain ID (use current network if not specified)
    const currentNetwork = walletState.getCurrentNetwork()
    let chainId: number
    if (authRequest.chainId !== undefined) {
      chainId =
        typeof authRequest.chainId === 'string'
          ? Number.parseInt(authRequest.chainId, authRequest.chainId.startsWith('0x') ? 16 : 10)
          : authRequest.chainId
    } else {
      chainId = currentNetwork?.chainId ?? 1
    }

    // Get nonce (use current transaction count if not specified)
    let nonce: bigint
    if (authRequest.nonce !== undefined) {
      nonce = BigInt(authRequest.nonce)
    } else {
      // Get current nonce from the network
      const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      if (network) {
        const client = getPublicClient(network.rpcUrl)
        const transactionCount = await client.getTransactionCount({ address: account })
        nonce = BigInt(transactionCount)
      } else {
        nonce = 0n
      }
    }

    // Request user approval (skip for internal wallet UI - user already confirmed in DelegateSetup)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
      try {
        await approvalController.requestAuthorization(
          origin,
          account,
          contractAddress,
          chainId,
          nonce
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_grantPermissions', origin })
      }
    }

    // After approval, sign the authorization
    try {
      // Create the authorization structure
      const authorization = createAuthorization(chainId, contractAddress, nonce)

      // Create the authorization hash
      const authorizationHash = createAuthorizationHash(authorization)

      // Sign the hash with the account's private key
      const signatureResult = await keyringController.signAuthorizationHash(
        account,
        authorizationHash
      )

      // Create the signed authorization
      const signedAuthorization = createSignedAuthorization(
        authorization,
        signatureResult.signature
      )

      return {
        signedAuthorization: {
          chainId: signedAuthorization.chainId,
          address: signedAuthorization.address,
          nonce: signedAuthorization.nonce,
          v: signedAuthorization.v,
          r: signedAuthorization.r,
          s: signedAuthorization.s,
        },
        authorizationHash,
      }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Authorization signing failed',
      })
    }
  },

  /**
   * Delegate Account via EIP-7702 (wallet_delegateAccount)
   * Combined authorization signing + transaction sending in a single step.
   * Handles the executor:'self' nonce adjustment automatically.
   *
   * This replaces the error-prone 2-step flow (wallet_signAuthorization + eth_sendTransaction)
   * by performing both operations internally, avoiding serialization round-trips and
   * ensuring correct nonce handling (authorization.nonce = tx.nonce + 1).
   */
  wallet_delegateAccount: async (params, origin, isExtension) => {
    const [request] = params as [
      {
        account: Address
        contractAddress: Address
        chainId?: number | string
      },
    ]

    if (!request?.account || !request?.contractAddress) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required parameters: account and contractAddress',
      })
    }

    const { account, contractAddress } = request

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address format',
      })
    }
    if (!isAddress(contractAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid contract address format',
      })
    }

    // Verify account is connected (internal requests always pass)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
      const connectedAccounts = walletState.getConnectedAccounts(origin)
      const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === account.toLowerCase())
      if (!isAuthorized) {
        throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
      }
    }

    // Check wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Get network
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const chainId =
      request.chainId !== undefined
        ? typeof request.chainId === 'string'
          ? Number.parseInt(request.chainId, request.chainId.startsWith('0x') ? 16 : 10)
          : request.chainId
        : network.chainId

    // Request user approval for external requests
    if (!isInternalRequest) {
      try {
        await approvalController.requestAuthorization(origin, account, contractAddress, chainId, 0n)
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_delegateAccount', origin })
      }
    }

    try {
      // Step 1: Get the transaction nonce (N)
      const txNonce = await client.getTransactionCount({ address: account })

      // Step 2: Authorization nonce = N + 1 (executor:'self' pattern)
      // When the EOA both signs the authorization AND sends the transaction:
      // - Transaction uses nonce N
      // - EVM increments sender nonce to N+1 before processing authorizations
      // - Authorization nonce must match the authority's nonce at processing time (N+1)
      const authNonce = BigInt(txNonce + 1)

      // Step 3: Create and sign the authorization
      const authorization = createAuthorization(chainId, contractAddress, authNonce)
      const authorizationHash = createAuthorizationHash(authorization)
      const signatureResult = await keyringController.signAuthorizationHash(
        account,
        authorizationHash
      )

      // Step 4: Kernel v0.3.3 EIP-7702 Design
      // Kernel intentionally blocks initialize() for EIP-7702 delegated accounts
      // (detects 0xef0100 prefix in address(this).code and reverts with AlreadyInitialized).
      // Instead, Kernel uses VALIDATION_TYPE_7702 (nonce key 0x00) which validates
      // signatures via ECDSA.recover(toEthSignedMessageHash(userOpHash), sig) == address(this).
      // No root validator or ECDSA module installation is needed.
      // The delegation transaction is a pure authorization-only tx with no data payload.

      // Step 5: Get gas prices and calculate gas
      // Pure delegation tx: base(21K) + authOverhead(25K) + perAuth(12.5K)
      const gasPrice = await client.getGasPrice()
      const numAuths = 1n
      const baseGas = BASE_TRANSFER_GAS + EIP7702_AUTH_GAS + GAS_PER_AUTHORIZATION * numAuths
      const gas = (baseGas * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      // Step 6: Build the EIP-7702 transaction
      // No data payload — delegation alone is sufficient for Kernel EIP-7702 mode
      const transaction = {
        to: account,
        value: 0n,
        data: '0x' as Hex,
        gas,
        nonce: txNonce,
        chainId: network.chainId,
        maxFeePerGas: gasPrice * 2n,
        maxPriorityFeePerGas: gasPrice / 10n > 0n ? gasPrice / 10n : 1_000_000n,
        type: 'eip7702' as const,
        authorizationList: [
          {
            address: contractAddress,
            chainId: chainId,
            nonce: txNonce + 1,
            yParity: signatureResult.v as 0 | 1,
            r: signatureResult.r,
            s: signatureResult.s,
            v: BigInt(signatureResult.v),
          },
        ],
      }

      // Step 7: Sign the transaction
      const signedTx = await keyringController.signTransaction(account, transaction)

      // Step 8: Broadcast
      const txHash = await client.sendRawTransaction({
        serializedTransaction: signedTx,
      })

      // Track pending transaction
      try {
        const txId = `delegate-${Date.now()}-${cryptoHex(5)}`
        await walletState.addPendingTransaction({
          id: txId,
          from: account,
          to: account,
          value: 0n,
          data: '0x' as Hex,
          chainId: network.chainId,
          status: 'submitted',
          type: 'send',
          txHash,
          timestamp: Date.now(),
        })
      } catch (_err) {
        logger.warn('Failed to track delegation transaction (tx was broadcast successfully)')
      }

      // Update account type to 'delegated' after successful broadcast
      try {
        await walletState.updateAccount(account, {
          type: 'delegated',
          delegateAddress: contractAddress,
        })
      } catch (_err) {
        logger.warn(
          'Failed to update account type after delegation (tx was broadcast successfully)'
        )
      }

      return { txHash }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'EIP-7702 delegation failed',
      })
    }
  },
}
