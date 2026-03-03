import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import type { Address } from 'viem'
import { createPublicClient, createTestClient, createWalletClient, http } from 'viem'
import { foundry } from 'viem/chains'
import type { AnvilFixture } from './setup'

/**
 * Start a standalone Anvil instance (no fork) with EIP-7702 support.
 * Uses --hardfork prague for EIP-7702 compatibility.
 */
export async function startAnvilStandalone(): Promise<AnvilFixture> {
  const port = await getFreePort()

  const args = [
    '--port',
    String(port),
    '--hardfork',
    'prague',
    '--balance',
    '10000', // 10000 ETH per account
  ]

  const anvilBin = process.env.ANVIL_BIN || 'anvil'
  let proc: ChildProcess

  try {
    proc = spawn(anvilBin, args, { stdio: 'pipe' })
  } catch {
    throw new Error(
      'Failed to start Anvil. Ensure Foundry is installed: curl -L https://foundry.paradigm.xyz | bash && foundryup'
    )
  }

  let stderr = ''
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  const exitPromise = new Promise<never>((_, reject) => {
    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Anvil exited with code ${code}: ${stderr}`))
      }
    })
    proc.on('error', (err) => reject(err))
  })

  const rpcUrl = `http://127.0.0.1:${port}`

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

  // Fetch accounts via raw JSON-RPC (getAddresses may not be available on TestClient)
  const accountsResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_accounts', params: [], id: 1 }),
  })
  const accountsJson = (await accountsResponse.json()) as { result: Address[] }
  const accounts = accountsJson.result

  const walletClient = createWalletClient({
    chain: foundry,
    transport,
    account: accounts[0],
  })

  return {
    publicClient,
    walletClient,
    testClient,
    entryPoint: '0x0000000000000000000000000000000000000000' as Address, // placeholder, actual address from deployment
    accounts,
    rpcUrl,
    stop: async () => {
      proc.kill('SIGTERM')
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
