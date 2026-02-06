import { useState, useCallback } from 'react'
import {
  parseWebAuthnCredential,
  encodeWebAuthnValidatorInit,
  validateWebAuthnValidatorConfig,
  type WebAuthnValidatorConfig,
} from '@stablenet/core'
import type { Hex } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface WebAuthnConfigProps {
  accountAddress: string
  onSubmit: (initData: Hex, config: WebAuthnValidatorConfig) => void
  onBack: () => void
}

type Step = 'intro' | 'registering' | 'success' | 'error'

interface Credential {
  id: string
  credentialId: Hex
  pubKeyX: bigint
  pubKeyY: bigint
  createdAt: string
}

// ============================================================================
// Component
// ============================================================================

export function WebAuthnConfig({ accountAddress, onSubmit, onBack }: WebAuthnConfigProps) {
  const [step, setStep] = useState<Step>('intro')
  const [credential, setCredential] = useState<Credential | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Register a new passkey
  const handleRegister = useCallback(async () => {
    setStep('registering')
    setError(null)

    try {
      // Check WebAuthn support
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      // Generate challenge
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      // Create credential options
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'StableNet Wallet',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(accountAddress.slice(0, 32)),
            name: `${accountAddress.slice(0, 8)}...${accountAddress.slice(-6)}`,
            displayName: 'StableNet Account',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256 (P-256)
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      }

      // Create credential
      const cred = (await navigator.credentials.create(createOptions)) as PublicKeyCredential

      if (!cred) {
        throw new Error('Failed to create credential')
      }

      const attestationResponse = cred.response as AuthenticatorAttestationResponse

      // Extract public key from attestation
      const publicKeyBuffer = attestationResponse.getPublicKey?.()
      if (!publicKeyBuffer) {
        throw new Error('Failed to get public key from credential')
      }

      // Parse the credential using SDK utility
      const parsed = parseWebAuthnCredential({
        id: cred.id,
        publicKey: publicKeyBuffer,
      })

      // Validate config
      const config: WebAuthnValidatorConfig = {
        pubKeyX: parsed.pubKeyX,
        pubKeyY: parsed.pubKeyY,
        credentialId: parsed.credentialId,
      }

      const validation = validateWebAuthnValidatorConfig(config)
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '))
      }

      // Save credential
      setCredential({
        id: cred.id,
        credentialId: parsed.credentialId,
        pubKeyX: parsed.pubKeyX,
        pubKeyY: parsed.pubKeyY,
        createdAt: new Date().toISOString(),
      })

      setStep('success')
    } catch (err) {
      console.error('WebAuthn registration failed:', err)
      setError(err instanceof Error ? err.message : 'Registration failed')
      setStep('error')
    }
  }, [accountAddress])

  // Confirm and submit
  const handleConfirm = useCallback(() => {
    if (!credential) return

    const config: WebAuthnValidatorConfig = {
      pubKeyX: credential.pubKeyX,
      pubKeyY: credential.pubKeyY,
      credentialId: credential.credentialId,
    }

    const initData = encodeWebAuthnValidatorInit(config)
    onSubmit(initData, config)
  }, [credential, onSubmit])

  return (
    <div className="webauthn-config">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🔐</span>
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            WebAuthn Validator
          </h3>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Use passkeys for secure authentication
          </p>
        </div>
      </div>

      {/* Step: Introduction */}
      {step === 'intro' && (
        <div className="intro-step">
          <div
            className="info-card p-4 rounded-lg mb-6"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <h4 className="font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              What are Passkeys?
            </h4>
            <ul className="text-sm space-y-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Phishing-resistant authentication</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Uses device biometrics (Face ID, Touch ID, Windows Hello)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>No passwords to remember or steal</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Syncs across your devices via iCloud/Google</span>
              </li>
            </ul>
          </div>

          <div
            className="warning-card p-4 rounded-lg mb-6"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--warning) / 0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
              <strong>Important:</strong> Once enabled, you'll need your passkey to sign
              transactions. Make sure your device supports biometric authentication.
            </p>
          </div>

          <div className="flex gap-3">
            <button className="btn-ghost flex-1 py-3 rounded-lg font-medium" onClick={onBack}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 py-3 rounded-lg font-medium"
              onClick={handleRegister}
            >
              Create Passkey
            </button>
          </div>
        </div>
      )}

      {/* Step: Registering */}
      {step === 'registering' && (
        <div className="registering-step text-center py-8">
          <div
            className="w-16 h-16 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Creating your passkey...
          </p>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Follow the prompts on your device to complete registration
          </p>
        </div>
      )}

      {/* Step: Success */}
      {step === 'success' && credential && (
        <div className="success-step">
          <div
            className="success-card p-4 rounded-lg mb-6 text-center"
            style={{
              backgroundColor: 'rgb(var(--success) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--success) / 0.3)',
            }}
          >
            <span className="text-4xl mb-2 block">✅</span>
            <p className="font-medium" style={{ color: 'rgb(var(--success))' }}>
              Passkey created successfully!
            </p>
          </div>

          <div
            className="credential-info p-4 rounded-lg mb-6"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <h4 className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--foreground))' }}>
              Credential Details
            </h4>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt style={{ color: 'rgb(var(--muted-foreground))' }}>Credential ID</dt>
                <dd className="font-mono text-xs" style={{ color: 'rgb(var(--foreground))' }}>
                  {credential.credentialId.slice(0, 10)}...{credential.credentialId.slice(-8)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'rgb(var(--muted-foreground))' }}>Public Key (X)</dt>
                <dd className="font-mono text-xs" style={{ color: 'rgb(var(--foreground))' }}>
                  {credential.pubKeyX.toString(16).slice(0, 8)}...
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'rgb(var(--muted-foreground))' }}>Public Key (Y)</dt>
                <dd className="font-mono text-xs" style={{ color: 'rgb(var(--foreground))' }}>
                  {credential.pubKeyY.toString(16).slice(0, 8)}...
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'rgb(var(--muted-foreground))' }}>Created</dt>
                <dd style={{ color: 'rgb(var(--foreground))' }}>
                  {new Date(credential.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-3">
            <button
              className="btn-ghost flex-1 py-3 rounded-lg font-medium"
              onClick={() => setStep('intro')}
            >
              Create Another
            </button>
            <button
              className="btn-primary flex-1 py-3 rounded-lg font-medium"
              onClick={handleConfirm}
            >
              Install Validator
            </button>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div className="error-step">
          <div
            className="error-card p-4 rounded-lg mb-6 text-center"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--destructive) / 0.3)',
            }}
          >
            <span className="text-4xl mb-2 block">❌</span>
            <p className="font-medium" style={{ color: 'rgb(var(--destructive))' }}>
              Registration failed
            </p>
            {error && (
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--destructive))' }}>
                {error}
              </p>
            )}
          </div>

          <div
            className="help-card p-4 rounded-lg mb-6"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <h4 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Troubleshooting
            </h4>
            <ul className="text-sm space-y-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <li>• Make sure your device supports biometric authentication</li>
              <li>• Check that you've set up Face ID, Touch ID, or Windows Hello</li>
              <li>• Try using a different browser (Chrome, Safari, Edge)</li>
              <li>• Ensure you're not in incognito/private mode</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button className="btn-ghost flex-1 py-3 rounded-lg font-medium" onClick={onBack}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 py-3 rounded-lg font-medium"
              onClick={handleRegister}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Credential Management Component
// ============================================================================

interface WebAuthnCredentialListProps {
  credentials: Credential[]
  onRemove?: (credentialId: string) => void
}

export function WebAuthnCredentialList({ credentials, onRemove }: WebAuthnCredentialListProps) {
  if (credentials.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
        No passkeys registered
      </div>
    )
  }

  return (
    <div className="credential-list space-y-3">
      {credentials.map((cred) => (
        <div
          key={cred.id}
          className="credential-item p-4 rounded-lg flex items-center justify-between"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
                Passkey
              </p>
              <p className="font-mono text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {cred.credentialId.slice(0, 10)}...{cred.credentialId.slice(-8)}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Created {new Date(cred.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {onRemove && (
            <button
              className="px-3 py-1 rounded text-sm"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                color: 'rgb(var(--destructive))',
              }}
              onClick={() => onRemove(cred.id)}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
