/**
 * Full E2E UserOp Test for StableNet Local (chainId 8283, native coin: WKRC)
 *
 * Fixes applied:
 * 1. Kernel v3: No mode prefix in signature (mode is in nonce, not signature)
 * 2. VerifyingPaymaster: Full paymasterData with validUntil + validAfter + signature
 * 3. Proper paymaster hash computation matching VerifyingPaymaster.sol getHash()
 */
import {
  type Address,
  concat,
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  pad,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CONFIG = {
  rpcUrl: 'http://localhost:8501',
  chainId: 8283n,
  entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
  factory: '0xbebb0338503f9e28ffdc84c3548f8454f12dd1d3' as Address,
  ecdsaValidator: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
  paymaster: '0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0' as Address,
  // Account owner
  senderPrivateKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
  // Paymaster signer = verifyingSigner (same as account owner for this deployment)
  paymasterSignerKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
}

const KERNEL_ACCOUNT_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'mode', type: 'bytes32' },
      { name: 'executionCalldata', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'rootValidator', type: 'bytes21' },
      { name: 'hook', type: 'address' },
      { name: 'validatorData', type: 'bytes' },
      { name: 'hookData', type: 'bytes' },
      { name: 'initConfig', type: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const KERNEL_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createAccount',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getAddress',
    inputs: [
      { name: 'initData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
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
  // v0.9 EntryPointSimulations: simulateValidation RETURNS (not reverts) on success
  {
    type: 'function',
    name: 'simulateValidation',
    inputs: [{ name: 'userOp', type: 'tuple', components: PACKED_USER_OP_COMPONENTS }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'returnInfo',
            type: 'tuple',
            components: [
              { name: 'preOpGas', type: 'uint256' },
              { name: 'prefund', type: 'uint256' },
              { name: 'accountValidationData', type: 'uint256' },
              { name: 'paymasterValidationData', type: 'uint256' },
              { name: 'paymasterContext', type: 'bytes' },
            ],
          },
          {
            name: 'senderInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'factoryInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'paymasterInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'aggregatorInfo',
            type: 'tuple',
            components: [
              { name: 'aggregator', type: 'address' },
              {
                name: 'stakeInfo',
                type: 'tuple',
                components: [
                  { name: 'stake', type: 'uint256' },
                  { name: 'unstakeDelaySec', type: 'uint256' },
                ],
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  // Error types (reverted on validation failure)
  {
    type: 'error',
    name: 'FailedOp',
    inputs: [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
  },
  {
    type: 'error',
    name: 'FailedOpWithRevert',
    inputs: [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'inner', type: 'bytes' },
    ],
  },
] as const

function packGasLimits(a: bigint, b: bigint): Hex {
  return concat([pad(toHex(a), { size: 16 }), pad(toHex(b), { size: 16 })]) as Hex
}

/**
 * Compute VerifyingPaymaster hash (matches VerifyingPaymaster.sol getHash())
 * Note: The contract uses abi.encode (NOT abi.encodePacked)
 * Includes senderNonce for replay prevention
 */
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
        { type: 'address' }, // sender
        { type: 'uint256' }, // nonce
        { type: 'bytes32' }, // keccak256(initCode)
        { type: 'bytes32' }, // keccak256(callData)
        { type: 'bytes32' }, // accountGasLimits
        { type: 'uint256' }, // preVerificationGas
        { type: 'bytes32' }, // gasFees
        { type: 'uint256' }, // chainId
        { type: 'address' }, // paymaster address
        { type: 'uint48' }, // validUntil
        { type: 'uint48' }, // validAfter
        { type: 'uint256' }, // senderNonce (replay prevention)
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

function parseRevertResult(raw: string): {
  type: string
  reason?: string
  inner?: string
  raw?: string
} {
  if (!raw || raw === '0x') return { type: 'empty', raw: '' }
  // v0.7 selector: 0xe0cff05f, v0.9 selector: 0x5eb2984f
  if (raw.startsWith('0xe0cff05f') || raw.startsWith('0x5eb2984f'))
    return { type: 'ValidationResult', raw }
  if (raw.startsWith('0x220266b6') || raw.startsWith('0x65c8fd4d')) {
    const isWithRevert = raw.startsWith('0x65c8fd4d')
    const decoded = raw.slice(10)
    try {
      const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
      const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
      const reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      const reason = Buffer.from(reasonHex, 'hex').toString('utf-8')
      let inner: string | undefined
      if (isWithRevert) {
        const innerOffset = parseInt(decoded.slice(128, 192), 16) * 2
        const innerLen = parseInt(decoded.slice(innerOffset, innerOffset + 64), 16)
        inner = '0x' + decoded.slice(innerOffset + 64, innerOffset + 64 + innerLen * 2)
      }
      return { type: isWithRevert ? 'FailedOpWithRevert' : 'FailedOp', reason, inner }
    } catch {
      return { type: 'decode_error', raw: raw.slice(0, 200) }
    }
  }
  return { type: 'unknown', raw: raw.slice(0, 200) }
}

async function main() {
  const signer = privateKeyToAccount(CONFIG.senderPrivateKey)
  const paymasterSigner = privateKeyToAccount(CONFIG.paymasterSignerKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  // 1. Build init data for Kernel smart account
  const rootValidator = concat([pad(toHex(1n), { size: 1 }), CONFIG.ecdsaValidator]) as Hex
  const initializeData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'initialize',
    args: [
      rootValidator,
      '0x0000000000000000000000000000000000000000' as Address,
      signer.address,
      '0x' as Hex,
      [],
    ],
  })
  const salt = pad(toHex(0n), { size: 32 })

  const smartAccountAddress = (await publicClient.readContract({
    address: CONFIG.factory,
    abi: KERNEL_FACTORY_ABI,
    functionName: 'getAddress',
    args: [initializeData, salt],
  })) as Address

  // 2. Check if account already deployed & get nonce
  const accountCode = await publicClient.getCode({ address: smartAccountAddress })
  const isDeployed = !!accountCode && accountCode !== '0x'

  // Get nonce from EntryPoint (key=0 for default validator)
  const currentNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: [
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
    ],
    functionName: 'getNonce',
    args: [smartAccountAddress, 0n],
  })) as bigint

  // Factory data only needed if account not yet deployed
  let factoryData: Hex | undefined
  let initCode: Hex
  if (!isDeployed) {
    factoryData = encodeFunctionData({
      abi: KERNEL_FACTORY_ABI,
      functionName: 'createAccount',
      args: [initializeData, salt],
    })
    initCode = concat([CONFIG.factory, factoryData]) as Hex
  } else {
    initCode = '0x' as Hex
  }

  const execMode = `0x${'00'.repeat(32)}` as Hex
  // Kernel v3 expects abi.encodePacked(target[20], value[32], callData[variable])
  const executionCalldata = concat([
    smartAccountAddress, // 20 bytes: target address
    pad(toHex(0n), { size: 32 }), // 32 bytes: value
  ]) as Hex // no callData for no-op
  const callData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })

  // 3. Gas parameters
  const verificationGasLimit = 500000n
  const callGasLimit = 200000n
  const preVerificationGas = 100000n
  const maxPriorityFeePerGas = 1000000000n // 1 gwei
  const maxFeePerGas = 2000000000n // 2 gwei
  const paymasterVerificationGasLimit = 200000n
  const paymasterPostOpGasLimit = 100000n

  const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit)
  const gasFees = packGasLimits(maxPriorityFeePerGas, maxFeePerGas)

  // 4. Build paymaster data with proper signature
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  const validAfter = 0n

  // Fetch senderNonce from VerifyingPaymaster (replay prevention)
  const senderNonce = (await publicClient.readContract({
    address: CONFIG.paymaster,
    abi: [
      {
        type: 'function',
        name: 'senderNonce',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'senderNonce',
    args: [smartAccountAddress],
  })) as bigint

  // Compute paymaster hash (includes senderNonce for replay prevention)
  const paymasterHash = computePaymasterHash({
    sender: smartAccountAddress,
    nonce: currentNonce,
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    chainId: CONFIG.chainId,
    paymasterAddress: CONFIG.paymaster,
    validUntil,
    validAfter,
    senderNonce,
  })

  // Sign paymaster hash
  const paymasterSignature = await paymasterSigner.signMessage({
    message: { raw: paymasterHash },
  })

  // Encode paymasterData: validUntil(6B) + validAfter(6B) + signature(65B)
  const paymasterData = concat([
    pad(toHex(validUntil), { size: 6 }),
    pad(toHex(validAfter), { size: 6 }),
    paymasterSignature,
  ]) as Hex

  // Full paymasterAndData: paymaster(20B) + verificationGasLimit(16B) + postOpGasLimit(16B) + paymasterData
  const paymasterAndData = concat([
    CONFIG.paymaster,
    pad(toHex(paymasterVerificationGasLimit), { size: 16 }),
    pad(toHex(paymasterPostOpGasLimit), { size: 16 }),
    paymasterData,
  ]) as Hex

  // 5. Build packed UserOp (with placeholder signature for hash)
  const packedOp = {
    sender: smartAccountAddress,
    nonce: currentNonce,
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: '0x' as Hex,
  }

  // 6. Get UserOp hash from EntryPoint
  const userOpHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex

  // 7. Sign UserOp hash - NO mode prefix (Kernel v3)
  const userOpSignature = await signer.signMessage({
    message: { raw: userOpHash },
  })
  let simulationPassed = false
  try {
    // v0.9 EntryPointSimulations returns ValidationResult on success (no revert)
    const simResult = await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'simulateValidation',
      args: [{ ...packedOp, signature: userOpSignature }],
    })
    const validationResult = simResult as unknown
    // Check SIG_FAILED: aggregator = address(1) in lowest 160 bits
    const pmvd = BigInt(validationResult.returnInfo.paymasterValidationData)
    const pmSigFailed = (pmvd & ((1n << 160n) - 1n)) === 1n
    const acctVd = BigInt(validationResult.returnInfo.accountValidationData)
    const acctSigFailed = (acctVd & ((1n << 160n) - 1n)) === 1n
    if (pmSigFailed)
      if (acctSigFailed)
        if (!pmSigFailed && !acctSigFailed) simulationPassed = !pmSigFailed && !acctSigFailed
  } catch (err: unknown) {
    const raw: string = err?.cause?.raw || err?.cause?.data || err?.data || ''
    const result = parseRevertResult(raw)
    if (result.type === 'ValidationResult' && result.raw) {
      // v0.9 reverts with ValidationResult on success (different from v0.7's 0xe0cff05f)
      try {
        const decoded = decodeAbiParameters(
          [
            {
              type: 'tuple',
              components: [
                {
                  name: 'returnInfo',
                  type: 'tuple',
                  components: [
                    { name: 'preOpGas', type: 'uint256' },
                    { name: 'prefund', type: 'uint256' },
                    { name: 'accountValidationData', type: 'uint256' },
                    { name: 'paymasterValidationData', type: 'uint256' },
                    { name: 'paymasterContext', type: 'bytes' },
                  ],
                },
                {
                  name: 'senderInfo',
                  type: 'tuple',
                  components: [
                    { name: 'stake', type: 'uint256' },
                    { name: 'unstakeDelaySec', type: 'uint256' },
                  ],
                },
                {
                  name: 'factoryInfo',
                  type: 'tuple',
                  components: [
                    { name: 'stake', type: 'uint256' },
                    { name: 'unstakeDelaySec', type: 'uint256' },
                  ],
                },
                {
                  name: 'paymasterInfo',
                  type: 'tuple',
                  components: [
                    { name: 'stake', type: 'uint256' },
                    { name: 'unstakeDelaySec', type: 'uint256' },
                  ],
                },
                {
                  name: 'aggregatorInfo',
                  type: 'tuple',
                  components: [
                    { name: 'aggregator', type: 'address' },
                    {
                      name: 'stakeInfo',
                      type: 'tuple',
                      components: [
                        { name: 'stake', type: 'uint256' },
                        { name: 'unstakeDelaySec', type: 'uint256' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          ('0x' + result.raw.slice(10)) as Hex
        )
        const vr = decoded[0] as unknown
        const pmvd = BigInt(vr.returnInfo.paymasterValidationData)
        const pmSigFailed = (pmvd & ((1n << 160n) - 1n)) === 1n
        const acctVd = BigInt(vr.returnInfo.accountValidationData)
        const acctSigFailed = (acctVd & ((1n << 160n) - 1n)) === 1n
        if (pmSigFailed)
          if (acctSigFailed)
            if (!pmSigFailed && !acctSigFailed) simulationPassed = !pmSigFailed && !acctSigFailed
      } catch (_decodeErr: unknown) {}
    } else if (result.type === 'FailedOp') {
    } else if (result.type === 'FailedOpWithRevert') {
      console.info('FailedOpWithRevert:', result.reason, 'inner:', result.inner)
    } else {
      if (raw) {
        const selector = raw.slice(0, 10)
        console.info('Unknown selector:', selector)
      }
    }
  }

  // 9. Send to bundler
  if (!simulationPassed) {
    return
  }
  try {
    const bundlerUrl = 'http://localhost:4337'
    const response = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: smartAccountAddress,
            nonce: toHex(currentNonce),
            ...(isDeployed ? {} : { factory: CONFIG.factory, factoryData }),
            callData,
            callGasLimit: toHex(callGasLimit),
            verificationGasLimit: toHex(verificationGasLimit),
            preVerificationGas: toHex(preVerificationGas),
            maxFeePerGas: toHex(maxFeePerGas),
            maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
            paymaster: CONFIG.paymaster,
            paymasterData,
            paymasterVerificationGasLimit: toHex(paymasterVerificationGasLimit),
            paymasterPostOpGasLimit: toHex(paymasterPostOpGasLimit),
            signature: userOpSignature,
          },
          CONFIG.entryPoint,
        ],
        id: 1,
      }),
    })
    const result = await response.json()
    if (result.error) {
    } else {
      await new Promise((r) => setTimeout(r, 5000))

      const receiptRes = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getUserOperationReceipt',
          params: [result.result],
          id: 2,
        }),
      })
      const receipt = await receiptRes.json()
      if (receipt.result) {
      } else {
        const statusRes = await fetch(bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'debug_bundler_getStatus',
            params: [],
            id: 3,
          }),
        })
        const _status = await statusRes.json()
      }
    }
  } catch (_err: unknown) {}
}

main().catch(console.error)
