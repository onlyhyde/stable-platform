'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Modal } from '@/components/common'

interface SubmitExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: ExpenseFormData) => void
}

export interface ExpenseFormData {
  description: string
  amount: string
  category: string
  documentationUrl: string
}

const INITIAL_FORM_STATE: ExpenseFormData = {
  description: '',
  amount: '',
  category: 'infrastructure',
  documentationUrl: '',
}

export function SubmitExpenseModal({ isOpen, onClose, onSubmit }: SubmitExpenseModalProps) {
  const [formData, setFormData] = useState<ExpenseFormData>(INITIAL_FORM_STATE)
  const [errors, setErrors] = useState<Partial<ExpenseFormData>>({})

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(INITIAL_FORM_STATE)
      setErrors({})
    }
  }, [isOpen])

  const handleChange =
    (field: keyof ExpenseFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
      // Clear error when field is modified
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }

  const validate = (): boolean => {
    const newErrors: Partial<ExpenseFormData> = {}

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required'
    }

    if (!formData.category) {
      newErrors.category = 'Category is required'
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
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Expense">
      <div className="space-y-4">
        <div>
          <Input
            label="Description"
            placeholder="Brief description of the expense"
            value={formData.description}
            onChange={handleChange('description')}
            aria-label="Description"
          />
          {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
        </div>
        <div>
          <Input
            label="Amount (USDC)"
            type="number"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange('amount')}
            aria-label="Amount (USDC)"
          />
          {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount}</p>}
        </div>
        <div>
          <label
            htmlFor="category-select"
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground) / 0.8)' }}
          >
            Category
          </label>
          <select
            id="category-select"
            aria-label="Category"
            className="w-full px-3 py-2 border rounded-lg"
            style={{ borderColor: 'rgb(var(--border))' }}
            value={formData.category}
            onChange={handleChange('category')}
          >
            <option value="infrastructure">Infrastructure</option>
            <option value="software">Software</option>
            <option value="travel">Travel</option>
            <option value="marketing">Marketing</option>
            <option value="other">Other</option>
          </select>
          {errors.category && <p className="text-sm text-red-500 mt-1">{errors.category}</p>}
        </div>
        <Input
          label="Receipt/Documentation URL"
          placeholder="https://..."
          value={formData.documentationUrl}
          onChange={handleChange('documentationUrl')}
          aria-label="Receipt/Documentation URL"
        />
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            Submit Expense
          </Button>
        </div>
      </div>
    </Modal>
  )
}
