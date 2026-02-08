'use client'

import { useEffect, useRef } from 'react'

interface MetaMaskUnsupportedModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MetaMaskUnsupportedModal({ isOpen, onClose }: MetaMaskUnsupportedModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgb(var(--overlay) / 0.6)' }}
      onClick={handleBackdropClick}
      onKeyDown={undefined}
      aria-hidden="true"
    >
      <div
        className="rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--card))' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4"
          style={{
            backgroundColor: 'rgb(var(--warning) / 0.1)',
            borderBottom: '1px solid rgb(var(--warning) / 0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--warning) / 0.2)' }}
            >
              <svg
                aria-hidden="true"
                className="w-6 h-6"
                style={{ color: 'rgb(var(--warning))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              MetaMask EIP-7702 제한
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="mb-4" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
            MetaMask는 <strong>커스텀 delegate 주소</strong>를 사용한 EIP-7702 authorization 서명을
            지원하지 않습니다.
          </p>

          <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <h4 className="font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              이유:
            </h4>
            <ul className="text-sm space-y-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <li className="flex items-start gap-2">
                <span style={{ color: 'rgb(var(--warning))' }} className="mt-0.5">
                  •
                </span>
                <span>
                  <code className="px-1 rounded" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                    eth_sign
                  </code>{' '}
                  메서드가 보안상 이유로 완전히 제거됨
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: 'rgb(var(--warning))' }} className="mt-0.5">
                  •
                </span>
                <span>MetaMask는 자체 하드코딩된 delegate 컨트랙트만 허용</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: 'rgb(var(--warning))' }} className="mt-0.5">
                  •
                </span>
                <span>EIP-7702 authorization 형식이 EIP-712와 호환되지 않음</span>
              </li>
            </ul>
          </div>

          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'rgb(var(--info) / 0.1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgb(var(--info) / 0.2)',
            }}
          >
            <h4 className="font-medium mb-2" style={{ color: 'rgb(var(--info))' }}>
              대안:
            </h4>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
              개발 환경에서는 <strong>"Private Key"</strong> 방식을 사용하세요. Anvil 테스트 계정의
              private key로 EIP-7702 authorization을 서명할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{
            backgroundColor: 'rgb(var(--secondary))',
            borderTop: '1px solid rgb(var(--border))',
          }}
        >
          <a
            href="https://blog.danfinlay.com/a-history-of-eth_sign-in-metamask/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm transition-colors"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            자세히 알아보기
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: 'rgb(var(--primary))',
              color: 'rgb(var(--primary-foreground))',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
