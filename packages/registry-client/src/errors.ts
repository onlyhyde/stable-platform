export class RegistryClientError extends Error {
  readonly statusCode: number
  readonly errorCode: string | undefined
  readonly details: Record<string, unknown>

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'RegistryClientError'
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.details = details
  }

  get isNotFound(): boolean {
    return this.statusCode === 404
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401
  }

  get isForbidden(): boolean {
    return this.statusCode === 403
  }

  get isServerError(): boolean {
    return this.statusCode >= 500
  }
}

export class WebSocketError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebSocketError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ConnectionTimeoutError extends WebSocketError {
  constructor(timeoutMs: number) {
    super(`WebSocket connection timed out after ${timeoutMs}ms`)
    this.name = 'ConnectionTimeoutError'
  }
}
