import type { Address } from 'viem'
import { formatUnits, parseUnits } from 'viem'

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: Address, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 4
): string {
  const formatted = formatUnits(amount, decimals)
  const [integer, decimal] = formatted.split('.')

  if (!decimal) return integer

  const trimmed = decimal.slice(0, displayDecimals).replace(/0+$/, '')
  return trimmed ? `${integer}.${trimmed}` : integer
}

/**
 * Parse token amount to bigint
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals)
}

/**
 * Format USD value
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

/**
 * Format date
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Class name utility
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
