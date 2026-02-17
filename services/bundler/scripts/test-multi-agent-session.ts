/**
 * Multi-Agent Session Key E2E Test (EIP-7702)
 *
 * Tests 3 agents with different permissions operating an EOA's assets
 * via SessionKeyExecutor:
 *
 * | Agent | Role          | Target Contract     | Allowed Function    | Spending Limit |
 * |-------|---------------|--------------------|--------------------|----------------|
 * | 1     | DeFi Trading  | UniswapV3SwapRouter | exactInputSingle   | 10 ETH         |
 * | 2     | Purchase      | USDC                | transfer           | 5 ETH          |
 * | 3     | Subscription  | USDC                | approve            | 1 ETH          |
 *
 * Execution paths tested:
 *   - executeOnBehalf (Agent signs execution hash, relayer submits tx)
 *   - UserOp via EntryPoint (Agent registered as ECDSAValidator owner)
 *
 * Pre-conditions:
 *   - EOA (0x1D828C...) has EIP-7702 delegation to Kernel impl
 *   - EOA has USDC balance
 *   - Deployer has native balance (paymaster signer)
 *
 * Run: npx tsx services/bundler/scripts/test-multi-agent-session.ts
 */
import {
  type Address,
  concat,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
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
  uniswapV3SwapRouter: '0x2f86f04c1d29ac39752384b34167a42e6d1730f9' as Address,
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
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])

const _ECDSA_VALIDATOR_ABI = parseAbi([
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
  {
    type: 'function',
    name: 'getActiveSessionKeys',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRemainingSpendingLimit',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addSessionKey',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'validAfter', type: 'uint48' },
      { name: 'validUntil', type: 'uint48' },
      { name: 'spendingLimit', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'grantPermission',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'maxValue', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeSessionKey',
    inputs: [{ name: 'sessionKey', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeOnBehalf',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes[]' }],
    stateMutability: 'nonpayable',
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
const HOOK_MODULE_INSTALLED = pad('0x01', { size: 20 }) as Address

// Function selectors
const TRANSFER_SELECTOR = '0xa9059cbb' as Hex // ERC20.transfer(address,uint256)
const APPROVE_SELECTOR = '0x095ea7b3' as Hex // ERC20.approve(address,uint256)
const EXECUTE_SELECTOR = '0xe9ae5c53' as Hex // Kernel.execute(bytes32,bytes)
// UniswapV3 SwapRouter.exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))
const EXACT_INPUT_SINGLE_SELECTOR = '0x414bf389' as Hex

// Execution modes
const SINGLE_MODE = `0x${'00'.repeat(32)}` as Hex
const BATCH_MODE = `0x01${'00'.repeat(31)}` as Hex

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
 */
function encodeValidatorNonceKey(validatorAddr: Address, nonceKey = 0): bigint {
  const mode = 0x00n
  const vType = 0x01n
  const addr = BigInt(validatorAddr)
  return (mode << 184n) | (vType << 176n) | (addr << 16n) | BigInt(nonceKey)
}

/**
 * Encode batch calldata for Kernel execute(BATCH_MODE, ...)
 * Format: abi.encode(Execution[]) where Execution = (address target, uint256 value, bytes callData)
 */
function encodeBatchCalldata(calls: { target: Address; value: bigint; callData: Hex }[]): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { type: 'address', name: 'target' },
          { type: 'uint256', name: 'value' },
          { type: 'bytes', name: 'callData' },
        ],
      },
    ],
    [calls]
  )
}

/**
 * Encode single execution calldata for Kernel execute(SINGLE_MODE, ...)
 * Format: abi.encodePacked(target[20], value[32], callData[variable])
 */
function encodeSingleCalldata(target: Address, value: bigint, callData: Hex): Hex {
  return concat([target, pad(toHex(value), { size: 32 }), callData]) as Hex
}

/**
 * Build execution hash for SessionKeyExecutor.executeOnBehalf()
 * Matches: keccak256(abi.encodePacked(chainId, address(this), account, target, value, data, nonce))
 */
function buildExecHash(
  chainId: bigint,
  executor: Address,
  account: Address,
  target: Address,
  value: bigint,
  data: Hex,
  nonce: bigint
): Hex {
  return keccak256(
    encodePacked(
      ['uint256', 'address', 'address', 'address', 'uint256', 'bytes', 'uint256'],
      [chainId, executor, account, target, value, data, nonce]
    )
  )
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

  const epNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [sender, nonceKey],
  })) as bigint

  const vgl = 500000n,
    cgl = 300000n,
    pvg = 100000n
  const mpfpg = 1000000000n,
    mfpg = 2000000000n
  const pmvgl = 200000n,
    pmpog = 100000n
  const agl = packGasLimits(vgl, cgl)
  const gf = packGasLimits(mpfpg, mfpg)

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
  const { publicClient, sender, callData, signer, label: _label } = params
  const nonceKey = params.nonceKey ?? 0n

  const epNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [sender, nonceKey],
  })) as bigint

  const vgl = 500000n,
    cgl = 300000n,
    pvg = 100000n
  const mpfpg = 1000000000n,
    mfpg = 2000000000n
  const pmvgl = 200000n,
    pmpog = 200000n
  const agl = packGasLimits(vgl, cgl)
  const gf = packGasLimits(mpfpg, mfpg)

  const erc20PmData = CONFIG.usdc as Hex
  const pmAndData = concat([
    CONFIG.erc20Paymaster,
    pad(toHex(pmvgl), { size: 16 }),
    pad(toHex(pmpog), { size: 16 }),
    erc20PmData,
  ]) as Hex

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
// Data Builders
// ============================================================================

/**
 * Build initData for installModule(VALIDATOR).
 * Layout: [hook(20 bytes)][ABI-encoded InstallValidatorDataFormat]
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
 * Layout: [hook(20 bytes)][ABI-encoded InstallExecutorDataFormat]
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
 * Encode permissions for SessionKeyExecutor
 * Format: abi.encode(Permission[]) where Permission = (address target, bytes4 selector, uint256 maxValue, bool allowed)
 */
function encodePermissions(
  permissions: {
    target: Address
    selector: Hex
    maxValue: bigint
    allowed: boolean
  }[]
): Hex {
  return encodeAbiParameters(
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
}

/**
 * Build executorData for SessionKeyExecutor.onInstall()
 * Format: abi.encode(sessionKey, validAfter, validUntil, spendingLimit, permissionsData)
 */
function buildSessionKeyExecutorData(params: {
  sessionKey: Address
  validAfter: number
  validUntil: number
  spendingLimit: bigint
  permissionsData: Hex
}): Hex {
  return encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint48' },
      { type: 'uint48' },
      { type: 'uint256' },
      { type: 'bytes' },
    ],
    [
      params.sessionKey,
      params.validAfter,
      params.validUntil,
      params.spendingLimit,
      params.permissionsData,
    ]
  )
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const eoaSigner = privateKeyToAccount(CONFIG.eoaPrivateKey)
  const deployerSigner = privateKeyToAccount(CONFIG.deployerPrivateKey)

  // Generate 3 fresh agent private keys
  const agent1Key = generatePrivateKey()
  const agent2Key = generatePrivateKey()
  const agent3Key = generatePrivateKey()
  const agent1Signer = privateKeyToAccount(agent1Key)
  const agent2Signer = privateKeyToAccount(agent2Key)
  const agent3Signer = privateKeyToAccount(agent3Key)

  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })
  const deployerWallet = createWalletClient({
    account: deployerSigner,
    transport: http(CONFIG.rpcUrl),
    chain: CHAIN,
  })

  const eoaAddress = eoaSigner.address

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
    results.push({ step: 'Step 1: Delegation 확인', success: true })
  } else {
    results.push({ step: 'Step 1: Delegation 확인', success: false })
    printSummary(results)
    return
  }

  const now = Math.floor(Date.now() / 1000)
  const validUntil24h = now + 86400 // 24 hours

  // Agent 1 permissions: UniswapV3SwapRouter.exactInputSingle
  const agent1Permissions = encodePermissions([
    {
      target: CONFIG.uniswapV3SwapRouter,
      selector: EXACT_INPUT_SINGLE_SELECTOR,
      maxValue: 0n,
      allowed: true,
    },
  ])

  const agent1ExecutorData = buildSessionKeyExecutorData({
    sessionKey: agent1Signer.address,
    validAfter: 0,
    validUntil: validUntil24h,
    spendingLimit: 10000000000000000000n, // 10 ETH
    permissionsData: agent1Permissions,
  })

  const executorInitData = buildExecutorInstallData({
    hook: HOOK_MODULE_INSTALLED,
    executorData: agent1ExecutorData,
    hookData: '0x' as Hex,
  })

  const installExecutorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'installModule',
    args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, executorInitData],
  })

  const step2Result = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: installExecutorCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'installModule(EXECUTOR) + Agent 1',
  })

  if (step2Result.success) {
    const isInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, '0x' as Hex],
    })) as boolean

    let agent1Active = false
    let agent1HasPerm = false
    try {
      const sk = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'getSessionKey',
        args: [eoaAddress, agent1Signer.address],
      })) as unknown
      agent1Active = sk.isActive

      agent1HasPerm = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'hasPermission',
        args: [
          eoaAddress,
          agent1Signer.address,
          CONFIG.uniswapV3SwapRouter,
          EXACT_INPUT_SINGLE_SELECTOR,
        ],
      })) as boolean
    } catch (_err: unknown) {}

    const step2Ok = isInstalled && agent1Active && agent1HasPerm
    results.push({ step: 'Step 2: SessionKeyExecutor + Agent 1', success: step2Ok })
  } else {
    results.push({ step: 'Step 2: SessionKeyExecutor + Agent 1', success: false })
    printSummary(results)
    return
  }

  const validUntil1h = now + 3600 // 1 hour

  const addAgent2Calldata = encodeFunctionData({
    abi: SESSION_KEY_EXECUTOR_ABI,
    functionName: 'addSessionKey',
    args: [agent2Signer.address, 0, validUntil1h, 5000000000000000000n], // 5 ETH
  })

  const grantAgent2PermCalldata = encodeFunctionData({
    abi: SESSION_KEY_EXECUTOR_ABI,
    functionName: 'grantPermission',
    args: [agent2Signer.address, CONFIG.usdc, TRANSFER_SELECTOR, 0n],
  })

  const batch3Calldata = encodeBatchCalldata([
    { target: CONFIG.sessionKeyExecutor, value: 0n, callData: addAgent2Calldata },
    { target: CONFIG.sessionKeyExecutor, value: 0n, callData: grantAgent2PermCalldata },
  ])

  const step3ExecCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [BATCH_MODE, batch3Calldata],
  })

  const step3Result = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: step3ExecCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'batch addSessionKey + grantPermission (Agent 2)',
  })

  if (step3Result.success) {
    let agent2Active = false
    let agent2HasPerm = false
    try {
      const sk = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'getSessionKey',
        args: [eoaAddress, agent2Signer.address],
      })) as unknown
      agent2Active = sk.isActive

      agent2HasPerm = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'hasPermission',
        args: [eoaAddress, agent2Signer.address, CONFIG.usdc, TRANSFER_SELECTOR],
      })) as boolean
    } catch (_err: unknown) {}

    const step3Ok = agent2Active && agent2HasPerm
    results.push({ step: 'Step 3: Agent 2 batch 등록', success: step3Ok })
  } else {
    results.push({ step: 'Step 3: Agent 2 batch 등록', success: false })
  }

  const validUntil30d = now + 2592000 // 30 days

  const addAgent3Calldata = encodeFunctionData({
    abi: SESSION_KEY_EXECUTOR_ABI,
    functionName: 'addSessionKey',
    args: [agent3Signer.address, 0, validUntil30d, 1000000000000000000n], // 1 ETH
  })

  const grantAgent3PermCalldata = encodeFunctionData({
    abi: SESSION_KEY_EXECUTOR_ABI,
    functionName: 'grantPermission',
    args: [agent3Signer.address, CONFIG.usdc, APPROVE_SELECTOR, 0n],
  })

  const batch4Calldata = encodeBatchCalldata([
    { target: CONFIG.sessionKeyExecutor, value: 0n, callData: addAgent3Calldata },
    { target: CONFIG.sessionKeyExecutor, value: 0n, callData: grantAgent3PermCalldata },
  ])

  const step4ExecCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [BATCH_MODE, batch4Calldata],
  })

  const step4Result = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: step4ExecCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'batch addSessionKey + grantPermission (Agent 3)',
  })

  if (step4Result.success) {
    let agent3Active = false
    let agent3HasPerm = false
    try {
      const sk = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'getSessionKey',
        args: [eoaAddress, agent3Signer.address],
      })) as unknown
      agent3Active = sk.isActive

      agent3HasPerm = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'hasPermission',
        args: [eoaAddress, agent3Signer.address, CONFIG.usdc, APPROVE_SELECTOR],
      })) as boolean
    } catch (_err: unknown) {}

    const step4Ok = agent3Active && agent3HasPerm
    results.push({ step: 'Step 4: Agent 3 batch 등록', success: step4Ok })
  } else {
    results.push({ step: 'Step 4: Agent 3 batch 등록', success: false })
  }

  let step5Ok = true
  try {
    // Get all active session keys
    const activeKeys = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'getActiveSessionKeys',
      args: [eoaAddress],
    })) as Address[]
    for (const _key of activeKeys) {
    }

    if (activeKeys.length !== 3) {
      step5Ok = false
    }

    // Cross-check permissions: Agent 1 should NOT have USDC.transfer
    const agent1UsdcTransfer = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent1Signer.address, CONFIG.usdc, TRANSFER_SELECTOR],
    })) as boolean
    if (agent1UsdcTransfer) step5Ok = false

    // Agent 2 should NOT have USDC.approve
    const agent2UsdcApprove = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent2Signer.address, CONFIG.usdc, APPROVE_SELECTOR],
    })) as boolean
    if (agent2UsdcApprove) step5Ok = false

    // Agent 3 should NOT have USDC.transfer
    const agent3UsdcTransfer = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent3Signer.address, CONFIG.usdc, TRANSFER_SELECTOR],
    })) as boolean
    if (agent3UsdcTransfer) step5Ok = false

    // Positive checks
    const agent1SwapPerm = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [
        eoaAddress,
        agent1Signer.address,
        CONFIG.uniswapV3SwapRouter,
        EXACT_INPUT_SINGLE_SELECTOR,
      ],
    })) as boolean
    if (!agent1SwapPerm) step5Ok = false

    const agent2TransferPerm = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent2Signer.address, CONFIG.usdc, TRANSFER_SELECTOR],
    })) as boolean
    if (!agent2TransferPerm) step5Ok = false

    const agent3ApprovePerm = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent3Signer.address, CONFIG.usdc, APPROVE_SELECTOR],
    })) as boolean
    if (!agent3ApprovePerm) step5Ok = false
  } catch (_err: unknown) {
    step5Ok = false
  }

  results.push({ step: 'Step 5: 전체 Agent 상태 검증', success: step5Ok })

  const transferRecipient = deployerSigner.address
  const transferAmount = 1000000n // 1 USDC (6 decimals)

  const _usdcBefore6 = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [eoaAddress],
  })) as bigint
  const recipientBefore6 = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [transferRecipient],
  })) as bigint

  let step6Ok = false
  try {
    // Get session key nonce
    const sessionKeyData = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'getSessionKey',
      args: [eoaAddress, agent2Signer.address],
    })) as unknown
    const sessionNonce = sessionKeyData.nonce as bigint

    // Build USDC.transfer calldata
    const transferCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [transferRecipient, transferAmount],
    })

    // Build execution hash
    const execHash = buildExecHash(
      CONFIG.chainIdBigInt,
      CONFIG.sessionKeyExecutor,
      eoaAddress,
      CONFIG.usdc,
      0n,
      transferCalldata,
      sessionNonce
    )

    // Agent 2 signs the execution hash (with EthSignedMessage prefix internally)
    const sig = await agent2Signer.signMessage({ message: { raw: execHash } })

    // Deployer calls executeOnBehalf
    const txHash = await deployerWallet.writeContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'executeOnBehalf',
      args: [eoaAddress, CONFIG.usdc, 0n, transferCalldata, sessionNonce, sig],
      gas: 500000n,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    if (receipt.status === 'success') {
      const _usdcAfter6 = (await publicClient.readContract({
        address: CONFIG.usdc,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [eoaAddress],
      })) as bigint
      const recipientAfter6 = (await publicClient.readContract({
        address: CONFIG.usdc,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [transferRecipient],
      })) as bigint
      const transferred = recipientAfter6 - recipientBefore6
      step6Ok = transferred >= transferAmount
    }
  } catch (_err: unknown) {}

  results.push({ step: 'Step 6: executeOnBehalf Agent 2 USDC transfer', success: step6Ok })

  const validatorInitData = buildValidatorInstallData({
    hook: HOOK_MODULE_INSTALLED,
    validatorData: agent1Signer.address as Hex,
    hookData: '0x' as Hex,
    selectorData: EXECUTE_SELECTOR,
  })

  const installValidatorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'installModule',
    args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, validatorInitData],
  })

  const step7aResult = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: installValidatorCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'installModule(VALIDATOR) Agent 1',
  })

  let step7Ok = false
  if (step7aResult.success) {
    const isInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, '0x' as Hex],
    })) as boolean

    if (isInstalled) {
      const transferAmount7 = 1000000n // 1 USDC
      const _usdcBefore7 = (await publicClient.readContract({
        address: CONFIG.usdc,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [eoaAddress],
      })) as bigint
      const recipientBefore7 = (await publicClient.readContract({
        address: CONFIG.usdc,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [transferRecipient],
      })) as bigint

      const transferCalldata7 = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [transferRecipient, transferAmount7],
      })
      const executionCalldata7 = encodeSingleCalldata(CONFIG.usdc, 0n, transferCalldata7)
      const transferExecCallData7 = encodeFunctionData({
        abi: KERNEL_ACCOUNT_ABI,
        functionName: 'execute',
        args: [SINGLE_MODE, executionCalldata7],
      })

      const validatorNonceKey = encodeValidatorNonceKey(CONFIG.ecdsaValidator)

      const step7bResult = await buildAndSendErc20PaymasterUserOp({
        publicClient,
        sender: eoaAddress,
        callData: transferExecCallData7,
        signer: agent1Signer, // Agent 1 signs
        nonceKey: validatorNonceKey,
        label: 'Agent 1 USDC transfer via UserOp',
      })

      if (step7bResult.success) {
        const _usdcAfter7 = (await publicClient.readContract({
          address: CONFIG.usdc,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [eoaAddress],
        })) as bigint
        const recipientAfter7 = (await publicClient.readContract({
          address: CONFIG.usdc,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [transferRecipient],
        })) as bigint
        const transferred7 = recipientAfter7 - recipientBefore7
        step7Ok = transferred7 >= transferAmount7
      }
    }
  }

  results.push({ step: 'Step 7: UserOp Agent 1 USDC transfer', success: step7Ok })

  let step8Ok = false
  try {
    // Diagnostic: re-verify hasPermission right before the call
    const _agent1HasUsdcTransfer = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent1Signer.address, CONFIG.usdc, TRANSFER_SELECTOR],
    })) as boolean
    const _agent1HasUsdcWildcard = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [eoaAddress, agent1Signer.address, CONFIG.usdc, '0x00000000' as Hex],
    })) as boolean

    const _usdcBefore8 = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [eoaAddress],
    })) as bigint

    const sessionKeyData8 = (await publicClient.readContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'getSessionKey',
      args: [eoaAddress, agent1Signer.address],
    })) as unknown
    const sessionNonce8 = sessionKeyData8.nonce as bigint

    const transferCalldata8 = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [transferRecipient, 1000000n],
    })

    const execHash8 = buildExecHash(
      CONFIG.chainIdBigInt,
      CONFIG.sessionKeyExecutor,
      eoaAddress,
      CONFIG.usdc,
      0n,
      transferCalldata8,
      sessionNonce8
    )

    // Agent 1 signs (does NOT have USDC.transfer permission)
    const sig8 = await agent1Signer.signMessage({ message: { raw: execHash8 } })
    await publicClient.simulateContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'executeOnBehalf',
      args: [eoaAddress, CONFIG.usdc, 0n, transferCalldata8, sessionNonce8, sig8],
      account: deployerSigner.address,
      gas: 500000n,
    })

    // If simulation passes, send the tx and check receipt
    const txHash8 = await deployerWallet.writeContract({
      address: CONFIG.sessionKeyExecutor,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'executeOnBehalf',
      args: [eoaAddress, CONFIG.usdc, 0n, transferCalldata8, sessionNonce8, sig8],
      gas: 500000n,
    })
    const receipt8 = await publicClient.waitForTransactionReceipt({ hash: txHash8 })

    const _usdcAfter8 = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [eoaAddress],
    })) as bigint

    if (receipt8.status === 'reverted') {
      step8Ok = true
    } else {
      step8Ok = false
    }
  } catch (err: unknown) {
    const errMsg = err?.shortMessage || err?.message || ''
    // Validate this is a permission/execution revert, not a transient error
    const isContractRevert =
      errMsg.includes('revert') ||
      errMsg.includes('execution reverted') ||
      errMsg.includes('PermissionDenied') ||
      errMsg.includes('ContractFunctionRevertedError')
    if (isContractRevert) {
      step8Ok = true
    } else {
      step8Ok = false
    }
  }

  results.push({ step: 'Step 8: Negative PermissionDenied', success: step8Ok })

  const revokeAgent3Calldata = encodeFunctionData({
    abi: SESSION_KEY_EXECUTOR_ABI,
    functionName: 'revokeSessionKey',
    args: [agent3Signer.address],
  })

  const revokeExecCalldata = encodeSingleCalldata(
    CONFIG.sessionKeyExecutor,
    0n,
    revokeAgent3Calldata
  )
  const revokeExecCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [SINGLE_MODE, revokeExecCalldata],
  })

  const step9Result = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: revokeExecCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'revokeSessionKey(Agent 3)',
  })

  let step9Ok = false
  if (step9Result.success) {
    try {
      const sk3 = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'getSessionKey',
        args: [eoaAddress, agent3Signer.address],
      })) as unknown

      const activeKeys = (await publicClient.readContract({
        address: CONFIG.sessionKeyExecutor,
        abi: SESSION_KEY_EXECUTOR_ABI,
        functionName: 'getActiveSessionKeys',
        args: [eoaAddress],
      })) as Address[]
      for (const _key of activeKeys) {
      }

      step9Ok = !sk3.isActive && activeKeys.length === 2
    } catch (_err: unknown) {}
  }

  results.push({ step: 'Step 9: Revocation Agent 3', success: step9Ok })
  const uninstallValidatorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'uninstallModule',
    args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, '0x' as Hex],
  })

  const step10aResult = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: uninstallValidatorCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'uninstallModule(VALIDATOR)',
  })

  let step10aOk = false
  if (step10aResult.success) {
    const isStillInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_VALIDATOR, CONFIG.ecdsaValidator, '0x' as Hex],
    })) as boolean
    step10aOk = !isStillInstalled
  } else {
  }
  const uninstallExecutorCallData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'uninstallModule',
    args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, '0x' as Hex],
  })

  const step10bResult = await buildAndSendSponsoredUserOp({
    publicClient,
    sender: eoaAddress,
    callData: uninstallExecutorCallData,
    signer: eoaSigner,
    deployerSigner,
    label: 'uninstallModule(EXECUTOR)',
  })

  let step10bOk = false
  if (step10bResult.success) {
    const isStillInstalled = (await publicClient.readContract({
      address: eoaAddress,
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'isModuleInstalled',
      args: [MODULE_TYPE_EXECUTOR, CONFIG.sessionKeyExecutor, '0x' as Hex],
    })) as boolean
    step10bOk = !isStillInstalled
  } else {
  }

  const step10Ok = step10aOk && step10bOk
  results.push({ step: 'Step 10: Cleanup', success: step10Ok })

  // ================================================================
  // Summary
  // ================================================================
  printSummary(results)
}

function printSummary(results: { step: string; success: boolean }[]) {
  for (const _r of results) {
  }
  const _passed = results.filter((r) => r.success).length
  const _total = results.length
}

main().catch(console.error)
