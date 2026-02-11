'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Modal } from '@/components/common'

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: EmployeeFormData) => void
}

export interface EmployeeFormData {
  walletAddress: string
  amount: string
  frequency: string
}

const INITIAL_FORM_STATE: EmployeeFormData = {
  walletAddress: '',
  amount: '',
  frequency: 'weekly',
}

// Simple Ethereum address validation
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function AddEmployeeModal({ isOpen, onClose, onSubmit }: AddEmployeeModalProps) {
  const [formData, setFormData] = useState<EmployeeFormData>(INITIAL_FORM_STATE)
  const [errors, setErrors] = useState<Partial<EmployeeFormData>>({})

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(INITIAL_FORM_STATE)
      setErrors({})
    }
  }, [isOpen])

  const handleChange =
    (field: keyof EmployeeFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
      // Clear error when field is modified
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }

  const validate = (): boolean => {
    const newErrors: Partial<EmployeeFormData> = {}

    if (!formData.walletAddress) {
      newErrors.walletAddress = 'Wallet address is required'
    } else if (!isValidAddress(formData.walletAddress)) {
      newErrors.walletAddress = 'Invalid Ethereum address'
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required'
    }

    if (!formData.frequency) {
      newErrors.frequency = 'Frequency is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      onSubmit?.(formData)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Employee">
      <div className="space-y-4">
        <div>
          <Input
            label="Wallet Address"
            placeholder="0x..."
            value={formData.walletAddress}
            onChange={handleChange('walletAddress')}
            aria-label="Wallet Address"
          />
          {errors.walletAddress && (
            <p className="text-sm text-red-500 mt-1">{errors.walletAddress}</p>
          )}
        </div>
        <div>
          <Input
            label="Payment Amount (USDC)"
            type="number"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange('amount')}
            aria-label="Payment Amount (USDC)"
          />
          {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount}</p>}
        </div>
        <div>
          <label
            htmlFor="frequency-select"
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground) / 0.8)' }}
          >
            Payment Frequency
          </label>
          <select
            id="frequency-select"
            aria-label="Payment Frequency"
            className="w-full px-3 py-2 border rounded-lg"
            style={{ borderColor: 'rgb(var(--border))' }}
            value={formData.frequency}
            onChange={handleChange('frequency')}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          {errors.frequency && <p className="text-sm text-red-500 mt-1">{errors.frequency}</p>}
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            Add Employee
          </Button>
        </div>
      </div>
    </Modal>
  )
}
