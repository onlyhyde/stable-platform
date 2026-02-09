import type { Address, Hex } from 'viem'

/**
 * Bundle submission parameters
 */
export interface BundleSubmission {
  /** Encoded transaction data (handleOps/handleAggregatedOps calldata) */
  data: Hex
  /** EntryPoint contract address */
  to: Address
  /** Gas limit for the bundle transaction */
  gasLimit: bigint
  /** Target block number (for Flashbots) */
  targetBlockNumber?: bigint
}

/**
 * Result of bundle submission
 */
export interface BundleSubmissionResult {
  /** Transaction hash (for direct) or bundle hash (for Flashbots) */
  hash: Hex
  /** Submission method used */
  method: string
}

/**
 * Interface for bundle submission strategies
 * Enables switching between direct submission and MEV-protected submission
 */
export interface IBundleSubmitter {
  /** Submit a bundle and return the result */
  submit(submission: BundleSubmission): Promise<BundleSubmissionResult>
  /** Get the type identifier for this submitter */
  getType(): string
}
