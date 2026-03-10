import { type RpcHandler, walletState } from './shared'

export const permissionsHandlers: Record<string, RpcHandler> = {
  /**
   * Request permissions from user
   */
  wallet_requestPermissions: async (params, origin, isExtension) => {
    const [requested] = (params ?? [{}]) as [Record<string, unknown>]
    const requestedMethods = Object.keys(requested)

    // EIP-2255: supported permission capabilities
    const SUPPORTED_PERMISSIONS = ['eth_accounts'] as const
    type SupportedPermission = (typeof SUPPORTED_PERMISSIONS)[number]

    const granted: Array<{
      parentCapability: string
      date: number
      caveats?: Array<{ type: string; value: unknown }>
    }> = []

    for (const method of requestedMethods) {
      if (!SUPPORTED_PERMISSIONS.includes(method as SupportedPermission)) {
        // Skip unsupported permissions — EIP-2255 allows partial grant
        continue
      }

      if (method === 'eth_accounts') {
        let connected = walletState.getConnectedAccounts(origin)

        // If not yet connected, trigger connect flow
        if (connected.length === 0) {
          // Dynamically import to avoid circular dependency
          const { accountsHandlers } = await import('./accounts')
          const handler = accountsHandlers['eth_requestAccounts']
          if (handler) {
            await handler(params, origin, isExtension)
          }
          connected = walletState.getConnectedAccounts(origin)
        }

        if (connected.length > 0) {
          granted.push({
            parentCapability: 'eth_accounts',
            date: Date.now(),
            caveats: [
              {
                type: 'restrictReturnedAccounts',
                value: connected,
              },
            ],
          })
        }
      }
    }

    return granted
  },

  /**
   * Get current permissions
   */
  wallet_getPermissions: async (_params, origin) => {
    const connected = walletState.getConnectedAccounts(origin)
    const permissions: Array<{
      parentCapability: string
      date: number
      caveats?: Array<{ type: string; value: unknown }>
    }> = []

    if (connected.length > 0) {
      permissions.push({
        parentCapability: 'eth_accounts',
        date: Date.now(),
        caveats: [
          {
            type: 'restrictReturnedAccounts',
            value: connected,
          },
        ],
      })
    }

    return permissions
  },
}
