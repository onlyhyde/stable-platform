/**
 * Verify EIP-7702 delegation by having EOA call itself
 */
import { createPublicClient, encodeFunctionData, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

async function main() {
  const eoaSigner = privateKeyToAccount(
    '0x80183f2d3db76f59e257602ed657302c71c808ddc44e0ba9110a689145c138dd'
  )
  const eoaAddress = eoaSigner.address
  const deployerAddr = '0x056DB290F8Ba3250ca64a45D16284D04Bc6f5FBf'
  const publicClient = createPublicClient({ transport: http('http://localhost:8501') })

  // 1. 현재 상태 확인
  const _code = await publicClient.getCode({ address: eoaAddress })

  const _balance = await publicClient.getBalance({ address: eoaAddress })

  // Kernel execute(mode, calldata) - no-op
  const callData = encodeFunctionData({
    abi: parseAbi(['function execute(bytes32 mode, bytes calldata executionCalldata) payable']),
    functionName: 'execute',
    args: [`0x${'00'.repeat(32)}`, '0x'],
  })
  try {
    const _result = await publicClient.call({
      account: eoaAddress,
      to: eoaAddress,
      data: callData,
    })
  } catch (_err: unknown) {}
  try {
    const _result2 = await publicClient.call({
      account: deployerAddr,
      to: eoaAddress,
      data: callData,
    })
  } catch (_err: unknown) {}
  try {
    const _nonce = await publicClient.readContract({
      address: '0xef6817fe73741a8f10088f9511c64b666a338a14',
      abi: parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256)']),
      functionName: 'getNonce',
      args: [eoaAddress, 0n],
    })
  } catch (_err: unknown) {}
}

main().catch(console.error)
