import { useCallback, useEffect, useState } from 'react'
import type { ApprovalRequest } from '../../types'

interface UseApprovalResult {
  pendingApprovals: ApprovalRequest[]
  currentApproval: ApprovalRequest | null
  isLoading: boolean
  approve: <T = unknown>(id: string, data?: T) => Promise<boolean>
  reject: (id: string, reason?: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useApproval(): UseApprovalResult {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PENDING_APPROVALS',
      })
      if (response?.approvals) {
        setPendingApprovals(response.approvals)
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Listen for approval updates
    const handleMessage = (message: {
      type: string
      payload?: { approval?: ApprovalRequest; id?: string }
    }) => {
      if (message.type === 'APPROVAL_ADDED' && message.payload?.approval) {
        setPendingApprovals((prev) => [...prev, message.payload!.approval!])
      } else if (message.type === 'APPROVAL_RESOLVED' && message.payload?.id) {
        setPendingApprovals((prev) => prev.filter((a) => a.id !== message.payload!.id))
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [refresh])

  const approve = useCallback(async <T = unknown>(id: string, data?: T): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'APPROVAL_RESPONSE',
        payload: { id, approved: true, data },
      })
      if (response?.success) {
        setPendingApprovals((prev) => prev.filter((a) => a.id !== id))
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const reject = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'APPROVAL_RESPONSE',
        payload: { id, approved: false, reason },
      })
      if (response?.success) {
        setPendingApprovals((prev) => prev.filter((a) => a.id !== id))
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const currentApproval = pendingApprovals[0] ?? null

  return {
    pendingApprovals,
    currentApproval,
    isLoading,
    approve,
    reject,
    refresh,
  }
}
