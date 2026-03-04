/**
 * Error Sanitizer Tests (SEC-15)
 */

import {
  createSanitizedError,
  sanitizeErrorMessage,
  withSanitizedErrors,
} from '../../../src/shared/security/errorSanitizer'

describe('errorSanitizer', () => {
  describe('sanitizeErrorMessage', () => {
    describe('safe messages', () => {
      it('should pass through known safe messages', () => {
        const safeMessages = [
          'Vault is locked',
          'Incorrect password',
          'User rejected the request',
          'Permission denied',
          'Invalid address',
        ]

        for (const msg of safeMessages) {
          expect(sanitizeErrorMessage(msg)).toBe(msg)
          expect(sanitizeErrorMessage(new Error(msg))).toBe(msg)
        }
      })

      it('should include error code when available', () => {
        const error = { message: 'User rejected the request', code: 4001 }
        const result = sanitizeErrorMessage(error, { includeErrorCode: true })
        expect(result).toBe('User rejected the request (4001)')
      })
    })

    describe('file path sanitization', () => {
      it('should redact Unix file paths', () => {
        const error = 'Error at /Users/john/project/src/file.ts:42:10'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('/Users/john')
        expect(result).not.toContain('file.ts')
      })

      it('should redact Windows file paths', () => {
        const error = 'Error at C:\\Users\\john\\project\\src\\file.ts'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('C:\\Users')
      })

      it('should redact node_modules paths', () => {
        const error = 'Error in node_modules/@ethersproject/contracts/lib/index.js'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('node_modules')
      })
    })

    describe('stack trace sanitization', () => {
      it('should redact stack trace lines', () => {
        const error = 'Error: something failed\n  at Object.fn (/path/to/file.js:10:5)'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('at Object.fn')
      })

      it('should redact line:column patterns', () => {
        const error = 'TypeError at file.ts:42:15'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain(':42:15')
      })
    })

    describe('error type replacements', () => {
      it('should replace fetch errors', () => {
        const error = 'Failed to fetch data from server'
        const result = sanitizeErrorMessage(error)
        expect(result).toBe('Network request failed')
      })

      it('should replace network errors', () => {
        const error = 'Network error occurred'
        const result = sanitizeErrorMessage(error)
        expect(result).toBe('Network connection error')
      })

      it('should replace timeout errors', () => {
        const error = 'Request timeout after 30000ms'
        const result = sanitizeErrorMessage(error)
        expect(result).toBe('Request timed out')
      })

      it('should replace JSON parsing errors', () => {
        const error = 'Invalid JSON response'
        const result = sanitizeErrorMessage(error)
        expect(result).toBe('Invalid response format')
      })

      it('should replace unexpected token errors', () => {
        const error = 'Unexpected token < in JSON at position 0'
        const result = sanitizeErrorMessage(error)
        expect(result).toBe('Invalid response format')
      })

      it('should replace null/undefined errors', () => {
        expect(sanitizeErrorMessage('Cannot read property x of undefined')).toBe(
          'Internal error occurred'
        )
        expect(sanitizeErrorMessage('undefined is not a function')).toBe('Internal error occurred')
        expect(sanitizeErrorMessage('null is not an object')).toBe('Internal error occurred')
      })

      it('should replace chrome API errors', () => {
        const error = 'chrome.runtime.sendMessage failed'
        const result = sanitizeErrorMessage(error)
        expect(result).toBe('Extension error')
      })
    })

    describe('sensitive pattern detection', () => {
      it('should redact memory addresses', () => {
        const error = 'Object at 0x7fff5fbff8e0 is invalid'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('0x7fff5fbff8e0')
      })

      it('should redact internal IPs', () => {
        const error = 'Connection refused to 192.168.1.100'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('192.168.1.100')
      })

      it('should redact localhost URLs', () => {
        const error = 'Failed to connect to localhost:3000'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('localhost:3000')
      })

      it('should redact potential API keys', () => {
        const error = 'Invalid key: sk_test_1234567890abcdefghijklmnop'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).not.toContain('1234567890abcdefghijklmnop')
      })
    })

    describe('generic fallback messages', () => {
      it('should use network generic for network errors', () => {
        const error = 'ECONNREFUSED at /path/to/internal/file.ts:42'
        const result = sanitizeErrorMessage(error, { category: 'network' })
        expect(result).toBe('A network error occurred. Please try again.')
      })

      it('should use authentication generic for auth errors', () => {
        // Message with internal path pattern triggers generic fallback
        const error = { message: 'Auth failed at /internal/auth/service.ts:42:5' }
        const result = sanitizeErrorMessage(error, {
          category: 'authentication',
          allowSafeMessages: false,
        })
        expect(result).toBe('Authentication failed. Please try again.')
      })

      it('should use default generic for unknown errors', () => {
        // Error with pattern that triggers containsSensitiveInfo
        const error = 'Some internal error at /path/to/internal/module.ts:42:10'
        const result = sanitizeErrorMessage(error, { allowSafeMessages: false })
        expect(result).toBe('An error occurred. Please try again.')
      })
    })

    describe('error object handling', () => {
      it('should handle Error objects', () => {
        const error = new Error('Vault is locked')
        expect(sanitizeErrorMessage(error)).toBe('Vault is locked')
      })

      it('should handle plain objects with message', () => {
        const error = { message: 'Incorrect password', code: 'WRONG_PASSWORD' }
        // By default includes error code
        expect(sanitizeErrorMessage(error)).toBe('Incorrect password (WRONG_PASSWORD)')
        // Can exclude error code
        expect(sanitizeErrorMessage(error, { includeErrorCode: false })).toBe('Incorrect password')
      })

      it('should handle plain objects with error property', () => {
        const error = { error: 'Permission denied' }
        expect(sanitizeErrorMessage(error)).toBe('Permission denied')
      })

      it('should handle unknown types', () => {
        expect(sanitizeErrorMessage(null)).toBe('Unknown error')
        expect(sanitizeErrorMessage(undefined)).toBe('Unknown error')
        expect(sanitizeErrorMessage(123)).toBe('Unknown error')
      })
    })
  })

  describe('createSanitizedError', () => {
    it('should create Error with sanitized message', () => {
      const error = createSanitizedError('Vault is locked')
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Vault is locked')
    })

    it('should preserve error code', () => {
      const original = { message: 'User rejected', code: 4001 }
      const error = createSanitizedError(original)
      expect((error as Error & { code: number }).code).toBe('4001')
    })
  })

  describe('withSanitizedErrors', () => {
    it('should pass through successful results', async () => {
      const fn = async (x: number) => x * 2
      const wrapped = withSanitizedErrors(fn)
      expect(await wrapped(5)).toBe(10)
    })

    it('should sanitize thrown errors', async () => {
      const fn = async () => {
        throw new Error('Error at /Users/john/secret/path.ts:42')
      }
      const wrapped = withSanitizedErrors(fn)

      await expect(wrapped()).rejects.toThrow()
      try {
        await wrapped()
      } catch (error) {
        expect((error as Error).message).not.toContain('/Users/john')
      }
    })

    it('should sanitize known error types', async () => {
      const fn = async () => {
        throw new Error('Failed to fetch')
      }
      const wrapped = withSanitizedErrors(fn)

      await expect(wrapped()).rejects.toThrow('Network request failed')
    })
  })
})
