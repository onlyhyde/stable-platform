import type { WalletClient } from 'viem'
import type { Logger } from '../utils/logger'
import type { BundleSubmission, BundleSubmissionResult, IBundleSubmitter } from './submitter'

/**
 * Direct bundle submitter - sends transactions directly to the public mempool
 * This is the default submission strategy.
 */
export class DirectSubmitter implements IBundleSubmitter {
  private readonly walletClient: WalletClient
  private readonly logger: Logger

  constructor(walletClient: WalletClient, logger: Logger) {
    this.walletClient = walletClient
    this.logger = logger.child({ module: 'directSubmitter' })
  }

  async submit(submission: BundleSubmission): Promise<BundleSubmissionResult> {
    this.logger.debug(
      { to: submission.to, gasLimit: submission.gasLimit.toString() },
      'Submitting bundle directly'
    )

    const hash = await this.walletClient.sendTransaction({
      account: this.walletClient.account!,
      chain: this.walletClient.chain,
      to: submission.to,
      data: submission.data,
      gas: submission.gasLimit,
    })

    this.logger.info({ hash }, 'Bundle submitted via direct submission')

    return { hash, method: 'direct' }
  }

  getType(): string {
    return 'direct'
  }
}
