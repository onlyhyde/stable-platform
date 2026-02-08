import { useEffect, useState } from 'react'
import { useRegistryClient } from '../provider'

export interface UseRegistryStatusResult {
  readonly isConnected: boolean
}

export function useRegistryStatus(): UseRegistryStatusResult {
  const client = useRegistryClient()
  const [isConnected, setIsConnected] = useState(client.isConnected)

  useEffect(() => {
    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    client.on('connected', handleConnect)
    client.on('disconnected', handleDisconnect)

    return () => {
      client.off('connected', handleConnect)
      client.off('disconnected', handleDisconnect)
    }
  }, [client])

  return { isConnected }
}
