import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther, formatGwei } from 'viem'
import type { SignatureApprovalRequest } from '../../types'
import { Badge, Button, Card } from '../../ui/components/common'

interface SignatureApprovalProps {
  approval: SignatureApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

/**
 * Detect whether the typed data represents an EIP-4337 PackedUserOperation.
 */
function isUserOpTypedData(typedData: unknown): typedData is {
  primaryType: 'PackedUserOperation'
  domain: { name: string; version: string; chainId: string; verifyingContract: string }
  types: Record<string, Array<{ name: string; type: string }>>
  message: Record<string, string>
} {
  if (!typedData || typeof typedData !== 'object') return false
  const td = typedData as Record<string, unknown>
  return td.primaryType === 'PackedUserOperation'
}

/**
 * Truncate long hex strings for display, keeping head and tail visible.
 */
function truncateHex(value: string, maxLen = 42): string {
  if (value.length <= maxLen) return value
  return `${value.slice(0, 22)}...${value.slice(-16)}`
}

/**
 * Truncate an address to 0x1234...5678 format.
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// ============================================================================
// UserOp Decoder — extract human-readable info from packed fields
// ============================================================================

interface DecodedUserOpInfo {
  sender: string
  nonce: string
  /** Decoded from callData if it's a Kernel execute(address,uint256,bytes) call */
  recipient?: string
  transferAmount?: string
  /** Gas info decoded from packed bytes32 fields */
  verificationGasLimit?: string
  callGasLimit?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  /** Paymaster info decoded from paymasterAndData */
  paymasterAddress?: string
  paymasterType?: string
  hasPaymaster: boolean
  /** ERC-20 paymaster: token address for gas payment */
  gasTokenAddress?: string
  /** ERC-20 paymaster: estimated max token cost */
  gasTokenMaxCost?: string
  /** ERC-20 paymaster: formatted max token cost for display */
  gasTokenMaxCostFormatted?: string
}

/**
 * Decode a packed UserOperation message into human-readable fields.
 * accountGasLimits = bytes32: verificationGasLimit(16) | callGasLimit(16)
 * gasFees = bytes32: maxPriorityFeePerGas(16) | maxFeePerGas(16)
 * paymasterAndData = paymaster(20) | pmVerificationGas(16) | pmPostOpGas(16) | data(...)
 */
function decodeUserOpInfo(message: Record<string, string>): DecodedUserOpInfo {
  const sender = message.sender ?? ''
  const nonce = message.nonce ?? '0'

  const result: DecodedUserOpInfo = {
    sender,
    nonce: formatNonce(nonce),
    hasPaymaster: false,
  }

  // Decode callData — Kernel execute(address,uint256,bytes) selector: 0x51945447
  // But more commonly, e9ae5c53 = execute(ExecMode,bytes) from ERC-7579
  const callData = message.callData ?? ''
  if (callData.length >= 10) {
    const selector = callData.slice(0, 10).toLowerCase()

    // Kernel v3 execute(bytes32 execMode, bytes calldata executionCalldata)
    // executionCalldata for single = abi.encodePacked(target, value, calldata)
    // = target(20) + value(32) + calldata(...)
    if (selector === '0xe9ae5c53' && callData.length >= 10 + 64 + 64 + 40 + 64) {
      // Skip selector(4) + execMode(32) + offset(32) + length(32)
      // Then: target(20 bytes = 40 hex) + value(32 bytes = 64 hex) + calldata
      const executionOffset = 10 + 64 + 64 + 64 // after selector + execMode + offset + length
      if (callData.length >= executionOffset + 40 + 64) {
        const targetHex = callData.slice(executionOffset, executionOffset + 40)
        const valueHex = callData.slice(executionOffset + 40, executionOffset + 40 + 64)
        result.recipient = `0x${targetHex}`
        try {
          const value = BigInt(`0x${valueHex}`)
          if (value > 0n) {
            result.transferAmount = formatEther(value)
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    // Legacy: execute(address,uint256,bytes) selector: 0xb61d27f6
    if (selector === '0xb61d27f6' && callData.length >= 10 + 64 + 64) {
      const targetHex = callData.slice(10 + 24, 10 + 64)
      const valueHex = callData.slice(10 + 64, 10 + 128)
      result.recipient = `0x${targetHex}`
      try {
        const value = BigInt(`0x${valueHex}`)
        if (value > 0n) {
          result.transferAmount = formatEther(value)
        }
      } catch {
        // ignore
      }
    }
  }

  // Decode accountGasLimits (bytes32 = verificationGasLimit(16) | callGasLimit(16))
  const gasLimits = message.accountGasLimits ?? ''
  if (gasLimits.startsWith('0x') && gasLimits.length === 66) {
    const hex = gasLimits.slice(2)
    try {
      result.verificationGasLimit = BigInt(`0x${hex.slice(0, 32)}`).toLocaleString()
      result.callGasLimit = BigInt(`0x${hex.slice(32)}`).toLocaleString()
    } catch {
      // ignore
    }
  }

  // Decode gasFees (bytes32 = maxPriorityFeePerGas(16) | maxFeePerGas(16))
  const gasFees = message.gasFees ?? ''
  if (gasFees.startsWith('0x') && gasFees.length === 66) {
    const hex = gasFees.slice(2)
    try {
      const priority = BigInt(`0x${hex.slice(0, 32)}`)
      const maxFee = BigInt(`0x${hex.slice(32)}`)
      result.maxPriorityFeePerGas = formatGwei(priority)
      result.maxFeePerGas = formatGwei(maxFee)
    } catch {
      // ignore
    }
  }

  // Decode paymasterAndData — paymaster(20) | pmVerGas(16) | pmPostOpGas(16) | data(...)
  const pmData = message.paymasterAndData ?? ''
  if (pmData.startsWith('0x') && pmData.length > 2 + 40) {
    result.hasPaymaster = true
    result.paymasterAddress = `0x${pmData.slice(2, 42)}`

    // Try to decode paymaster type from envelope header (after 52-byte prefix)
    // Envelope starts at offset 52 bytes = 104 hex chars from 0x
    const envelopeStart = 2 + 104
    if (pmData.length > envelopeStart + 4) {
      // version(1) + type(1) — type byte at offset 1
      const typeByte = parseInt(pmData.slice(envelopeStart + 2, envelopeStart + 4), 16)
      const typeNames: Record<number, string> = {
        0: 'Verifying',
        1: 'Sponsor',
        2: 'ERC-20',
        3: 'Permit2',
      }
      result.paymasterType = typeNames[typeByte] ?? `Type ${typeByte}`

      // ERC-20 paymaster: decode token address and maxTokenCost from payload
      // Envelope: version(1) + type(1) + flags(1) + validUntil(6) + validAfter(6) + nonce(8) + payloadLen(2) + payload
      // = 25 bytes = 50 hex chars of envelope header
      // Payload for ERC20: ABI-encoded (address token, uint256 maxTokenCost, uint256 quoteId, bytes erc20Extra)
      if (typeByte === 2) {
        try {
          const payloadStart = envelopeStart + 50 // after envelope header
          if (pmData.length > payloadStart + 128) {
            // ABI-encoded: first 32 bytes = token address (padded), next 32 bytes = maxTokenCost
            const tokenHex = pmData.slice(payloadStart + 24, payloadStart + 64)
            result.gasTokenAddress = `0x${tokenHex}`

            const maxCostHex = pmData.slice(payloadStart + 64, payloadStart + 128)
            const maxCostBigInt = BigInt(`0x${maxCostHex}`)
            result.gasTokenMaxCost = maxCostBigInt.toString()

            // Format as USDC (6 decimals) — most common ERC-20 gas token
            if (maxCostBigInt > 0n) {
              const whole = maxCostBigInt / 1000000n
              const frac = maxCostBigInt % 1000000n
              const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '')
              result.gasTokenMaxCostFormatted = fracStr
                ? `${whole}.${fracStr} USDC`
                : `${whole} USDC`
            }
          }
        } catch {
          // ignore decode errors
        }
      }
    }
  } else if (pmData === '0x' || pmData === '') {
    result.hasPaymaster = false
  }

  return result
}

function formatNonce(nonce: string): string {
  try {
    const n = BigInt(nonce)
    return n.toString()
  } catch {
    return nonce
  }
}

// ============================================================================
// Component
// ============================================================================

export function SignatureApproval({ approval, onApprove, onReject }: SignatureApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const { data } = approval

  const isUserOp = isUserOpTypedData(data.typedData)
  const isEip712 = data.method === 'eth_signTypedData_v4'
  // Narrowed typed data reference after type guard
  const userOpTypedData = isUserOp
    ? (data.typedData as {
        domain: Record<string, string>
        message: Record<string, string>
      })
    : null

  // Decode UserOp into human-readable info
  const decodedInfo = useMemo(() => {
    if (!userOpTypedData) return null
    return decodeUserOpInfo(userOpTypedData.message)
  }, [userOpTypedData])

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      default:
        return 'success'
    }
  }

  const getOriginDisplay = (origin: string) => {
    try {
      return new URL(origin).hostname
    } catch {
      return origin === 'extension' ? 'StableNet Wallet' : origin
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderBottom: '1px solid rgb(var(--border))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {approval.favicon ? (
              <img src={approval.favicon} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--surface))' }}
              >
                <svg
                  className="w-5 h-5"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium break-all" style={{ color: 'rgb(var(--foreground))' }}>
                {getOriginDisplay(approval.origin)}
              </p>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('signatureRequest')}
              </p>
            </div>
          </div>
          {data.riskLevel && (
            <Badge variant={getRiskColor(data.riskLevel)}>{data.riskLevel.toUpperCase()}</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {/* Signing account */}
        <Card padding="md">
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('signingWith')}
          </p>
          <p className="text-sm font-mono break-all" style={{ color: 'rgb(var(--foreground))' }}>
            {data.address}
          </p>
        </Card>

        {/* EIP Standard indicator */}
        {isUserOp && (
          <Card padding="md">
            <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('signingStandard')}
            </p>
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {isEip712 ? t('eip712Label') : t('eip191Label')}
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {isEip712 ? t('userOpTypedDataDesc') : t('userOpHashDesc')}
            </p>
          </Card>
        )}

        {/* EIP-191 message (personal_sign) */}
        {(data.displayMessage || data.message) && !isUserOp && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('message')}
            </p>
            <div
              className="rounded-lg p-3 max-h-48 overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <pre
                className="text-sm whitespace-pre-wrap break-all font-mono"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {data.displayMessage || String(data.message)}
              </pre>
            </div>
          </Card>
        )}

        {/* UserOp EIP-191 hash display (collapsed, shown after human-readable summary) */}
        {data.message && isUserOp && !isEip712 && decodedInfo && (
          <details>
            <summary
              className="text-xs cursor-pointer py-1"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              UserOperation Hash
            </summary>
            <Card padding="md">
              <div
                className="rounded-lg p-3 overflow-x-auto"
                style={{ backgroundColor: 'rgb(var(--surface))' }}
              >
                <code
                  className="text-xs break-all font-mono"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {String(data.message)}
                </code>
              </div>
            </Card>
          </details>
        )}

        {/* UserOp EIP-191 hash display (full, when no typed data available) */}
        {data.message && isUserOp && !isEip712 && !decodedInfo && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              UserOperation Hash
            </p>
            <div
              className="rounded-lg p-3 overflow-x-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <code
                className="text-xs break-all font-mono"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {String(data.message)}
              </code>
            </div>
          </Card>
        )}

        {/* ================================================================ */}
        {/* UserOp Human-Readable Summary (EIP-712 or EIP-191 with typedData) */}
        {/* ================================================================ */}
        {isUserOp && decodedInfo && (
          <>
            {/* Transaction Summary Card */}
            <Card padding="md">
              <p
                className="text-xs font-medium mb-3"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {t('userOpSummary')}
              </p>
              <div className="space-y-2">
                {/* Sender */}
                <InfoRow
                  label={t('userOpSender')}
                  value={truncateAddress(decodedInfo.sender)}
                  mono
                  title={decodedInfo.sender}
                />

                {/* Nonce */}
                <InfoRow label={t('userOpNonce')} value={`#${decodedInfo.nonce}`} />

                {/* Recipient (if decoded) */}
                {decodedInfo.recipient && (
                  <InfoRow
                    label={t('userOpRecipient')}
                    value={truncateAddress(decodedInfo.recipient)}
                    mono
                    title={decodedInfo.recipient}
                  />
                )}

                {/* Transfer Amount */}
                {decodedInfo.transferAmount && (
                  <InfoRow
                    label={t('userOpAmount')}
                    value={`${decodedInfo.transferAmount} WKRC`}
                    highlight
                  />
                )}
              </div>
            </Card>

            {/* Gas Info Card */}
            <Card padding="md">
              <p
                className="text-xs font-medium mb-3"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {t('userOpGasInfo')}
              </p>
              <div className="space-y-2">
                {decodedInfo.verificationGasLimit && (
                  <InfoRow
                    label={t('userOpVerificationGas')}
                    value={decodedInfo.verificationGasLimit}
                  />
                )}
                {decodedInfo.callGasLimit && (
                  <InfoRow label={t('userOpCallGas')} value={decodedInfo.callGasLimit} />
                )}
                {decodedInfo.maxFeePerGas && (
                  <InfoRow label={t('userOpMaxFee')} value={`${decodedInfo.maxFeePerGas} Gwei`} />
                )}
                {decodedInfo.maxPriorityFeePerGas && (
                  <InfoRow
                    label={t('userOpPriorityFee')}
                    value={`${decodedInfo.maxPriorityFeePerGas} Gwei`}
                  />
                )}
                {/* PreVerificationGas */}
                {userOpTypedData?.message.preVerificationGas && (
                  <InfoRow
                    label={t('userOpPreVerGas')}
                    value={formatNonce(String(userOpTypedData.message.preVerificationGas))}
                  />
                )}
              </div>
            </Card>

            {/* Paymaster Info Card */}
            {decodedInfo.hasPaymaster && (
              <Card padding="md">
                <p
                  className="text-xs font-medium mb-3"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {t('userOpPaymaster')}
                </p>
                <div className="space-y-2">
                  {decodedInfo.paymasterAddress && (
                    <InfoRow
                      label={t('userOpPaymasterAddr')}
                      value={truncateAddress(decodedInfo.paymasterAddress)}
                      mono
                      title={decodedInfo.paymasterAddress}
                    />
                  )}
                  {decodedInfo.paymasterType && (
                    <InfoRow label={t('userOpPaymasterType')} value={decodedInfo.paymasterType} />
                  )}
                  {/* ERC-20 gas payment details */}
                  {decodedInfo.gasTokenAddress && (
                    <InfoRow
                      label={t('userOpGasToken')}
                      value={truncateAddress(decodedInfo.gasTokenAddress)}
                      mono
                      title={decodedInfo.gasTokenAddress}
                    />
                  )}
                  {decodedInfo.gasTokenMaxCostFormatted && (
                    <InfoRow
                      label={t('userOpGasTokenCost')}
                      value={decodedInfo.gasTokenMaxCostFormatted}
                      highlight
                    />
                  )}
                </div>
              </Card>
            )}

            {!decodedInfo.hasPaymaster && (
              <Card padding="md">
                <div className="flex items-center gap-2">
                  <span className="text-sm">💰</span>
                  <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {t('userOpSelfPay')}
                  </p>
                </div>
              </Card>
            )}

            {/* EIP-712 Domain */}
            <Card padding="md">
              <p
                className="text-xs font-medium mb-2"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                EIP-712 Domain
              </p>
              <div className="space-y-2">
                {Object.entries(userOpTypedData!.domain).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2">
                    <span
                      className="text-xs shrink-0"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {key}
                    </span>
                    <span
                      className="text-xs font-mono text-right break-all"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Raw PackedUserOperation fields (collapsed) */}
            <details>
              <summary
                className="text-xs cursor-pointer py-1"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {t('userOpRawFields')}
              </summary>
              <Card padding="md">
                <div className="space-y-3">
                  {Object.entries(userOpTypedData!.message).map(([key, value]) => {
                    const strValue = String(value)
                    const isLongHex = strValue.startsWith('0x') && strValue.length > 42

                    return (
                      <div key={key}>
                        <p
                          className="text-xs mb-0.5"
                          style={{ color: 'rgb(var(--muted-foreground))' }}
                        >
                          {key}
                        </p>
                        {isLongHex ? (
                          <div
                            className="rounded p-2 overflow-x-auto"
                            style={{ backgroundColor: 'rgb(var(--surface))' }}
                          >
                            <code
                              className="text-xs break-all font-mono"
                              style={{ color: 'rgb(var(--foreground))' }}
                              title={strValue}
                            >
                              {truncateHex(strValue, 66)}
                            </code>
                          </div>
                        ) : (
                          <p
                            className="text-xs font-mono break-all"
                            style={{ color: 'rgb(var(--foreground))' }}
                          >
                            {strValue}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            </details>
          </>
        )}

        {/* Generic Typed Data (non-UserOp EIP-712) */}
        {data.typedData !== undefined && !isUserOp && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('typedData')}
            </p>
            <div
              className="rounded-lg p-3 max-h-48 overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <pre
                className="text-xs whitespace-pre-wrap break-all font-mono"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {JSON.stringify(data.typedData, null, 2)}
              </pre>
            </div>
          </Card>
        )}

        {/* Risk Warnings */}
        {data.riskWarnings && data.riskWarnings.length > 0 && (
          <Card
            variant="filled"
            padding="md"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              border: '1px solid rgb(var(--destructive) / 0.2)',
            }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--destructive))' }}>
              {t('securityWarnings')}
            </p>
            <ul className="space-y-1">
              {data.riskWarnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: 'rgb(var(--destructive) / 0.8)' }}
                >
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: 'rgb(var(--destructive))' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {warning}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div
        className="p-6 space-y-3"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderTop: '1px solid rgb(var(--border))',
        }}
      >
        <Button onClick={() => onApprove()} fullWidth>
          {t('sign')}
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          {tc('reject')}
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface InfoRowProps {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
  title?: string
}

function InfoRow({ label, value, mono, highlight, title }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs shrink-0" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {label}
      </span>
      <span
        className={`text-xs text-right break-all ${mono ? 'font-mono' : ''}`}
        style={{
          color: highlight ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
          fontWeight: highlight ? 500 : 400,
        }}
        title={title}
      >
        {value}
      </span>
    </div>
  )
}
