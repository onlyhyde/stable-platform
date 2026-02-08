export interface FoundryTransaction {
  readonly hash: string
  readonly contractName: string
  readonly contractAddress: string
  readonly transactionType: string
}

export interface FoundryBroadcast {
  readonly chain: number
  readonly transactions: readonly FoundryTransaction[]
}

export function parseFoundryBroadcast(content: string): FoundryBroadcast | null {
  try {
    const data = JSON.parse(content) as Record<string, unknown>

    const chain = Number(data.chain)
    if (Number.isNaN(chain) || chain <= 0) return null

    const rawTxs = data.transactions
    if (!Array.isArray(rawTxs)) return null

    const transactions: FoundryTransaction[] = rawTxs
      .filter(
        (tx: Record<string, unknown>) =>
          tx.transactionType === 'CREATE' || tx.transactionType === 'CREATE2'
      )
      .map((tx: Record<string, unknown>) => ({
        hash: String(tx.hash ?? ''),
        contractName: String(tx.contractName ?? ''),
        contractAddress: String(tx.contractAddress ?? ''),
        transactionType: String(tx.transactionType ?? ''),
      }))
      .filter((tx) => tx.contractName && tx.contractAddress)

    return { chain, transactions }
  } catch {
    return null
  }
}
