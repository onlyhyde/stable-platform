'use client'

import { type FC, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../common/Card'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import type { CreatePlanParams, IntervalPreset } from '../../types/subscription'
import { INTERVAL_PRESETS } from '../../types/subscription'
import { parseUnits, type Address } from 'viem'
import { cn } from '../../lib/utils'

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
        <CardDescription>Set up a new recurring subscription plan for your customers</CardDescription>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={3}
                placeholder="Describe what subscribers get..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Pricing</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                  <select
                    className="absolute right-0 top-0 h-full px-2 border-l border-gray-300 bg-gray-50 rounded-r-lg focus:outline-none"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Interval
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
            <h3 className="font-medium text-gray-900">Trial & Grace Period (Optional)</h3>

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
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-900">{name || 'Plan Name'}</p>
                <p className="text-sm text-gray-500">{description || 'Plan description'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {price || '0'} {selectedToken.symbol}
                </p>
                <p className="text-sm text-gray-500 capitalize">{interval}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
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
