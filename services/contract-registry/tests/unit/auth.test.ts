import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthHook } from '../../src/server/middleware/auth'

describe('Auth Middleware', () => {
  const mockReply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass through when no API key is configured', async () => {
    const hook = createAuthHook(undefined)
    const mockRequest = { headers: {} }

    const result = await hook(mockRequest as unknown, mockReply as unknown)

    expect(result).toBeUndefined()
    expect(mockReply.status).not.toHaveBeenCalled()
  })

  it('should allow request with valid API key', async () => {
    const hook = createAuthHook('test-api-key')
    const mockRequest = { headers: { 'x-api-key': 'test-api-key' } }

    const result = await hook(mockRequest as unknown, mockReply as unknown)

    expect(result).toBeUndefined()
    expect(mockReply.status).not.toHaveBeenCalled()
  })

  it('should reject request with invalid API key', async () => {
    const hook = createAuthHook('test-api-key')
    const mockRequest = { headers: { 'x-api-key': 'wrong-key' } }

    await hook(mockRequest as unknown, mockReply as unknown)

    expect(mockReply.status).toHaveBeenCalledWith(401)
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    })
  })

  it('should reject request with missing API key', async () => {
    const hook = createAuthHook('test-api-key')
    const mockRequest = { headers: {} }

    await hook(mockRequest as unknown, mockReply as unknown)

    expect(mockReply.status).toHaveBeenCalledWith(401)
  })
})
