import { useEffect, useState } from 'react'
import type {
  CryptoCurrency,
  FiatCurrency,
  LinkedBankAccount,
  OnRampOrder,
  OnRampQuote,
  PaymentMethod,
} from '../../types'
import { Button, Card, Input, Modal, Select, Spinner } from '../components/common'
import { OrderCard, PaymentMethodSelector, QuoteCard } from '../components/onramp'
import { useWalletStore } from '../hooks/useWalletStore'

type ViewType = 'buy' | 'orders'

interface BuyPageProps {
  onBack?: () => void
}

export function BuyPage({ onBack }: BuyPageProps) {
  const { selectedAccount } = useWalletStore()
  const [activeView, setActiveView] = useState<ViewType>('buy')

  // Buy form state
  const [fiatAmount, setFiatAmount] = useState('')
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>('USD')
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>('ETH')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [selectedBankAccount, setSelectedBankAccount] = useState('')

  // Quote state
  const [quote, setQuote] = useState<OnRampQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  // Order state
  const [orders, setOrders] = useState<OnRampOrder[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)

  // Bank accounts for payment
  const [linkedBankAccounts, setLinkedBankAccounts] = useState<LinkedBankAccount[]>([])

  // Payment instructions modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<OnRampOrder | null>(null)

  useEffect(() => {
    loadBankAccounts()
    loadOrders()
  }, [])

  // Quote expiration timer
  useEffect(() => {
    if (!quote) return
    const expiresAt = new Date(quote.expiresAt).getTime()
    const checkExpiration = setInterval(() => {
      if (Date.now() > expiresAt) {
        setQuote(null)
        clearInterval(checkExpiration)
      }
    }, 1000)
    return () => clearInterval(checkExpiration)
  }, [quote])

  async function loadBankAccounts() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LINKED_BANK_ACCOUNTS',
      })
      if (response?.accounts) {
        setLinkedBankAccounts(response.accounts)
      }
    } catch {
      // Silent fail for optional feature
    }
  }

  async function loadOrders() {
    setIsLoadingOrders(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ONRAMP_ORDERS',
      })
      if (response?.orders) {
        setOrders(response.orders)
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingOrders(false)
    }
  }

  async function handleGetQuote() {
    if (!fiatAmount || Number.parseFloat(fiatAmount) <= 0) {
      setQuoteError('Please enter a valid amount')
      return
    }

    setIsLoadingQuote(true)
    setQuoteError('')
    setQuote(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ONRAMP_QUOTE',
        payload: {
          fiatCurrency,
          cryptoCurrency,
          fiatAmount: Number.parseFloat(fiatAmount),
        },
      })

      if (response?.quote) {
        setQuote(response.quote)
      } else if (response?.error) {
        setQuoteError(response.error)
      }
    } catch {
      setQuoteError('Failed to get quote')
    } finally {
      setIsLoadingQuote(false)
    }
  }

  async function handleCreateOrder() {
    if (!quote || !paymentMethod || !selectedAccount) {
      return
    }

    setIsCreatingOrder(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_ONRAMP_ORDER',
        payload: {
          quoteId: quote.id,
          fiatCurrency,
          cryptoCurrency,
          fiatAmount: Number.parseFloat(fiatAmount),
          paymentMethod,
          recipientAddress: selectedAccount,
          bankAccountNo: paymentMethod === 'bank_transfer' ? selectedBankAccount : undefined,
        },
      })

      if (response?.order) {
        setPendingOrder(response.order)
        setShowPaymentModal(true)
        setQuote(null)
        setFiatAmount('')
        setPaymentMethod('')
        await loadOrders()
      } else if (response?.error) {
        setQuoteError(response.error)
      }
    } catch {
      setQuoteError('Failed to create order')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  async function handleCancelOrder(orderId: string) {
    try {
      await chrome.runtime.sendMessage({
        type: 'CANCEL_ONRAMP_ORDER',
        payload: { orderId },
      })
      await loadOrders()
    } catch {
      // Handle error
    }
  }

  const fiatCurrencyOptions: { value: FiatCurrency; label: string }[] = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'KRW', label: 'KRW - Korean Won' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
  ]

  const cryptoCurrencyOptions: { value: CryptoCurrency; label: string }[] = [
    { value: 'ETH', label: 'ETH - Ethereum' },
    { value: 'USDC', label: 'USDC - USD Coin' },
    { value: 'USDT', label: 'USDT - Tether' },
    { value: 'DAI', label: 'DAI - Dai' },
  ]

  return (
    <div className="min-h-full" style={{ backgroundColor: 'rgb(var(--background))' }}>
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderBottom: '1px solid rgb(var(--border))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              Buy Crypto
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          <button
            type="button"
            onClick={() => setActiveView('buy')}
            className="pb-2 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeView === 'buy' ? 'rgb(var(--primary))' : 'transparent',
              color: activeView === 'buy' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            }}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setActiveView('orders')}
            className="pb-2 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeView === 'orders' ? 'rgb(var(--primary))' : 'transparent',
              color:
                activeView === 'orders' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            }}
          >
            Orders
            {orders.filter((o) => o.status === 'pending' || o.status === 'processing').length >
              0 && (
              <span
                className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'rgb(var(--primary) / 0.1)',
                  color: 'rgb(var(--primary))',
                }}
              >
                {orders.filter((o) => o.status === 'pending' || o.status === 'processing').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeView === 'buy' ? (
          <div className="space-y-4">
            {/* Amount Input */}
            <Card padding="lg">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label="You Pay"
                      type="number"
                      value={fiatAmount}
                      onChange={(e) => {
                        setFiatAmount(e.target.value)
                        setQuote(null)
                      }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="w-32">
                    <Select
                      label="Currency"
                      value={fiatCurrency}
                      onChange={(e) => {
                        setFiatCurrency(e.target.value as FiatCurrency)
                        setQuote(null)
                      }}
                      options={fiatCurrencyOptions}
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </div>

                <Select
                  label="You Receive"
                  value={cryptoCurrency}
                  onChange={(e) => {
                    setCryptoCurrency(e.target.value as CryptoCurrency)
                    setQuote(null)
                  }}
                  options={cryptoCurrencyOptions}
                />

                <Button
                  onClick={handleGetQuote}
                  fullWidth
                  isLoading={isLoadingQuote}
                  disabled={!fiatAmount || Number.parseFloat(fiatAmount) <= 0}
                >
                  Get Quote
                </Button>
              </div>
            </Card>

            {quoteError && (
              <div
                className="p-3 text-sm rounded-lg"
                style={{
                  backgroundColor: 'rgb(var(--destructive) / 0.1)',
                  color: 'rgb(var(--destructive))',
                }}
              >
                {quoteError}
              </div>
            )}

            {/* Quote Display */}
            {quote && <QuoteCard quote={quote} />}

            {/* Payment Method */}
            {quote && (
              <Card padding="lg">
                <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

                {paymentMethod === 'bank_transfer' && linkedBankAccounts.length > 0 && (
                  <div className="mt-4">
                    <Select
                      label="Select Bank Account"
                      value={selectedBankAccount}
                      onChange={(e) => setSelectedBankAccount(e.target.value)}
                      options={[
                        { value: '', label: 'Select account' },
                        ...linkedBankAccounts.map((acc) => ({
                          value: acc.accountNo,
                          label: `${acc.accountType === 'checking' ? 'Checking' : 'Savings'} - ****${acc.accountNo.slice(-4)}`,
                        })),
                      ]}
                    />
                  </div>
                )}

                <Button
                  onClick={handleCreateOrder}
                  fullWidth
                  className="mt-4"
                  isLoading={isCreatingOrder}
                  disabled={
                    !paymentMethod ||
                    (paymentMethod === 'bank_transfer' &&
                      linkedBankAccounts.length > 0 &&
                      !selectedBankAccount)
                  }
                >
                  Continue to Payment
                </Button>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingOrders ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : orders.length === 0 ? (
              <Card padding="lg" className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-3">No orders yet</p>
                <Button size="sm" onClick={() => setActiveView('buy')}>
                  Buy Crypto
                </Button>
              </Card>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onCancel={() => handleCancelOrder(order.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Payment Instructions Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setPendingOrder(null)
        }}
        title="Payment Instructions"
        size="md"
      >
        {pendingOrder && (
          <div className="space-y-4">
            <Card padding="md" variant="filled" className="bg-amber-50">
              <p className="text-sm text-amber-800">
                Please complete your payment within 30 minutes to secure this rate.
              </p>
            </Card>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount to Pay</span>
                <span className="font-medium text-gray-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: pendingOrder.fiatCurrency,
                  }).format(pendingOrder.totalFiatAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Reference</span>
                <span className="font-mono text-gray-900">{pendingOrder.id.slice(0, 12)}</span>
              </div>
            </div>

            {pendingOrder.paymentMethod === 'bank_transfer' && (
              <Card padding="md">
                <p className="text-xs text-gray-500 mb-2">Transfer to</p>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-900">Bank: StableNet Bank</p>
                  <p className="text-gray-900">Account: 1234567890</p>
                  <p className="text-gray-900">Routing: 021000021</p>
                </div>
              </Card>
            )}

            <Button
              onClick={() => {
                setShowPaymentModal(false)
                setPendingOrder(null)
              }}
              fullWidth
            >
              I've Completed Payment
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
