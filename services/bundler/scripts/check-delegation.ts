/**
 * Verify EIP-7702 delegation by having EOA call itself
 */
import { createPublicClient, encodeFunctionData, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

async function main() {
  const eoaSigner = privateKeyToAccount('0x80183f2d3db76f59e257602ed657302c71c808ddc44e0ba9110a689145c138dd')
  const eoaAddress = eoaSigner.address
  const deployerAddr = '0x056DB290F8Ba3250ca64a45D16284D04Bc6f5FBf'
  const publicClient = createPublicClient({ transport: http('http://localhost:8501') })

  console.log('EOA address:', eoaAddress)

  // 1. 현재 상태 확인
  const code = await publicClient.getCode({ address: eoaAddress })
  console.log('EOA code:', code ? code.slice(0, 46) + '...' : '0x')
  console.log('Delegation set:', code?.toLowerCase().startsWith('0xef0100'))

  const balance = await publicClient.getBalance({ address: eoaAddress })
  console.log('Native balance:', balance, 'wei')

  // Kernel execute(mode, calldata) - no-op
  const callData = encodeFunctionData({
    abi: parseAbi(['function execute(bytes32 mode, bytes calldata executionCalldata) payable']),
    functionName: 'execute',
    args: [`0x${'00'.repeat(32)}`, '0x'],
  })

  // 2. EOA가 자기 주소로 eth_call (from=EOA, to=EOA)
  console.log('\n=== Test 1: EOA → EOA (자기 자신 호출) ===')
  try {
    const result = await publicClient.call({
      account: eoaAddress,
      to: eoaAddress,
      data: callData,
    })
    console.log('SUCCESS! Result:', result)
  } catch (err: any) {
    console.log('FAILED:', err.shortMessage || err.message)
  }

  // 3. Deployer가 EOA 주소로 eth_call
  console.log('\n=== Test 2: Deployer → EOA ===')
  try {
    const result2 = await publicClient.call({
      account: deployerAddr,
      to: eoaAddress,
      data: callData,
    })
    console.log('SUCCESS! Result:', result2)
  } catch (err: any) {
    console.log('FAILED:', err.shortMessage || err.message)
  }

  // 4. EntryPoint getNonce 확인 (delegation 없으면 이것도 실패해야 함)
  console.log('\n=== Test 3: EntryPoint.getNonce(EOA) ===')
  try {
    const nonce = await publicClient.readContract({
      address: '0xef6817fe73741a8f10088f9511c64b666a338a14',
      abi: parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256)']),
      functionName: 'getNonce',
      args: [eoaAddress, 0n],
    })
    console.log('EntryPoint nonce:', nonce.toString())
    console.log('(nonce > 0 = 이전 UserOp 성공 = delegation 유효)')
  } catch (err: any) {
    console.log('FAILED:', err.shortMessage || err.message)
  }
}

main().catch(console.error)
