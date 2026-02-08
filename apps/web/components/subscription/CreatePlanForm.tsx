'use client'

import { type FC, useState } from 'react'
import { type Address, parseUnits } from 'viem'
import type { CreatePlanParams, IntervalPreset } from '../../types/subscription'
import { INTERVAL_PRESETS } from '../../types/subscription'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Input } from '../common/Input'

interface CreatePlanFormProps {
  onSubmit: (params: CreatePlanParams) => Promise<void>
  isLoading?: boolean
  className?: string
}

const TOKENS = [
  { address: '0x0000000000000000000000000000000000000000' as Address, symbol: 'ETH', decimals: 18 },
  { address: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44' as Address, symbol: 'USDC', decimals: 6 },
]

export const CreatePlanForm: FC<CreatePlanFormProps> = ({
  onSubmit,
  isLoading = false,
  className,
}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [interval, setInterval] = useState<IntervalPreset>('monthly')
  const [tokenIndex, setTokenIndex] = useState(0)
  const [trialDays, setTrialDays] = useState('')
  const [graceDays, setGraceDays] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedToken = TOKENS[tokenIndex]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Plan name is required')
      return
    }

    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
      setError('Valid price is required')
      return
    }

    try {
      const params: CreatePlanParams = {
        name: name.trim(),
        description: description.trim(),
        price: parseUnits(price, selectedToken.decimals),
        interval: INTERVAL_PRESETS[interval],
        token: selectedToken.address,
        trialPeriod: trialDays ? BigInt(Number(trialDays) * 86400) : 0n,
        gracePeriod: graceDays ? BigInt(Number(graceDays) * 86400) : 0n,
      }

      await onSubmit(params)

      // Reset form on success
      setName('')
      setDescription('')
      setPrice('')
      setInterval('monthly')
      setTrialDays('')
      setGraceDays('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan')
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create Subscription Plan</CardTitle>
        <CardDescription>
          Set up a new recurring subscription plan for your customers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <Input
              label="Plan Name"
              placeholder="e.g., Premium Monthly"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div>
              <span
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground) / 0.8)' }}
              >
                Description
              </span>
              <textarea
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none resize-none"
                style={{
                  borderColor: 'rgb(var(--border))',
                  backgroundColor: 'rgb(var(--background))',
                }}
                rows={3}
                placeholder="Describe what subscribers get..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Pricing
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'rgb(var(--foreground) / 0.8)' }}
                >
                  Price
                </span>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full px-3 py-2 pr-16 border rounded-lg focus:ring-2 focus:outline-none"
                    style={{
                      borderColor: 'rgb(var(--border))',
                      backgroundColor: 'rgb(var(--background))',
                    }}
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                  <select
                    className="absolute right-0 top-0 h-full px-2 border-l rounded-r-lg focus:outline-none"
                    style={{
                      borderColor: 'rgb(var(--border))',
                      backgroundColor: 'rgb(var(--secondary))',
                    }}
                    value={tokenIndex}
                    onChange={(e) => setTokenIndex(Number(e.target.value))}
                  >
                    {TOKENS.map((token, index) => (
                      <option key={token.address} value={index}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'rgb(var(--foreground) / 0.8)' }}
                >
                  Billing Interval
                </span>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{
                    borderColor: 'rgb(var(--border))',
                    backgroundColor: 'rgb(var(--background))',
                  }}
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as IntervalPreset)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Trial & Grace Period */}
          <div className="space-y-4">
            <h3 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Trial & Grace Period (Optional)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Free Trial (days)"
                type="number"
                min="0"
                placeholder="0"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                hint="Days before first payment"
              />

              <Input
                label="Grace Period (days)"
                type="number"
                min="0"
                placeholder="0"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                hint="Days after failed payment"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <h4
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Preview
            </h4>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {name || 'Plan Name'}
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {description || 'Plan description'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {price || '0'} {selectedToken.symbol}
                </p>
                <p className="text-sm capitalize" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {interval}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div
              className="border rounded-lg p-3 text-sm"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                borderColor: 'rgb(var(--destructive) / 0.3)',
                color: 'rgb(var(--destructive))',
              }}
            >
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Create Plan
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default CreatePlanForm
