import type { EIP1193Provider } from '../src/types'

/**
 * Create a mock EIP-1193 provider for testing
 */
export function createMockProvider(
  overrides: Partial<Record<string, unknown>> = {}
): EIP1193Provider & { _listeners: Map<string, Set<(...args: unknown[]) => void>> } {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  const provider: EIP1193Provider & {
    _listeners: Map<string, Set<(...args: unknown[]) => void>>
    _emit: (event: string, ...args: unknown[]) => void
  } = {
    _listeners: listeners,

    _emit(event: string, ...args: unknown[]) {
      const handlers = listeners.get(event)
      if (handlers) {
        for (const handler of handlers) {
          handler(...args)
        }
      }
    },

    async request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T> {
      const { method, params } = args

      // Check overrides first (allows tests to override any method)
      if (overrides[method] !== undefined) {
        const override = overrides[method]
        if (typeof override === 'function') {
          return (override as (params?: unknown[] | object) => T)(params)
        }
        return override as T
      }

      switch (method) {
        case 'eth_requestAccounts':
          return ['0x1234567890abcdef1234567890abcdef12345678'] as unknown as T
        case 'eth_accounts':
          return ['0x1234567890abcdef1234567890abcdef12345678'] as unknown as T
        case 'eth_chainId':
          return '0x1' as unknown as T
        case 'eth_getBalance':
          return '0xde0b6b3a7640000' as unknown as T // 1 ETH
        case 'eth_blockNumber':
          return '0x100' as unknown as T
        case 'eth_sendTransaction':
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as unknown as T
        case 'eth_getTransactionReceipt':
          return {
            blockNumber: '0xff',
            status: '0x1',
            gasUsed: '0x5208',
          } as unknown as T
        case 'personal_sign':
          return '0xsignature' as unknown as T
        case 'eth_signTypedData_v4':
          return '0xtypedsignature' as unknown as T
        case 'wallet_switchEthereumChain':
          return null as unknown as T
        case 'wallet_requestPermissions':
          return [
            {
              parentCapability: 'eth_accounts',
              date: Date.now(),
              id: 'perm-1',
              invoker: 'https://example.com',
            },
          ] as unknown as T
        case 'wallet_getPermissions':
          return [
            {
              parentCapability: 'eth_accounts',
              date: Date.now(),
              id: 'perm-1',
              invoker: 'https://example.com',
            },
          ] as unknown as T
        case 'wallet_revokePermissions':
          return null as unknown as T
        case 'eth_call':
          return '0x' as unknown as T
        default:
          throw new Error(`Unsupported method: ${method}`)
      }
    },

    on(event: string, listener: (...args: unknown[]) => void): void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(listener)
    },

    removeListener(event: string, listener: (...args: unknown[]) => void): void {
      listeners.get(event)?.delete(listener)
    },

    isStableNet: true,
  }

  return provider
}

/**
 * Utility to flush microtasks/promises in tests
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
