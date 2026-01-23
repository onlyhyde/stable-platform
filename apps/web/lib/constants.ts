import type { Address } from 'viem'

/**
 * Contract addresses by chain ID
 */
export const CONTRACT_ADDRESSES: Record<number, {
  entryPoint: Address
  accountFactory: Address
  paymaster: Address
  stealthAnnouncer: Address
  stealthRegistry: Address
}> = {
  // Devnet
  31337: {
    entryPoint: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    accountFactory: '0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c',
    paymaster: '0x2dd78fd9b8f40659af32ef98555b8b31bc97a351',
    stealthAnnouncer: '0x8fc8cfb7f7362e44e472c690a6e025b80e406458',
    stealthRegistry: '0xc7143d5ba86553c06f5730c8dc9f8187a621a8d4',
  },
  // Testnet
  11155111: {
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    accountFactory: '0x0000000000000000000000000000000000000000',
    paymaster: '0x0000000000000000000000000000000000000000',
    stealthAnnouncer: '0x0000000000000000000000000000000000000000',
    stealthRegistry: '0x0000000000000000000000000000000000000000',
  },
}

/**
 * Service URLs by chain ID
 */
export const SERVICE_URLS: Record<number, {
  bundler: string
  paymaster: string
  stealthServer: string
}> = {
  31337: {
    bundler: 'http://localhost:4337',
    paymaster: 'http://localhost:4338',
    stealthServer: 'http://localhost:4339',
  },
  11155111: {
    bundler: 'https://testnet.stablenet.io/bundler',
    paymaster: 'https://testnet.stablenet.io/paymaster',
    stealthServer: 'https://testnet.stablenet.io/stealth',
  },
}

/**
 * Default tokens by chain
 */
export const DEFAULT_TOKENS: Record<number, Array<{
  address: Address
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
}>> = {
  31337: [
    {
      address: '0x0000000000000000000000000000000000000000',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    {
      address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    },
    {
      address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
    },
  ],
  11155111: [
    {
      address: '0x0000000000000000000000000000000000000000',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  ],
}

/**
 * App configuration
 */
export const APP_CONFIG = {
  name: 'StableNet',
  description: 'StableNet Smart Account Platform',
  defaultSlippage: 0.5, // 0.5%
  maxSlippage: 50, // 50%
  txTimeout: 60000, // 60 seconds
}
