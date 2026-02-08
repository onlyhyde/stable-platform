import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import type { Logger } from '../../utils/logger'
import type { ChannelManager } from './channels'
import { parseClientMessage, serializeMessage } from './protocol'

export function setupWebSocket(
  app: FastifyInstance,
  channelManager: ChannelManager,
  logger: Logger
) {
  const wsLogger = logger.child({ module: 'websocket' })

  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    channelManager.addClient(socket)
    wsLogger.debug({ clients: channelManager.clientCount }, 'Client connected')

    socket.on('message', (raw) => {
      const msg = parseClientMessage(String(raw))
      if (!msg) {
        socket.send(serializeMessage({ type: 'error', message: 'Invalid message format' }))
        return
      }

      switch (msg.type) {
        case 'subscribe': {
          const added = channelManager.subscribe(socket, msg.channels)
          socket.send(serializeMessage({ type: 'subscribed', channels: added }))
          wsLogger.debug({ channels: added }, 'Client subscribed')
          break
        }
        case 'unsubscribe': {
          const removed = channelManager.unsubscribe(socket, msg.channels)
          socket.send(serializeMessage({ type: 'unsubscribed', channels: removed }))
          wsLogger.debug({ channels: removed }, 'Client unsubscribed')
          break
        }
        case 'ping': {
          socket.send(serializeMessage({ type: 'pong' }))
          break
        }
      }
    })

    socket.on('close', () => {
      channelManager.removeClient(socket)
      wsLogger.debug({ clients: channelManager.clientCount }, 'Client disconnected')
    })

    socket.on('error', (err) => {
      wsLogger.warn({ error: err.message }, 'WebSocket error')
      channelManager.removeClient(socket)
    })
  })
}
