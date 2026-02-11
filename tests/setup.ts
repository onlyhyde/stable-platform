import { afterAll, beforeAll } from 'vitest'

// Test environment configuration
export const TEST_CONFIG = {
  // Local Anvil/Hardhat network
  rpcUrl: process.env.TEST_RPC_URL || 'http://127.0.0.1:8545',
  chainId: Number.parseInt(process.env.TEST_CHAIN_ID || '31337', 10),

  // Bundler endpoint
  bundlerUrl: process.env.TEST_BUNDLER_URL || 'http://127.0.0.1:4337',

  // Paymaster endpoint
  paymasterUrl: process.env.TEST_PAYMASTER_URL || 'http://127.0.0.1:4338',

  // Contract addresses (deployed to local Anvil)
  contracts: {
    // ERC-4337 Core
    entryPoint: process.env.ENTRY_POINT_ADDRESS || '0x4A679253410272dd5232B3Ff7cF5dbB88f295319',

    // Kernel Smart Account
    kernelFactory:
      process.env.KERNEL_FACTORY_ADDRESS || '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
    kernelImplementation:
      process.env.KERNEL_IMPLEMENTATION_ADDRESS || '0x7a2088a1bFc9d81c55368AE168C2C02570cB814F',

    // Validators
    ecdsaValidator:
      process.env.ECDSA_VALIDATOR_ADDRESS || '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
    sessionKeyValidator:
      process.env.SESSION_KEY_VALIDATOR_ADDRESS || '0x95401dc811bb5740090279Ba06cfA8fcF6113778',

    // Paymasters
    verifyingPaymaster:
      process.env.VERIFYING_PAYMASTER_ADDRESS || '0x4c5859f0F772848b2D91F1D83E2Fe57935348029',
    subscriptionPaymaster: process.env.SUBSCRIPTION_PAYMASTER_ADDRESS || '',

    // Tokens
    usdc: process.env.USDC_ADDRESS || '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
    usdt: process.env.USDT_ADDRESS || '',
    weth: process.env.WETH_ADDRESS || '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',

    // Subscription
    subscriptionManager:
      process.env.SUBSCRIPTION_MANAGER_ADDRESS || '0x9d4454B023096f34B160D6B654540c56A1F81688',
    permissionManager:
      process.env.PERMISSION_MANAGER_ADDRESS || '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf',
    recurringPaymentExecutor:
      process.env.RECURRING_PAYMENT_EXECUTOR_ADDRESS ||
      '0x998abeb3E57409262aE5b751f60747921B33613E',

    // DeFi
    uniswapV3Router: process.env.UNISWAP_V3_ROUTER_ADDRESS || '',
    uniswapV3Quoter: process.env.UNISWAP_V3_QUOTER_ADDRESS || '',

    // Stealth (EIP-5564, EIP-6538)
    stealthAnnouncer:
      process.env.STEALTH_ANNOUNCER_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    stealthRegistry:
      process.env.STEALTH_REGISTRY_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },

  // Test accounts (Anvil default accounts)
  accounts: {
    deployer: {
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    },
    user1: {
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    },
    user2: {
      address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    },
    bundler: {
      address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    },
  },
}

// Setup before all tests
beforeAll(async () => {})

// Cleanup after all tests
afterAll(async () => {})

// Helper to check if local network is available
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const response = await fetch(TEST_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

// Helper to check if bundler is available
export async function isBundlerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(TEST_CONFIG.bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_supportedEntryPoints',
        params: [],
        id: 1,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}
