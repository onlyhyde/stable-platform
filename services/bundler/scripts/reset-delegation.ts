/**
 * Reset EIP-7702 delegation: delegate to 0x0 (revocation)
 *
 * EOA signs authorization with address=0x0 → code cleared
 * Deployer sends Type 4 tx (EOA has no native balance)
 */
import { type Address, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CONFIG = {
  rpcUrl: 'http://localhost:8501',
  chainId: 8283,
  eoaPrivateKey:
    '0x80183f2d3db76f59e257602ed657302c71c808ddc44e0ba9110a689145c138dd' as `0x${string}`,
  deployerPrivateKey:
    '0xe8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35' as `0x${string}`,
}

const CHAIN = {
  id: CONFIG.chainId,
  name: 'StableNet Local',
  nativeCurrency: { name: 'WKRC', symbol: 'WKRC', decimals: 18 },
  rpcUrls: { default: { http: [CONFIG.rpcUrl] } },
} as const

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

  // 1. 현재 상태 확인
  const codeBefore = await publicClient.getCode({ address: eoaAddress })
  const isDelegated =
    codeBefore && codeBefore !== '0x' && codeBefore.toLowerCase().startsWith('0xef0100')

  if (!isDelegated) {
    return
  }

  // 2. 현재 nonce 확인
  const currentNonce = await publicClient.getTransactionCount({ address: eoaAddress })
  const authorization = await eoaSigner.signAuthorization({
    contractAddress: '0x0000000000000000000000000000000000000000' as Address,
    chainId: CONFIG.chainId,
    nonce: currentNonce,
  })
  const txHash = await deployerWallet.sendTransaction({
    to: eoaAddress,
    authorizationList: [authorization],
    gas: 100000n,
  })

  const _receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  // 5. 결과 확인
  const _codeAfter = await publicClient.getCode({ address: eoaAddress })
  const _nonceAfter = await publicClient.getTransactionCount({ address: eoaAddress })
}

main().catch(console.error)
