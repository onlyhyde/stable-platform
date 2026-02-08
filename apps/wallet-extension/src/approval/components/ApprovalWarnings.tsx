/**
 * Approval Warnings Component
 *
 * Displays severity-coded warnings for transaction and signature approvals.
 * Warnings are categorized by severity: critical, high, medium, info.
 */

import { useTranslation } from 'react-i18next'
import { Badge, Card } from '../../ui/components/common'

export interface ApprovalWarning {
  message: string
  severity: 'critical' | 'high' | 'medium' | 'info'
}

interface ApprovalWarningsProps {
  warnings: string[]
  riskLevel?: 'low' | 'medium' | 'high'
}

/**
 * Classify a warning string into a severity level based on keywords
 */
function classifyWarning(warning: string): ApprovalWarning {
  const lower = warning.toLowerCase()

  if (
    lower.includes('unlimited') ||
    lower.includes('all your') ||
    lower.includes('full access') ||
    lower.includes('critical')
  ) {
    return { message: warning, severity: 'critical' }
  }

  if (
    lower.includes('simulation failed') ||
    lower.includes('may revert') ||
    lower.includes('high value') ||
    lower.includes('token approval') ||
    lower.includes('nft approval')
  ) {
    return { message: warning, severity: 'high' }
  }

  if (
    lower.includes('unknown contract') ||
    lower.includes('proceed with caution') ||
    lower.includes('verify') ||
    lower.includes('spending approval')
  ) {
    return { message: warning, severity: 'medium' }
  }

  return { message: warning, severity: 'info' }
}

const SEVERITY_STYLES: Record<
  ApprovalWarning['severity'],
  { bg: string; border: string; icon: string; text: string; labelKey: string }
> = {
  critical: {
    bg: 'rgb(239 68 68 / 0.1)',
    border: 'rgb(239 68 68 / 0.3)',
    icon: 'rgb(239 68 68)',
    text: 'rgb(239 68 68 / 0.9)',
    labelKey: 'severityCritical',
  },
  high: {
    bg: 'rgb(249 115 22 / 0.1)',
    border: 'rgb(249 115 22 / 0.3)',
    icon: 'rgb(249 115 22)',
    text: 'rgb(249 115 22 / 0.9)',
    labelKey: 'severityHigh',
  },
  medium: {
    bg: 'rgb(234 179 8 / 0.1)',
    border: 'rgb(234 179 8 / 0.3)',
    icon: 'rgb(234 179 8)',
    text: 'rgb(234 179 8 / 0.9)',
    labelKey: 'severityWarning',
  },
  info: {
    bg: 'rgb(var(--surface))',
    border: 'rgb(var(--border))',
    icon: 'rgb(var(--muted-foreground))',
    text: 'rgb(var(--foreground-secondary))',
    labelKey: 'severityInfo',
  },
}

export function ApprovalWarnings({ warnings, riskLevel }: ApprovalWarningsProps) {
  const { t } = useTranslation('approval')
  if (!warnings || warnings.length === 0) return null

  const classified = warnings.map(classifyWarning)

  // Sort by severity: critical first, then high, medium, info
  const severityOrder: Record<ApprovalWarning['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    info: 3,
  }
  classified.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const hasCritical = classified.some((w) => w.severity === 'critical')
  const hasHigh = classified.some((w) => w.severity === 'high')

  // Overall card styling based on highest severity
  const overallSeverity = hasCritical ? 'critical' : hasHigh ? 'high' : 'medium'
  const overallStyle = SEVERITY_STYLES[overallSeverity]

  return (
    <Card
      variant="filled"
      padding="md"
      style={{
        backgroundColor: overallStyle.bg,
        border: `1px solid ${overallStyle.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
            style={{ color: overallStyle.icon }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {hasCritical ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            )}
          </svg>
          <p className="text-sm font-semibold" style={{ color: overallStyle.icon }}>
            {hasCritical ? t('criticalWarnings') : hasHigh ? t('riskWarnings') : t('warnings')}
          </p>
        </div>
        {riskLevel && (
          <Badge
            variant={
              riskLevel === 'high' ? 'error' : riskLevel === 'medium' ? 'warning' : 'success'
            }
          >
            {riskLevel.toUpperCase()}
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        {classified.map((warning) => {
          const style = SEVERITY_STYLES[warning.severity]
          return (
            <li
              key={warning.message}
              className="flex items-start gap-2 text-sm rounded-md px-2 py-1.5"
              style={{ backgroundColor: style.bg }}
            >
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                style={{
                  backgroundColor: style.icon,
                  color: 'white',
                }}
              >
                {t(style.labelKey)}
              </span>
              <span style={{ color: style.text }}>{warning.message}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
