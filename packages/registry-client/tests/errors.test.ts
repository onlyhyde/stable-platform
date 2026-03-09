import { describe, expect, it } from 'vitest'
import {
  ConnectionTimeoutError,
  RegistryClientError,
  ValidationError,
  WebSocketError,
} from '../src/errors'

describe('RegistryClientError', () => {
  it('sets name correctly', () => {
    const err = new RegistryClientError('test', 400)
    expect(err.name).toBe('RegistryClientError')
    expect(err.message).toBe('test')
    expect(err.statusCode).toBe(400)
  })

  it('isNotFound for 404', () => {
    const err = new RegistryClientError('not found', 404)
    expect(err.isNotFound).toBe(true)
    expect(err.isUnauthorized).toBe(false)
    expect(err.isForbidden).toBe(false)
    expect(err.isServerError).toBe(false)
  })

  it('isUnauthorized for 401', () => {
    const err = new RegistryClientError('unauthorized', 401)
    expect(err.isUnauthorized).toBe(true)
  })

  it('isForbidden for 403', () => {
    const err = new RegistryClientError('forbidden', 403)
    expect(err.isForbidden).toBe(true)
  })

  it('isServerError for 5xx', () => {
    expect(new RegistryClientError('err', 500).isServerError).toBe(true)
    expect(new RegistryClientError('err', 502).isServerError).toBe(true)
    expect(new RegistryClientError('err', 503).isServerError).toBe(true)
  })

  it('stores errorCode and details', () => {
    const err = new RegistryClientError('test', 400, 'INVALID_INPUT', { field: 'name' })
    expect(err.errorCode).toBe('INVALID_INPUT')
    expect(err.details).toEqual({ field: 'name' })
  })

  it('defaults details to empty object', () => {
    const err = new RegistryClientError('test', 400)
    expect(err.details).toEqual({})
  })

  it('is instanceof Error', () => {
    const err = new RegistryClientError('test', 400)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(RegistryClientError)
  })
})

describe('WebSocketError', () => {
  it('sets name correctly', () => {
    const err = new WebSocketError('connection failed')
    expect(err.name).toBe('WebSocketError')
    expect(err.message).toBe('connection failed')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('ValidationError', () => {
  it('sets name correctly', () => {
    const err = new ValidationError('invalid input')
    expect(err.name).toBe('ValidationError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('ConnectionTimeoutError', () => {
  it('formats timeout message', () => {
    const err = new ConnectionTimeoutError(5000)
    expect(err.name).toBe('ConnectionTimeoutError')
    expect(err.message).toBe('WebSocket connection timed out after 5000ms')
    expect(err).toBeInstanceOf(WebSocketError)
    expect(err).toBeInstanceOf(Error)
  })
})
