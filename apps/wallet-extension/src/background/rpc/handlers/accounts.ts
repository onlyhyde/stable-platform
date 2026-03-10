import {
  approvalController,
  checkOrigin,
  createRpcError,
  eventBroadcaster,
  handleApprovalError,
  RPC_ERRORS,
  type RpcHandler,
  walletState,
} from './shared'

export const accountsHandlers: Record<string, RpcHandler> = {
  /**
   * Get connected accounts
   * Returns accounts with the currently selected account first
   */
  eth_accounts: async (_params, origin) => {
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (connectedAccounts.length === 0) {
      return []
    }

    // Return connected accounts with selected account first
    const state = walletState.getState()
    const selectedAccount = state.accounts.selectedAccount

    if (selectedAccount && connectedAccounts.includes(selectedAccount)) {
      // Move selected account to first position
      const sorted = [selectedAccount, ...connectedAccounts.filter((a) => a !== selectedAccount)]
      return sorted
    }

    return connectedAccounts
  },

  /**
   * Request account connection
   * Shows approval popup for user to select accounts
   */
  eth_requestAccounts: async (_params, origin) => {
    // Phishing detection: block critical threats, warn on suspicious origins
    const phishingResult = checkOrigin(origin)
    if (!phishingResult.isSafe && phishingResult.riskLevel === 'critical') {
      throw createRpcError({
        code: RPC_ERRORS.UNAUTHORIZED.code,
        message: phishingResult.reason ?? 'This site has been identified as a phishing threat',
      })
    }

    const state = walletState.getState()

    // If already connected, return accounts with selected first
    if (walletState.isConnected(origin)) {
      const connectedAccounts = walletState.getConnectedAccounts(origin)
      const selectedAccount = state.accounts.selectedAccount

      if (selectedAccount && connectedAccounts.includes(selectedAccount)) {
        return [selectedAccount, ...connectedAccounts.filter((a) => a !== selectedAccount)]
      }
      return connectedAccounts
    }

    // If no accounts, return error
    if (state.accounts.accounts.length === 0) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Build phishing warnings for non-critical but suspicious origins
    const phishingWarnings =
      !phishingResult.isSafe && phishingResult.reason
        ? {
            warnings: [phishingResult.reason],
            riskLevel: phishingResult.riskLevel as 'low' | 'medium' | 'high',
          }
        : undefined

    // Request user approval via popup
    try {
      const result = await approvalController.requestConnect(origin, undefined, phishingWarnings)

      // Save connected site with approved accounts
      await walletState.addConnectedSite({
        origin,
        accounts: result.accounts,
        permissions: result.permissions,
        connectedAt: Date.now(),
      })

      // Get current chain ID for connect event
      const network = walletState.getCurrentNetwork()
      const chainIdHex = network ? `0x${network.chainId.toString(16)}` : '0x1'

      // Broadcast connect event (EIP-1193)
      await eventBroadcaster.broadcastConnect(origin, chainIdHex)

      // Broadcast accountsChanged with the connected accounts
      await eventBroadcaster.broadcastAccountsChanged(origin, result.accounts)

      // Return accounts with selected account first
      const selectedAccount = state.accounts.selectedAccount
      if (selectedAccount && result.accounts.includes(selectedAccount)) {
        return [selectedAccount, ...result.accounts.filter((a) => a !== selectedAccount)]
      }

      return result.accounts
    } catch (error) {
      handleApprovalError(error, { method: 'eth_requestAccounts', origin })
    }
  },
}
