# StableNet Wallet - dApp Developer Guide

> Version: 1.0.0
> Last Updated: 2026-01-30

A comprehensive guide for integrating StableNet Wallet into your decentralized application.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation & Detection](#installation--detection)
- [Connecting to the Wallet](#connecting-to-the-wallet)
- [Handling Account Changes](#handling-account-changes)
- [Sending Transactions](#sending-transactions)
- [Signing Messages](#signing-messages)
- [Network Management](#network-management)
- [TypeScript Integration](#typescript-integration)
- [React Integration](#react-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Detect the Provider

```javascript
function getProvider() {
  if (typeof window.stablenet !== 'undefined') {
    return window.stablenet;
  }

  // Fallback: check for EIP-6963 announcement
  // or redirect to wallet installation page
  window.open('https://stablenet.dev/wallet', '_blank');
  return null;
}
```

### 2. Connect to Wallet

```javascript
async function connect() {
  const provider = getProvider();
  if (!provider) return;

  try {
    const accounts = await provider.request({
      method: 'eth_requestAccounts'
    });
    console.log('Connected:', accounts[0]);
    return accounts[0];
  } catch (error) {
    if (error.code === 4001) {
      console.log('User rejected connection');
    }
  }
}
```

### 3. Send a Transaction

```javascript
async function sendETH(to, amountInEth) {
  const provider = getProvider();
  const [from] = await provider.request({ method: 'eth_accounts' });

  const weiValue = '0x' + (BigInt(amountInEth * 1e18)).toString(16);

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to,
      value: weiValue
    }]
  });

  console.log('Transaction sent:', txHash);
  return txHash;
}
```

---

## Installation & Detection

### Detecting StableNet Wallet

StableNet Wallet injects its provider at `window.stablenet`. For better UX, implement detection with fallback:

```javascript
class WalletConnection {
  constructor() {
    this.provider = null;
    this.account = null;
  }

  async detect() {
    // Wait for provider injection (page load)
    if (document.readyState !== 'complete') {
      await new Promise(resolve =>
        window.addEventListener('load', resolve, { once: true })
      );
    }

    // Check for StableNet
    if (window.stablenet) {
      this.provider = window.stablenet;
      return { installed: true, provider: this.provider };
    }

    return { installed: false, provider: null };
  }

  getInstallUrl() {
    return 'https://stablenet.dev/wallet';
  }
}
```

### EIP-6963 Multi-Wallet Detection

For applications supporting multiple wallets:

```javascript
const wallets = [];

window.addEventListener('eip6963:announceProvider', (event) => {
  const { info, provider } = event.detail;

  wallets.push({
    uuid: info.uuid,
    name: info.name,
    icon: info.icon,
    rdns: info.rdns,
    provider
  });

  // Check for StableNet
  if (info.rdns === 'dev.stablenet.wallet') {
    console.log('StableNet Wallet detected via EIP-6963');
  }
});

// Request wallet announcements
window.dispatchEvent(new Event('eip6963:requestProvider'));
```

---

## Connecting to the Wallet

### Basic Connection

```javascript
async function connectWallet() {
  const provider = window.stablenet;

  if (!provider) {
    throw new Error('StableNet Wallet not installed');
  }

  try {
    // Request account access
    const accounts = await provider.request({
      method: 'eth_requestAccounts'
    });

    // Get current chain
    const chainId = await provider.request({
      method: 'eth_chainId'
    });

    return {
      account: accounts[0],
      chainId: parseInt(chainId, 16)
    };
  } catch (error) {
    handleConnectionError(error);
    throw error;
  }
}

function handleConnectionError(error) {
  switch (error.code) {
    case 4001:
      // User rejected - don't spam, show connect button
      console.log('Connection rejected by user');
      break;
    case 4100:
      // Not authorized - wallet may be locked
      console.log('Wallet is locked');
      break;
    default:
      console.error('Connection error:', error.message);
  }
}
```

### Check Existing Connection

```javascript
async function checkConnection() {
  const provider = window.stablenet;
  if (!provider) return null;

  // eth_accounts doesn't trigger popup if already connected
  const accounts = await provider.request({
    method: 'eth_accounts'
  });

  if (accounts.length > 0) {
    return accounts[0];
  }

  return null;
}

// Auto-reconnect on page load
window.addEventListener('load', async () => {
  const account = await checkConnection();
  if (account) {
    console.log('Already connected:', account);
    updateUI(account);
  }
});
```

---

## Handling Account Changes

Always listen for account and chain changes to keep your UI in sync:

```javascript
class WalletManager {
  constructor() {
    this.provider = window.stablenet;
    this.account = null;
    this.chainId = null;
    this.listeners = new Set();
  }

  init() {
    if (!this.provider) return;

    // Account changes
    this.provider.on('accountsChanged', (accounts) => {
      this.account = accounts[0] || null;
      this.emit('accountChanged', this.account);

      if (!this.account) {
        // User disconnected
        this.emit('disconnected');
      }
    });

    // Chain changes
    this.provider.on('chainChanged', (chainId) => {
      this.chainId = parseInt(chainId, 16);
      this.emit('chainChanged', this.chainId);

      // Recommended: reload to reset state
      // window.location.reload();
    });

    // Connection events
    this.provider.on('connect', (info) => {
      this.chainId = parseInt(info.chainId, 16);
      this.emit('connected', this.chainId);
    });

    this.provider.on('disconnect', (error) => {
      this.account = null;
      this.emit('disconnected', error);
    });
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }
}
```

---

## Sending Transactions

### Simple ETH Transfer

```javascript
async function sendEther(to, amountEth) {
  const provider = window.stablenet;
  const [from] = await provider.request({ method: 'eth_accounts' });

  // Convert ETH to Wei (hex)
  const weiValue = BigInt(Math.floor(amountEth * 1e18));
  const hexValue = '0x' + weiValue.toString(16);

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to,
      value: hexValue
    }]
  });

  return txHash;
}
```

### ERC-20 Token Transfer

```javascript
async function transferToken(tokenAddress, to, amount, decimals = 18) {
  const provider = window.stablenet;
  const [from] = await provider.request({ method: 'eth_accounts' });

  // ERC-20 transfer(address,uint256) selector
  const selector = '0xa9059cbb';

  // Encode parameters
  const toParam = to.slice(2).padStart(64, '0');
  const amountWei = BigInt(amount * (10 ** decimals));
  const amountParam = amountWei.toString(16).padStart(64, '0');

  const data = selector + toParam + amountParam;

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: tokenAddress,
      data
    }]
  });

  return txHash;
}
```

### Contract Interaction with ethers.js

```javascript
import { ethers } from 'ethers';

async function interactWithContract() {
  // Wrap StableNet provider with ethers
  const provider = new ethers.BrowserProvider(window.stablenet);
  const signer = await provider.getSigner();

  // Contract interaction
  const contract = new ethers.Contract(
    '0xContractAddress',
    ['function mint(uint256 amount) payable'],
    signer
  );

  const tx = await contract.mint(1, {
    value: ethers.parseEther('0.1')
  });

  console.log('Transaction hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('Confirmed in block:', receipt.blockNumber);
}
```

### Transaction with Gas Estimation

```javascript
async function sendTransactionWithGas(txParams) {
  const provider = window.stablenet;

  // Estimate gas
  const gasEstimate = await provider.request({
    method: 'eth_estimateGas',
    params: [txParams]
  });

  // Get current gas price (EIP-1559)
  const feeData = await provider.request({
    method: 'eth_feeHistory',
    params: ['0x1', 'latest', [50]]
  });

  const baseFee = BigInt(feeData.baseFeePerGas[0]);
  const priorityFee = BigInt('1500000000'); // 1.5 gwei

  // Add 20% buffer to gas estimate
  const gasLimit = BigInt(gasEstimate) * 120n / 100n;

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      ...txParams,
      gas: '0x' + gasLimit.toString(16),
      maxFeePerGas: '0x' + (baseFee * 2n + priorityFee).toString(16),
      maxPriorityFeePerGas: '0x' + priorityFee.toString(16)
    }]
  });

  return txHash;
}
```

---

## Signing Messages

### Personal Sign (EIP-191)

Used for authentication and off-chain signatures:

```javascript
async function signMessage(message) {
  const provider = window.stablenet;
  const [account] = await provider.request({ method: 'eth_accounts' });

  // Convert message to hex
  const hexMessage = '0x' + Buffer.from(message).toString('hex');
  // Or: '0x' + Array.from(new TextEncoder().encode(message))
  //            .map(b => b.toString(16).padStart(2, '0')).join('')

  const signature = await provider.request({
    method: 'personal_sign',
    params: [hexMessage, account]
  });

  return signature;
}

// Verification example (server-side with ethers)
import { verifyMessage } from 'ethers';

function verifySignature(message, signature, expectedAddress) {
  const recoveredAddress = verifyMessage(message, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}
```

### Sign-In With Ethereum (SIWE)

```javascript
import { SiweMessage } from 'siwe';

async function signInWithEthereum() {
  const provider = window.stablenet;
  const [address] = await provider.request({ method: 'eth_accounts' });
  const chainId = await provider.request({ method: 'eth_chainId' });

  // Create SIWE message
  const siweMessage = new SiweMessage({
    domain: window.location.host,
    address,
    statement: 'Sign in to My dApp',
    uri: window.location.origin,
    version: '1',
    chainId: parseInt(chainId, 16),
    nonce: generateNonce(), // Get from your server
    issuedAt: new Date().toISOString()
  });

  const message = siweMessage.prepareMessage();

  // Sign the message
  const signature = await provider.request({
    method: 'personal_sign',
    params: ['0x' + Buffer.from(message).toString('hex'), address]
  });

  // Send to server for verification
  return { message, signature };
}
```

### Typed Data Signing (EIP-712)

For structured data like permits and orders:

```javascript
async function signPermit(tokenAddress, spender, value, deadline) {
  const provider = window.stablenet;
  const [owner] = await provider.request({ method: 'eth_accounts' });
  const chainId = await provider.request({ method: 'eth_chainId' });

  // Get nonce from token contract
  const nonce = await getPermitNonce(tokenAddress, owner);

  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    primaryType: 'Permit',
    domain: {
      name: 'Token Name',
      version: '1',
      chainId: parseInt(chainId, 16),
      verifyingContract: tokenAddress
    },
    message: {
      owner,
      spender,
      value: value.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString()
    }
  };

  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [owner, JSON.stringify(typedData)]
  });

  // Split signature for contract
  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  return { v, r, s, deadline, signature };
}
```

---

## Network Management

### Get Current Network

```javascript
async function getCurrentNetwork() {
  const provider = window.stablenet;
  const chainId = await provider.request({ method: 'eth_chainId' });

  const networks = {
    '0x1': { name: 'Ethereum Mainnet', currency: 'ETH' },
    '0x89': { name: 'Polygon', currency: 'MATIC' },
    '0xa4b1': { name: 'Arbitrum One', currency: 'ETH' },
    '0xa': { name: 'Optimism', currency: 'ETH' },
    '0x2105': { name: 'Base', currency: 'ETH' }
  };

  return networks[chainId] || { name: 'Unknown', chainId };
}
```

### Switch Network

```javascript
async function switchToPolygon() {
  const provider = window.stablenet;
  const polygonChainId = '0x89';

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: polygonChainId }]
    });
  } catch (error) {
    // Chain not added - add it
    if (error.code === 4902) {
      await addPolygonNetwork();
    } else {
      throw error;
    }
  }
}

async function addPolygonNetwork() {
  const provider = window.stablenet;

  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x89',
      chainName: 'Polygon Mainnet',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com']
    }]
  });
}
```

### Ensure Correct Network

```javascript
async function ensureNetwork(requiredChainId) {
  const provider = window.stablenet;
  const currentChainId = await provider.request({ method: 'eth_chainId' });

  if (currentChainId !== requiredChainId) {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: requiredChainId }]
      });
      return true;
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Please switch to the correct network');
      }
      throw error;
    }
  }

  return true;
}
```

---

## TypeScript Integration

### Type Definitions

```typescript
// types/wallet.ts

interface RequestArguments {
  method: string;
  params?: unknown[];
}

interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}

interface ProviderConnectInfo {
  chainId: string;
}

interface EIP1193Provider {
  request(args: RequestArguments): Promise<unknown>;
  on(event: 'connect', listener: (info: ProviderConnectInfo) => void): this;
  on(event: 'disconnect', listener: (error: ProviderRpcError) => void): this;
  on(event: 'accountsChanged', listener: (accounts: string[]) => void): this;
  on(event: 'chainChanged', listener: (chainId: string) => void): this;
  removeListener(event: string, listener: (...args: unknown[]) => void): this;

  chainId: string | null;
  selectedAddress: string | null;
  isConnected: boolean;
  isStableNet?: boolean;
}

declare global {
  interface Window {
    stablenet?: EIP1193Provider;
    ethereum?: EIP1193Provider;
  }
}

export type { EIP1193Provider, RequestArguments, ProviderRpcError };
```

### Typed Wallet Hook

```typescript
// hooks/useWallet.ts
import { useState, useEffect, useCallback } from 'react';
import type { EIP1193Provider } from '../types/wallet';

interface WalletState {
  provider: EIP1193Provider | null;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    provider: null,
    account: null,
    chainId: null,
    isConnected: false,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const provider = window.stablenet;

    if (!provider) {
      setState(s => ({ ...s, isLoading: false }));
      return;
    }

    setState(s => ({ ...s, provider }));

    // Check existing connection
    provider.request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          return provider.request({ method: 'eth_chainId' })
            .then((chainId: string) => {
              setState(s => ({
                ...s,
                account: accounts[0],
                chainId: parseInt(chainId, 16),
                isConnected: true,
                isLoading: false
              }));
            });
        }
        setState(s => ({ ...s, isLoading: false }));
      })
      .catch((error: Error) => {
        setState(s => ({ ...s, error, isLoading: false }));
      });

    // Event listeners
    const handleAccountsChanged = (accounts: string[]) => {
      setState(s => ({
        ...s,
        account: accounts[0] || null,
        isConnected: accounts.length > 0
      }));
    };

    const handleChainChanged = (chainId: string) => {
      setState(s => ({ ...s, chainId: parseInt(chainId, 16) }));
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!state.provider) {
      throw new Error('Wallet not installed');
    }

    const accounts = await state.provider.request({
      method: 'eth_requestAccounts'
    }) as string[];

    const chainId = await state.provider.request({
      method: 'eth_chainId'
    }) as string;

    setState(s => ({
      ...s,
      account: accounts[0],
      chainId: parseInt(chainId, 16),
      isConnected: true
    }));

    return accounts[0];
  }, [state.provider]);

  const disconnect = useCallback(() => {
    setState(s => ({
      ...s,
      account: null,
      isConnected: false
    }));
  }, []);

  return { ...state, connect, disconnect };
}
```

---

## React Integration

### WalletProvider Context

```tsx
// contexts/WalletContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useWallet } from '../hooks/useWallet';

interface WalletContextType {
  provider: any;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<string>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return context;
}
```

### Connect Button Component

```tsx
// components/ConnectButton.tsx
import React from 'react';
import { useWalletContext } from '../contexts/WalletContext';

export function ConnectButton() {
  const { account, isConnected, isLoading, connect, disconnect } = useWalletContext();

  if (isLoading) {
    return <button disabled>Loading...</button>;
  }

  if (isConnected && account) {
    return (
      <div className="wallet-info">
        <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <button onClick={connect}>
      Connect Wallet
    </button>
  );
}
```

---

## Best Practices

### 1. Always Handle Errors

```javascript
async function safeRequest(method, params) {
  try {
    return await window.stablenet.request({ method, params });
  } catch (error) {
    // Log for debugging
    console.error(`${method} failed:`, error);

    // User-friendly messages
    const messages = {
      4001: 'Request was rejected',
      4100: 'Please unlock your wallet',
      4902: 'Network not configured',
      '-32002': 'Request already pending'
    };

    throw new Error(messages[error.code] || error.message);
  }
}
```

### 2. Don't Spam Connection Requests

```javascript
// BAD: Requests on every page load
useEffect(() => {
  window.stablenet.request({ method: 'eth_requestAccounts' });
}, []);

// GOOD: Only request on user action
function ConnectButton() {
  const [account, setAccount] = useState(null);

  // Check existing connection silently
  useEffect(() => {
    window.stablenet?.request({ method: 'eth_accounts' })
      .then(accounts => setAccount(accounts[0]));
  }, []);

  // Only popup on click
  const connect = () => {
    window.stablenet.request({ method: 'eth_requestAccounts' })
      .then(accounts => setAccount(accounts[0]));
  };

  return account
    ? <span>{account}</span>
    : <button onClick={connect}>Connect</button>;
}
```

### 3. Handle Chain Changes Properly

```javascript
// Recommended: Reload on chain change
window.stablenet.on('chainChanged', () => {
  window.location.reload();
});

// Alternative: Update state carefully
window.stablenet.on('chainChanged', async (chainId) => {
  // Clear cached data
  clearContractInstances();
  clearCachedBalances();

  // Reinitialize with new chain
  await initializeForChain(parseInt(chainId, 16));
});
```

### 4. Validate Addresses

```javascript
import { isAddress, getAddress } from 'ethers';

function validateAddress(address) {
  if (!isAddress(address)) {
    throw new Error('Invalid address format');
  }
  // Return checksummed address
  return getAddress(address);
}
```

### 5. Use Appropriate Gas Settings

```javascript
// Let wallet estimate when possible
const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{
    from,
    to,
    value,
    // Don't set gas - let wallet estimate
  }]
});

// Only override for specific needs
const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{
    from,
    to,
    data,
    gas: '0x' + (300000).toString(16), // Complex contract call
  }]
});
```

---

## Troubleshooting

### Common Issues

#### "Wallet not installed"

```javascript
if (!window.stablenet) {
  // Show install prompt
  showInstallModal();
  return;
}
```

#### "User rejected request" (4001)

This is normal user behavior - handle gracefully:

```javascript
try {
  await connect();
} catch (error) {
  if (error.code === 4001) {
    // Don't show error - user chose to reject
    return;
  }
  showError(error.message);
}
```

#### "Request already pending" (-32002)

```javascript
// Prevent duplicate requests
let pendingRequest = null;

async function connect() {
  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = window.stablenet.request({
    method: 'eth_requestAccounts'
  });

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}
```

#### Chain ID Mismatch

```javascript
// Ensure correct chain before transaction
const chainId = await provider.request({ method: 'eth_chainId' });
if (chainId !== EXPECTED_CHAIN_ID) {
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: EXPECTED_CHAIN_ID }]
  });
}
```

### Debug Mode

```javascript
// Enable verbose logging
window.stablenet.on('connect', (info) => {
  console.log('[Wallet] Connected:', info);
});

window.stablenet.on('disconnect', (error) => {
  console.log('[Wallet] Disconnected:', error);
});

window.stablenet.on('accountsChanged', (accounts) => {
  console.log('[Wallet] Accounts changed:', accounts);
});

window.stablenet.on('chainChanged', (chainId) => {
  console.log('[Wallet] Chain changed:', chainId);
});
```

---

## See Also

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Architecture](./ARCHITECTURE.md) - Technical architecture
- [EIP-1193 Spec](https://eips.ethereum.org/EIPS/eip-1193)
- [ethers.js Documentation](https://docs.ethers.org/)
- [viem Documentation](https://viem.sh/)
