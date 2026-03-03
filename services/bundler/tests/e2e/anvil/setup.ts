import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import type { Address, PublicClient, TestClient, WalletClient } from 'viem'
import { createPublicClient, createTestClient, createWalletClient, http } from 'viem'
import { foundry } from 'viem/chains'

/**
 * Anvil fixture for E2E testing against real EntryPoint
 */
export interface AnvilFixture {
  publicClient: PublicClient
  walletClient: WalletClient
  testClient: TestClient
  entryPoint: Address
  accounts: Address[]
  rpcUrl: string
  stop: () => Promise<void>
}

/**
 * ERC-4337 EntryPoint v0.9 deployed address (deterministic CREATE2, ABI-compatible with v0.7/v0.8)
 */
export const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

/**
 * Check if Anvil tests should be skipped
 */
export function shouldSkipAnvilTests(): boolean {
  return process.env.SKIP_ANVIL_TESTS !== 'false'
}

/**
 * Find a free port
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Could not get port')))
      }
    })
    server.on('error', reject)
  })
}

/**
 * Wait for Anvil RPC to be ready
 */
async function waitForAnvil(rpcUrl: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
      })
      if (res.ok) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Anvil not ready after ${timeoutMs}ms`)
}

/**
 * Start an Anvil instance with mainnet fork via child_process.
 * Requires Foundry to be installed (~/.foundry/bin/anvil or in PATH).
 */
export async function startAnvil(): Promise<AnvilFixture> {
  const port = await getFreePort()
  const forkUrl = process.env.ANVIL_FORK_URL || 'https://eth.llamarpc.com'

  const args = ['--port', String(port), '--fork-url', forkUrl]

  if (process.env.ANVIL_FORK_BLOCK) {
    args.push('--fork-block-number', process.env.ANVIL_FORK_BLOCK)
  }

  const anvilBin = process.env.ANVIL_BIN || 'anvil'
  let proc: ChildProcess

  try {
    proc = spawn(anvilBin, args, { stdio: 'pipe' })
  } catch (_err) {
    throw new Error(
      `Failed to start Anvil. Ensure Foundry is installed: curl -L https://foundry.paradigm.xyz | bash && foundryup`
    )
  }

  // Collect stderr for error reporting
  let stderr = ''
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  // Handle early exit
  const exitPromise = new Promise<never>((_, reject) => {
    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Anvil exited with code ${code}: ${stderr}`))
      }
    })
    proc.on('error', (err) => reject(err))
  })

  const rpcUrl = `http://127.0.0.1:${port}`

  // Wait for Anvil to be ready or fail
  await Promise.race([waitForAnvil(rpcUrl), exitPromise])

  const transport = http(rpcUrl)

  const publicClient = createPublicClient({
    chain: foundry,
    transport,
  })

  const testClient = createTestClient({
    chain: foundry,
    transport,
    mode: 'anvil',
  })

  const accounts = (await testClient.getAddresses()) as Address[]

  const walletClient = createWalletClient({
    chain: foundry,
    transport,
    account: accounts[0],
  })

  return {
    publicClient,
    walletClient,
    testClient,
    entryPoint: ENTRY_POINT_ADDRESS,
    accounts,
    rpcUrl,
    stop: async () => {
      proc.kill('SIGTERM')
      // Wait briefly for graceful shutdown
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve())
        setTimeout(() => {
          proc.kill('SIGKILL')
          resolve()
        }, 2000)
      })
    },
  }
}
