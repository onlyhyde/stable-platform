import { type Hex, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Logger } from '../utils/logger'
import type { BundleSubmission, BundleSubmissionResult, IBundleSubmitter } from './submitter'

/**
 * Flashbots submitter configuration
 */
export interface FlashbotsConfig {
  /** Flashbots relay URL */
  relayUrl: string
  /** Authentication private key for signing requests (hex) */
  authKey: Hex
}

/**
 * Flashbots eth_sendBundle request payload
 */
interface FlashbotsBundleRequest {
  jsonrpc: '2.0'
  id: number
  method: 'eth_sendBundle'
  params: [
    {
      txs: Hex[]
      blockNumber: Hex
      minTimestamp?: number
      maxTimestamp?: number
    },
  ]
}

/**
 * Flashbots relay response
 */
interface FlashbotsRelayResponse {
  jsonrpc: '2.0'
  id: number
  result?: { bundleHash: Hex }
  error?: { code: number; message: string }
}

/**
 * Flashbots bundle submitter - sends bundles to Flashbots relay
 * for MEV protection. Bundles are only included by Flashbots builders,
 * preventing sandwich attacks and other MEV extraction.
 */
export class FlashbotsSubmitter implements IBundleSubmitter {
  private readonly config: FlashbotsConfig
  private readonly logger: Logger
  private readonly account: ReturnType<typeof privateKeyToAccount>
  private requestId = 0

  constructor(config: FlashbotsConfig, logger: Logger) {
    this.config = config
    this.logger = logger.child({ module: 'flashbotsSubmitter' })
    this.account = privateKeyToAccount(config.authKey)
  }

  async submit(submission: BundleSubmission): Promise<BundleSubmissionResult> {
    const targetBlock = submission.targetBlockNumber
    if (!targetBlock) {
      throw new Error('Flashbots submission requires targetBlockNumber')
    }

    const blockNumberHex = toHex(targetBlock)
    this.requestId++

    const payload: FlashbotsBundleRequest = {
      jsonrpc: '2.0',
      id: this.requestId,
      method: 'eth_sendBundle',
      params: [
        {
          txs: [submission.data],
          blockNumber: blockNumberHex,
        },
      ],
    }

    const body = JSON.stringify(payload)
    const signature = await this.signPayload(body)

    this.logger.debug(
      {
        relayUrl: this.config.relayUrl,
        targetBlock: targetBlock.toString(),
      },
      'Submitting bundle to Flashbots relay'
    )

    const response = await fetch(this.config.relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flashbots-Signature': signature,
      },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      this.logger.error({ status: response.status, body: text }, 'Flashbots relay returned error')
      throw new Error(`Flashbots relay error: ${response.status} ${text}`)
    }

    const result = (await response.json()) as FlashbotsRelayResponse

    if (result.error) {
      this.logger.error(
        { code: result.error.code, message: result.error.message },
        'Flashbots relay returned RPC error'
      )
      throw new Error(`Flashbots RPC error: ${result.error.message}`)
    }

    const bundleHash = result.result?.bundleHash ?? (keccak256(toHex(body)) as Hex)

    this.logger.info(
      { bundleHash, targetBlock: targetBlock.toString() },
      'Bundle submitted to Flashbots relay'
    )

    return { hash: bundleHash, method: 'flashbots' }
  }

  getType(): string {
    return 'flashbots'
  }

  /**
   * Sign payload with auth key for X-Flashbots-Signature header
   * Format: <address>:<signature>
   *
   * Flashbots relay requires: keccak256(body) signed via EIP-191 (eth_sign)
   * using the secp256k1 private key, returning `signerAddress:signature`
   */
  private async signPayload(body: string): Promise<string> {
    const bodyHash = keccak256(toHex(body))
    const signature = await this.account.signMessage({ message: { raw: bodyHash } })
    return `${this.account.address}:${signature}`
  }
}
