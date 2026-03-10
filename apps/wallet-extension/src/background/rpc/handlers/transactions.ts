import type { Address, Hash, Hex } from 'viem'
import { isAddress } from 'viem/utils'
import {
  approvalController,
  createRpcError,
  cryptoHex,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_VALUES,
  decodeStringResult,
  eventBroadcaster,
  formatBalance,
  getMultiModeController,
  getPublicClient,
  handleApprovalError,
  keyringController,
  logger,
  type MultiModeTransactionParams,
  RPC_ERRORS,
  type RpcHandler,
  walletState,
} from './shared'

export const transactionsHandlers: Record<string, RpcHandler> = {
  /**
   * Send a transaction
   * Signs and broadcasts a transaction to the network
   */
  eth_sendTransaction: async (params, origin, isExtension) => {
    const [txParams] = params as [
      {
        from?: Address
        to?: Address
        value?: string
        data?: Hex
        gas?: string
        gasPrice?: string
        maxFeePerGas?: string
        maxPriorityFeePerGas?: string
        nonce?: string
        type?: string
        authorizationList?: Array<{
          chainId: string | number
          address: Address
          nonce: string | number
          v: string | number
          r: string
          s: string
        }>
      },
    ]

    // Validate required 'from' field
    if (!txParams.from) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required field: from',
      })
    }

    // Validate 'from' address format
    if (!isAddress(txParams.from)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid from address format',
      })
    }

    // Validate 'to' address format if provided
    if (txParams.to && !isAddress(txParams.to)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid to address format',
      })
    }

    // Verify site is connected and account is authorized
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (connectedAccounts.length === 0) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const normalizedFrom = txParams.from.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedFrom)
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

    // Check network is selected
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    // Create public client for gas estimation and broadcasting
    const client = getPublicClient(network.rpcUrl)

    // Get nonce if not provided
    let nonce = txParams.nonce ? Number.parseInt(txParams.nonce, 16) : undefined
    if (nonce === undefined) {
      nonce = await client.getTransactionCount({ address: txParams.from })
    }

    // Estimate gas if not provided
    let gas = txParams.gas ? BigInt(txParams.gas) : undefined
    if (!gas) {
      try {
        gas = await client.estimateGas({
          account: txParams.from,
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : undefined,
          data: txParams.data,
        })
      } catch {
        // Delegated accounts (EIP-7702 → Kernel) need more gas than plain EOA transfers
        // because Kernel's receive()/fallback() runs validation logic
        const accountInfo = walletState
          .getState()
          .accounts.accounts.find(
            (a: { address: string }) => a.address.toLowerCase() === txParams.from!.toLowerCase()
          )
        gas =
          accountInfo?.type === 'delegated'
            ? DEFAULT_CALL_GAS_LIMIT // 200K — covers Kernel dispatch + validation
            : DEFAULT_VALUES.GAS_LIMIT // 21K — plain EOA transfer
      }
    }

    // Get gas price if not provided
    let gasPrice = txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined
    const maxFeePerGas = txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined
    const maxPriorityFeePerGas = txParams.maxPriorityFeePerGas
      ? BigInt(txParams.maxPriorityFeePerGas)
      : undefined

    // If no gas price params, get current gas price
    if (!gasPrice && !maxFeePerGas) {
      gasPrice = await client.getGasPrice()
    }

    // Calculate estimated gas cost
    const estimatedGasCost = gas * (maxFeePerGas ?? gasPrice ?? BigInt(0))

    // Request user approval (skip for internal wallet UI - user already confirmed)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
      try {
        await approvalController.requestTransaction(
          origin,
          txParams.from,
          txParams.to ?? ('0x' as Address), // Contract deployment if no 'to'
          txParams.value ? BigInt(txParams.value) : BigInt(0),
          txParams.data,
          estimatedGasCost,
          undefined, // methodName
          undefined // favicon
        )
      } catch (error) {
        handleApprovalError(error, { method: 'eth_sendTransaction', origin })
      }
    }

    // Check if this is an EIP-7702 SetCode transaction
    const isEip7702 =
      txParams.type === '0x04' ||
      (txParams.authorizationList && txParams.authorizationList.length > 0)

    // Build transaction object for signing
    const transaction = isEip7702
      ? {
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : BigInt(0),
          data: txParams.data,
          gas,
          nonce,
          chainId: network.chainId,
          maxFeePerGas: maxFeePerGas ?? gasPrice ?? (await client.getGasPrice()),
          maxPriorityFeePerGas: maxPriorityFeePerGas ?? maxFeePerGas ?? gasPrice ?? BigInt(0),
          type: 'eip7702' as const,
          authorizationList: (txParams.authorizationList ?? []).map((auth) => ({
            chainId: Number(auth.chainId),
            address: auth.address,
            nonce: Number(auth.nonce),
            v: BigInt(auth.v),
            r: auth.r as Hex,
            s: auth.s as Hex,
            yParity: Number(auth.v) === 0 ? 0 : Number(auth.v) === 1 ? 1 : Number(auth.v) - 27,
          })),
        }
      : {
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : BigInt(0),
          data: txParams.data,
          gas,
          nonce,
          chainId: network.chainId,
          ...(maxFeePerGas
            ? {
                maxFeePerGas,
                maxPriorityFeePerGas: maxPriorityFeePerGas ?? maxFeePerGas,
                type: 'eip1559' as const,
              }
            : {
                gasPrice: gasPrice ?? BigInt(0),
              }),
        }

    // Sign transaction
    let signedTx: Hex
    try {
      signedTx = await keyringController.signTransaction(txParams.from, transaction)
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Transaction signing failed',
      })
    }

    // Broadcast transaction
    let txHash: Hash
    try {
      txHash = await client.sendRawTransaction({
        serializedTransaction: signedTx,
      })
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Transaction broadcast failed',
      })
    }

    // Track pending transaction in wallet state (non-blocking)
    try {
      const txId = `tx-${Date.now()}-${cryptoHex(5)}`
      await walletState.addPendingTransaction({
        id: txId,
        from: txParams.from,
        to: txParams.to ?? ('0x' as Address),
        value: txParams.value ? BigInt(txParams.value) : 0n,
        data: txParams.data,
        chainId: network.chainId,
        status: 'submitted',
        type: 'send',
        txHash,
        timestamp: Date.now(),
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
      })
    } catch (_err) {
      logger.warn('Failed to track pending transaction (tx was broadcast successfully)')
    }

    return txHash
  },

  /**
   * Send a multi-mode transaction via SDK TransactionRouter.
   * Supports EOA, EIP-7702, and Smart Account modes with unified lifecycle.
   */
  wallet_sendMultiModeTransaction: async (params, origin, isExtension) => {
    const [txParamsRaw] = params as [Record<string, unknown>]

    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    const from = txParamsRaw.from as Address
    if (!isAddress(from)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid from address',
      })
    }

    if (txParamsRaw.to && !isAddress(txParamsRaw.to as string)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid to address format',
      })
    }

    // Verify sender is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === from.toLowerCase())
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const controller = getMultiModeController()

    // Build MultiModeTransactionParams from raw input
    const txParams: MultiModeTransactionParams = {
      from,
      to: txParamsRaw.to as Address | undefined,
      value: txParamsRaw.value
        ? (() => {
            try {
              return BigInt(txParamsRaw.value as string)
            } catch {
              throw createRpcError({
                code: RPC_ERRORS.INVALID_PARAMS.code,
                message: 'Invalid value: must be a numeric string or hex',
              })
            }
          })()
        : undefined,
      data: txParamsRaw.data as Hex | undefined,
      mode: txParamsRaw.mode as MultiModeTransactionParams['mode'],
      gasPayment: txParamsRaw.gasPayment as MultiModeTransactionParams['gasPayment'],
      calls: txParamsRaw.calls as MultiModeTransactionParams['calls'],
      delegateTo: txParamsRaw.delegateTo as Address | undefined,
    }

    // Add transaction — controller estimates gas via SDK router.prepare()
    const txMeta = await controller.addTransaction(txParams, origin)

    // Request user approval (skip for internal wallet UI)
    if (!isExtension) {
      try {
        await approvalController.requestTransaction(
          origin,
          txParams.from,
          txParams.to ?? txParams.from,
          txParams.value ?? 0n,
          txParams.data ?? '0x',
          txMeta.gasEstimate?.estimatedCost ?? 0n,
          'MultiModeTransaction',
          undefined
        )
      } catch (error) {
        // User rejected — clean up controller state
        await controller.rejectTransaction(txMeta.id).catch((e) => {
          logger.warn(
            `[wallet_sendMultiModeTransaction] rejectTransaction cleanup failed: ${(e as Error).message}`
          )
        })
        handleApprovalError(error, { method: 'wallet_sendMultiModeTransaction', origin })
      }
    }

    // Process: approve → sign → submit (callbacks handle signing and submission)
    try {
      const hash = await controller.processTransaction(txMeta.id)

      // Track as pending transaction
      // Fire-and-forget: pending tx tracking should not block the response
      const network = walletState.getCurrentNetwork()
      walletState
        .addPendingTransaction({
          id: txMeta.id,
          from: txParams.from,
          to: txParams.to ?? txParams.from,
          value: txParams.value ?? 0n,
          data: txParams.data ?? '0x',
          chainId: network?.chainId ?? 0,
          status: 'submitted',
          type: txMeta.mode === 'smartAccount' ? 'userOp' : 'send',
          userOpHash: txMeta.mode === 'smartAccount' ? hash : undefined,
          txHash: txMeta.mode !== 'smartAccount' ? hash : undefined,
          timestamp: Date.now(),
        })
        .catch(() => {})

      logger.info(`[wallet_sendMultiModeTransaction] OK: mode=${txMeta.mode}, hash=${hash}`)
      return hash
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      logger.error(
        `[wallet_sendMultiModeTransaction] FAILED: mode=${txMeta.mode}, err=${err.message}`
      )
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Multi-mode transaction failed',
        data: err.data,
      })
    }
  },

  /**
   * Get available transaction modes for the selected account.
   * Returns mode list with features for UI mode selection.
   */
  wallet_getTransactionModes: async (_params, origin) => {
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    try {
      const controller = getMultiModeController()
      return controller.getSupportedModes()
    } catch (error) {
      logger.warn(`[wallet_getTransactionModes] fallback to eoa: ${(error as Error).message}`)
      return ['eoa']
    }
  },

  /**
   * Get all assets (native + tokens) for the connected account
   * Custom RPC method for dApps to get wallet's complete asset list
   */
  wallet_getAssets: async (_params, origin) => {
    // Verify site is connected
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const state = walletState.getState()
    const network = walletState.getCurrentNetwork()
    const selectedAccount = state.accounts.selectedAccount

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!selectedAccount) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Verify account is connected to this origin
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (!connectedAccounts.includes(selectedAccount)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Get native balance
    const client = getPublicClient(network.rpcUrl)

    let nativeBalance: bigint
    try {
      nativeBalance = await client.getBalance({ address: selectedAccount })
    } catch {
      nativeBalance = BigInt(0)
    }

    // Format native balance
    const nativeDecimals = network.currency.decimals
    const formattedNativeBalance = formatBalance(nativeBalance.toString(), nativeDecimals)

    // Get tracked tokens and their balances
    const trackedTokens = walletState.getTokensForChain(network.chainId)
    const tokenBalances = await Promise.all(
      trackedTokens.map(async (token) => {
        // Try to get cached balance first
        let balance = walletState.getCachedBalance(network.chainId, selectedAccount, token.address)

        // Fetch fresh balance if not cached
        if (!balance) {
          try {
            const data = `0x70a08231${selectedAccount.slice(2).padStart(64, '0').toLowerCase()}`
            const result = await client.call({
              to: token.address,
              data: data as Hex,
            })
            balance = result.data ? BigInt(result.data).toString() : '0'
            // Cache the balance
            await walletState.updateTokenBalance(
              network.chainId,
              selectedAccount,
              token.address,
              balance
            )
          } catch {
            balance = '0'
          }
        }

        return {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance,
          formattedBalance: formatBalance(balance, token.decimals),
          logoURI: token.logoURI,
        }
      })
    )

    return {
      chainId: network.chainId,
      account: selectedAccount,
      native: {
        symbol: network.currency.symbol,
        name: network.currency.name,
        decimals: nativeDecimals,
        balance: nativeBalance.toString(),
        formattedBalance: formattedNativeBalance,
      },
      tokens: tokenBalances,
      updatedAt: Date.now(),
    }
  },

  /**
   * Add a token to the wallet's tracked tokens
   * Custom RPC method for dApps to request adding a token
   */
  wallet_addToken: async (params, origin) => {
    // Verify site is connected
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const [tokenParams] = params as [
      {
        address: Address
        symbol?: string
        name?: string
        decimals?: number
        logoURI?: string
      },
    ]

    if (!tokenParams?.address) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Token address is required',
      })
    }

    if (!isAddress(tokenParams.address)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid token address',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const normalizedAddress = tokenParams.address.toLowerCase() as Address

    // Check if token already exists
    const existingToken = walletState.getToken(network.chainId, normalizedAddress)
    if (existingToken) {
      return {
        success: true,
        token: existingToken,
      }
    }

    // Fetch token metadata from contract if not provided
    let symbol = tokenParams.symbol
    let name = tokenParams.name
    let decimals = tokenParams.decimals

    if (!symbol || !name || decimals === undefined) {
      const client = getPublicClient(network.rpcUrl)

      try {
        // Fetch missing metadata
        if (!symbol) {
          const symbolResult = await client.call({
            to: normalizedAddress,
            data: '0x95d89b41' as Hex, // symbol()
          })
          symbol = decodeStringResult(symbolResult.data)
        }

        if (!name) {
          const nameResult = await client.call({
            to: normalizedAddress,
            data: '0x06fdde03' as Hex, // name()
          })
          name = decodeStringResult(nameResult.data)
        }

        if (decimals === undefined) {
          const decimalsResult = await client.call({
            to: normalizedAddress,
            data: '0x313ce567' as Hex, // decimals()
          })
          decimals = decimalsResult.data ? Number(BigInt(decimalsResult.data)) : 18
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to fetch token metadata: ${(error as Error).message}`,
        }
      }
    }

    // Create and store the token
    const newToken = {
      address: normalizedAddress,
      symbol: symbol ?? 'UNKNOWN',
      name: name ?? 'Unknown Token',
      decimals: decimals ?? 18,
      chainId: network.chainId,
      logoURI: tokenParams.logoURI,
      isVisible: true,
      addedAt: Date.now(),
    }

    await walletState.addToken(network.chainId, newToken)

    // Broadcast assetsChanged event to all connected sites
    const connectedOrigins = walletState.getState().connections.connectedSites.map((s) => s.origin)
    await eventBroadcaster.broadcastAssetsChanged(
      network.chainId,
      walletState.getState().accounts.selectedAccount ?? ('' as Address),
      'token_added',
      connectedOrigins
    )

    return {
      success: true,
      token: newToken,
    }
  },
}
