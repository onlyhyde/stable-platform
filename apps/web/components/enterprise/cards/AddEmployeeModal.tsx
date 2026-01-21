'use client'

import { Modal, Button, Input } from '@/components/common'

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

export function AddEmployeeModal({ isOpen, onClose, onSubmit }: AddEmployeeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Employee"
    >
      <div className="space-y-4">
        <Input
          label="Wallet Address"
          placeholder="0x..."
        />
        <Input
          label="Payment Amount (USDC)"
          type="number"
          placeholder="0.00"
        />
        <div>
          <label htmlFor="frequency-select" className="block text-sm font-medium text-gray-700 mb-1">
            Payment Frequency
          </label>
          <select
            id="frequency-select"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onSubmit?.({
            walletAddress: '',
            amount: '',
            frequency: '',
          })}>
            Add Employee
          </Button>
        </div>
      </div>
    </Modal>
  )
}
