import type { ContractEntry, ResolvedAddressSet } from '../../store/types'

export type ClientMessage =
  | { type: 'subscribe'; channels: string[] }
  | { type: 'unsubscribe'; channels: string[] }
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'subscribed'; channels: string[] }
  | { type: 'unsubscribed'; channels: string[] }
  | { type: 'contract:updated'; data: ContractEntry }
  | { type: 'contract:deleted'; chainId: number; name: string }
  | { type: 'set:updated'; data: ResolvedAddressSet }
  | { type: 'set:deleted'; chainId: number; name: string }
  | { type: 'pong' }
  | { type: 'error'; message: string }

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw) as ClientMessage
    if (!msg || typeof msg !== 'object' || !msg.type) return null

    switch (msg.type) {
      case 'subscribe':
      case 'unsubscribe':
        if (!Array.isArray(msg.channels)) return null
        return msg
      case 'ping':
        return msg
      default:
        return null
    }
  } catch {
    return null
  }
}

export function serializeMessage(msg: ServerMessage): string {
  return JSON.stringify(msg)
}
