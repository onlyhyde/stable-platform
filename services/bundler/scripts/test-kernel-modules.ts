/**
 * Kernel v3 Module Install/Uninstall E2E Test (EIP-7702)
 *
 * Tests the agent delegation use case:
 *   1. Verify EIP-7702 delegation to Kernel impl
 *   2. Install ECDSAValidator with agent EOA as owner
 *   3. Agent signs UserOp to transfer USDC (proving agent can operate EOA's assets)
 *   4. Install SessionKeyExecutor with agent as session key
 *   5. Uninstall both modules (revoke all agent permissions)
 *
 * Pre-conditions:
 *   - EOA (0x1D828C...) has EIP-7702 delegation to Kernel impl
 *   - EOA has USDC balance
 *   - Deployer has native balance (paymaster signer)
 */
import {
  type Address,
  concat,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  pad,
  parseAbi,
  toHex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

// ============================================================================
// Configuration
// ============================================================================
const CONFIG = {
  rpcUrl: 'http://localhost:8501',
  bundlerUrl: 'http://localhost:4337',
  chainId: 8283,
  chainIdBigInt: 8283n,
  entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
  ecdsaValidator: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
  sessionKeyExecutor: '0x621b0872c00f6328bd9001a121af09dd18b193e0' as Address,
  kernelImpl: '0xa61b944dd427a85495b685d93237cb73087e0035' as Address,
  verifyingPaymaster: '0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0' as Address,
  erc20Paymaster: '0xaf420bfe67697a5724235e4676136f264023d099' as Address,
  usdc: '0x085ee10cc10be8fb2ce51feb13e809a0c3f98699' as Address,
  // EOA that became smart account via EIP-7702 delegation
  eoaPrivateKey: '0x80183f2d3db76f59e257602ed657302c71c808ddc44e0ba9110a689145c138dd' as Hex,
  // Deployer (native balance holder, paymaster signer)
  deployerPrivateKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
}

const CHAIN = {
  id: CONFIG.chainId,
  name: 'StableNet Local',
  nativeCurrency: { name: 'WKRC', symbol: 'WKRC', decimals: 18 },
  rpcUrls: { default: { http: [CONFIG.rpcUrl] } },
} as const

// ============================================================================
// ABIs
// ============================================================================
const KERNEL_ACCOUNT_ABI = parseAbi([
  'function execute(bytes32 mode, bytes calldata executionCalldata) payable',
  'function installModule(uint256 moduleType, address module, bytes calldata initData) payable',
  'function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData) payable',
  'function isModuleInstalled(uint256 moduleType, address module, bytes calldata additionalContext) view returns (bool)',
])

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])

const ECDSA_VALIDATOR_ABI = parseAbi([
  'function ecdsaValidatorStorage(address) view returns (address owner)',
])

const SESSION_KEY_EXECUTOR_ABI = [
  {
    type: 'function',
    name: 'getSessionKey',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'sessionKey', type: 'address' },
          { name: 'validAfter', type: 'uint48' },
          { name: 'validUntil', type: 'uint48' },
          { name: 'spendingLimit', type: 'uint256' },
          { name: 'spentAmount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasPermission',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const

const PACKED_USER_OP_COMPONENTS = [
  { name: 'sender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'initCode', type: 'bytes' },
  { name: 'callData', type: 'bytes' },
  { name: 'accountGasLimits', type: 'bytes32' },
  { name: 'preVerificationGas', type: 'uint256' },
  { name: 'gasFees', type: 'bytes32' },
  { name: 'paymasterAndData', type: 'bytes' },
  { name: 'signature', type: 'bytes' },
] as const

const EP_ABI = [
  {
    type: 'function',
    name: 'getUserOpHash',
    inputs: [{ name: 'userOp', type: 'tuple', components: PACKED_USER_OP_COMPONENTS }],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNonce',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// ============================================================================
// Constants
// ============================================================================
const MODULE_TYPE_VALIDATOR = 1n
const MODULE_TYPE_EXECUTOR = 2n
const HOOK_MODULE_INSTALLED = pad('0x01', { size: 20 }) as Address // address(1)

// ERC20.transfer selector
const TRANSFER_SELECTOR = '0xa9059cbb' as Hex
// Kernel.execute(bytes32,bytes) selector
const EXECUTE_SELECTOR = '0xe9ae5c53' as Hex

// ============================================================================
// Helpers
// ============================================================================
function packGasLimits(a: bigint, b: bigint): Hex {
  return concat([pad(toHex(a), { size: 16 }), pad(toHex(b), { size: 16 })]) as Hex
}

function computePaymasterHash(params: {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: bigint
  gasFees: Hex
  chainId: bigint
  paymasterAddress: Address
  validUntil: bigint
  validAfter: bigint
  senderNonce: bigint
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint48' },
        { type: 'uint48' },
        { type: 'uint256' },
      ],
      [
        params.sender,
        params.nonce,
        keccak256(params.initCode),
        keccak256(params.callData),
        params.accountGasLimits as `0x${string}`,
        params.preVerificationGas,
        params.gasFees as `0x${string}`,
        params.chainId,
        params.paymasterAddress,
        Number(params.validUntil),
        Number(params.validAfter),
        params.senderNonce,
      ]
    )
  )
}

async function sendUserOp(bundlerUrl: string, op: Record<string, unknown>, entryPoint: Address) {
  const response = await fetch(bundlerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_sendUserOperation',
      params: [op, entryPoint],
      id: 1,
    }),
  })
  return response.json()
}

async function waitForReceipt(bundlerUrl: string, hash: string, maxWait = 30000): Promise<unknown> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 2000))
    const res = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getUserOperationReceipt',
        params: [hash],
        id: 2,
      }),
    })
    const data = await res.json()
    if (data.result) return data.result
  }
  return null
}

/**
 * Encode validator nonce key for EntryPoint.getNonce()
 * Layout (uint192): [mode(8)][vType(8)][validatorAddr(160)][nonceKey(16)]
 *
 * Mirrors Kernel's ValidationTypeLib.encodeAsNonceKey:
 *   res := or(nonceKey, shr(80, validationIdWithoutType))
 *   res := or(res, shr(72, vType))
 *   res := or(res, shr(64, mode))
 */
function encodeValidatorNonceKey(validatorAddr: Address, nonceKey = 0): bigint {
  const mode = 0x00n // DEFAULT mode
  const vType = 0x01n // VALIDATION_TYPE_VALIDATOR
  const addr = BigInt(validatorAddr)

  // uint192 layout: [mode(8)][vType(8)][validatorAddr(160)][nonceKey(16)]
  // mode at bits [191:184], vType at bits [183:176], addr at bits [175:16], nonceKey at bits [15:0]
  return (mode << 184n) | (vType << 176n) | (addr << 16n) | BigInt(nonceKey)
}

/**
 * Build, sign, and send a UserOp with VerifyingPaymaster sponsorship
 */
async function buildAndSendSponsoredUserOp(params: {
  publicClient: unknown
  sender: Address
  callData: Hex
  signer: ReturnType<typeof privateKeyToAccount>
  deployerSigner: ReturnType<typeof privateKeyToAccount>
  nonceKey?: bigint
  label: string
}): Promise<{ success: boolean; receipt: unknown; error?: unknown }> {
  const { publicClient, sender, callData, signer, deployerSigner, label: _label } = params
  const nonceKey = params.nonceKey ?? 0n

  // Get nonce
  const epNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [sender, nonceKey],
  })) as bigint

  // Gas params
  const vgl = 500000n,
    cgl = 300000n,
    pvg = 100000n
  const mpfpg = 1000000000n,
    mfpg = 2000000000n
  const pmvgl = 200000n,
    pmpog = 100000n
  const agl = packGasLimits(vgl, cgl)
  const gf = packGasLimits(mpfpg, mfpg)

  // VerifyingPaymaster signature
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600)
  const validAfter = 0n
  const senderNonce = (await publicClient.readContract({
    address: CONFIG.verifyingPaymaster,
    abi: parseAbi(['function senderNonce(address) view returns (uint256)']),
    functionName: 'senderNonce',
    args: [sender],
  })) as bigint

  const pmHash = computePaymasterHash({
    sender,
    nonce: epNonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits: agl,
    preVerificationGas: pvg,
    gasFees: gf,
    chainId: CONFIG.chainIdBigInt,
    paymasterAddress: CONFIG.verifyingPaymaster,
    validUntil,
    validAfter,
    senderNonce,
  })
  const pmSig = await deployerSigner.signMessage({ message: { raw: pmHash } })
  const pmData = concat([
    pad(toHex(validUntil), { size: 6 }),
    pad(toHex(validAfter), { size: 6 }),
    pmSig,
  ]) as Hex
  const pmAndData = concat([
    CONFIG.verifyingPaymaster,
    pad(toHex(pmvgl), { size: 16 }),
    pad(toHex(pmpog), { size: 16 }),
    pmData,
  ]) as Hex

  // Build packed op and get hash
  const packedOp = {
    sender,
    nonce: epNonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits: agl,
    preVerificationGas: pvg,
    gasFees: gf,
    paymasterAndData: pmAndData,
    signature: '0x' as Hex,
  }
  const userOpHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex
  const userOpSig = await signer.signMessage({ message: { raw: userOpHash } })
  const result = await sendUserOp(
    CONFIG.bundlerUrl,
    {
      sender,
      nonce: toHex(epNonce),
      callData,
      callGasLimit: toHex(cgl),
      verificationGasLimit: toHex(vgl),
      preVerificationGas: toHex(pvg),
      maxFeePerGas: toHex(mfpg),
      maxPriorityFeePerGas: toHex(mpfpg),
      paymaster: CONFIG.verifyingPaymaster,
      paymasterData: pmData,
      paymasterVerificationGasLimit: toHex(pmvgl),
      paymasterPostOpGasLimit: toHex(pmpog),
      signature: userOpSig,
    },
    CONFIG.entryPoint
  )

  if (result.error) {
    return { success: false, receipt: null, error: result.error }
  }

  const receipt = await waitForReceipt(CONFIG.bundlerUrl, result.result)
  if (receipt) {
  } else {
  }

  return { success: receipt?.success === true, receipt }
}

/**
 * Build, sign, and send a UserOp with ERC20Paymaster (USDC gas payment)
 */
async function buildAndSendErc20PaymasterUserOp(params: {
  publicClient: unknown
  sender: Address
  callData: Hex
  signer: ReturnType<typeof privateKeyToAccount>
  nonceKey?: bigint
  label: string
}): Promise<{ success: boolean; receipt: unknown; error?: unknown }> {
  const { publicClient, sender, callData, signer, label: _label2 } = params
  const nonceKey = params.nonceKey ?? 0n

  // Get nonce
  const epNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [sender, nonceKey],
  })) as bigint

  // Gas params
  const vgl = 500000n,
    cgl = 300000n,
    pvg = 100000n
  const mpfpg = 1000000000n,
    mfpg = 2000000000n
  const pmvgl = 200000n,
    pmpog = 200000n
  const agl = packGasLimits(vgl, cgl)
  const gf = packGasLimits(mpfpg, mfpg)

  // ERC20Paymaster paymasterData = token address (20 bytes)
  const erc20PmData = CONFIG.usdc as Hex
  const pmAndData = concat([
    CONFIG.erc20Paymaster,
    pad(toHex(pmvgl), { size: 16 }),
    pad(toHex(pmpog), { size: 16 }),
    erc20PmData,
  ]) as Hex

  // Build packed op and get hash
  const packedOp = {
    sender,
    nonce: epNonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits: agl,
    preVerificationGas: pvg,
    gasFees: gf,
    paymasterAndData: pmAndData,
    signature: '0x' as Hex,
  }
  const userOpHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex
  const userOpSig = await signer.signMessage({ message: { raw: userOpHash } })
  const result = await sendUserOp(
    CONFIG.bundlerUrl,
    {
      sender,
      nonce: toHex(epNonce),
      callData,
      callGasLimit: toHex(cgl),
      verificationGasLimit: toHex(vgl),
      preVerificationGas: toHex(pvg),
      maxFeePerGas: toHex(mfpg),
      maxPriorityFeePerGas: toHex(mpfpg),
      paymaster: CONFIG.erc20Paymaster,
      paymasterData: erc20PmData,
      paymasterVerificationGasLimit: toHex(pmvgl),
      paymasterPostOpGasLimit: toHex(pmpog),
      signature: userOpSig,
    },
    CONFIG.entryPoint
  )

  if (result.error) {
    return { success: false, receipt: null, error: result.error }
  }

  const receipt = await waitForReceipt(CONFIG.bundlerUrl, result.result)
  if (receipt) {
  } else {
  }

  return { success: receipt?.success === true, receipt }
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const eoaSigner = privateKeyToAccount(CONFIG.eoaPrivateKey)
  const deployerSigner = privateKeyToAccount(CONFIG.deployerPrivateKey)

  // Generate a fresh agent private key for this test
  const agentPrivateKey = generatePrivateKey()
  const agentSigner = privateKeyToAccount(agentPrivateKey)

  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })
  const deployerWallet = createWalletClient({
    account: deployerSigner,
    transport: http(CONFIG.rpcUrl),
    chain: CHAIN,
  })

  const eoaAddress = eoaSigner.address
  const agentAddress = agentSigner.address

  const results: { step: string; success: boolean }[] = []

  let eoaCode = await publicClient.getCode({ address: eoaAddress })
  let isDelegated = eoaCode && eoaCode !== '0x' && eoaCode.toLowerCase().startsWith('0xef0100')

  if (!isDelegated) {
    const eoaExternalNonce = await publicClient.getTransactionCount({ address: eoaAddress })

    const authorization = await eoaSigner.signAuthorization({
      contractAddress: CONFIG.kernelImpl,
      chainId: CONFIG.chainId,
      nonce: eoaExternalNonce,
    })

    const txHash = await deployerWallet.sendTransaction({
      to: eoaAddress,
      authorizationList: [authorization],
      gas: 100000n,
    })
    const _receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    eoaCode = await publicClient.getCode({ address: eoaAddress })
    isDelegated = eoaCode && eoaCode !== '0x' && eoaCode.toLowerCase().startsWith('0xef0100')
  }

  if (isDelegated && eoaCode) {
    const _delegateAddr = `0x${eoaCode.slice(8, 48)}`
    results.push({ step: 'Step 1: Delegation', success: true })
  } else {
    results.push({ step: 'Step 1: Delegation', success: false })
    printSummary(results)
    return
  }

  // Build initData for installModule(VALIDATOR)
  // Hook = address(1) = HOOK_MODULE_INSTALLED (no actual hook, just flag)
  const validatorInitData = buildValidatorInstallData({
    hook: HOOK_MODULE_INSTALLED,
    validatorData: agentAddress as Hex, // ECDSAValidator.onInstall reads first 20 bytes as owner
    hookData: '0x' as Hex,
    selectorData: EXECUTE_SELECTOR, // Grant access to execute(bytes32,bytes) selector
  })

  const installValidatorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'installModule',
    args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, validatorInitData],
  })

  const step2Result = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: installValidatorCallData,
    signer: eoaSigner, // EOA signs (root validation)
    deployerSigner,
    label: 'installModule(VALIDATOR)',
  })

  if (step2Result.success) {
    // Verify: isModuleInstalled
    const isInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, '0x' as Hex],
    })) as boolean

    // Verify: ECDSAValidator.ecdsaValidatorStorage(eoaAddress).owner == agent
    const storedOwner = (await publicClient.readContract({
      address: CONFIG.ecdsaValidator,
      abi: ECDSA_VALIDATOR_ABI,
      functionName: 'ecdsaValidatorStorage',
      args: [eoaAddress],
    })) as Address

    const step2Ok = isInstalled && storedOwner.toLowerCase() === agentAddress.toLowerCase()
    results.push({ step: 'Step 2: ECDSAValidator Install', success: step2Ok })
    if (step2Ok) {
    } else {
    }
  } else {
    results.push({ step: 'Step 2: ECDSAValidator Install', success: false })
    printSummary(results)
    return
  }

  const transferRecipient = deployerSigner.address
  const transferAmount = 1000000n // 1 USDC (6 decimals)

  const _usdcBefore = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [eoaAddress],
  })) as bigint
  const recipientUsdcBefore = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [transferRecipient],
  })) as bigint

  // Nonce key for installed ECDSAValidator
  const validatorNonceKey = encodeValidatorNonceKey(CONFIG.ecdsaValidator)

  // Build callData: execute(mode, encodePacked(USDC, 0, transfer(recipient, amount)))
  const execMode = `0x${'00'.repeat(32)}` as Hex
  const transferCalldata = encodeFunctionData({
    abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
    functionName: 'transfer',
    args: [transferRecipient, transferAmount],
  })
  const executionCalldata = concat([
    CONFIG.usdc,
    pad(toHex(0n), { size: 32 }),
    transferCalldata,
  ]) as Hex
  const transferExecCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })

  // Agent signs this UserOp (not EOA) — ECDSAValidator will verify agent's signature
  const step3Result = await buildAndSendErc20PaymasterUserOp({
    publicClient,
    sender: eoaAddress,
    callData: transferExecCallData,
    signer: agentSigner, // Agent signs!
    nonceKey: validatorNonceKey, // Encodes validator info in nonce
    label: 'Agent USDC transfer',
  })

  if (step3Result.success) {
    const _usdcAfter = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [eoaAddress],
    })) as bigint
    const recipientUsdcAfter = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [transferRecipient],
    })) as bigint
    const usdcTransferred = recipientUsdcAfter - recipientUsdcBefore

    const step3Ok = usdcTransferred >= transferAmount
    results.push({ step: 'Step 3: Agent USDC Transfer', success: step3Ok })
    if (step3Ok) {
    } else {
    }
  } else {
    results.push({ step: 'Step 3: Agent USDC Transfer', success: false })
  }

  const validUntilSession = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour from now
  const spendingLimit = 1000000000000000000n // 1 ETH

  // Permissions: allow USDC.transfer
  const permissions = [
    {
      target: CONFIG.usdc,
      selector: TRANSFER_SELECTOR as `0x${string}`,
      maxValue: 0n, // 0 = no ETH value check (ERC20 transfer has value=0)
      allowed: true,
    },
  ]

  const permissionsEncoded = encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { type: 'address', name: 'target' },
          { type: 'bytes4', name: 'selector' },
          { type: 'uint256', name: 'maxValue' },
          { type: 'bool', name: 'allowed' },
        ],
      },
    ],
    [permissions]
  )

  const executorData = encodeAbiParameters(
    [
      { type: 'address' }, // sessionKey
      { type: 'uint48' }, // validAfter
      { type: 'uint48' }, // validUntil
      { type: 'uint256' }, // spendingLimit
      { type: 'bytes' }, // permissionsData
    ],
    [agentAddress, 0, Number(validUntilSession), spendingLimit, permissionsEncoded]
  )

  const executorInitData = buildExecutorInstallData({
    hook: HOOK_MODULE_INSTALLED,
    executorData,
    hookData: '0x' as Hex,
  })

  const installExecutorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'installModule',
    args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, executorInitData],
  })

  const step4Result = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: installExecutorCallData,
    signer: eoaSigner, // EOA signs (root validation)
    deployerSigner,
    label: 'installModule(EXECUTOR)',
  })

  if (step4Result.success) {
    // Verify: isModuleInstalled
    const isInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, '0x' as Hex],
    })) as boolean

    // Verify: getSessionKey
    let sessionKeyActive = false
    let hasTransferPermission = false
    try {
      const sessionKeyConfig = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'getSessionKey',
        args: [eoaAddress, agentAddress],
      })) as unknown
      sessionKeyActive = sessionKeyConfig.isActive

      // Verify: hasPermission
      hasTransferPermission = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'hasPermission',
        args: [eoaAddress, agentAddress, CONFIG.usdc, TRANSFER_SELECTOR as `0x${string}`],
      })) as boolean
    } catch (_err: unknown) {}

    const step4Ok = isInstalled && sessionKeyActive && hasTransferPermission
    results.push({ step: 'Step 4: SessionKeyExecutor Install', success: step4Ok })
    if (step4Ok) {
    } else {
    }
  } else {
    results.push({ step: 'Step 4: SessionKeyExecutor Install', success: false })
  }

  const uninstallValidatorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'uninstallModule',
    args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, '0x' as Hex],
  })

  const step5aResult = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: uninstallValidatorCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'uninstallModule(VALIDATOR)',
  })

  if (step5aResult.success) {
    const isStillInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, '0x' as Hex],
    })) as boolean
    const step5aOk = !isStillInstalled
    results.push({ step: 'Step 5a: ECDSAValidator Uninstall', success: step5aOk })
    if (step5aOk) {
    } else {
    }
  } else {
    results.push({ step: 'Step 5a: ECDSAValidator Uninstall', success: false })
  }

  const uninstallExecutorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'uninstallModule',
    args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, '0x' as Hex],
  })

  const step5bResult = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: uninstallExecutorCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'uninstallModule(EXECUTOR)',
  })

  if (step5bResult.success) {
    const isStillInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, '0x' as Hex],
    })) as boolean
    const step5bOk = !isStillInstalled
    results.push({ step: 'Step 5b: SessionKeyExecutor Uninstall', success: step5bOk })
    if (step5bOk) {
    } else {
    }
  } else {
    results.push({ step: 'Step 5b: SessionKeyExecutor Uninstall', success: false })
  }

  // ================================================================
  // Summary
  // ================================================================
  printSummary(results)
}

// ============================================================================
// Data Builders
// ============================================================================

/**
 * Build initData for installModule(VALIDATOR).
 *
 * Layout: [hook(20 bytes)][ABI-encoded InstallValidatorDataFormat]
 *
 * Kernel reads the first 20 bytes as hook address, then ABI-decodes the rest
 * as InstallValidatorDataFormat { validatorData, hookData, selectorData }.
 *
 * The Solidity code does:
 *   IHook hook = IHook(address(bytes20(initData[0:20])));
 *   InstallValidatorDataFormat calldata data;
 *   assembly { data := add(initData.offset, 20) }
 *
 * So the ABI-encoded struct starts at byte 20 of initData.
 */
function buildValidatorInstallData(params: {
  hook: Address
  validatorData: Hex
  hookData: Hex
  selectorData: Hex
}): Hex {
  const encodedStruct = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }],
    [params.validatorData, params.hookData, params.selectorData]
  )
  return concat([params.hook, encodedStruct]) as Hex
}

/**
 * Build initData for installModule(EXECUTOR).
 *
 * Layout: [hook(20 bytes)][ABI-encoded InstallExecutorDataFormat]
 *
 * Kernel reads the first 20 bytes as hook address, then ABI-decodes the rest
 * as InstallExecutorDataFormat { executorData, hookData }.
 */
function buildExecutorInstallData(params: {
  hook: Address
  executorData: Hex
  hookData: Hex
}): Hex {
  const encodedStruct = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }],
    [params.executorData, params.hookData]
  )
  return concat([params.hook, encodedStruct]) as Hex
}

/**
 * Print test summary
 */
function printSummary(results: { step: string; success: boolean }[]) {
  for (const _r of results) {
  }
  const _passed = results.filter((r) => r.success).length
  const _total = results.length
}

main().catch(console.error)
