import { useState } from 'react'
import { useWalletStore } from '../hooks/useWalletStore'
import { isAddress, parseEther } from 'viem'

export function Send() {
  const { selectedAccount, setPage, setError } = useWalletStore()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isSending, setIsSending] = useState(false)

  const isValidRecipient = recipient === '' || isAddress(recipient)
  const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)
  const canSend = isAddress(recipient) && Number(amount) > 0 && selectedAccount

  async function handleSend() {
    if (!canSend) return

    setIsSending(true)
    try {
      // Send transaction via background
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `send-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendUserOperation',
          params: [
            {
              sender: selectedAccount,
              target: recipient,
              value: parseEther(amount).toString(16),
              data: '0x',
            },
            '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint
          ],
        },
      })

      if (response?.payload?.error) {
        setError(response.payload.error.message)
      } else {
        // Success - go back to home
        setPage('home')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send transaction')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6">Send</h2>

      <div className="space-y-4">
        {/* Recipient Input */}
        <div>
          <label htmlFor="recipient-input" className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
          <input
            id="recipient-input"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              !isValidRecipient ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {!isValidRecipient && (
            <p className="text-red-500 text-xs mt-1">Invalid address</p>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor="amount-input" className="block text-sm font-medium text-gray-700 mb-1">Amount (ETH)</label>
          <input
            id="amount-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.0001"
            min="0"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              !isValidAmount ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {!isValidAmount && (
            <p className="text-red-500 text-xs mt-1">Invalid amount</p>
          )}
        </div>

        {/* Gas Estimation */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-500">
            Gas will be sponsored by the Paymaster
          </p>
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend || isSending}
          className={`w-full py-3 rounded-lg font-medium ${
            canSend && !isSending
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={() => setPage('home')}
          className="w-full py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
