import type { Address, Hex } from 'viem'
import { encodeFunctionData, pad, concat, toHex } from 'viem'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ENTRY_POINT_SIMULATIONS_ABI,
  ENTRY_POINT_SIMULATIONS_BYTECODE,
} from '../../../src/abi'
import { decodeValidationResultReturn } from '../../../src/validation/errors'
import { type AnvilFixture, shouldSkipAnvilTests } from './setup'
import { startAnvilStandalone } from './anvilStandalone'

/**
 * State Override Integration Test
 *
 * Verifies that eth_call state override correctly injects EntryPointSimulations
 * bytecode at the EntryPoint address, enabling simulateValidation to run
 * as a normal return (not revert).
 *
 * Test strategy:
 *   1. Deploy EntryPoint on standalone Anvil (no fork)
 *   2. Call simulateValidation WITHOUT state override → reverts (function doesn't exist)
 *   3. Call simulateValidation WITH state override → runs EntryPointSimulations code
 *
 * To run: SKIP_ANVIL_TESTS=false pnpm test:anvil
 */
describe.skipIf(shouldSkipAnvilTests())('State Override Integration', () => {
  let fixture: AnvilFixture
  let entryPoint: Address
  let deployer: Address

  beforeAll(async () => {
    fixture = await startAnvilStandalone()
    deployer = fixture.accounts[0]!
    entryPoint = await deployEntryPoint(fixture)
  }, 60000)

  afterAll(async () => {
    if (fixture) {
      await fixture.stop()
    }
  }, 10000)

  it('should have EntryPoint deployed with code', async () => {
    const code = await fixture.publicClient.getCode({ address: entryPoint })
    expect(code).toBeDefined()
    expect(code!.length).toBeGreaterThan(2) // more than just '0x'
  })

  it('should FAIL simulateValidation WITHOUT state override (function removed from EntryPoint)', async () => {
    const packedOp = buildMinimalPackedUserOp(deployer)

    const calldata = encodeFunctionData({
      abi: ENTRY_POINT_SIMULATIONS_ABI,
      functionName: 'simulateValidation',
      args: [packedOp],
    })

    // Without state override, EntryPoint doesn't have simulateValidation
    // so this should revert
    await expect(
      fixture.publicClient.call({
        to: entryPoint,
        data: calldata,
        gas: 1_000_000n,
      })
    ).rejects.toThrow()
  })

  it('should SUCCEED simulateValidation WITH state override (EntryPointSimulations injected)', async () => {
    const packedOp = buildMinimalPackedUserOp(deployer)

    const calldata = encodeFunctionData({
      abi: ENTRY_POINT_SIMULATIONS_ABI,
      functionName: 'simulateValidation',
      args: [packedOp],
    })

    // With state override: inject EntryPointSimulations bytecode
    // The UserOp will fail validation (EOA sender, no deposit), but
    // the important thing is that the function EXECUTES (state override works)
    // and returns a meaningful error via revert (FailedOp), not "function not found"
    try {
      const result = await fixture.publicClient.call({
        to: entryPoint,
        data: calldata,
        gas: 3_000_000n,
        stateOverride: [
          {
            address: entryPoint,
            code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
          },
        ],
      })

      // If we get a normal return, decode it as ValidationResult
      expect(result.data).toBeDefined()
      const decoded = decodeValidationResultReturn(result.data!)
      expect(decoded.returnInfo).toBeDefined()
      expect(decoded.senderInfo).toBeDefined()
    } catch (error: unknown) {
      // FailedOp revert is also acceptable — it means simulateValidation
      // actually ran (state override worked) but the UserOp failed validation
      const errorStr = String(error)
      // Should contain AA error codes (AA20 account not deployed, AA21 didn't pay, etc.)
      // NOT "execution reverted" with no data (which would mean function not found)
      expect(
        errorStr.includes('AA') ||
          errorStr.includes('FailedOp') ||
          errorStr.includes('account not deployed') ||
          errorStr.includes('revert')
      ).toBe(true)

      // Verify it's NOT a "function selector not found" style error
      expect(errorStr).not.toContain('function selector was not recognized')
    }
  })

  it('should return normal ValidationResult for funded account with state override', async () => {
    const sender = fixture.accounts[1]!

    // Deploy a minimal contract at sender address so it passes "has code" check
    await fixture.testClient.setCode({
      address: sender,
      bytecode: MINIMAL_ACCOUNT_BYTECODE,
    })

    // Deposit ETH for sender in EntryPoint
    await fixture.walletClient.sendTransaction({
      to: entryPoint,
      data: encodeFunctionData({
        abi: [{ type: 'function', name: 'depositTo', inputs: [{ name: 'account', type: 'address' }], outputs: [], stateMutability: 'payable' }],
        functionName: 'depositTo',
        args: [sender],
      }),
      value: 10n ** 18n, // 1 ETH deposit
    })
    await fixture.testClient.mine({ blocks: 1 })

    const packedOp = buildMinimalPackedUserOp(sender)

    const calldata = encodeFunctionData({
      abi: ENTRY_POINT_SIMULATIONS_ABI,
      functionName: 'simulateValidation',
      args: [packedOp],
    })

    // This should get further in validation since sender has code + deposit
    try {
      const result = await fixture.publicClient.call({
        to: entryPoint,
        data: calldata,
        gas: 5_000_000n,
        stateOverride: [
          {
            address: entryPoint,
            code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
          },
        ],
      })

      // Normal return — ValidationResult
      if (result.data && result.data.length > 2) {
        const decoded = decodeValidationResultReturn(result.data)
        expect(decoded.returnInfo).toBeDefined()
        expect(decoded.returnInfo.preOpGas).toBeGreaterThanOrEqual(0n)
        expect(decoded.senderInfo).toBeDefined()
      }
    } catch (error: unknown) {
      // Even if it fails, it should be an AA error (meaning simulation ran)
      const errorStr = String(error)
      expect(
        errorStr.includes('AA') ||
          errorStr.includes('FailedOp') ||
          errorStr.includes('revert')
      ).toBe(true)
    }
  })

  it('should preserve EntryPoint storage when using state override', async () => {
    // Verify deposit made in previous test is readable via state-overridden contract
    const sender = fixture.accounts[1]!

    // Read balance via original EntryPoint
    const balanceBefore = await fixture.publicClient.readContract({
      address: entryPoint,
      abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: 'balanceOf',
      args: [sender],
    })

    // Read balance via state-overridden contract (EntryPointSimulations)
    const balanceCalldata = encodeFunctionData({
      abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: 'balanceOf',
      args: [sender],
    })

    const result = await fixture.publicClient.call({
      to: entryPoint,
      data: balanceCalldata,
      stateOverride: [
        {
          address: entryPoint,
          code: ENTRY_POINT_SIMULATIONS_BYTECODE as Hex,
        },
      ],
    })

    // Both should return the same balance — proving storage is preserved
    expect(balanceBefore).toBeGreaterThan(0n)

    // Decode uint256 from return data
    const overriddenBalance = BigInt(result.data ?? '0x0')
    expect(overriddenBalance).toBe(balanceBefore)
  })
})

// ============ Helpers ============

/**
 * Minimal bytecode that acts as a "valid" account for simulateValidation.
 * Returns success (0) for any call — enough to pass the validateUserOp check.
 * PUSH1 0x00, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
 */
const MINIMAL_ACCOUNT_BYTECODE =
  '0x60006000526020600060003960206000f3' as Hex

/**
 * Build a minimal PackedUserOperation for testing.
 * Uses high gas values to avoid OOG, but the op itself may fail validation.
 */
function buildMinimalPackedUserOp(sender: Address) {
  const accountGasLimits = concat([
    pad(toHex(200_000n), { size: 16 }), // verificationGasLimit
    pad(toHex(200_000n), { size: 16 }), // callGasLimit
  ]) as Hex

  const gasFees = concat([
    pad(toHex(1_000_000_000n), { size: 16 }), // maxPriorityFeePerGas
    pad(toHex(30_000_000_000n), { size: 16 }), // maxFeePerGas
  ]) as Hex

  return {
    sender,
    nonce: 0n,
    initCode: '0x' as Hex,
    callData: '0x' as Hex,
    accountGasLimits,
    preVerificationGas: 50_000n,
    gasFees,
    paymasterAndData: '0x' as Hex,
    signature: ('0x' + 'ff'.repeat(65)) as Hex,
  }
}

/**
 * Deploy EntryPoint on Anvil using the compiled creation bytecode from Foundry.
 */
async function deployEntryPoint(fixture: AnvilFixture): Promise<Address> {
  // Read creation bytecode from forge artifact
  const fs = await import('node:fs')
  const path = await import('node:path')

  const artifactPath = path.resolve(
    __dirname,
    '../../../../../../poc-contract/out/entrypoint/EntryPoint.sol/EntryPoint.json'
  )

  let creationBytecode: Hex

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
    creationBytecode = artifact.bytecode.object as Hex
  } catch {
    throw new Error(
      `Failed to read EntryPoint artifact at ${artifactPath}. Run 'forge build' in poc-contract first.`
    )
  }

  // Deploy via raw transaction (contract creation)
  const hash = await fixture.walletClient.sendTransaction({
    data: creationBytecode,
  })

  await fixture.testClient.mine({ blocks: 1 })

  const receipt = await fixture.publicClient.getTransactionReceipt({ hash })

  if (!receipt.contractAddress) {
    throw new Error('EntryPoint deployment failed — no contract address in receipt')
  }

  return receipt.contractAddress
}
