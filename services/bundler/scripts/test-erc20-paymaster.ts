/**
 * ERC20 Paymaster E2E Test
 *
 * Tests the flow where a user with NO native coins pays gas in USDC:
 *
 * Step 1: Deploy smart account via VerifyingPaymaster (sponsored)
 *         + approve USDC to ERC20Paymaster in the same UserOp
 * Step 2: Send second UserOp using ERC20Paymaster (user pays gas in USDC)
 */
import {
  type Address,
  concat,
  createPublicClient,
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
  chainId: 8283n,
  entryPoint: '0xef6817fe73741a8f10088f9511c64b666a338a14' as Address,
  factory: '0xbebb0338503f9e28ffdc84c3548f8454f12dd1d3' as Address,
  ecdsaValidator: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
  // Paymasters
  verifyingPaymaster: '0xfed3fc34af59a30c5a19ff8caf260604ddf39fc0' as Address,
  erc20Paymaster: '0xaf420bfe67697a5724235e4676136f264023d099' as Address,
  // Tokens
  usdc: '0x085ee10cc10be8fb2ce51feb13e809a0c3f98699' as Address,
  // Keys - user with USDC only (no native WKRC)
  userPrivateKey: '0x80183f2d3db76f59e257602ed657302c71c808ddc44e0ba9110a689145c138dd' as Hex,
  // Paymaster signer (deployer)
  paymasterSignerKey: '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as Hex,
}

// ============================================================================
// ABIs
// ============================================================================
const KERNEL_ACCOUNT_ABI = parseAbi([
  'function execute(bytes32 mode, bytes calldata executionCalldata) payable',
  'function initialize(bytes21 rootValidator, address hook, bytes calldata validatorData, bytes calldata hookData, bytes[] calldata initConfig)',
])

const KERNEL_FACTORY_ABI = parseAbi([
  'function createAccount(bytes calldata initData, bytes32 salt) payable returns (address)',
  'function getAddress(bytes calldata initData, bytes32 salt) view returns (address)',
])

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
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
  const userSigner = privateKeyToAccount(CONFIG.userPrivateKey)
  const paymasterSigner = privateKeyToAccount(CONFIG.paymasterSignerKey)
  const publicClient = createPublicClient({ transport: http(CONFIG.rpcUrl) })

  // ----------------------------------------------------------------
  // Compute counterfactual smart account address
  // ----------------------------------------------------------------
  const rootValidator = concat([pad(toHex(1n), { size: 1 }), CONFIG.ecdsaValidator]) as Hex
  const initializeData = encodeFunctionData({
    abi: KERNEL_ACCOUNT_ABI,
    functionName: 'initialize',
    args: [
      rootValidator,
      '0x0000000000000000000000000000000000000000' as Address,
      userSigner.address,
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

  // Check account state
  const accountCode = await publicClient.getCode({ address: smartAccountAddress })
  const isDeployed = !!accountCode && accountCode !== '0x'

  // Check USDC balances
  const _userUsdcBalance = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userSigner.address],
  })) as bigint
  const smartAcctUsdcBalance = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccountAddress],
  })) as bigint

  // ================================================================
  // STEP 1: Deploy account via VerifyingPaymaster (sponsored)
  //         + transfer USDC to smart account
  //         + approve ERC20Paymaster to spend USDC
  // ================================================================
  if (!isDeployed) {
    // For testing: the deployer mints/sends USDC to the counterfactual address
    // In production, someone would have sent USDC to the counterfactual address already
    if (smartAcctUsdcBalance === 0n) {
      // Check if deployer has USDC to send
      const deployerUsdcBalance = (await publicClient.readContract({
        address: CONFIG.usdc,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [paymasterSigner.address],
      })) as bigint

      if (deployerUsdcBalance > 0n) {
        // Transfer 100 USDC to counterfactual address
        const transferAmount = 100_000_000n // 100 USDC (6 decimals)
        const transferData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [smartAccountAddress, transferAmount],
        })
        // Use raw fetch to send tx
        const { createWalletClient } = await import('viem')
        const walletClient = createWalletClient({
          account: paymasterSigner,
          transport: http(CONFIG.rpcUrl),
        })
        const txHash = await walletClient.sendTransaction({
          to: CONFIG.usdc,
          data: transferData,
          chain: {
            id: 8283,
            name: 'StableNet Local',
            nativeCurrency: { name: 'WKRC', symbol: 'WKRC', decimals: 18 },
            rpcUrls: { default: { http: ['http://localhost:8501'] } },
          },
        })
        await publicClient.waitForTransactionReceipt({ hash: txHash })
      }
    }

    // Verify USDC at counterfactual
    const _saBalance = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccountAddress],
    })) as bigint

    // Build callData: execute(mode, encode(approve(erc20Paymaster, type(uint256).max)))
    const execMode = `0x${'00'.repeat(32)}` as Hex
    const approveCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONFIG.erc20Paymaster, 2n ** 256n - 1n], // max approval
    })
    // Kernel v3 expects abi.encodePacked(target[20], value[32], callData[variable])
    const executionCalldata = concat([
      CONFIG.usdc, // 20 bytes: target address
      pad(toHex(0n), { size: 32 }), // 32 bytes: value
      approveCalldata, // variable: callData
    ]) as Hex
    const callData = encodeFunctionData({
      abi: KERNEL_ACCOUNT_ABI,
      functionName: 'execute',
      args: [execMode, executionCalldata],
    })

    // Factory data
    const factoryData = encodeFunctionData({
      abi: KERNEL_FACTORY_ABI,
      functionName: 'createAccount',
      args: [initializeData, salt],
    })
    const initCode = concat([CONFIG.factory, factoryData]) as Hex

    // Gas params
    const verificationGasLimit = 500000n
    const callGasLimit = 200000n
    const preVerificationGas = 100000n
    const maxPriorityFeePerGas = 1000000000n
    const maxFeePerGas = 2000000000n
    const pmVerificationGasLimit = 200000n
    const pmPostOpGasLimit = 100000n
    const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit)
    const gasFees = packGasLimits(maxPriorityFeePerGas, maxFeePerGas)

    // VerifyingPaymaster signature
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600)
    const validAfter = 0n
    const senderNonce = (await publicClient.readContract({
      address: CONFIG.verifyingPaymaster,
      abi: parseAbi(['function senderNonce(address) view returns (uint256)']),
      functionName: 'senderNonce',
      args: [smartAccountAddress],
    })) as bigint

    const paymasterHash = computePaymasterHash({
      sender: smartAccountAddress,
      nonce: 0n,
      initCode,
      callData,
      accountGasLimits,
      preVerificationGas,
      gasFees,
      chainId: CONFIG.chainId,
      paymasterAddress: CONFIG.verifyingPaymaster,
      validUntil,
      validAfter,
      senderNonce,
    })
    const paymasterSignature = await paymasterSigner.signMessage({
      message: { raw: paymasterHash },
    })
    const paymasterData = concat([
      pad(toHex(validUntil), { size: 6 }),
      pad(toHex(validAfter), { size: 6 }),
      paymasterSignature,
    ]) as Hex
    const paymasterAndData = concat([
      CONFIG.verifyingPaymaster,
      pad(toHex(pmVerificationGasLimit), { size: 16 }),
      pad(toHex(pmPostOpGasLimit), { size: 16 }),
      paymasterData,
    ]) as Hex

    // Build packed op, get hash, sign
    const packedOp = {
      sender: smartAccountAddress,
      nonce: 0n,
      initCode,
      callData,
      accountGasLimits,
      preVerificationGas,
      gasFees,
      paymasterAndData,
      signature: '0x' as Hex,
    }
    const userOpHash = (await publicClient.readContract({
      address: CONFIG.entryPoint,
      abi: EP_ABI,
      functionName: 'getUserOpHash',
      args: [packedOp],
    })) as Hex
    const userOpSignature = await userSigner.signMessage({ message: { raw: userOpHash } })
    const result = await sendUserOp(
      CONFIG.bundlerUrl,
      {
        sender: smartAccountAddress,
        nonce: toHex(0n),
        factory: CONFIG.factory,
        factoryData,
        callData,
        callGasLimit: toHex(callGasLimit),
        verificationGasLimit: toHex(verificationGasLimit),
        preVerificationGas: toHex(preVerificationGas),
        maxFeePerGas: toHex(maxFeePerGas),
        maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
        paymaster: CONFIG.verifyingPaymaster,
        paymasterData,
        paymasterVerificationGasLimit: toHex(pmVerificationGasLimit),
        paymasterPostOpGasLimit: toHex(pmPostOpGasLimit),
        signature: userOpSignature,
      },
      CONFIG.entryPoint
    )

    if (result.error) {
      return
    }

    // Wait for receipt
    const receipt = await waitForReceipt(CONFIG.bundlerUrl, result.result)
    if (receipt) {
    } else {
      // Check on-chain if it worked
      const code = await publicClient.getCode({ address: smartAccountAddress })
      if (code && code !== '0x') {
      } else {
        return
      }
    }
  } else {
    // Check if USDC already at smart account
    const _saBalance = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccountAddress],
    })) as bigint

    // Check allowance
    const allowance = (await publicClient.readContract({
      address: CONFIG.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [smartAccountAddress, CONFIG.erc20Paymaster],
    })) as bigint

    // If no allowance, send approve UserOp via VerifyingPaymaster
    if (allowance === 0n) {
      const approveNonce = (await publicClient.readContract({
        address: CONFIG.entryPoint,
        abi: EP_ABI,
        functionName: 'getNonce',
        args: [smartAccountAddress, 0n],
      })) as bigint

      const approveMode = `0x${'00'.repeat(32)}` as Hex
      const approveCalldata = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONFIG.erc20Paymaster, 2n ** 256n - 1n],
      })
      const approveExecData = concat([
        CONFIG.usdc,
        pad(toHex(0n), { size: 32 }),
        approveCalldata,
      ]) as Hex
      const approveCallData = encodeFunctionData({
        abi: KERNEL_ACCOUNT_ABI,
        functionName: 'execute',
        args: [approveMode, approveExecData],
      })

      const vgl = 500000n,
        cgl = 200000n,
        pvg = 100000n
      const mpfpg = 1000000000n,
        mfpg = 2000000000n
      const pmvgl = 200000n,
        pmpog = 100000n
      const agl = packGasLimits(vgl, cgl)
      const gf = packGasLimits(mpfpg, mfpg)
      const vu = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const va = 0n
      const sn = (await publicClient.readContract({
        address: CONFIG.verifyingPaymaster,
        abi: parseAbi(['function senderNonce(address) view returns (uint256)']),
        functionName: 'senderNonce',
        args: [smartAccountAddress],
      })) as bigint

      const pmHash = computePaymasterHash({
        sender: smartAccountAddress,
        nonce: approveNonce,
        initCode: '0x' as Hex,
        callData: approveCallData,
        accountGasLimits: agl,
        preVerificationGas: pvg,
        gasFees: gf,
        chainId: CONFIG.chainId,
        paymasterAddress: CONFIG.verifyingPaymaster,
        validUntil: vu,
        validAfter: va,
        senderNonce: sn,
      })
      const pmSig = await paymasterSigner.signMessage({ message: { raw: pmHash } })
      const pmData = concat([
        pad(toHex(vu), { size: 6 }),
        pad(toHex(va), { size: 6 }),
        pmSig,
      ]) as Hex
      const pmAndData = concat([
        CONFIG.verifyingPaymaster,
        pad(toHex(pmvgl), { size: 16 }),
        pad(toHex(pmpog), { size: 16 }),
        pmData,
      ]) as Hex

      const approvePacked = {
        sender: smartAccountAddress,
        nonce: approveNonce,
        initCode: '0x' as Hex,
        callData: approveCallData,
        accountGasLimits: agl,
        preVerificationGas: pvg,
        gasFees: gf,
        paymasterAndData: pmAndData,
        signature: '0x' as Hex,
      }
      const approveOpHash = (await publicClient.readContract({
        address: CONFIG.entryPoint,
        abi: EP_ABI,
        functionName: 'getUserOpHash',
        args: [approvePacked],
      })) as Hex
      const approveSig = await userSigner.signMessage({ message: { raw: approveOpHash } })

      const approveResult = await sendUserOp(
        CONFIG.bundlerUrl,
        {
          sender: smartAccountAddress,
          nonce: toHex(approveNonce),
          callData: approveCallData,
          callGasLimit: toHex(cgl),
          verificationGasLimit: toHex(vgl),
          preVerificationGas: toHex(pvg),
          maxFeePerGas: toHex(mfpg),
          maxPriorityFeePerGas: toHex(mpfpg),
          paymaster: CONFIG.verifyingPaymaster,
          paymasterData: pmData,
          paymasterVerificationGasLimit: toHex(pmvgl),
          paymasterPostOpGasLimit: toHex(pmpog),
          signature: approveSig,
        },
        CONFIG.entryPoint
      )

      if (approveResult.error) {
        return
      }
      const approveReceipt = await waitForReceipt(CONFIG.bundlerUrl, approveResult.result)
      if (approveReceipt) {
      }

      // Verify allowance
      const newAllowance = (await publicClient.readContract({
        address: CONFIG.usdc,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [smartAccountAddress, CONFIG.erc20Paymaster],
      })) as bigint
      if (newAllowance === 0n) {
        return
      }
    }
  }

  // Get current state
  const currentNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [smartAccountAddress, 0n],
  })) as bigint

  const _usdcBalanceBefore = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccountAddress],
  })) as bigint

  // Build a simple no-op callData
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

  // Gas params
  const verificationGasLimit = 500000n
  const callGasLimit = 200000n
  const preVerificationGas = 100000n
  const maxPriorityFeePerGas = 1000000000n
  const maxFeePerGas = 2000000000n
  const pmVerificationGasLimit = 200000n
  const pmPostOpGasLimit = 200000n // Higher for ERC20 transfer in postOp
  const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit)
  const gasFees = packGasLimits(maxPriorityFeePerGas, maxFeePerGas)

  // ERC20Paymaster paymasterData = just the token address (20 bytes)
  const erc20PaymasterData = CONFIG.usdc as Hex // token address
  const paymasterAndData = concat([
    CONFIG.erc20Paymaster,
    pad(toHex(pmVerificationGasLimit), { size: 16 }),
    pad(toHex(pmPostOpGasLimit), { size: 16 }),
    erc20PaymasterData,
  ]) as Hex

  // Build packed op, get hash, sign
  const packedOp = {
    sender: smartAccountAddress,
    nonce: currentNonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: '0x' as Hex,
  }
  const userOpHash = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getUserOpHash',
    args: [packedOp],
  })) as Hex
  const userOpSignature = await userSigner.signMessage({ message: { raw: userOpHash } })
  const result = await sendUserOp(
    CONFIG.bundlerUrl,
    {
      sender: smartAccountAddress,
      nonce: toHex(currentNonce),
      callData,
      callGasLimit: toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas: toHex(preVerificationGas),
      maxFeePerGas: toHex(maxFeePerGas),
      maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
      paymaster: CONFIG.erc20Paymaster,
      paymasterData: erc20PaymasterData,
      paymasterVerificationGasLimit: toHex(pmVerificationGasLimit),
      paymasterPostOpGasLimit: toHex(pmPostOpGasLimit),
      signature: userOpSignature,
    },
    CONFIG.entryPoint
  )

  if (result.error) {
    try {
      const _simResult = await publicClient.readContract({
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
        args: [{ ...packedOp, signature: userOpSignature }],
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

  // Check USDC balance after
  const _usdcBalanceAfter = (await publicClient.readContract({
    address: CONFIG.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccountAddress],
  })) as bigint

  const _newNonce = (await publicClient.readContract({
    address: CONFIG.entryPoint,
    abi: EP_ABI,
    functionName: 'getNonce',
    args: [smartAccountAddress, 0n],
  })) as bigint
}

main().catch(console.error)
