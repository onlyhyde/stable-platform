'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Address } from 'viem'
import { formatEther, formatUnits, parseUnits } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from '@/components/common'
import { useWallet } from '@/hooks'
import { useLending } from '@/hooks/useLending'
import type { LendingMarket, LendingPosition } from '@/types/defi'

type ActionMode = null | 'supply' | 'withdraw' | 'borrow' | 'repay'

const WAD = 1000000000000000000n

export default function LendingPage() {
  const { isConnected } = useWallet()
  const { addToast } = useToast()
  const {
    markets,
    positions,
    accountConfig,
    healthFactor,
    healthFactorInfo,
    isLoading,
    isExecuting,
    error,
    executorInstalled,
    supply,
    withdraw,
    borrow,
    repay,
    refetch,
  } = useLending()

  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [selectedAsset, setSelectedAsset] = useState<LendingMarket | null>(null)
  const [amount, setAmount] = useState('')

  const openAction = (mode: ActionMode, market: LendingMarket) => {
    setActionMode(mode)
    setSelectedAsset(market)
    setAmount('')
  }

  const closeAction = () => {
    setActionMode(null)
    setSelectedAsset(null)
    setAmount('')
  }

  const handleAction = async () => {
    if (!selectedAsset || !amount || !actionMode) return
    const parsedAmount = parseUnits(amount, selectedAsset.asset.decimals)

    let result: `0x${string}` | null = null
    switch (actionMode) {
      case 'supply':
        result = await supply(selectedAsset.asset.address, parsedAmount)
        break
      case 'withdraw':
        result = await withdraw(selectedAsset.asset.address, parsedAmount)
        break
      case 'borrow':
        result = await borrow(selectedAsset.asset.address, parsedAmount)
        break
      case 'repay':
        result = await repay(selectedAsset.asset.address, parsedAmount)
        break
    }

    if (result) {
      const labels: Record<string, string> = {
        supply: 'Supply',
        withdraw: 'Withdrawal',
        borrow: 'Borrow',
        repay: 'Repayment',
      }
      addToast({
        type: 'success',
        title: `${labels[actionMode]} Submitted`,
        message: `${amount} ${selectedAsset.asset.symbol} ${actionMode} initiated`,
      })
      closeAction()
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to access lending
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/defi"
              className="text-sm transition-colors"
              style={{ color: 'rgb(var(--primary))' }}
            >
              DeFi
            </Link>
            <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>/</span>
            <span className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>Lending</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            Lending
          </h1>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>
            Supply assets to earn interest or borrow against collateral
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'rgb(var(--primary))' }}
        >
          Refresh
        </button>
      </div>

      {/* Module Not Installed Banner */}
      {!executorInstalled && !isLoading && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--warning) / 0.1)',
            borderColor: 'rgb(var(--warning) / 0.3)',
          }}
        >
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Lending Executor Not Installed
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Install the Lending Executor module on your Smart Account to use lending features.{' '}
            <Link href="/marketplace" className="underline" style={{ color: 'rgb(var(--primary))' }}>
              Go to Marketplace
            </Link>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderColor: 'rgb(var(--destructive) / 0.3)',
          }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>{error}</p>
        </div>
      )}

      {/* Health Factor */}
      {executorInstalled && (
        <HealthFactorCard healthFactor={healthFactor} healthFactorInfo={healthFactorInfo} />
      )}

      {/* Account Summary */}
      {accountConfig && executorInstalled && (
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Borrow Limit
                </p>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatEther(accountConfig.maxBorrowLimit)} KRC
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Total Borrowed
                </p>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatEther(accountConfig.totalBorrowed)} KRC
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Min Health Factor
                </p>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {accountConfig.minHealthFactor > 0n
                    ? `${(Number(accountConfig.minHealthFactor) / 1e18).toFixed(2)}x`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Positions */}
      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {positions.filter((p) => p.suppliedAmount > 0n).length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Supplied
                </p>
                {positions
                  .filter((p) => p.suppliedAmount > 0n)
                  .map((position) => (
                    <div
                      key={`supply-${position.asset.address}`}
                      className="flex items-center justify-between p-3 rounded-lg border mb-2"
                      style={{ borderColor: 'rgb(var(--border))' }}
                    >
                      <div>
                        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                          {formatUnits(position.suppliedAmount, position.asset.decimals)}{' '}
                          {position.asset.symbol}
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(var(--primary))' }}>
                          APY {position.supplyAPY}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openAction(
                            'withdraw',
                            markets.find((m) => m.asset.address === position.asset.address)!
                          )
                        }
                        className="text-xs px-3 py-1 rounded-md border transition-colors"
                        style={{
                          borderColor: 'rgb(var(--border))',
                          color: 'rgb(var(--muted-foreground))',
                        }}
                      >
                        Withdraw
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {positions.filter((p) => p.borrowedAmount > 0n).length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Borrowed
                </p>
                {positions
                  .filter((p) => p.borrowedAmount > 0n)
                  .map((position) => (
                    <div
                      key={`borrow-${position.asset.address}`}
                      className="flex items-center justify-between p-3 rounded-lg border mb-2"
                      style={{ borderColor: 'rgb(var(--border))' }}
                    >
                      <div>
                        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                          {formatUnits(position.borrowedAmount, position.asset.decimals)}{' '}
                          {position.asset.symbol}
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                          APY {position.borrowAPY}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openAction(
                            'repay',
                            markets.find((m) => m.asset.address === position.asset.address)!
                          )
                        }
                        className="text-xs px-3 py-1 rounded-md border transition-colors"
                        style={{
                          borderColor: 'rgb(var(--border))',
                          color: 'rgb(var(--muted-foreground))',
                        }}
                      >
                        Repay
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Form */}
      {actionMode && selectedAsset && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="capitalize">
                {actionMode} {selectedAsset.asset.symbol}
              </CardTitle>
              <button
                type="button"
                onClick={closeAction}
                className="text-sm"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Cancel
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Amount"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            {(actionMode === 'supply' || actionMode === 'borrow') && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {actionMode === 'supply' ? 'Supply APY' : 'Borrow APY'}
                  </p>
                  <p
                    className="font-semibold"
                    style={{
                      color:
                        actionMode === 'supply'
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--destructive))',
                    }}
                  >
                    {actionMode === 'supply'
                      ? selectedAsset.supplyAPY
                      : selectedAsset.borrowAPY}
                    %
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Available Liquidity
                  </p>
                  <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                    {formatUnits(selectedAsset.availableLiquidity, selectedAsset.asset.decimals)}{' '}
                    {selectedAsset.asset.symbol}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleAction}
              isLoading={isExecuting}
              disabled={!amount || Number(amount) <= 0 || !executorInstalled}
              className="w-full capitalize"
            >
              {executorInstalled ? actionMode : 'Install Lending Module First'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Available Markets */}
      <Card>
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p
              className="text-center py-8 text-sm"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              Loading markets...
            </p>
          ) : (
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-2 px-3 py-2 text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
                <span>Asset</span>
                <span className="text-right">Supply APY</span>
                <span className="text-right">Borrow APY</span>
                <span className="text-right">Utilization</span>
                <span className="text-right">Actions</span>
              </div>

              {markets.map((market) => (
                <MarketRow
                  key={market.asset.address}
                  market={market}
                  executorInstalled={executorInstalled}
                  onSupply={() => openAction('supply', market)}
                  onBorrow={() => openAction('borrow', market)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function HealthFactorCard({
  healthFactor,
  healthFactorInfo,
}: {
  healthFactor: bigint | null
  healthFactorInfo: { value: bigint; isEnabled: boolean; isInitialized: boolean } | null
}) {
  if (!healthFactorInfo?.isInitialized && healthFactor === null) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                Health Factor
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                No active positions
              </p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgb(var(--muted-foreground))' }}>
              --
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hfNum = healthFactor !== null ? Number(healthFactor) / 1e18 : null
  const isMax = healthFactor !== null && healthFactor > 100n * WAD
  const displayHf = isMax ? '>100' : hfNum !== null ? hfNum.toFixed(2) : '--'

  // Color based on health factor
  let hfColor = 'rgb(var(--primary))' // green/safe
  let hfLabel = 'Safe'
  if (hfNum !== null && !isMax) {
    if (hfNum < 1) {
      hfColor = 'rgb(var(--destructive))'
      hfLabel = 'Liquidatable'
    } else if (hfNum < 1.2) {
      hfColor = 'rgb(var(--destructive))'
      hfLabel = 'At Risk'
    } else if (hfNum < 1.5) {
      hfColor = 'rgb(234 179 8)' // yellow
      hfLabel = 'Caution'
    }
  }

  // Progress bar width (cap at 100%)
  const barWidth = hfNum !== null && !isMax ? Math.min((hfNum / 3) * 100, 100) : 100

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Health Factor
            </p>
            <p className="text-xs" style={{ color: hfColor }}>
              {hfLabel}
            </p>
          </div>
          <p className="text-2xl font-bold" style={{ color: hfColor }}>
            {displayHf}x
          </p>
        </div>

        {/* Progress Bar */}
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barWidth}%`,
              backgroundColor: hfColor,
            }}
          />
        </div>

        <div className="flex justify-between mt-1 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          <span>0</span>
          <span>1.0 (Liquidation)</span>
          <span>1.5</span>
          <span>3.0+</span>
        </div>
      </CardContent>
    </Card>
  )
}

function MarketRow({
  market,
  executorInstalled,
  onSupply,
  onBorrow,
}: {
  market: LendingMarket
  executorInstalled: boolean
  onSupply: () => void
  onBorrow: () => void
}) {
  return (
    <div
      className="grid grid-cols-5 gap-2 items-center px-3 py-3 rounded-lg border"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <div>
        <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
          {market.asset.symbol}
        </p>
        <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {market.asset.name}
        </p>
      </div>

      <p className="text-right text-sm font-medium" style={{ color: 'rgb(var(--primary))' }}>
        {market.supplyAPY}%
      </p>

      <p className="text-right text-sm font-medium" style={{ color: 'rgb(var(--destructive))' }}>
        {market.borrowAPY}%
      </p>

      <div className="text-right">
        <p className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>
          {market.utilizationRate}%
        </p>
        <div
          className="h-1 rounded-full mt-1 overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${market.utilizationRate}%`,
              backgroundColor:
                market.utilizationRate > 80
                  ? 'rgb(var(--destructive))'
                  : 'rgb(var(--primary))',
            }}
          />
        </div>
      </div>

      <div className="flex gap-1 justify-end">
        <button
          type="button"
          onClick={onSupply}
          disabled={!executorInstalled}
          className="text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50"
          style={{
            borderColor: 'rgb(var(--primary))',
            color: 'rgb(var(--primary))',
          }}
        >
          Supply
        </button>
        <button
          type="button"
          onClick={onBorrow}
          disabled={!executorInstalled}
          className="text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50"
          style={{
            borderColor: 'rgb(var(--border))',
            color: 'rgb(var(--muted-foreground))',
          }}
        >
          Borrow
        </button>
      </div>
    </div>
  )
}
