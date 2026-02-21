'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from '@/components/common'
import { useWallet } from '@/hooks'
import { useOnRamp } from '@/hooks/useOnRamp'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import type {
  CryptoCurrency,
  FiatCurrency,
  KycStatus,
  OnRampOrder,
  OnRampQuote,
  PaymentMethod,
} from '@/types/onramp'

type Tab = 'buy' | 'orders'

const FIAT_OPTIONS: FiatCurrency[] = ['USD', 'EUR', 'KRW']
const CRYPTO_OPTIONS: CryptoCurrency[] = ['ETH', 'USDC', 'USDT']
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'wire', label: 'Wire Transfer' },
]

export default function BuyPage() {
  const { address, isConnected } = useWallet()
  const { addToast } = useToast()
  const {
    quote,
    orders,
    kycStatus,
    isLoadingQuote,
    isLoadingOrders,
    isCreatingOrder,
    error,
    getQuote,
    createOrder,
    cancelOrder,
    refreshOrders,
    checkKycStatus,
    clearQuote,
  } = useOnRamp()
  const { accounts } = useBankAccounts()

  const [activeTab, setActiveTab] = useState<Tab>('buy')
  const [fiatAmount, setFiatAmount] = useState('')
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>('USD')
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>('ETH')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer')
  const [selectedAccount, setSelectedAccount] = useState('')

  // Check KYC on connect
  useEffect(() => {
    if (address) {
      checkKycStatus(address)
    }
  }, [address, checkKycStatus])

  // Load orders on tab switch
  useEffect(() => {
    if (activeTab === 'orders') {
      refreshOrders()
    }
  }, [activeTab, refreshOrders])

  const handleGetQuote = async () => {
    const amount = Number(fiatAmount)
    if (!amount || amount <= 0) return
    await getQuote(fiatCurrency, cryptoCurrency, amount)
  }

  const handleCreateOrder = async () => {
    if (!quote || !address) return
    const order = await createOrder({
      quoteId: quote.id,
      paymentMethod,
      recipientAddress: address,
      bankAccountNo: paymentMethod === 'bank_transfer' ? selectedAccount : undefined,
    })
    if (order) {
      addToast({
        type: 'success',
        title: 'Order Created',
        message: `Buy order for ${order.cryptoAmount} ${order.cryptoCurrency} submitted`,
      })
      setActiveTab('orders')
      clearQuote()
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    const ok = await cancelOrder(orderId)
    if (ok) {
      addToast({ type: 'info', title: 'Order Cancelled', message: 'Your order has been cancelled' })
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to buy crypto
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Buy Crypto
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Purchase crypto with fiat currency
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex rounded-lg p-1" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <button
          type="button"
          onClick={() => setActiveTab('buy')}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'buy' ? 'rgb(var(--background))' : 'transparent',
            color:
              activeTab === 'buy' ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
            boxShadow: activeTab === 'buy' ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
          }}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'orders' ? 'rgb(var(--background))' : 'transparent',
            color:
              activeTab === 'orders' ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
            boxShadow: activeTab === 'orders' ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
          }}
        >
          Orders{orders.length > 0 ? ` (${orders.length})` : ''}
        </button>
      </div>

      {/* KYC Status Banner */}
      <KycBanner status={kycStatus} />

      {/* Buy Tab */}
      {activeTab === 'buy' && (
        <Card>
          <CardHeader>
            <CardTitle>Get a Quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount + Fiat Currency */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Amount"
                  type="number"
                  placeholder="100"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                />
              </div>
              <div className="w-24">
                <span
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Currency
                </span>
                <select
                  value={fiatCurrency}
                  onChange={(e) => setFiatCurrency(e.target.value as FiatCurrency)}
                  className="w-full p-2.5 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    borderColor: 'rgb(var(--border))',
                    color: 'rgb(var(--foreground))',
                  }}
                >
                  {FIAT_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Crypto Currency */}
            <div>
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                Receive
              </span>
              <div className="grid grid-cols-3 gap-2">
                {CRYPTO_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCryptoCurrency(c)}
                    className="p-2 rounded-lg border text-sm font-medium transition-all"
                    style={{
                      backgroundColor:
                        cryptoCurrency === c
                          ? 'rgb(var(--primary) / 0.1)'
                          : 'rgb(var(--secondary))',
                      borderColor:
                        cryptoCurrency === c ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                      color: 'rgb(var(--foreground))',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                Payment Method
              </span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2.5 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'rgb(var(--secondary))',
                  borderColor: 'rgb(var(--border))',
                  color: 'rgb(var(--foreground))',
                }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bank Account Selector (for bank_transfer) */}
            {paymentMethod === 'bank_transfer' && accounts.length > 0 && (
              <div>
                <span
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  From Bank Account
                </span>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full p-2.5 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    borderColor: 'rgb(var(--border))',
                    color: 'rgb(var(--foreground))',
                  }}
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.accountNo} value={a.accountNo}>
                      {a.accountType} ****{a.accountNo.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Get Quote Button */}
            {!quote && (
              <Button
                onClick={handleGetQuote}
                isLoading={isLoadingQuote}
                disabled={!fiatAmount || Number(fiatAmount) <= 0}
                className="w-full"
              >
                Get Quote
              </Button>
            )}

            {/* Quote Display */}
            {quote && <QuoteDisplay quote={quote} />}

            {/* Create Order Button */}
            {quote && (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={clearQuote} className="flex-1">
                  New Quote
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  isLoading={isCreatingOrder}
                  disabled={kycStatus !== 'verified'}
                  className="flex-1"
                >
                  {kycStatus !== 'verified' ? 'KYC Required' : 'Buy Now'}
                </Button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--destructive) / 0.1)',
                  borderColor: 'rgb(var(--destructive) / 0.3)',
                }}
              >
                <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
                  {error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card>
          <CardHeader>
            <CardTitle>Your Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingOrders ? (
              <p
                className="text-center py-8 text-sm"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Loading orders...
              </p>
            ) : orders.length === 0 ? (
              <p
                className="text-center py-8 text-sm"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                No orders yet. Buy some crypto to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <OrderItem
                    key={order.id}
                    order={order}
                    onCancel={() => handleCancelOrder(order.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function KycBanner({ status }: { status: KycStatus }) {
  const styles: Record<KycStatus, { bg: string; color: string; label: string }> = {
    none: {
      bg: 'rgb(var(--warning) / 0.1)',
      color: 'rgb(var(--warning))',
      label: 'KYC not started - verification required to buy',
    },
    pending: {
      bg: 'rgb(var(--warning) / 0.1)',
      color: 'rgb(var(--warning))',
      label: 'KYC verification pending...',
    },
    verified: {
      bg: 'rgb(var(--success) / 0.1)',
      color: 'rgb(var(--success))',
      label: 'KYC verified',
    },
    rejected: {
      bg: 'rgb(var(--destructive) / 0.1)',
      color: 'rgb(var(--destructive))',
      label: 'KYC rejected - please resubmit',
    },
  }

  const s = styles[status]

  return (
    <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </div>
  )
}

function QuoteDisplay({ quote }: { quote: OnRampQuote }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(quote.expiresAt).getTime() - Date.now()
      if (remaining <= 0) {
        setTimeLeft('Expired')
      } else {
        const mins = Math.floor(remaining / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [quote.expiresAt])

  return (
    <div
      className="p-4 rounded-lg border space-y-2"
      style={{ borderColor: 'rgb(var(--primary) / 0.3)', backgroundColor: 'rgb(var(--primary) / 0.05)' }}
    >
      <div className="flex justify-between text-sm">
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>You pay</span>
        <span style={{ color: 'rgb(var(--foreground))' }} className="font-medium">
          {quote.totalFiatAmount.toLocaleString()} {quote.fiatCurrency}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>You receive</span>
        <span style={{ color: 'rgb(var(--foreground))' }} className="font-medium">
          {quote.cryptoAmount} {quote.cryptoCurrency}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>Rate</span>
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>
          1 {quote.cryptoCurrency} = {quote.exchangeRate.toLocaleString()} {quote.fiatCurrency}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>Fees</span>
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>
          {quote.fees.total.toFixed(2)} {quote.fiatCurrency}
        </span>
      </div>
      <div
        className="flex justify-between text-xs pt-2 border-t"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>Expires in</span>
        <span
          style={{
            color: timeLeft === 'Expired' ? 'rgb(var(--destructive))' : 'rgb(var(--warning))',
          }}
        >
          {timeLeft}
        </span>
      </div>
    </div>
  )
}

function OrderItem({ order, onCancel }: { order: OnRampOrder; onCancel: () => void }) {
  const statusStyles: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))' },
    processing: { bg: 'rgb(var(--primary) / 0.1)', color: 'rgb(var(--primary))' },
    completed: { bg: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' },
    failed: { bg: 'rgb(var(--destructive) / 0.1)', color: 'rgb(var(--destructive))' },
    cancelled: { bg: 'rgb(var(--muted) / 0.1)', color: 'rgb(var(--muted-foreground))' },
    refunded: { bg: 'rgb(var(--muted) / 0.1)', color: 'rgb(var(--muted-foreground))' },
  }

  const s = statusStyles[order.status] || statusStyles.pending
  const canCancel = order.status === 'pending'

  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: s.bg, color: s.color }}
        >
          {order.status}
        </span>
        <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {order.fiatAmount.toLocaleString()} {order.fiatCurrency}
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {order.cryptoAmount} {order.cryptoCurrency}
          </p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded transition-colors"
            style={{ color: 'rgb(var(--destructive))' }}
          >
            Cancel
          </button>
        )}
      </div>
      {order.failureReason && (
        <p className="text-xs mt-2" style={{ color: 'rgb(var(--destructive))' }}>
          {order.failureReason}
        </p>
      )}
    </div>
  )
}
