import type { WebSocket } from 'ws'
import type { ContractEntry, ResolvedAddressSet } from '../../store/types'
import { type ServerMessage, serializeMessage } from './protocol'

interface ClientState {
  readonly socket: WebSocket
  readonly channels: Set<string>
}

export class ChannelManager {
  private clients = new Map<WebSocket, ClientState>()

  addClient(socket: WebSocket): void {
    this.clients.set(socket, { socket, channels: new Set() })
  }

  removeClient(socket: WebSocket): void {
    this.clients.delete(socket)
  }

  subscribe(socket: WebSocket, channels: string[]): string[] {
    const state = this.clients.get(socket)
    if (!state) return []

    const added: string[] = []
    for (const ch of channels) {
      if (!state.channels.has(ch)) {
        state.channels.add(ch)
        added.push(ch)
      }
    }
    return added
  }

  unsubscribe(socket: WebSocket, channels: string[]): string[] {
    const state = this.clients.get(socket)
    if (!state) return []

    const removed: string[] = []
    for (const ch of channels) {
      if (state.channels.delete(ch)) {
        removed.push(ch)
      }
    }
    return removed
  }

  broadcastContractUpdate(entry: ContractEntry): void {
    const msg: ServerMessage = { type: 'contract:updated', data: entry }
    const channels = [
      'contracts:*',
      `contracts:${entry.chainId}`,
      `contracts:${entry.chainId}:${entry.name}`,
    ]
    this.broadcast(channels, msg)
  }

  broadcastContractDelete(chainId: number, name: string): void {
    const msg: ServerMessage = { type: 'contract:deleted', chainId, name }
    const channels = ['contracts:*', `contracts:${chainId}`, `contracts:${chainId}:${name}`]
    this.broadcast(channels, msg)
  }

  broadcastSetUpdate(resolved: ResolvedAddressSet): void {
    const msg: ServerMessage = { type: 'set:updated', data: resolved }
    const channels = [`sets:${resolved.chainId}:${resolved.name}`]
    this.broadcast(channels, msg)
  }

  broadcastSetDelete(chainId: number, name: string): void {
    const msg: ServerMessage = { type: 'set:deleted', chainId, name }
    const channels = [`sets:${chainId}:${name}`]
    this.broadcast(channels, msg)
  }

  get clientCount(): number {
    return this.clients.size
  }

  private broadcast(channels: string[], msg: ServerMessage): void {
    const serialized = serializeMessage(msg)

    for (const [, state] of this.clients) {
      const matches = channels.some((ch) => state.channels.has(ch))
      if (matches && state.socket.readyState === 1) {
        state.socket.send(serialized)
      }
    }
  }
}
