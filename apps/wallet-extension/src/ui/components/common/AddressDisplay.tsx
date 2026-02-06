import { useState } from 'react'
import type { Address } from 'viem'

export interface AddressDisplayProps {
  address: Address
  truncate?: boolean
  truncateLength?: number
  showCopy?: boolean
  showQR?: boolean
  onShowQR?: () => void
  className?: string
}

export function AddressDisplay({
  address,
  truncate = true,
  truncateLength = 4,
  showCopy = true,
  showQR = false,
  onShowQR,
  className = '',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false)

  const displayAddress = truncate
    ? `${address.slice(0, truncateLength + 2)}...${address.slice(-truncateLength)}`
    : address

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API failed
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <code className="text-sm font-mono text-gray-700 break-all">{displayAddress}</code>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          title={copied ? 'Copied!' : 'Copy address'}
        >
          {copied ? (
            <svg
              className="w-4 h-4 text-green-500"
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
          ) : (
            <svg
              className="w-4 h-4"
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
          )}
        </button>
      )}
      {showQR && onShowQR && (
        <button
          type="button"
          onClick={onShowQR}
          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          title="Show QR code"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

export interface AddressAvatarProps {
  address: Address
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const avatarSizes = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

export function AddressAvatar({ address, size = 'md', className = '' }: AddressAvatarProps) {
  // Generate a color based on the address
  const hue = Number.parseInt(address.slice(2, 8), 16) % 360

  return (
    <div
      className={`
        rounded-full flex items-center justify-center font-medium text-white
        ${avatarSizes[size]}
        ${className}
      `}
      style={{ backgroundColor: `hsl(${hue}, 60%, 50%)` }}
    >
      {address.slice(2, 4).toUpperCase()}
    </div>
  )
}
