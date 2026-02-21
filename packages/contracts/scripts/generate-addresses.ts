#!/usr/bin/env tsx
/**
 * Generate TypeScript address file and .env.contracts from Foundry deployment output
 *
 * Usage:
 *   pnpm generate
 *   pnpm generate --chain 8283
 *   pnpm generate --input ../../poc-contract/deployments
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MONOREPO_ROOT = resolve(__dirname, '../../..')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Load .env file from monorepo root into process.env (does not override existing vars)
 */
function loadEnvFile(): void {
  const envPath = resolve(MONOREPO_ROOT, '.env')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

interface DeploymentOutput {
  [key: string]: string
}

interface ChainDeployment {
  chainId: number
  addresses: DeploymentOutput
}

// ─── Key-to-structure mapping ───────────────────────────────────────────────
// Maps addresses.json keys to their location in ChainAddresses.
// Keys not listed here go into `raw` only.

const KEY_MAP: Record<string, { group: string; field: string }> = {
  // core
  entryPoint: { group: 'core', field: 'entryPoint' },
  kernel: { group: 'core', field: 'kernel' },
  kernelFactory: { group: 'core', field: 'kernelFactory' },
  factoryStaker: { group: 'core', field: 'factoryStaker' },

  // validators
  ecdsaValidator: { group: 'validators', field: 'ecdsaValidator' },
  webAuthnValidator: { group: 'validators', field: 'webAuthnValidator' },
  multiChainValidator: { group: 'validators', field: 'multiChainValidator' },
  multiSigValidator: { group: 'validators', field: 'multiSigValidator' },
  weightedEcdsaValidator: { group: 'validators', field: 'weightedEcdsaValidator' },

  // executors
  sessionKeyExecutor: { group: 'executors', field: 'sessionKeyExecutor' },

  // hooks
  spendingLimitHook: { group: 'hooks', field: 'spendingLimitHook' },

  // paymasters
  verifyingPaymaster: { group: 'paymasters', field: 'verifyingPaymaster' },
  erc20Paymaster: { group: 'paymasters', field: 'erc20Paymaster' },
  permit2Paymaster: { group: 'paymasters', field: 'permit2Paymaster' },
  sponsorPaymaster: { group: 'paymasters', field: 'sponsorPaymaster' },

  // privacy (stealth)
  erc5564Announcer: { group: 'privacy', field: 'stealthAnnouncer' },
  erc6538Registry: { group: 'privacy', field: 'stealthRegistry' },

  // compliance
  kycRegistry: { group: 'compliance', field: 'kycRegistry' },
  regulatoryRegistry: { group: 'compliance', field: 'regulatoryRegistry' },
  auditHook: { group: 'compliance', field: 'auditHook' },
  auditLogger: { group: 'compliance', field: 'auditLogger' },

  // subscriptions
  subscriptionManager: { group: 'subscriptions', field: 'subscriptionManager' },
  recurringPaymentExecutor: { group: 'subscriptions', field: 'recurringPaymentExecutor' },
  erc7715PermissionManager: { group: 'subscriptions', field: 'permissionManager' },

  // tokens
  wkrc: { group: 'tokens', field: 'wkrc' },
  usdc: { group: 'tokens', field: 'usdc' },

  // defi
  lendingPool: { group: 'defi', field: 'lendingPool' },
  stakingVault: { group: 'defi', field: 'stakingVault' },
  priceOracle: { group: 'defi', field: 'priceOracle' },
  proofOfReserve: { group: 'defi', field: 'proofOfReserve' },
  privateBank: { group: 'defi', field: 'privateBank' },
  permit2: { group: 'defi', field: 'permit2' },

  // uniswap
  uniswapV3Factory: { group: 'uniswap', field: 'factory' },
  uniswapV3SwapRouter: { group: 'uniswap', field: 'swapRouter' },
  uniswapV3Quoter: { group: 'uniswap', field: 'quoter' },
  uniswapV3NftPositionManager: { group: 'uniswap', field: 'nftPositionManager' },
  uniswapV3WkrcUsdcPool: { group: 'uniswap', field: 'wkrcUsdcPool' },

  // fallbacks
  flashLoanFallback: { group: 'fallbacks', field: 'flashLoanFallback' },
  tokenReceiverFallback: { group: 'fallbacks', field: 'tokenReceiverFallback' },
}

// Group definitions with default fields (all default to ZERO_ADDRESS)
const GROUP_DEFAULTS: Record<string, string[]> = {
  core: ['entryPoint', 'kernel', 'kernelFactory', 'factoryStaker'],
  validators: [
    'ecdsaValidator',
    'webAuthnValidator',
    'multiChainValidator',
    'multiSigValidator',
    'weightedEcdsaValidator',
  ],
  executors: ['sessionKeyExecutor'],
  hooks: ['spendingLimitHook'],
  paymasters: ['verifyingPaymaster', 'erc20Paymaster', 'permit2Paymaster', 'sponsorPaymaster'],
  privacy: ['stealthAnnouncer', 'stealthRegistry'],
  compliance: ['kycRegistry', 'regulatoryRegistry', 'auditHook', 'auditLogger'],
  subscriptions: ['subscriptionManager', 'recurringPaymentExecutor', 'permissionManager'],
  tokens: ['wkrc', 'usdc'],
  defi: ['lendingPool', 'stakingVault', 'priceOracle', 'proofOfReserve', 'privateBank', 'permit2'],
  uniswap: ['factory', 'swapRouter', 'quoter', 'nftPositionManager', 'wkrcUsdcPool'],
  fallbacks: ['flashLoanFallback', 'tokenReceiverFallback'],
}

// ─── ENV var mapping ─────────────────────────────────────────────────────────
// Maps addresses.json key → ENV variable name used in docker-compose and Go services

const ENV_MAP: Record<string, string> = {
  entryPoint: 'ENTRY_POINT_ADDRESS',
  kernel: 'KERNEL_IMPLEMENTATION_ADDRESS',
  kernelFactory: 'KERNEL_FACTORY_ADDRESS',
  factoryStaker: 'FACTORY_STAKER_ADDRESS',
  ecdsaValidator: 'ECDSA_VALIDATOR_ADDRESS',
  webAuthnValidator: 'WEBAUTHN_VALIDATOR_ADDRESS',
  multiChainValidator: 'MULTI_CHAIN_VALIDATOR_ADDRESS',
  multiSigValidator: 'MULTI_SIG_VALIDATOR_ADDRESS',
  weightedEcdsaValidator: 'WEIGHTED_ECDSA_VALIDATOR_ADDRESS',
  sessionKeyExecutor: 'SESSION_KEY_EXECUTOR_ADDRESS',
  spendingLimitHook: 'SPENDING_LIMIT_HOOK_ADDRESS',
  verifyingPaymaster: 'VERIFYING_PAYMASTER_ADDRESS',
  erc20Paymaster: 'ERC20_PAYMASTER_ADDRESS',
  permit2Paymaster: 'PERMIT2_PAYMASTER_ADDRESS',
  sponsorPaymaster: 'SPONSOR_PAYMASTER_ADDRESS',
  erc5564Announcer: 'STEALTH_ANNOUNCER_ADDRESS',
  erc6538Registry: 'STEALTH_REGISTRY_ADDRESS',
  kycRegistry: 'KYC_REGISTRY_ADDRESS',
  regulatoryRegistry: 'REGULATORY_REGISTRY_ADDRESS',
  auditHook: 'AUDIT_HOOK_ADDRESS',
  auditLogger: 'AUDIT_LOGGER_ADDRESS',
  subscriptionManager: 'SUBSCRIPTION_MANAGER_ADDRESS',
  recurringPaymentExecutor: 'RECURRING_PAYMENT_EXECUTOR_ADDRESS',
  erc7715PermissionManager: 'PERMISSION_MANAGER_ADDRESS',
  wkrc: 'WKRC_ADDRESS',
  usdc: 'USDC_ADDRESS',
  lendingPool: 'LENDING_POOL_ADDRESS',
  stakingVault: 'STAKING_VAULT_ADDRESS',
  priceOracle: 'PRICE_ORACLE_ADDRESS',
  proofOfReserve: 'PROOF_OF_RESERVE_ADDRESS',
  privateBank: 'PRIVATE_BANK_ADDRESS',
  permit2: 'PERMIT2_ADDRESS',
  uniswapV3Factory: 'UNISWAP_V3_FACTORY',
  uniswapV3SwapRouter: 'UNISWAP_V3_ROUTER',
  uniswapV3Quoter: 'UNISWAP_V3_QUOTER',
  uniswapV3NftPositionManager: 'UNISWAP_V3_NFT_POSITION_MANAGER',
  uniswapV3WkrcUsdcPool: 'UNISWAP_V3_WKRC_USDC_POOL',
  flashLoanFallback: 'FLASH_LOAN_FALLBACK_ADDRESS',
  tokenReceiverFallback: 'TOKEN_RECEIVER_FALLBACK_ADDRESS',
}

// ─── .env merge helper ───────────────────────────────────────────────────────
// Docker Compose auto-reads `.env` from the project root for YAML interpolation.
// This function merges contract addresses from .env.contracts into .env so that
// `docker compose up` picks up new addresses without extra flags.

function mergeIntoEnv(envContractsPath: string): void {
  const dotenvPath = resolve(MONOREPO_ROOT, '.env')
  if (!existsSync(dotenvPath)) return

  const contractsContent = readFileSync(envContractsPath, 'utf-8')
  const dotenvContent = readFileSync(dotenvPath, 'utf-8')

  // Parse contract env vars (skip comments and empty lines)
  const contractVars = new Map<string, string>()
  for (const line of contractsContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    contractVars.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim())
  }

  // Update existing vars in .env, track which were updated
  const updated = new Set<string>()
  const lines = dotenvContent.split('\n')
  const updatedLines = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) return line
    const key = trimmed.slice(0, eqIdx).trim()
    if (contractVars.has(key)) {
      updated.add(key)
      return `${key}=${contractVars.get(key)}`
    }
    return line
  })

  // Append new vars that weren't already in .env
  const newVars: string[] = []
  for (const [key, value] of contractVars) {
    if (!updated.has(key)) {
      newVars.push(`${key}=${value}`)
    }
  }

  let result = updatedLines.join('\n')
  if (newVars.length > 0) {
    // Ensure trailing newline before appending
    if (!result.endsWith('\n')) result += '\n'
    result += `\n# Contract addresses (auto-merged by pnpm generate)\n`
    result += newVars.join('\n')
    result += '\n'
  }

  writeFileSync(dotenvPath, result, 'utf-8')
  console.log(`Merged ${contractVars.size} contract vars into: ${dotenvPath} (${updated.size} updated, ${newVars.length} added)`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findDeploymentFiles(basePath: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(basePath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(basePath, entry.name)

      if (entry.isDirectory()) {
        const addressFile = join(fullPath, 'addresses.json')
        if (existsSync(addressFile)) {
          files.push(addressFile)
        }

        const broadcastDir = join(fullPath, 'broadcast')
        if (existsSync(broadcastDir)) {
          const subFiles = await findDeploymentFiles(broadcastDir)
          files.push(...subFiles)
        }
      } else if (entry.name === 'addresses.json') {
        files.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files
}

async function loadDeployment(filePath: string): Promise<ChainDeployment | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    let chainId: number

    // Check _chainId field first (our format), then chainId, then path
    if (data._chainId) {
      chainId = Number.parseInt(data._chainId, 10)
    } else if (data.chainId) {
      chainId = Number.parseInt(data.chainId, 10)
    } else {
      const pathMatch = filePath.match(/\/(\d+)\//)
      if (pathMatch) {
        chainId = Number.parseInt(pathMatch[1], 10)
      } else {
        console.warn(`Could not determine chain ID for ${filePath}`)
        return null
      }
    }

    // Remove metadata fields from addresses
    const addresses: DeploymentOutput = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_') || typeof value !== 'string') continue
      addresses[key] = value
    }

    return { chainId, addresses }
  } catch (error) {
    console.warn(`Failed to load ${filePath}:`, error)
    return null
  }
}

function getAddr(addresses: DeploymentOutput, key: string): string {
  return addresses[key] || ZERO_ADDRESS
}

function buildGroupAddresses(
  addresses: DeploymentOutput,
  groupName: string
): Record<string, string> {
  const fields = GROUP_DEFAULTS[groupName] || []
  const result: Record<string, string> = {}

  // First, set all defaults to ZERO_ADDRESS
  for (const field of fields) {
    result[field] = ZERO_ADDRESS
  }

  // Then, fill from addresses using KEY_MAP
  for (const [jsonKey, mapping] of Object.entries(KEY_MAP)) {
    if (mapping.group === groupName && addresses[jsonKey]) {
      result[mapping.field] = addresses[jsonKey]
    }
  }

  return result
}

function buildRaw(addresses: DeploymentOutput): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const [key, value] of Object.entries(addresses)) {
    raw[key] = value
  }
  return raw
}

// ─── TypeScript generation ───────────────────────────────────────────────────

function generateAddressesTs(deployments: ChainDeployment[]): string {
  const lines: string[] = [
    '/**',
    ' * Auto-generated contract addresses',
    ' * DO NOT EDIT - This file is generated by scripts/generate-addresses.ts',
    ' *',
    ` * Generated: ${new Date().toISOString()}`,
    ' * To regenerate: pnpm generate',
    ' */',
    '',
    "import type { ChainAddresses } from '../types'",
    '',
    `const ZERO = '${ZERO_ADDRESS}' as const`,
    '',
    '/**',
    ' * Contract addresses by chain ID',
    ' */',
    'export const CHAIN_ADDRESSES: Record<number, ChainAddresses> = {',
  ]

  const groups = [
    'core',
    'validators',
    'executors',
    'hooks',
    'paymasters',
    'privacy',
    'compliance',
    'subscriptions',
    'tokens',
    'defi',
    'uniswap',
    'fallbacks',
  ]

  for (const deployment of deployments) {
    const { chainId, addresses } = deployment
    const chainName = getChainName(chainId)

    lines.push(`  // ${chainName}`)
    lines.push(`  ${chainId}: {`)
    lines.push(`    chainId: ${chainId},`)

    // Generate each group
    for (const group of groups) {
      const groupAddrs = buildGroupAddresses(addresses, group)
      lines.push(`    ${group}: {`)
      for (const [field, addr] of Object.entries(groupAddrs)) {
        lines.push(`      ${field}: '${addr}',`)
      }
      lines.push('    },')
    }

    // delegatePresets
    lines.push('    delegatePresets: [')
    const kernelAddress = addresses.kernel
    if (kernelAddress && kernelAddress !== ZERO_ADDRESS) {
      lines.push('      {')
      lines.push("        name: 'Kernel v3.0',")
      lines.push("        description: 'ZeroDev Kernel - ERC-7579 compatible Smart Account',")
      lines.push(`        address: '${kernelAddress}',`)
      lines.push("        features: ['ERC-7579', 'Modular', 'Gas Sponsorship', 'Session Keys'],")
      lines.push('      },')
    }
    lines.push('    ],')

    // raw: all addresses as flat record
    const raw = buildRaw(addresses)
    lines.push('    raw: {')
    for (const [key, addr] of Object.entries(raw)) {
      lines.push(`      ${key}: '${addr}',`)
    }
    lines.push('    },')

    lines.push('  },')
    lines.push('')
  }

  lines.push('}')
  lines.push('')

  // Service URLs
  lines.push('/**')
  lines.push(' * Service URLs by chain ID')
  lines.push(' */')
  lines.push(
    'export const SERVICE_URLS: Record<number, { bundler: string; paymaster: string; stealthServer: string }> = {'
  )

  for (const deployment of deployments) {
    const { chainId } = deployment
    const urls = getServiceUrls(chainId)
    lines.push(`  ${chainId}: {`)
    lines.push(`    bundler: '${urls.bundler}',`)
    lines.push(`    paymaster: '${urls.paymaster}',`)
    lines.push(`    stealthServer: '${urls.stealthServer}',`)
    lines.push('  },')
  }

  lines.push('}')
  lines.push('')

  // Default tokens
  lines.push('/**')
  lines.push(' * Default tokens by chain ID')
  lines.push(' */')
  lines.push(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: generates TypeScript type literal
    'export const DEFAULT_TOKENS: Record<number, Array<{ address: `0x${string}`; name: string; symbol: string; decimals: number; logoUrl?: string }>> = {'
  )

  for (const deployment of deployments) {
    const { chainId, addresses } = deployment
    const tokens = getDefaultTokens(chainId, addresses)
    lines.push(`  ${chainId}: [`)
    for (const token of tokens) {
      lines.push('    {')
      lines.push(`      address: '${token.address}',`)
      lines.push(`      name: '${token.name}',`)
      lines.push(`      symbol: '${token.symbol}',`)
      lines.push(`      decimals: ${token.decimals},`)
      lines.push('    },')
    }
    lines.push('  ],')
  }

  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

// ─── .env.contracts generation ───────────────────────────────────────────────

function generateEnvContracts(deployments: ChainDeployment[]): string {
  const lines: string[] = [
    '# Auto-generated contract addresses for docker-compose and Go services',
    '# DO NOT EDIT - This file is generated by: pnpm generate',
    `# Generated: ${new Date().toISOString()}`,
    '#',
    '# Usage: source this file alongside your main .env',
    '#   cp .env.example .env',
    '#   cat .env.contracts >> .env',
    '#',
    '# Or in docker-compose.yml:',
    '#   env_file:',
    '#     - .env',
    '#     - packages/contracts/.env.contracts',
    '',
  ]

  for (const deployment of deployments) {
    const { chainId, addresses } = deployment
    const chainName = getChainName(chainId)

    lines.push(`# ═══════════════════════════════════════`)
    lines.push(`# ${chainName} (Chain ID: ${chainId})`)
    lines.push(`# ═══════════════════════════════════════`)
    lines.push('')

    // Group env vars by category
    const categories: Record<string, Array<{ envKey: string; value: string }>> = {}

    for (const [jsonKey, value] of Object.entries(addresses)) {
      const envKey = ENV_MAP[jsonKey]
      if (!envKey) continue

      const mapping = KEY_MAP[jsonKey]
      const category = mapping ? mapping.group : 'other'

      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push({ envKey, value })
    }

    const categoryOrder = [
      'core',
      'validators',
      'executors',
      'hooks',
      'paymasters',
      'privacy',
      'compliance',
      'subscriptions',
      'tokens',
      'defi',
      'uniswap',
      'fallbacks',
      'other',
    ]
    const categoryLabels: Record<string, string> = {
      core: 'Core (ERC-4337 / Kernel)',
      validators: 'Validators',
      executors: 'Executors',
      hooks: 'Hooks',
      paymasters: 'Paymasters',
      privacy: 'Privacy (Stealth)',
      compliance: 'Compliance',
      subscriptions: 'Subscriptions',
      tokens: 'Tokens',
      defi: 'DeFi',
      uniswap: 'Uniswap V3',
      fallbacks: 'Fallbacks',
      other: 'Other',
    }

    for (const cat of categoryOrder) {
      const entries = categories[cat]
      if (!entries || entries.length === 0) continue

      lines.push(`# ${categoryLabels[cat] || cat}`)
      for (const { envKey, value } of entries) {
        lines.push(`${envKey}=${value}`)
      }
      lines.push('')
    }

    // Append precompile addresses for supported chains
    const precompileSection = generatePrecompileEnvSection(chainId)
    if (precompileSection) {
      lines.push(precompileSection)
    }
  }

  return lines.join('\n')
}

// ─── Config helpers ──────────────────────────────────────────────────────────

function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Mainnet',
    8283: 'StableNet Local',
    11155111: 'Sepolia Testnet',
    31337: 'Devnet (Anvil)',
  }
  return names[chainId] || `Chain ${chainId}`
}

function getServiceUrls(chainId: number): {
  bundler: string
  paymaster: string
  stealthServer: string
} {
  const urls: Record<number, { bundler: string; paymaster: string; stealthServer: string }> = {
    8283: {
      bundler: 'http://localhost:4337',
      paymaster: 'http://localhost:4338',
      stealthServer: 'http://localhost:4339',
    },
    31337: {
      bundler: 'http://localhost:4337',
      paymaster: 'http://localhost:4338',
      stealthServer: 'http://localhost:4339',
    },
    11155111: {
      bundler: 'https://testnet.stablenet.io/bundler',
      paymaster: 'https://testnet.stablenet.io/paymaster',
      stealthServer: 'https://testnet.stablenet.io/stealth',
    },
    1: {
      bundler: 'https://stablenet.io/bundler',
      paymaster: 'https://stablenet.io/paymaster',
      stealthServer: 'https://stablenet.io/stealth',
    },
  }
  return urls[chainId] || urls[31337]
}

function getDefaultTokens(
  _chainId: number,
  addresses: DeploymentOutput
): Array<{ address: string; name: string; symbol: string; decimals: number }> {
  const tokens = [
    {
      address: ZERO_ADDRESS,
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  ]

  if (addresses.usdc) {
    tokens.push({
      address: addresses.usdc,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    })
  }

  if (addresses.wkrc) {
    tokens.push({
      address: addresses.wkrc,
      name: 'Wrapped KRC',
      symbol: 'WKRC',
      decimals: 18,
    })
  }

  return tokens
}

// ─── Precompile ENV generation (chain 8283 only) ────────────────────────────

const PRECOMPILE_ENV: Record<string, { envKey: string; address: string; comment: string }> = {
  nativeCoinAdapter: {
    envKey: 'NATIVE_COIN_ADAPTER_ADDRESS',
    address: '0x0000000000000000000000000000000000001000',
    comment: 'WKRC fiat token adapter',
  },
  govValidator: {
    envKey: 'GOV_VALIDATOR_ADDRESS',
    address: '0x0000000000000000000000000000000000001001',
    comment: 'WBFT validator governance',
  },
  govMasterMinter: {
    envKey: 'GOV_MASTER_MINTER_ADDRESS',
    address: '0x0000000000000000000000000000000000001002',
    comment: 'Master minter governance',
  },
  govMinter: {
    envKey: 'GOV_MINTER_ADDRESS',
    address: '0x0000000000000000000000000000000000001003',
    comment: 'Minter governance',
  },
  govCouncil: {
    envKey: 'GOV_COUNCIL_ADDRESS',
    address: '0x0000000000000000000000000000000000001004',
    comment: 'Council governance',
  },
  blsPopPrecompile: {
    envKey: 'BLS_POP_PRECOMPILE_ADDRESS',
    address: '0x0000000000000000000000000000000000B00001',
    comment: 'BLS signature verification',
  },
  nativeCoinManager: {
    envKey: 'NATIVE_COIN_MANAGER_ADDRESS',
    address: '0x0000000000000000000000000000000000B00002',
    comment: 'Native coin management',
  },
  accountManager: {
    envKey: 'ACCOUNT_MANAGER_ADDRESS',
    address: '0x0000000000000000000000000000000000B00003',
    comment: 'Account management',
  },
}

function generatePrecompileEnvSection(chainId: number): string {
  if (chainId !== 8283) return ''

  const lines: string[] = [
    '# System Contracts (Precompiled)',
  ]

  for (const entry of Object.values(PRECOMPILE_ENV)) {
    lines.push(`${entry.envKey}=${entry.address}`)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Load .env from monorepo root (DEPLOYMENT_DIR, CHAIN_ID)
  loadEnvFile()

  const args = process.argv.slice(2)

  // Defaults from .env → DEPLOYMENT_DIR (relative to monorepo root)
  const defaultDeploymentDir = process.env.DEPLOYMENT_DIR
    ? resolve(MONOREPO_ROOT, process.env.DEPLOYMENT_DIR)
    : resolve(__dirname, '../../../../poc-contract/deployments')

  // CHAIN_ID from .env → target single chain
  const defaultChainId = process.env.CHAIN_ID
    ? Number.parseInt(process.env.CHAIN_ID, 10)
    : null

  let inputPath = defaultDeploymentDir
  let specificChain = defaultChainId

  // CLI args override env vars
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = resolve(args[i + 1])
      i++
    } else if (args[i] === '--chain' && args[i + 1]) {
      specificChain = Number.parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--all') {
      specificChain = null
    }
  }

  if (specificChain) {
    console.log(`Target chain: ${specificChain} (from ${process.env.CHAIN_ID ? '.env CHAIN_ID' : '--chain'})`)
  }

  // Find deployment files
  const files = await findDeploymentFiles(inputPath)

  if (files.length === 0) {
    console.log(`No deployment files found in ${inputPath}`)
    return
  }

  console.log(`Found ${files.length} deployment file(s)`)

  // Load deployments
  const deployments: ChainDeployment[] = []

  for (const file of files) {
    const deployment = await loadDeployment(file)
    if (deployment) {
      if (specificChain === null || deployment.chainId === specificChain) {
        deployments.push(deployment)
        console.log(
          `  Chain ${deployment.chainId}: ${Object.keys(deployment.addresses).length} contracts`
        )
      }
    }
  }

  if (deployments.length === 0) {
    console.log('No deployments matched')
    return
  }

  // Sort by chain ID for consistent output
  deployments.sort((a, b) => a.chainId - b.chainId)

  // Generate TypeScript addresses file
  const tsContent = generateAddressesTs(deployments)
  const tsOutputPath = resolve(__dirname, '../src/generated/addresses.ts')
  await writeFile(tsOutputPath, tsContent, 'utf-8')
  console.log(`\nGenerated: ${tsOutputPath}`)

  // Generate .env.contracts file
  const envContent = generateEnvContracts(deployments)
  const envOutputPath = resolve(__dirname, '../../../.env.contracts')
  await writeFile(envOutputPath, envContent, 'utf-8')
  console.log(`Generated: ${envOutputPath}`)

  // Merge contract addresses into .env for docker-compose auto-loading
  mergeIntoEnv(envOutputPath)

  console.log(`\nDone! ${deployments.length} chain(s) processed.`)
}

main().catch(console.error)
