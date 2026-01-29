import { useEffect, useState } from 'react'
import type { ApprovalRequest } from '../types'
import { ConnectApproval } from './pages/ConnectApproval'
import { SignatureApproval } from './pages/SignatureApproval'
import { TransactionApproval } from './pages/TransactionApproval'
import { Spinner } from '../ui/components/common'
import { MESSAGE_TYPES } from '../shared/constants'

export function ApprovalApp() {
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Get approval ID from URL params
    const params = new URLSearchParams(window.location.search)
    const approvalId = params.get('id')

    if (!approvalId) {
      setError('No approval ID provided')
      setLoading(false)
      return
    }

    // Fetch approval details from background
    loadApproval(approvalId)
  }, [])

  const loadApproval = async (id: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_APPROVAL',
        id: `get-approval-${Date.now()}`,
        payload: { approvalId: id },
      })

      if (response?.payload?.approval) {
        setApproval(response.payload.approval)
      } else {
        setError('Approval not found or expired')
      }
    } catch (err) {
      setError('Failed to load approval')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (data?: unknown) => {
    if (!approval) return

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.APPROVAL_RESPONSE,
        id: `approve-${Date.now()}`,
        payload: {
          approvalId: approval.id,
          approved: true,
          data,
        },
      })

      // Close window
      window.close()
    } catch (err) {
      setError('Failed to approve request')
    }
  }

  const handleReject = async () => {
    if (!approval) return

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.APPROVAL_RESPONSE,
        id: `reject-${Date.now()}`,
        payload: {
          approvalId: approval.id,
          approved: false,
        },
      })

      // Close window
      window.close()
    } catch (err) {
      setError('Failed to reject request')
    }
  }

  if (loading) {
    return (
      <div
        className="w-full h-screen flex items-center justify-center"
        style={{ backgroundColor: 'rgb(var(--background))' }}
      >
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="w-full h-screen flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: 'rgb(var(--background))' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'rgb(var(--destructive) / 0.1)' }}
        >
          <svg
            className="w-6 h-6"
            style={{ color: 'rgb(var(--destructive))' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p
          className="font-medium mb-2"
          style={{ color: 'rgb(var(--foreground))' }}
        >
          Error
        </p>
        <p
          className="text-sm text-center"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          {error}
        </p>
        <button
          type="button"
          onClick={() => window.close()}
          className="mt-4 px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: 'rgb(var(--surface))',
            color: 'rgb(var(--foreground-secondary))',
          }}
        >
          Close
        </button>
      </div>
    )
  }

  if (!approval) {
    return null
  }

  // Render appropriate approval page based on type
  switch (approval.type) {
    case 'connect':
      return (
        <ConnectApproval
          approval={approval}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )

    case 'signature':
      return (
        <SignatureApproval
          approval={approval}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )

    case 'transaction':
      return (
        <TransactionApproval
          approval={approval}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )

    default:
      return (
        <div
          className="w-full h-screen flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--background))' }}
        >
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>Unknown approval type</p>
        </div>
      )
  }
}
