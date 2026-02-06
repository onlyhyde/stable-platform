import { useEffect, useMemo, useState } from 'react'
import { isAddress, parseEther } from 'viem'
import { useIndexerData, useNetworkCurrency, useWalletStore } from '../hooks'
import type { TokenBalance } from '../hooks/useIndexerData'

/** Asset type for native or ERC-20 token */
interface SelectedAsset {
  type: 'native' | 'erc20'
  address?: string
  symbol: string
  name: string
  decimals: number
  balance?: string
  formattedBalance?: string
}

/**
 * Parse token amount to smallest unit
 */
function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const combined = whole + paddedFraction
  return BigInt(combined)
}

/**
 * Encode ERC-20 transfer call data
 */
function encodeTransferData(to: string, amount: bigint): string {
  // transfer(address,uint256) selector: 0xa9059cbb
  const selector = '0xa9059cbb'
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0')
  const paddedAmount = amount.toString(16).padStart(64, '0')
  return selector + paddedTo + paddedAmount
}

export function Send() {
  const { selectedAccount, balances, setPage, setError } = useWalletStore()
  const { symbol: nativeSymbol, name: nativeName, decimals: nativeDecimals } = useNetworkCurrency()
  const { tokenBalances } = useIndexerData()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null)
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false)

  // Native balance
  const nativeBalance = selectedAccount ? balances[selectedAccount] : undefined

  // Build asset list (native + tokens)
  const assetList = useMemo<SelectedAsset[]>(() => {
    const native: SelectedAsset = {
      type: 'native',
      symbol: nativeSymbol,
      name: nativeName,
      decimals: nativeDecimals,
      balance: nativeBalance?.toString(),
      formattedBalance: nativeBalance ? (Number(nativeBalance) / 1e18).toFixed(4) : undefined,
    }

    const tokens: SelectedAsset[] = tokenBalances.map((t) => ({
      type: 'erc20',
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      balance: t.balance,
      formattedBalance: t.formattedBalance,
    }))

    return [native, ...tokens]
  }, [nativeSymbol, nativeName, nativeDecimals, nativeBalance, tokenBalances])

  // Initialize selected asset
  useEffect(() => {
    // Check if token was passed from Home page
    const storedToken = sessionStorage.getItem('selectedToken')
    if (storedToken) {
      try {
        const token: TokenBalance = JSON.parse(storedToken)
        setSelectedAsset({
          type: 'erc20',
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance,
          formattedBalance: token.formattedBalance,
        })
        sessionStorage.removeItem('selectedToken')
        return
      } catch {
        // Invalid stored token
      }
    }

    // Default to native asset
    if (!selectedAsset && assetList.length > 0) {
      const firstAsset = assetList[0]
      if (firstAsset) {
        setSelectedAsset(firstAsset)
      }
    }
  }, [assetList])

  const isValidRecipient = recipient === '' || isAddress(recipient)
  const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)
  const canSend = isAddress(recipient) && Number(amount) > 0 && selectedAccount && selectedAsset

  async function handleSend() {
    if (!canSend || !selectedAsset) return

    setIsSending(true)
    try {
      let txParams: {
        sender: string
        target: string
        value: string
        data: string
      }

      if (selectedAsset.type === 'native') {
        // Native transfer
        txParams = {
          sender: selectedAccount,
          target: recipient,
          value: parseEther(amount).toString(16),
          data: '0x',
        }
      } else {
        // ERC-20 transfer
        const tokenAmount = parseTokenAmount(amount, selectedAsset.decimals)
        txParams = {
          sender: selectedAccount,
          target: selectedAsset.address!, // token contract address
          value: '0x0', // no native value
          data: encodeTransferData(recipient, tokenAmount),
        }
      }

      // Send transaction via background
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `send-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendUserOperation',
          params: [
            txParams,
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

  function handleAssetSelect(asset: SelectedAsset) {
    setSelectedAsset(asset)
    setIsAssetSelectorOpen(false)
    setAmount('') // Reset amount when changing asset
  }

  function handleMaxAmount() {
    if (selectedAsset?.formattedBalance) {
      // Use slightly less than max for native to account for gas
      if (selectedAsset.type === 'native' && nativeBalance) {
        const maxWithGas = nativeBalance - BigInt(1e16) // Reserve 0.01 for gas
        if (maxWithGas > 0n) {
          setAmount((Number(maxWithGas) / 1e18).toString())
        }
      } else {
        setAmount(selectedAsset.formattedBalance)
      }
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6" style={{ color: 'rgb(var(--foreground))' }}>
        Send
      </h2>

      <div className="space-y-4">
        {/* Asset Selector */}
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Asset
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAssetSelectorOpen(!isAssetSelectorOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg input-base"
            >
              {selectedAsset ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor:
                        selectedAsset.type === 'native'
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--muted))',
                      color: selectedAsset.type === 'native' ? 'white' : 'rgb(var(--foreground))',
                    }}
                  >
                    {selectedAsset.symbol.charAt(0)}
                  </div>
                  <span style={{ color: 'rgb(var(--foreground))' }}>{selectedAsset.symbol}</span>
                  {selectedAsset.formattedBalance && (
                    <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      ({selectedAsset.formattedBalance})
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Select asset</span>
              )}
              <svg
                className={`w-4 h-4 transition-transform ${isAssetSelectorOpen ? 'rotate-180' : ''}`}
                style={{ color: 'rgb(var(--muted-foreground))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown */}
            {isAssetSelectorOpen && (
              <div
                className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto"
                style={{ backgroundColor: 'rgb(var(--card))' }}
              >
                {assetList.map((asset) => (
                  <button
                    key={asset.type === 'native' ? 'native' : asset.address}
                    type="button"
                    onClick={() => handleAssetSelect(asset)}
                    className="w-full flex items-center justify-between px-3 py-2 transition-colors hover:bg-primary/5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor:
                            asset.type === 'native' ? 'rgb(var(--primary))' : 'rgb(var(--muted))',
                          color: asset.type === 'native' ? 'white' : 'rgb(var(--foreground))',
                        }}
                      >
                        {asset.symbol.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                          {asset.symbol}
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                          {asset.name}
                        </p>
                      </div>
                    </div>
                    {asset.formattedBalance && (
                      <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {asset.formattedBalance}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recipient Input */}
        <div>
          <label
            htmlFor="recipient-input"
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Recipient
          </label>
          <input
            id="recipient-input"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 rounded-lg input-base"
            style={{
              borderColor: !isValidRecipient ? 'rgb(var(--destructive))' : undefined,
            }}
          />
          {!isValidRecipient && (
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
              Invalid address
            </p>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="amount-input"
              className="text-sm font-medium"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              Amount ({selectedAsset?.symbol || '...'})
            </label>
            {selectedAsset?.formattedBalance && (
              <button
                type="button"
                onClick={handleMaxAmount}
                className="text-xs font-medium"
                style={{ color: 'rgb(var(--primary))' }}
              >
                MAX
              </button>
            )}
          </div>
          <input
            id="amount-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.0001"
            min="0"
            className="w-full px-3 py-2 rounded-lg input-base"
            style={{
              borderColor: !isValidAmount ? 'rgb(var(--destructive))' : undefined,
            }}
          />
          {!isValidAmount && (
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
              Invalid amount
            </p>
          )}
        </div>

        {/* Gas Estimation */}
        <div className="rounded-lg p-3" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Gas will be sponsored by the Paymaster
          </p>
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend || isSending}
          className={`w-full py-3 rounded-lg font-medium ${
            canSend && !isSending ? 'btn-primary' : ''
          }`}
          style={{
            backgroundColor: !canSend || isSending ? 'rgb(var(--secondary))' : undefined,
            color: !canSend || isSending ? 'rgb(var(--muted-foreground))' : undefined,
            cursor: !canSend || isSending ? 'not-allowed' : undefined,
          }}
        >
          {isSending ? 'Sending...' : `Send ${selectedAsset?.symbol || ''}`}
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={() => setPage('home')}
          className="w-full py-3 rounded-lg font-medium btn-ghost"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
