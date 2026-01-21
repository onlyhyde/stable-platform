'use client'

import { Modal, Button, Input } from '@/components/common'

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

export function SubmitExpenseModal({ isOpen, onClose, onSubmit }: SubmitExpenseModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Expense"
    >
      <div className="space-y-4">
        <Input
          label="Description"
          placeholder="Brief description of the expense"
        />
        <Input
          label="Amount (USDC)"
          type="number"
          placeholder="0.00"
        />
        <div>
          <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category-select"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          >
            <option value="infrastructure">Infrastructure</option>
            <option value="software">Software</option>
            <option value="travel">Travel</option>
            <option value="marketing">Marketing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Input
          label="Receipt/Documentation URL"
          placeholder="https://..."
        />
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onSubmit?.({
            description: '',
            amount: '',
            category: '',
            documentationUrl: '',
          })}>
            Submit Expense
          </Button>
        </div>
      </div>
    </Modal>
  )
}
