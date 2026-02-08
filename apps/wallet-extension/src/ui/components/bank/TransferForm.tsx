import { useState } from 'react'
import type { LinkedBankAccount } from '../../../types'
import { Button, Card, Input, Select } from '../common'

interface TransferFormProps {
  accounts: LinkedBankAccount[]
  onTransfer: (from: string, to: string, amount: number, description?: string) => Promise<void>
  isLoading?: boolean
}

export function TransferForm({ accounts, onTransfer, isLoading = false }: TransferFormProps) {
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fromAccount || !toAccount) {
      setError('Please select both accounts')
      return
    }

    if (fromAccount === toAccount) {
      setError('Cannot transfer to the same account')
      return
    }

    const amountNum = Number.parseFloat(amount)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      await onTransfer(fromAccount, toAccount, amountNum, description || undefined)
      // Reset form on success
      setAmount('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    }
  }

  const accountOptions = accounts.map((acc) => ({
    value: acc.accountNo,
    label: `${acc.accountType === 'checking' ? 'Checking' : 'Savings'} - ****${acc.accountNo.slice(-4)}`,
  }))

  return (
    <Card padding="lg">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Transfer Funds</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="From Account"
          value={fromAccount}
          onChange={(e) => setFromAccount(e.target.value)}
          options={[{ value: '', label: 'Select account' }, ...accountOptions]}
        />

        <Select
          label="To Account"
          value={toAccount}
          onChange={(e) => setToAccount(e.target.value)}
          options={[{ value: '', label: 'Select account' }, ...accountOptions]}
        />

        <Input
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          leftElement={<span className="text-gray-500">$</span>}
          min="0.01"
          step="0.01"
        />

        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description"
        />

        {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <Button
          type="submit"
          fullWidth
          isLoading={isLoading}
          disabled={!fromAccount || !toAccount || !amount}
        >
          Transfer
        </Button>
      </form>
    </Card>
  )
}
