/**
 * EIP-7702 + ERC20 Paymaster E2E Test (Case 4)
 *
 * Tests the flow where an EOA delegates to Kernel implementation via EIP-7702,
 * becoming a smart account directly (no factory deployment), then pays gas in USDC.
 *
 * Key difference from Case 3 (test-erc20-paymaster.ts):
 * - Case 3: Factory deploys a separate Smart Account address
 * - Case 4: EOA itself becomes the Smart Account via EIP-7702 delegation
 *
 * Steps:
 *   1. EIP-7702 delegation + Kernel initialize (Type 4 tx from deployer)
 *   2. USDC approve via VerifyingPaymaster-sponsored UserOp
 *   3. No-op UserOp via ERC20Paymaster (user pays gas in USDC)
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
import { privateKeyToAccount } from 'viem/accounts'

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
  kernelImpl: '0xa61b944dd427a85495b685d93237cb73087e0035' as Address,
  // Paymasters
  verifyingPaymaster: '0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0' as Address,
  erc20Paymaster: '0xaf420bfe67697a5724235e4676136f264023d099' as Address,
  // Tokens
  usdc: '0x085ee10cc10be8fb2ce51feb13e809a0c3f98699' as Address,
  // EOA that will become smart account via EIP-7702 (has 1000 USDC, no native)
  eoaPrivateKey: '0x80183f2d3db76f59e257602ed657302c71c808ddc44e0ba9110a689145c138dd' as Hex,
  // Deployer (has native coins, also paymaster signer)
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
])

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

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

async function waitForReceipt(bundlerUrl: string, hash: string, maxWait = 15000): Promise<unknown> {
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

// ============================================================================
// Main
// ============================================================================
async function main() {
  const eoaSigner = privateKeyToAccount(CONFIG.eoaPrivateKey)
  const deployerSigner = privateKeyToAccount(CONFIG.deployerPrivateKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })
  const deployerWallet = createWalletClient({
    account: deployerSigner,
    transport: http(CONFIG.rpcUrl),
    chain: CHAIN,
  })

  const eoaAddress = eoaSigner.address

  // Pre-condition checks
  const eoaCode = await publicClient.getCode({ address: eoaAddress })
  const isDelegated = eoaCode && eoaCode !== '0x' && eoaCode.toLowerCase().startsWith('0xef0100')
  const _eoaNativeBalance = await publicClient.getBalance({ address: eoaAddress })
  const _eoaUsdcBalance = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [eoaAddress],
  })) as bigint
  const eoaExternalNonce = await publicClient.getTransactionCount({ address: eoaAddress })

  // ================================================================
  // STEP 1: EIP-7702 Delegation (no initialize)
  //
  // Kernel v3 EIP-7702 모드: initialize() 불필요
  //   - EXTCODECOPY(self)로 0xef01 prefix를 감지하면 AlreadyInitialized() revert
  //   - delegation 자체가 초기화 역할 (EOA 서명 = 기본 validator)
  //   - 따라서 delegation만 설정하고 initialize()는 호출하지 않음
  // ================================================================
  if (!isDelegated) {
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

    // Verify delegation
    const newCode = await publicClient.getCode({ address: eoaAddress })
    const delegationSuccess =
      newCode && newCode !== '0x' && newCode.toLowerCase().startsWith('0xef0100')

    if (!delegationSuccess) {
      return
    }

    // Extract delegate address from code (0xef0100 + 20 bytes address)
    const _delegateAddr = newCode ? `0x${newCode.slice(8, 48)}` : 'unknown'
  } else {
    const _delegateAddr = eoaCode ? `0x${eoaCode.slice(8, 48)}` : 'unknown'
  }

  // Check current allowance
  const currentAllowance = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [eoaAddress, CONFIG.erc20Paymaster],
  })) as bigint

  if (currentAllowance > 0n) {
  } else {
    // sender = EOA address (now a smart account via delegation)
    // No initCode needed (code already set via delegation)
    const epNonce = (await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'getNonce',
      args: [eoaAddress, 0n],
    })) as bigint

    // Build callData: execute(mode, encodePacked(USDC, 0, approve(erc20Paymaster, max)))
    const execMode = `0x${'00'.repeat(32)}` as Hex
    const approveCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONFIG.erc20Paymaster, 2n ** 256n - 1n],
    })
    const executionCalldata = concat([
      CONFIG.usdc,
      pad(toHex(0n), { size: 32 }),
      approveCalldata,
    ]) as Hex
    const callData = encodeFunctionData({
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'execute',
      args: [execMode, executionCalldata],
    })

    // Gas params
    const vgl = 500000n,
      cgl = 200000n,
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
      args: [eoaAddress],
    })) as bigint

    const pmHash = computePaymasterHash({
      sender: eoaAddress,
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

    // Build packed op, get hash, sign with EOA (now smart account owner)
    const packedOp = {
      sender: eoaAddress,
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
    const userOpSig = await eoaSigner.signMessage({ message: { raw: userOpHash } })
    const result = await sendUserOp(
      CONFIG.bundlerUrl,
      {
        sender: eoaAddress,
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
      return
    }

    const opReceipt = await waitForReceipt(CONFIG.bundlerUrl, result.result)
    if (opReceipt) {
    } else {
    }

    // Verify allowance
    const newAllowance = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [eoaAddress, CONFIG.erc20Paymaster],
    })) as bigint
    if (newAllowance === 0n) {
      return
    }
  }

  const transferRecipient = deployerSigner.address
  const transferAmount = 1000000n // 1 USDC (6 decimals)

  const currentNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [eoaAddress, 0n],
  })) as bigint

  const usdcBefore = (await publicClient.readContract({
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

  // Build callData: execute(mode, encodePacked(USDC, 0, transfer(recipient, amount)))
  // Kernel single call: abi.encodePacked(target[20], value[32], callData[variable])
  const execMode = `0x${'00'.repeat(32)}` as Hex
  const transferCalldata = encodeFunctionData({
    abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
    functionName: 'transfer',
    args: [transferRecipient, transferAmount],
  })
  const executionCalldata3 = concat([
    CONFIG.usdc, // target: USDC contract
    pad(toHex(0n), { size: 32 }), // value: 0
    transferCalldata, // calldata: transfer(recipient, 1 USDC)
  ]) as Hex
  const callData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata3],
  })

  // Gas params
  const vgl = 500000n,
    cgl = 200000n,
    pvg = 100000n
  const mpfpg = 1000000000n,
    mfpg = 2000000000n
  const pmvgl = 200000n,
    pmpog = 200000n // Higher postOp for ERC20 transfer
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

  const packedOp = {
    sender: eoaAddress,
    nonce: currentNonce,
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
  const userOpSig = await eoaSigner.signMessage({ message: { raw: userOpHash } })
  const result = await sendUserOp(
    CONFIG.bundlerUrl,
    {
      sender: eoaAddress,
      nonce: toHex(currentNonce),
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
    try {
      await publicClient.readContract({
        address: CONFIG.entryPoint,
        abi: [
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
        ],
        functionName: 'simulateValidation',
        args: [{ ...packedOp, signature: userOpSig }],
      })
    } catch (err: unknown) {
      const raw: string = err?.cause?.data || err?.data || ''
      if (
        typeof raw === 'string' &&
        (raw.startsWith('0x220266b6') || raw.startsWith('0x65c8fd4d'))
      ) {
        const decoded = raw.slice(10)
        const reasonOffset = parseInt(decoded.slice(64, 128), 16) * 2
        const reasonLen = parseInt(decoded.slice(reasonOffset, reasonOffset + 64), 16)
        const _reasonHex = decoded.slice(reasonOffset + 64, reasonOffset + 64 + reasonLen * 2)
      } else {
      }
    }
    return
  }
  const receipt = await waitForReceipt(CONFIG.bundlerUrl, result.result)
  if (receipt) {
  } else {
  }

  // Final balance checks
  const usdcAfter = (await publicClient.readContract({
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

  const _newNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [eoaAddress, 0n],
  })) as bigint

  const _usdcTransferred = recipientUsdcAfter - recipientUsdcBefore
  const _usdcGasFee = usdcBefore - usdcAfter - transferAmount
  const finalCode = await publicClient.getCode({ address: eoaAddress })
  if (finalCode && finalCode.length >= 48) {
  }
}

main().catch(console.error)
