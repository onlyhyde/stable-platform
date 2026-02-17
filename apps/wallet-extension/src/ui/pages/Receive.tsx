import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWalletStore } from '../hooks/useWalletStore'

export function Receive() {
  const { t: tc } = useTranslation('common')
  const { selectedAccount, accounts } = useWalletStore()
  const [copied, setCopied] = useState(false)

  const currentAccount = accounts.find((a) => a.address === selectedAccount)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedAccount) return
    QRCode.toDataURL(selectedAccount, {
      width: 192,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [selectedAccount])

  async function copyAddress() {
    if (!selectedAccount) return

    await navigator.clipboard.writeText(selectedAccount)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!currentAccount) {
    return (
      <div className="p-4 text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {tc('noAccountFound')}
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2
        className="text-xl font-bold mb-6 text-center"
        style={{ color: 'rgb(var(--foreground))' }}
      >
        {tc('receive')}
      </h2>

      {/* QR Code */}
      <div className="flex justify-center mb-6">
        <div
          className="w-48 h-48 rounded-2xl flex items-center justify-center overflow-hidden"
          style={{
            backgroundColor: 'rgb(var(--card))',
            border: '2px solid rgb(var(--border))',
          }}
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Wallet address QR code" className="w-full h-full" />
          ) : (
            <div className="text-center p-4">
              <svg
                className="w-24 h-24 mx-auto animate-pulse"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 11V3h8v8H3zm2-6v4h4V5H5zM3 21v-8h8v8H3zm2-6v4h4v-4H5zm8-10h8v8h-8V3zm2 6h4V5h-4v4zm-2 10h2v-2h-2v2zm0-4h2v-2h-2v2zm2 4h2v-2h-2v2zm2-4h2v-2h-2v2zm2 4h2v-2h-2v2zm-2-8h2v-2h-2v2zm2 0h2v-2h-2v2z" />
              </svg>
              <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {tc('loading', 'Loading...')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Address Display */}
      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {tc('accountAddress')}
        </p>
        <code
          className="text-sm break-all block"
          style={{ color: 'rgb(var(--foreground-secondary))' }}
        >
          {currentAccount.address}
        </code>
      </div>

      {/* Copy Button */}
      <button
        type="button"
        onClick={copyAddress}
        className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
          copied ? 'badge-success' : 'btn-primary'
        }`}
      >
        {copied ? (
          <>
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            {tc('copied')}
          </>
        ) : (
          <>
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {tc('copyAddress')}
          </>
        )}
      </button>

      {/* Info */}
      <p className="text-xs text-center mt-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {tc(
          'receiveWarning',
          'Only send assets on the same network. Sending to a different network may result in loss of funds.'
        )}
      </p>
    </div>
  )
}
