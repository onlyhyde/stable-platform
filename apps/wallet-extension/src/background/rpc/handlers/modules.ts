import type { Address, Hex } from 'viem'
import { getAddress, isAddress } from 'viem/utils'
import {
  approvalController,
  buildKernelInstallData,
  createBundlerClient,
  createModuleOperationClient,
  createRpcError,
  ENTRY_POINT_ABI,
  getEntryPointForChain,
  getModuleTypeName,
  getNonceKeyForAccount,
  getPublicClient,
  handleApprovalError,
  keyringController,
  type ModuleType,
  normalizeAccountId,
  RPC_ERRORS,
  RpcError,
  type RpcHandler,
  resolveFactory,
  signUserOp,
  sponsorAndSign,
  type UserOperation,
  walletState,
} from './shared'

export const modulesHandlers: Record<string, RpcHandler> = {
  /**
   * Install a module on a Smart Account (ERC-7579)
   * Custom RPC method for module management
   */
  stablenet_installModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleAddress: Address
        moduleType: string
        initData: Hex | Record<string, unknown>
        initDataEncoded: boolean
        chainId: number
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module installation parameters',
      })
    }

    const {
      account,
      moduleAddress,
      moduleType,
      initData,
      initDataEncoded,
      chainId,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(moduleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
      })
    }

    // Verify account is connected (case-insensitive)
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

    // Get network configuration
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

    // Parse module type from string to ModuleType
    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    // Determine module-specific init data
    const moduleSpecificData: Hex = initDataEncoded ? (initData as Hex) : ('0x' as Hex)

    // Wrap in Kernel v3 format: [hook(20 bytes)][ABI-encoded struct]
    // Validators need (validatorData, hookData, selectorData) wrapping
    // Executors need (executorData, hookData) wrapping
    const kernelInitData = buildKernelInstallData(moduleTypeParsed, moduleSpecificData)

    // Create module operation client and prepare calldata
    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareInstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      initData: kernelInitData,
    })

    // Build a UserOperation to execute the module installation
    // This calls the smart account's installModule function
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

    // Get gas prices
    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    // Create UserOperation
    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo?.factory ?? undefined,
      factoryData: factoryInfo?.factoryData ?? undefined,
      callData: moduleCalldata.data,
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

    // Calculate estimated gas cost for approval display (pre-paymaster estimate)
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI)
    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          account, // Smart account is both from and to
          BigInt(0),
          moduleCalldata.data,
          estimatedGasCost,
          `Install ${moduleTypeNameStr} Module`,
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_installModule', origin })
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
          const message = err.message?.includes('fetch')
            ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
            : err.message || 'Module installation failed'
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message,
            data: err.data,
          })
        }
      }
      // sponsorAndSign returned null → fall through to self-pay
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
      const message = err.message?.includes('fetch')
        ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
        : err.message || 'Module installation failed'
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message,
        data: err.data,
      })
    }
  },

  /**
   * Uninstall a module from a Smart Account (ERC-7579)
   * Custom RPC method for module management
   */
  stablenet_uninstallModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleAddress: Address
        moduleType: string
        chainId: number
        deInitData?: Hex
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module uninstallation parameters',
      })
    }

    const {
      account,
      moduleAddress,
      moduleType,
      chainId,
      deInitData = '0x' as Hex,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(moduleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
      })
    }

    // Verify account is connected (case-insensitive)
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

    // Get network configuration
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
    const bundlerUrl = network.bundlerUrl

    // Parse module type from string to ModuleType
    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    // Create module operation client and prepare calldata
    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareUninstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      deInitData,
    })

    // Build a UserOperation to execute the module uninstallation
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

    // Get gas prices
    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo2 = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    // Create UserOperation
    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo2?.factory ?? undefined,
      factoryData: factoryInfo2?.factoryData ?? undefined,
      callData: moduleCalldata.data,
      callGasLimit: BigInt(300000),
      verificationGasLimit: BigInt(300000),
      preVerificationGas: BigInt(100000),
      maxFeePerGas: feeData.maxFeePerGas ?? BigInt(1e9),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? BigInt(1e8),
      paymaster: undefined,
      paymasterVerificationGasLimit: undefined,
      paymasterPostOpGasLimit: undefined,
      paymasterData: undefined,
      signature: '0x',
    }

    // Calculate estimated gas cost for approval display
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI requests)
    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          account,
          BigInt(0),
          moduleCalldata.data,
          estimatedGasCost,
          `Uninstall ${moduleTypeNameStr} Module`,
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_uninstallModule', origin })
      }
    }

    // Helper to submit and handle uninstall-specific errors
    const submitUninstallOp = async (signedOp: UserOperation) => {
      try {
        const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
        const userOpHash = await bundlerClient.sendUserOperation(signedOp)
        return { hash: userOpHash }
      } catch (error) {
        const err = error as Error & { code?: number; data?: unknown }

        // Detect ModuleOnUninstallFailed and suggest forceUninstallModule
        const errMsg = err.message ?? ''
        if (
          errMsg.includes('Module rejected uninstall') ||
          errMsg.includes('0x45b4a14f') ||
          errMsg.includes('ModuleOnUninstallFailed')
        ) {
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message:
              'Module rejected uninstall operation. Use stablenet_forceUninstallModule for emergency removal.',
            data: { ...((err.data as object) ?? {}), suggestForceUninstall: true },
          })
        }

        const message = err.message?.includes('fetch')
          ? `Bundler unreachable (${bundlerUrl}): ${err.message}`
          : err.message || 'Module uninstallation failed'
        throw createRpcError({
          code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
          message,
          data: err.data,
        })
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
        bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId, origin)
        },
      })

      if (signedUserOp) {
        return submitUninstallOp(signedUserOp)
      }
      // sponsorAndSign returned null → fall through to self-pay
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

    return submitUninstallOp(signedUserOp)
  },

  /**
   * Force uninstall a module from a Smart Account (ERC-7579)
   * Uses ExcessivelySafeCall — module onUninstall() revert is ignored.
   */
  stablenet_forceUninstallModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleAddress: Address
        moduleType: string
        chainId: number
        deInitData?: Hex
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module force uninstallation parameters',
      })
    }

    const {
      account,
      moduleAddress,
      moduleType,
      chainId,
      deInitData = '0x' as Hex,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(moduleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
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

    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareForceUninstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      deInitData,
    })

    const client = getPublicClient(network.rpcUrl)
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
      callData: moduleCalldata.data,
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

    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          account,
          BigInt(0),
          moduleCalldata.data,
          estimatedGasCost,
          `Force Uninstall ${moduleTypeNameStr} Module`,
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_forceUninstallModule', origin })
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
          const message = err.message?.includes('fetch')
            ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
            : err.message || 'Module force uninstallation failed'
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message,
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
      const message = err.message?.includes('fetch')
        ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
        : err.message || 'Module force uninstallation failed'
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message,
        data: err.data,
      })
    }
  },

  /**
   * Replace a module atomically on a Smart Account (ERC-7579)
   * Old module is uninstalled and new module is installed in a single transaction.
   * If the new module install fails, the old module remains.
   */
  stablenet_replaceModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleType: string
        oldModuleAddress: Address
        deInitData?: Hex
        newModuleAddress: Address
        initData: Hex | Record<string, unknown>
        initDataEncoded: boolean
        chainId: number
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module replacement parameters',
      })
    }

    const {
      account,
      moduleType,
      oldModuleAddress,
      deInitData = '0x' as Hex,
      newModuleAddress,
      initData,
      initDataEncoded,
      chainId,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(oldModuleAddress) || !isAddress(newModuleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
      })
    }

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

    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    const moduleSpecificData: Hex = initDataEncoded ? (initData as Hex) : ('0x' as Hex)
    const kernelInitData = buildKernelInstallData(moduleTypeParsed, moduleSpecificData)

    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareReplaceModule(account, {
      moduleType: moduleTypeParsed,
      oldModuleAddress,
      deInitData,
      newModuleAddress,
      initData: kernelInitData,
    })

    const client = getPublicClient(network.rpcUrl)
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
      callData: moduleCalldata.data,
      callGasLimit: BigInt(800000),
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

    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          account,
          BigInt(0),
          moduleCalldata.data,
          estimatedGasCost,
          `Replace ${moduleTypeNameStr} Module`,
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_replaceModule', origin })
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
          const message = err.message?.includes('fetch')
            ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
            : err.message || 'Module replacement failed'
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message,
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
      const message = err.message?.includes('fetch')
        ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
        : err.message || 'Module replacement failed'
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message,
        data: err.data,
      })
    }
  },

  /**
   * Set the root validator for a Smart Account (Kernel)
   */
  stablenet_setRootValidator: async (params, origin) => {
    const [requestParams] = params as [
      { account: string; validator: string; validatorData?: string; chainId: number },
    ]
    const { account, validator, validatorData, chainId } = requestParams

    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }
    if (!validator || !isAddress(validator)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid validator address is required',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    try {
      const { KERNEL_ABI } = await import('@stablenet/core')
      const { encodeFunctionData } = await import('viem')

      const callData = encodeFunctionData({
        abi: KERNEL_ABI,
        functionName: 'setRootValidator',
        args: [validator as Address, (validatorData ?? '0x') as `0x${string}`],
      })

      // Send as a transaction to the smart account
      const tx = {
        from: account,
        to: account, // Call on the smart account itself
        data: callData,
        value: '0x0',
      }

      // Use the transactionsHandlers.eth_sendTransaction via dynamic import
      const { transactionsHandlers } = await import('./transactions')
      return await transactionsHandlers.eth_sendTransaction!([tx], origin ?? 'extension', true)
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to set root validator',
      })
    }
  },

  /**
   * Get Smart Account information (root validator, delegation, module counts)
   */
  stablenet_getSmartAccountInfo: async (params) => {
    const [requestParams] = params as [{ account: string; chainId: number }]
    const { account, chainId } = requestParams

    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const accountAddr = account as Address

    // Check if account has code (is smart account or delegated)
    let code: string | undefined
    try {
      code = await client.getCode({ address: accountAddr })
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('network')) {
        throw createRpcError({
          code: RPC_ERRORS.INTERNAL_ERROR.code,
          message: `RPC unreachable (${network.rpcUrl}): ${msg}`,
        })
      }
      // Non-network errors (e.g. unsupported method) — treat as no code
      code = undefined
    }
    const { classifyAccountByCode, extractDelegateAddress } = await import('@stablenet/core')
    const accountType = classifyAccountByCode(code as Hex | undefined)
    const delegationTarget =
      accountType === 'delegated' ? getAddress(extractDelegateAddress(code as Hex)!) : null

    let rootValidator: string | null = null
    let accountId: string | null = null

    // Only query on-chain data if account is smart or delegated
    if (accountType === 'smart' || accountType === 'delegated') {
      try {
        const { KERNEL_ABI } = await import('@stablenet/core')
        rootValidator = (await client
          .readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'rootValidator',
          })
          .catch(() => null)) as string | null

        const rawAccountId = (await client
          .readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'accountId',
          })
          .catch(() => null)) as string | null

        // Normalize accountId: both "kernel.advanced.v0.3.3" and "kernel.advanced.0.3.3"
        // should be recognized as the same Kernel v0.3.3 account
        accountId = rawAccountId ? normalizeAccountId(rawAccountId) : null
      } catch {
        // Contract may not support these methods
      }
    }

    // Sync stored account type if on-chain state differs
    const storedAccount = walletState
      .getState()
      .accounts.accounts.find((a) => a.address.toLowerCase() === accountAddr.toLowerCase())
    if (storedAccount && storedAccount.type !== accountType) {
      walletState
        .updateAccount(accountAddr, {
          type: accountType,
          ...(delegationTarget ? { delegateAddress: delegationTarget as Address } : {}),
        })
        .catch(() => {})
    }

    return {
      accountType,
      isDeployed: !!code && code !== '0x',
      rootValidator,
      accountId,
      delegationTarget,
      isDelegated: accountType === 'delegated',
    }
  },

  /**
   * Get module registry entries (for marketplace browsing)
   */
  stablenet_getRegistryModules: async (params) => {
    const [requestParams] = params as [{ chainId?: number; type?: number } | undefined]

    try {
      const { createModuleRegistry } = await import('@stablenet/core')
      const chainId = requestParams?.chainId ?? walletState.getCurrentNetwork()?.chainId ?? 1
      const registry = createModuleRegistry({ chainId })

      let modules = registry.getAll()

      // Filter by type if specified
      const filterType = requestParams?.type
      if (filterType !== undefined) {
        const filterBigInt = BigInt(filterType)
        modules = modules.filter((m) => m.metadata.type === filterBigInt)
      }

      return { modules }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to fetch registry modules',
      })
    }
  },

  /**
   * Get installed modules for a Smart Account (ERC-7579)
   * Checks each registry module against the on-chain account
   */
  stablenet_getInstalledModules: async (params) => {
    const [requestParams] = params as [{ account: string; chainId: number }]
    const { account, chainId } = requestParams ?? {}

    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const accountAddr = account as Address

    // Verify account has code (smart account or delegated)
    let code: string | undefined
    try {
      code = await client.getCode({ address: accountAddr })
    } catch (err) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: `RPC unreachable (${network.rpcUrl}): ${(err as Error).message}`,
      })
    }

    const hasCode = !!code && code !== '0x'
    if (!hasCode) {
      // EOA without code — no modules can be installed
      return { modules: [] }
    }

    try {
      const { createModuleRegistry, KERNEL_ABI, MODULE_STATUS } = await import('@stablenet/core')
      const registry = createModuleRegistry({ chainId })
      const registryModules = registry.getAll()

      const installed: Array<{
        address: string
        type: bigint
        metadata: {
          address: string
          type: bigint
          name: string
          description: string
          version: string
        }
        initData: string
        status: string
        installedAt: number
      }> = []

      // Check each registry module against the on-chain account
      for (const entry of registryModules) {
        const moduleAddr = registry.getModuleAddress(entry)
        if (!moduleAddr) continue

        try {
          const isInstalled = await client.readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'isModuleInstalled',
            args: [entry.metadata.type, moduleAddr, '0x'],
          })

          if (isInstalled) {
            installed.push({
              address: moduleAddr,
              type: entry.metadata.type,
              metadata: {
                address: moduleAddr,
                type: entry.metadata.type,
                name: entry.metadata.name,
                description: entry.metadata.description,
                version: entry.metadata.version,
              },
              initData: '0x',
              status: MODULE_STATUS.INSTALLED,
              installedAt: Date.now(),
            })
          }
        } catch {
          // Module may not support isModuleInstalled — skip
        }
      }

      return { modules: installed }
    } catch (error) {
      // Re-throw RpcError as-is
      if (error instanceof RpcError) throw error
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to fetch installed modules',
      })
    }
  },
}
