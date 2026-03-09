import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react'
import { RegistryClient } from '../client'
import type { RegistryClientOptions } from '../types'

const RegistryContext = createContext<RegistryClient | null>(null)

export interface RegistryProviderProps {
  readonly options: RegistryClientOptions
  readonly children: ReactNode
}

export function RegistryProvider({ options, children }: RegistryProviderProps) {
  const clientRef = useRef<RegistryClient | null>(null)
  const initialOptionsRef = useRef(options)

  if (!clientRef.current) {
    clientRef.current = new RegistryClient(options)
  }

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      (options.url !== initialOptionsRef.current.url ||
        options.apiKey !== initialOptionsRef.current.apiKey)
    ) {
      console.warn(
        '[@stablenet/registry-client] RegistryProvider options changed after initial render. ' +
          'The client is not recreated on options change. ' +
          'To use a new configuration, remount the provider with a different key prop.'
      )
    }
  }, [options.url, options.apiKey])

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect()
    }
  }, [])

  return <RegistryContext.Provider value={clientRef.current}>{children}</RegistryContext.Provider>
}

export function useRegistryClient(): RegistryClient {
  const client = useContext(RegistryContext)
  if (!client) {
    throw new Error('useRegistryClient must be used within a RegistryProvider')
  }
  return client
}
