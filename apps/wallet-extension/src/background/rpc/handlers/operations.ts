import type { Address, Hex } from 'viem'
import { isAddress } from 'viem/utils'
import {
  approvalController,
  createBundlerClient,
  createRpcError,
  ENTRY_POINT_ABI,
  encodeKernelExecute,
  fetchFromPaymaster,
  getEntryPointForChain,
  getNonceKeyForAccount,
  getPublicClient,
  handleApprovalError,
  keyringController,
  logger,
  RPC_ERRORS,
  type RpcHandler,
  resolveFactory,
  signUserOp,
  sponsorAndSign,
  type UserOperation,
  walletState,
} from './shared'

export const operationsHandlers: Record<string, RpcHandler> = {
  /**
   * Execute a token swap through the installed Swap Executor module (ERC-7579)
   * Encodes the swap calldata and submits as a UserOperation
   */
  stablenet_executeSwap: async (params, origin) => {
    const [swapParams] = params as [
      {
        account: Address
        swapExecutorAddress: Address
        tokenIn: Address
        tokenOut: Address
        fee: number
        amountIn: string
        amountOutMinimum: string
        deadline: string
        chainId: number
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!swapParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing swap parameters',
      })
    }

    const {
      account,
      swapExecutorAddress,
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      amountOutMinimum,
      deadline,
      chainId,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = swapParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }
    if (!isAddress(swapExecutorAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid swap executor address',
      })
    }
    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid token address',
      })
    }

    // Verify account is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAccount = account.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAccount)
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }
    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Encode swap calldata using SWAP_EXECUTOR_ABI
    const { encodeFunctionData } = await import('viem')
    const { SWAP_EXECUTOR_ABI } = await import('@stablenet/core')

    const swapCalldata = encodeFunctionData({
      abi: SWAP_EXECUTOR_ABI,
      functionName: 'swapExactInputSingle',
      args: [tokenIn, tokenOut, fee, BigInt(amountIn), BigInt(amountOutMinimum), BigInt(deadline)],
    })

    // Encode execution through the Smart Account's execute function
    // The swap executor is called as a module via the Kernel's execute
    const { KERNEL_ABI } = await import('@stablenet/core')
    const { concatHex, numberToHex, pad } = await import('viem')

    // ExecMode: single call (0x00), default exec type
    const execMode = pad('0x00' as `0x${string}`, { size: 32 })

    // executionCalldata: abi.encodePacked(target, value, callData)
    const targetBytes = swapExecutorAddress as `0x${string}`
    const valueBytes = pad(numberToHex(0n), { size: 32 })
    const executionCalldata = concatHex([targetBytes, valueBytes, swapCalldata])

    const callData = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'execute',
      args: [execMode, executionCalldata],
    })

    // Build UserOperation
    const client = getPublicClient(network.rpcUrl)

    // Get current nonce from EntryPoint (authoritative source for ERC-4337)
    const entryPoint = getEntryPointForChain(chainId)
    const nonce = await client
      .readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [account, await getNonceKeyForAccount(account)],
      })
      .catch(() => 0n)

    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo?.factory ?? undefined,
      factoryData: factoryInfo?.factoryData ?? undefined,
      callData,
      callGasLimit: BigInt(500000),
      verificationGasLimit: BigInt(500000),
      preVerificationGas: BigInt(100000),
      maxFeePerGas: feeData.maxFeePerGas ?? BigInt(1e9),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? BigInt(1e8),
      paymaster: undefined,
      paymasterVerificationGasLimit: undefined,
      paymasterPostOpGasLimit: undefined,
      paymasterData: undefined,
      signature: '0x',
    }

    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI requests)
    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          swapExecutorAddress,
          BigInt(0),
          swapCalldata,
          estimatedGasCost,
          'Swap Tokens',
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'stablenet_executeSwap', origin })
      }
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    if (gasPaymentMode !== 'native' && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPaymentMode === 'erc20' && gasPaymentTokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPaymentTokenAddress }
          : {}

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId,
        context: paymasterContext,
        bundlerUrl: network.bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId, origin)
        },
      })

      if (signedUserOp) {
        try {
          const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
          const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
          return { hash: userOpHash }
        } catch (error) {
          const err = error as Error & { code?: number; data?: unknown }
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message: err.message || 'Swap execution failed',
            data: err.data,
          })
        }
      }
    }

    // Self-pay path: sign with EIP-712 and submit directly
    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, chainId, origin)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Swap execution failed',
        data: err.data,
      })
    }
  },

  /**
   * Speed up a pending transaction by resubmitting with higher gas
   */
  stablenet_speedUpTransaction: async (params) => {
    const requestParams = params?.[0] as { hash?: string } | undefined
    if (!requestParams?.hash) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing transaction hash',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    try {
      const client = getPublicClient(network.rpcUrl)
      const tx = await client.getTransaction({ hash: requestParams.hash as `0x${string}` })

      // Build replacement transaction with 10% higher gas
      const bumpFactor = 110n
      const bumpDivisor = 100n

      const replacementTx: Record<string, string> = {
        from: tx.from,
        to: tx.to ?? tx.from,
        nonce: `0x${tx.nonce.toString(16)}`,
        value: `0x${tx.value.toString(16)}`,
        data: tx.input,
      }

      if (tx.maxFeePerGas != null) {
        // EIP-1559
        const newMaxFee = (tx.maxFeePerGas * bumpFactor) / bumpDivisor
        const newPriorityFee = ((tx.maxPriorityFeePerGas ?? 0n) * bumpFactor) / bumpDivisor
        replacementTx.maxFeePerGas = `0x${newMaxFee.toString(16)}`
        replacementTx.maxPriorityFeePerGas = `0x${newPriorityFee.toString(16)}`
      } else if (tx.gasPrice != null) {
        // Legacy
        const newGasPrice = (tx.gasPrice * bumpFactor) / bumpDivisor
        replacementTx.gasPrice = `0x${newGasPrice.toString(16)}`
      }

      if (tx.gas) {
        replacementTx.gas = `0x${tx.gas.toString(16)}`
      }

      // Send the replacement transaction via the existing eth_sendTransaction handler
      const { transactionsHandlers } = await import('./transactions')
      return await transactionsHandlers.eth_sendTransaction!([replacementTx], 'extension', true)
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to speed up transaction',
      })
    }
  },

  /**
   * Cancel a pending transaction by sending a zero-value self-transfer with same nonce
   */
  stablenet_cancelTransaction: async (params) => {
    const requestParams = params?.[0] as { hash?: string } | undefined
    if (!requestParams?.hash) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing transaction hash',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    try {
      const client = getPublicClient(network.rpcUrl)
      const tx = await client.getTransaction({ hash: requestParams.hash as `0x${string}` })

      // Build cancel transaction: same nonce, to=self, value=0, data=0x, higher gas
      const bumpFactor = 110n
      const bumpDivisor = 100n

      const cancelTx: Record<string, string> = {
        from: tx.from,
        to: tx.from, // Self-transfer
        nonce: `0x${tx.nonce.toString(16)}`,
        value: '0x0',
        data: '0x',
      }

      if (tx.maxFeePerGas != null) {
        const newMaxFee = (tx.maxFeePerGas * bumpFactor) / bumpDivisor
        const newPriorityFee = ((tx.maxPriorityFeePerGas ?? 0n) * bumpFactor) / bumpDivisor
        cancelTx.maxFeePerGas = `0x${newMaxFee.toString(16)}`
        cancelTx.maxPriorityFeePerGas = `0x${newPriorityFee.toString(16)}`
      } else if (tx.gasPrice != null) {
        const newGasPrice = (tx.gasPrice * bumpFactor) / bumpDivisor
        cancelTx.gasPrice = `0x${newGasPrice.toString(16)}`
      }

      // Minimal gas for a simple transfer
      cancelTx.gas = '0x5208' // 21000

      const { transactionsHandlers } = await import('./transactions')
      return await transactionsHandlers.eth_sendTransaction!([cancelTx], 'extension', true)
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to cancel transaction',
      })
    }
  },

  /**
   * Estimate gas for multi-mode transactions
   * Used by the Send UI to show estimated gas cost before sending
   */
  stablenet_estimateGas: async (params) => {
    const [estimateParams] = params as [
      {
        mode?: string
        from?: string
        to?: string
        value?: string
        data?: string
        gasPayment?: { type: string; tokenAddress?: string }
        chainId?: number
      },
    ]

    if (!estimateParams?.from || !estimateParams?.to) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing from or to address',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    try {
      // Parse value - handle both hex and decimal string formats
      let parsedValue = 0n
      if (estimateParams.value) {
        const val = estimateParams.value
        parsedValue = val.startsWith('0x') ? BigInt(val) : BigInt(val)
      }

      // Smart Account mode: estimate via bundler
      if (estimateParams.mode === 'smart_account' && network.bundlerUrl) {
        const entryPoint = getEntryPointForChain(network.chainId)
        const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })

        // Build a partial UserOperation for estimation
        // Encode callData through Kernel execute() for proper Smart Account execution
        const partialUserOp: Partial<UserOperation> = {
          sender: estimateParams.from as Address,
          callData: encodeKernelExecute(
            estimateParams.to as Address,
            parsedValue,
            (estimateParams.data as Hex) || '0x'
          ),
          // Dummy values for estimation - bundler will calculate actual gas
          nonce: 0n,
          signature: '0x' as Hex,
          callGasLimit: 0n,
          verificationGasLimit: 0n,
          preVerificationGas: 0n,
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
        }

        // If gasPayment is sponsor/erc20/permit2, fetch paymaster stub for accurate estimation
        const gasPayment = estimateParams.gasPayment
        const hasPaymaster =
          gasPayment && gasPayment.type !== 'none' && gasPayment.type !== 'self-pay'

        if (hasPaymaster && network.paymasterUrl) {
          try {
            const chainIdHex = `0x${(network.chainId).toString(16)}`
            const paymasterContext: Record<string, unknown> =
              gasPayment.type === 'erc20' && gasPayment.tokenAddress
                ? { paymasterType: 'erc20', tokenAddress: gasPayment.tokenAddress }
                : {}

            const userOpHex = {
              sender: estimateParams.from,
              nonce: '0x0',
              callData: partialUserOp.callData,
              callGasLimit: '0x0',
              verificationGasLimit: '0x0',
              preVerificationGas: '0x0',
              maxFeePerGas: '0x0',
              maxPriorityFeePerGas: '0x0',
              signature: '0x',
            }

            const stubResult = (await fetchFromPaymaster(
              network.paymasterUrl,
              'pm_getPaymasterStubData',
              [userOpHex, entryPoint, chainIdHex, paymasterContext]
            )) as
              | {
                  paymaster?: string
                  paymasterData?: string
                  paymasterVerificationGasLimit?: string
                  paymasterPostOpGasLimit?: string
                }
              | undefined

            if (stubResult?.paymaster) {
              partialUserOp.paymaster = stubResult.paymaster as Address
              partialUserOp.paymasterData = (stubResult.paymasterData ?? '0x') as Hex
              partialUserOp.paymasterVerificationGasLimit = BigInt(
                stubResult.paymasterVerificationGasLimit ?? '0'
              )
              partialUserOp.paymasterPostOpGasLimit = BigInt(
                stubResult.paymasterPostOpGasLimit ?? '0'
              )
            }
          } catch (stubError) {
            logger.warn('Paymaster stub fetch failed for gas estimation, proceeding without', {
              error: stubError,
            })
          }
        }

        try {
          const gasEstimate = await bundlerClient.estimateUserOperationGas(
            partialUserOp as UserOperation
          )

          // Get fee data for cost calculation
          const block = await client.getBlock({ blockTag: 'latest' })
          const baseFee = block.baseFeePerGas ?? 0n
          const maxPriorityFeePerGas = await client
            .estimateMaxPriorityFeePerGas()
            .catch(() => 1000000000n)
          const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

          const totalGas =
            gasEstimate.preVerificationGas +
            gasEstimate.verificationGasLimit +
            gasEstimate.callGasLimit +
            (gasEstimate.paymasterVerificationGasLimit ?? 0n) +
            (gasEstimate.paymasterPostOpGasLimit ?? 0n)
          const estimatedCost = totalGas * maxFeePerGas

          return {
            gasLimit: totalGas.toString(),
            maxFeePerGas: maxFeePerGas.toString(),
            maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
            estimatedCost: estimatedCost.toString(),
            preVerificationGas: gasEstimate.preVerificationGas.toString(),
            verificationGasLimit: gasEstimate.verificationGasLimit.toString(),
            callGasLimit: gasEstimate.callGasLimit.toString(),
            ...(gasEstimate.paymasterVerificationGasLimit != null && {
              paymasterVerificationGasLimit: gasEstimate.paymasterVerificationGasLimit.toString(),
            }),
            ...(gasEstimate.paymasterPostOpGasLimit != null && {
              paymasterPostOpGasLimit: gasEstimate.paymasterPostOpGasLimit.toString(),
            }),
          }
        } catch (bundlerError) {
          logger.warn('Bundler gas estimation failed, falling back to RPC', { error: bundlerError })
          // Fall through to standard estimation below
        }
      }

      // Standard EOA/EIP-7702 gas estimation
      const gasLimit = await client.estimateGas({
        account: estimateParams.from as Address,
        to: estimateParams.to as Address,
        value: parsedValue,
        data: (estimateParams.data as `0x${string}`) || undefined,
      })

      // Get current gas price (try EIP-1559 first)
      let maxFeePerGas = 0n
      let maxPriorityFeePerGas = 0n

      try {
        const block = await client.getBlock({ blockTag: 'latest' })
        const baseFee = block.baseFeePerGas ?? 0n
        maxPriorityFeePerGas = await client.estimateMaxPriorityFeePerGas().catch(() => 1000000000n) // 1 gwei fallback
        maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas
      } catch {
        // Fallback to legacy gas price
        const gasPrice = await client.getGasPrice()
        maxFeePerGas = gasPrice
        maxPriorityFeePerGas = gasPrice
      }

      const estimatedCost = gasLimit * maxFeePerGas

      return {
        gasLimit: gasLimit.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        estimatedCost: estimatedCost.toString(),
      }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to estimate gas',
      })
    }
  },
}
