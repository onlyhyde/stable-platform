import type { Address, Hex } from 'viem'
import { isAddress } from 'viem/utils'
import {
  approvalController,
  createBundlerClient,
  createRpcError,
  cryptoHex,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  ENTRY_POINT_ABI,
  encodeKernelExecute,
  getEntryPointForChain,
  getNonceKeyForAccount,
  getPublicClient,
  getUserOperationHash,
  handleApprovalError,
  keyringController,
  logger,
  packUserOperation,
  parseUserOperation,
  RPC_ERRORS,
  type RpcHandler,
  resolveFactory,
  signUserOp,
  sponsorAndSign,
  type UserOperation,
  walletState,
} from './shared'

export const userOpsHandlers: Record<string, RpcHandler> = {
  /**
   * Send a UserOperation (ERC-4337)
   */
  eth_sendUserOperation: async (params, origin, isExtension) => {
    const [userOpParam, entryPointParam] = params as [unknown, Address]

    // Verify connection
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Validate entryPoint
    const entryPoint = entryPointParam ?? getEntryPointForChain()
    if (!isAddress(entryPoint)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid entryPoint address',
      })
    }

    // Encode callData from target/value/data if not already present (UI sends this format)
    const raw = userOpParam as Record<string, unknown>
    if (!raw.callData && raw.target) {
      raw.callData = encodeKernelExecute(
        raw.target as Address,
        raw.value ? BigInt(raw.value as string) : 0n,
        (raw.data as Hex) || '0x'
      )
    }

    // Extract gasPayment before parsing (not part of UserOperation schema)
    const gasPayment = raw.gasPayment as { type: string; tokenAddress?: string } | undefined
    delete raw.gasPayment

    // Parse and validate UserOperation
    const userOp = parseUserOperation(userOpParam)
    if (!userOp) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid UserOperation format',
      })
    }

    // Validate sender address
    if (!isAddress(userOp.sender)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid sender address',
      })
    }

    // Verify sender account is connected (case-insensitive)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedSender = userOp.sender.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedSender)
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

    // Check network and bundler URL
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }
    const bundlerUrl = network.bundlerUrl

    // Fetch current nonce from EntryPoint if not provided by the caller
    if (userOp.nonce === 0n) {
      const publicClient = getPublicClient(network.rpcUrl)
      const onChainNonce = await publicClient
        .readContract({
          address: entryPoint,
          abi: [
            {
              inputs: [
                { name: 'sender', type: 'address' },
                { name: 'key', type: 'uint192' },
              ],
              name: 'getNonce',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'getNonce',
          args: [userOp.sender, await getNonceKeyForAccount(userOp.sender, network.chainId)],
        })
        .catch(() => 0n)
      userOp.nonce = onChainNonce
    }

    // Resolve factory/initCode for undeployed accounts (ERC-4337)
    if (!userOp.factory) {
      const factoryInfo = await resolveFactory(userOp.sender, network.rpcUrl)
      if (factoryInfo) {
        userOp.factory = factoryInfo.factory
        userOp.factoryData = factoryInfo.factoryData
        logger.info(
          `[eth_sendUserOperation] Account not deployed, attaching factory: ${factoryInfo.factory}`
        )
      }
    }

    // Estimate gas prices if not provided by the caller
    if (userOp.maxFeePerGas === 0n) {
      const publicClient = getPublicClient(network.rpcUrl)
      try {
        const fees = await publicClient.estimateFeesPerGas()
        // Add 25% buffer for price fluctuation between estimation and inclusion
        const buffer = (fees.maxFeePerGas ?? 0n) / 4n
        userOp.maxFeePerGas = (fees.maxFeePerGas ?? 0n) + buffer
        // ERC-4337: maxPriorityFeePerGas must not exceed maxFeePerGas
        const rawPriority = fees.maxPriorityFeePerGas ?? 0n
        userOp.maxPriorityFeePerGas =
          rawPriority > userOp.maxFeePerGas ? userOp.maxFeePerGas : rawPriority
      } catch {
        // Fallback to legacy gas price for non-EIP-1559 chains
        const gasPrice = await publicClient.getGasPrice()
        const buffer = gasPrice / 4n
        userOp.maxFeePerGas = gasPrice + buffer
        userOp.maxPriorityFeePerGas = gasPrice
      }
    }

    // Calculate estimated gas cost for approval display (pre-estimation defaults)
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI - user already confirmed)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
      try {
        await approvalController.requestTransaction(
          origin,
          userOp.sender,
          userOp.sender, // Smart account is both from and to
          BigInt(0), // UserOp value is in callData
          userOp.callData,
          estimatedGasCost,
          'UserOperation',
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'eth_sendUserOperation', origin })
      }
    }

    // Helper to submit UserOp and track pending transaction
    const submitAndTrack = async (signedOp: UserOperation) => {
      const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedOp)

      // Track as pending transaction with userOpHash (txHash comes later from bundler polling)
      try {
        const txId = `userop-${Date.now()}-${cryptoHex(5)}`
        const target = raw.target as Address | undefined
        await walletState.addPendingTransaction({
          id: txId,
          from: signedOp.sender,
          to: target ?? signedOp.sender,
          value: raw.value ? BigInt(raw.value as string) : 0n,
          data: signedOp.callData,
          chainId: network.chainId,
          status: 'submitted',
          type: 'userOp',
          userOpHash,
          timestamp: Date.now(),
          maxFeePerGas: signedOp.maxFeePerGas,
          maxPriorityFeePerGas: signedOp.maxPriorityFeePerGas,
        })
      } catch {
        // Non-blocking: pending tx tracking failure should not fail the UserOp submission
      }

      return userOpHash
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    const shouldSponsor =
      gasPayment?.type === 'sponsor' ||
      gasPayment?.type === 'erc20' ||
      (!gasPayment && !!network.paymasterUrl)
    logger.info(
      `[eth_sendUserOperation] sender=${userOp.sender}, nonce=${userOp.nonce}, shouldSponsor=${shouldSponsor}, gasPayment=${JSON.stringify(gasPayment ?? 'none')}`
    )

    if (!userOp.paymaster && shouldSponsor && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPayment?.type === 'erc20' && gasPayment.tokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPayment.tokenAddress }
          : {}

      logger.info(
        `[eth_sendUserOperation] Sponsored path: paymasterUrl=${network.paymasterUrl}, context=${JSON.stringify(paymasterContext)}`
      )

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId: network.chainId,
        context: paymasterContext,
        bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, network.chainId, origin)
        },
      })

      if (signedUserOp) {
        logger.info(`[eth_sendUserOperation] sponsorAndSign OK, submitting to bundler...`)

        // AA24 diagnostic: compare client-side hash with on-chain EntryPoint hash
        try {
          const clientHash = getUserOperationHash(signedUserOp, entryPoint, BigInt(network.chainId))
          const packed = packUserOperation(signedUserOp)
          // Cast packed to satisfy EntryPoint ABI tuple type (nonce is Hex in packed but bigint in ABI)
          const packedForAbi = {
            ...packed,
            nonce: BigInt(packed.nonce),
            preVerificationGas: BigInt(packed.preVerificationGas),
          }
          const onChainHash = (await getPublicClient(network.rpcUrl).readContract({
            address: entryPoint,
            abi: ENTRY_POINT_ABI,
            functionName: 'getUserOpHash',
            args: [packedForAbi as never],
          })) as `0x${string}`
          const hashMatch = clientHash === onChainHash
          logger.info(
            `[eth_sendUserOperation] HASH DIAG: clientHash=${clientHash.slice(0, 14)}..., onChainHash=${String(onChainHash).slice(0, 14)}..., match=${hashMatch}`
          )
          if (!hashMatch) {
            logger.error(
              `[eth_sendUserOperation] HASH MISMATCH! Client signs different hash than EntryPoint expects. clientHash=${clientHash}, onChainHash=${String(onChainHash)}`
            )
          }
        } catch (hashErr) {
          logger.warn(`[eth_sendUserOperation] HASH DIAG failed: ${(hashErr as Error).message}`)
        }

        try {
          const hash = await submitAndTrack(signedUserOp)
          logger.info(`[eth_sendUserOperation] Bundler accepted: userOpHash=${hash}`)
          return hash
        } catch (error) {
          const err = error as Error & { code?: number; data?: unknown }
          logger.error(
            `[eth_sendUserOperation] Bundler REJECTED: code=${err.code}, msg=${err.message}, data=${JSON.stringify(err.data ?? null)}`
          )
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message: err.message || 'UserOperation submission failed',
            data: err.data,
          })
        }
      }
      logger.warn(
        '[eth_sendUserOperation] sponsorAndSign returned null, falling through to self-pay'
      )
      // sponsorAndSign returned null → fall through to self-pay
    }

    // Self-pay path: estimate gas without paymaster, then sign with EIP-712
    // NOTE: Do NOT add extra buffer here — the bundler's estimator already includes
    // configurable buffers (default 10%). Adding more causes double-buffering that
    // can exceed MAX_VERIFICATION_GAS validation limits.
    logger.info('[eth_sendUserOperation] Self-pay path: estimating gas without paymaster')
    try {
      const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
      const gasEstimate = await bundlerClient.estimateUserOperationGas(userOp)
      userOp.preVerificationGas = gasEstimate.preVerificationGas
      userOp.verificationGasLimit = gasEstimate.verificationGasLimit
      userOp.callGasLimit = gasEstimate.callGasLimit
      logger.info(
        `[eth_sendUserOperation] Self-pay gas OK: preVerif=${userOp.preVerificationGas}, verifLimit=${userOp.verificationGasLimit}, callLimit=${userOp.callGasLimit}`
      )
    } catch (error) {
      logger.warn(
        `[eth_sendUserOperation] Self-pay gas estimation FAILED, using defaults: ${(error as Error).message}`
      )
      userOp.verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT
      userOp.callGasLimit = DEFAULT_CALL_GAS_LIMIT
      userOp.preVerificationGas = DEFAULT_PRE_VERIFICATION_GAS
    }

    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, network.chainId, origin)
      signedUserOp = { ...userOp, signature }
      logger.info(`[eth_sendUserOperation] Self-pay signed OK: sigLen=${signature.length}`)
    } catch (error) {
      logger.error(`[eth_sendUserOperation] Self-pay signing FAILED: ${(error as Error).message}`)
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // AA24 diagnostic: compare client-side hash with on-chain EntryPoint hash
    try {
      const clientHash = getUserOperationHash(signedUserOp, entryPoint, BigInt(network.chainId))
      const packed = packUserOperation(signedUserOp)
      const packedForAbi = {
        ...packed,
        nonce: BigInt(packed.nonce),
        preVerificationGas: BigInt(packed.preVerificationGas),
      }
      const onChainHash = (await getPublicClient(network.rpcUrl).readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getUserOpHash',
        args: [packedForAbi as never],
      })) as `0x${string}`
      const hashMatch = clientHash === onChainHash
      logger.info(
        `[eth_sendUserOperation] HASH DIAG (self-pay): clientHash=${clientHash.slice(0, 14)}..., onChainHash=${String(onChainHash).slice(0, 14)}..., match=${hashMatch}`
      )
      if (!hashMatch) {
        logger.error(
          `[eth_sendUserOperation] HASH MISMATCH! clientHash=${clientHash}, onChainHash=${String(onChainHash)}`
        )
      }
    } catch (hashErr) {
      logger.warn(
        `[eth_sendUserOperation] HASH DIAG (self-pay) failed: ${(hashErr as Error).message}`
      )
    }

    try {
      const hash = await submitAndTrack(signedUserOp)
      logger.info(`[eth_sendUserOperation] Self-pay submitted OK: userOpHash=${hash}`)
      return hash
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      logger.error(
        `[eth_sendUserOperation] Self-pay bundler REJECTED: code=${err.code}, msg=${err.message}, data=${JSON.stringify(err.data ?? null)}`
      )
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'UserOperation submission failed',
        data: err.data,
      })
    }
  },

  /**
   * Estimate gas for a UserOperation
   */
  eth_estimateUserOperationGas: async (params) => {
    const [userOpParam, entryPointParam] = params as [unknown, Address]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Validate entryPoint
    const entryPoint = entryPointParam ?? getEntryPointForChain()
    if (!isAddress(entryPoint)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid entryPoint address',
      })
    }

    // Parse UserOperation (allow partial for estimation)
    const userOp = parseUserOperation(userOpParam)
    if (!userOp) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid UserOperation format',
      })
    }

    // Forward to bundler (SDK handles packing internally)
    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const gasEstimate = await bundlerClient.estimateUserOperationGas(userOp)

      // Return as hex values for JSON-RPC compatibility
      return {
        preVerificationGas: `0x${gasEstimate.preVerificationGas.toString(16)}`,
        verificationGasLimit: `0x${gasEstimate.verificationGasLimit.toString(16)}`,
        callGasLimit: `0x${gasEstimate.callGasLimit.toString(16)}`,
        ...(gasEstimate.paymasterVerificationGasLimit && {
          paymasterVerificationGasLimit: `0x${gasEstimate.paymasterVerificationGasLimit.toString(16)}`,
        }),
        ...(gasEstimate.paymasterPostOpGasLimit && {
          paymasterPostOpGasLimit: `0x${gasEstimate.paymasterPostOpGasLimit.toString(16)}`,
        }),
      }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Gas estimation failed',
        data: err.data,
      })
    }
  },

  /**
   * Get UserOperation by hash
   */
  eth_getUserOperationByHash: async (params) => {
    const [userOpHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    try {
      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint: getEntryPointForChain(network.chainId),
        chainId: BigInt(network.chainId),
      })
      return await bundlerClient.getUserOperationByHash(userOpHash)
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Failed to get UserOperation',
        data: err.data,
      })
    }
  },

  /**
   * Get UserOperation receipt
   */
  eth_getUserOperationReceipt: async (params) => {
    const [userOpHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    try {
      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint: getEntryPointForChain(network.chainId),
        chainId: BigInt(network.chainId),
      })
      return await bundlerClient.getUserOperationReceipt(userOpHash)
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Failed to get UserOperation receipt',
        data: err.data,
      })
    }
  },

  /**
   * Get UserOperation status from bundler mempool
   */
  debug_bundler_getUserOperationStatus: async (params) => {
    const [userOpHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    try {
      const response = await fetch(network.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'debug_bundler_getUserOperationStatus',
          params: [userOpHash],
        }),
      })
      const json = await response.json()
      return json.result ?? null
    } catch {
      return null
    }
  },

  /**
   * Get supported entry points
   */
  eth_supportedEntryPoints: async () => {
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      // Return default entry points if bundler not configured
      return [getEntryPointForChain()]
    }

    try {
      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint: getEntryPointForChain(network.chainId),
        chainId: BigInt(network.chainId),
      })
      return await bundlerClient.getSupportedEntryPoints()
    } catch {
      // Fallback to default entry points
      return [getEntryPointForChain()]
    }
  },
}
