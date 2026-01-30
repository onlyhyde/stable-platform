# StableNet Wallet - API Reference

> Version: 1.0.0
> Last Updated: 2026-01-30

This document provides a complete reference for all RPC methods and APIs supported by StableNet Wallet.

---

## Table of Contents

- [Provider Access](#provider-access)
- [Connection Methods](#connection-methods)
- [Account Methods](#account-methods)
- [Signing Methods](#signing-methods)
- [Transaction Methods](#transaction-methods)
- [Network Methods](#network-methods)
- [Read-Only Methods](#read-only-methods)
- [UserOperation Methods (ERC-4337)](#useroperation-methods-erc-4337)
- [Permission Methods](#permission-methods)
- [Events](#events)
- [Error Codes](#error-codes)

---

## Provider Access

StableNet Wallet injects an EIP-1193 compatible provider into web pages.

```javascript
// Primary access
const provider = window.stablenet;

// MetaMask compatibility mode (if enabled)
const provider = window.ethereum;

// Check if StableNet is available
if (typeof window.stablenet !== 'undefined') {
  console.log('StableNet Wallet is installed!');
}
```

### Provider Properties

| Property | Type | Description |
|----------|------|-------------|
| `chainId` | `string \| null` | Current chain ID in hex (e.g., `"0x1"`) |
| `selectedAddress` | `string \| null` | Currently selected account address |
| `isConnected` | `boolean` | Whether the provider is connected |
| `isStableNet` | `boolean` | Always `true` for StableNet |

---

## Connection Methods

### eth_requestAccounts

Requests user permission to connect the dApp to the wallet.

```javascript
const accounts = await provider.request({
  method: 'eth_requestAccounts'
});
// Returns: ['0x1234...', '0x5678...']
```

**Returns**: `string[]` - Array of connected account addresses

**User Approval**: Required (shows connection popup)

---

## Account Methods

### eth_accounts

Returns the list of accounts the dApp is permitted to access.

```javascript
const accounts = await provider.request({
  method: 'eth_accounts'
});
// Returns: ['0x1234...'] or [] if not connected
```

**Returns**: `string[]` - Array of permitted account addresses

**User Approval**: Not required

> **Note**: Returns empty array if the user has not connected. Use `eth_requestAccounts` to request connection.

---

## Signing Methods

### personal_sign

Signs a message with the user's private key using EIP-191.

```javascript
const message = 'Hello, StableNet!';
const hexMessage = '0x' + Buffer.from(message).toString('hex');

const signature = await provider.request({
  method: 'personal_sign',
  params: [hexMessage, account]
});
```

**Parameters**:
| Index | Type | Description |
|-------|------|-------------|
| 0 | `string` | Message to sign (hex-encoded with `0x` prefix) |
| 1 | `string` | Account address to sign with |

**Returns**: `string` - Signature in hex format

**User Approval**: Required (shows signature popup with message preview)

---

### eth_signTypedData_v4

Signs typed structured data according to EIP-712.

```javascript
const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' }
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' }
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' }
    ]
  },
  primaryType: 'Mail',
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
  },
  message: {
    from: { name: 'Alice', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
    to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
    contents: 'Hello, Bob!'
  }
};

const signature = await provider.request({
  method: 'eth_signTypedData_v4',
  params: [account, JSON.stringify(typedData)]
});
```

**Parameters**:
| Index | Type | Description |
|-------|------|-------------|
| 0 | `string` | Account address to sign with |
| 1 | `string` | Typed data as JSON string |

**Returns**: `string` - Signature in hex format

**User Approval**: Required (shows typed data preview with domain validation)

**Security Features**:
- Domain validation (chain ID mismatch warning)
- Verifying contract verification
- Risk assessment for token approvals

---

## Transaction Methods

### eth_sendTransaction

Sends a transaction to the network.

```javascript
const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{
    from: '0x1234...',
    to: '0x5678...',
    value: '0xDE0B6B3A7640000', // 1 ETH in wei (hex)
    data: '0x',                 // Optional: contract call data
    gas: '0x5208',              // Optional: gas limit
    maxFeePerGas: '0x3B9ACA00', // Optional: EIP-1559
    maxPriorityFeePerGas: '0x3B9ACA00' // Optional: EIP-1559
  }]
});
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `string` | Yes | Sender address |
| `to` | `string` | No | Recipient address (omit for contract deployment) |
| `value` | `string` | No | Amount in wei (hex) |
| `data` | `string` | No | Contract call data |
| `gas` | `string` | No | Gas limit (hex) |
| `gasPrice` | `string` | No | Gas price in wei (legacy) |
| `maxFeePerGas` | `string` | No | Max fee per gas (EIP-1559) |
| `maxPriorityFeePerGas` | `string` | No | Priority fee (EIP-1559) |
| `nonce` | `string` | No | Transaction nonce (hex) |

**Returns**: `string` - Transaction hash

**User Approval**: Required (shows transaction details with risk analysis)

**Risk Warnings**:
- High value transactions (>10 ETH)
- Contract deployments
- Token approvals (especially unlimited)
- NFT setApprovalForAll

---

## Network Methods

### eth_chainId

Returns the current chain ID.

```javascript
const chainId = await provider.request({
  method: 'eth_chainId'
});
// Returns: '0x1' for Ethereum Mainnet
```

**Returns**: `string` - Chain ID in hex format

---

### wallet_switchEthereumChain

Requests switching to a different network.

```javascript
try {
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x89' }] // Polygon
  });
} catch (error) {
  if (error.code === 4902) {
    // Chain not added, request to add it
  }
}
```

**Parameters**:
| Field | Type | Description |
|-------|------|-------------|
| `chainId` | `string` | Target chain ID in hex |

**User Approval**: Required if switching to a different network

**Error Codes**:
- `4902`: Chain not added to wallet

---

### wallet_addEthereumChain

Requests adding a new network to the wallet.

```javascript
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
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chainId` | `string` | Yes | Chain ID in hex |
| `chainName` | `string` | Yes | Human-readable name |
| `nativeCurrency` | `object` | Yes | Native token info |
| `rpcUrls` | `string[]` | Yes | RPC endpoint URLs |
| `blockExplorerUrls` | `string[]` | No | Block explorer URLs |

**User Approval**: Required

---

## Read-Only Methods

These methods do not require user approval and are proxied to the RPC node.

### eth_getBalance

```javascript
const balance = await provider.request({
  method: 'eth_getBalance',
  params: ['0x1234...', 'latest']
});
// Returns: '0xDE0B6B3A7640000' (1 ETH in wei)
```

### eth_call

```javascript
const result = await provider.request({
  method: 'eth_call',
  params: [{
    to: '0xContractAddress',
    data: '0x70a08231000000000000000000000000...' // balanceOf(address)
  }, 'latest']
});
```

### eth_blockNumber

```javascript
const blockNumber = await provider.request({
  method: 'eth_blockNumber'
});
// Returns: '0x10D4F' (hex block number)
```

### Other Read-Only Methods

- `eth_getCode` - Get contract bytecode
- `eth_getLogs` - Get event logs
- `eth_getBlockByNumber` - Get block by number
- `eth_getBlockByHash` - Get block by hash
- `eth_gasPrice` - Get current gas price
- `eth_maxPriorityFeePerGas` - Get priority fee suggestion
- `eth_feeHistory` - Get fee history
- `eth_getTransactionCount` - Get account nonce
- `eth_getTransactionReceipt` - Get transaction receipt
- `eth_estimateGas` - Estimate gas for transaction

---

## UserOperation Methods (ERC-4337)

StableNet Wallet supports Account Abstraction via ERC-4337.

### eth_sendUserOperation

```javascript
const userOpHash = await provider.request({
  method: 'eth_sendUserOperation',
  params: [
    {
      sender: '0xSmartAccountAddress',
      nonce: '0x0',
      initCode: '0x',
      callData: '0x...',
      callGasLimit: '0x5208',
      verificationGasLimit: '0x5208',
      preVerificationGas: '0x5208',
      maxFeePerGas: '0x3B9ACA00',
      maxPriorityFeePerGas: '0x3B9ACA00',
      paymasterAndData: '0x',
      signature: '0x'
    },
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' // EntryPoint
  ]
});
```

### eth_estimateUserOperationGas

Estimates gas limits for a UserOperation.

### eth_getUserOperationByHash

Gets UserOperation details by hash.

### eth_getUserOperationReceipt

Gets the receipt of a completed UserOperation.

### eth_supportedEntryPoints

Returns supported EntryPoint contract addresses.

---

## Permission Methods

### wallet_requestPermissions

```javascript
const permissions = await provider.request({
  method: 'wallet_requestPermissions',
  params: [{ eth_accounts: {} }]
});
```

### wallet_getPermissions

```javascript
const permissions = await provider.request({
  method: 'wallet_getPermissions'
});
```

---

## Events

StableNet Wallet emits EIP-1193 standard events.

### connect

Emitted when the provider connects to a chain.

```javascript
provider.on('connect', (connectInfo) => {
  console.log('Connected to chain:', connectInfo.chainId);
});
```

### disconnect

Emitted when the provider disconnects.

```javascript
provider.on('disconnect', (error) => {
  console.log('Disconnected:', error.message);
});
```

### accountsChanged

Emitted when the user's accounts change.

```javascript
provider.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    console.log('Please connect to StableNet Wallet.');
  } else {
    console.log('Active account:', accounts[0]);
  }
});
```

### chainChanged

Emitted when the connected chain changes.

```javascript
provider.on('chainChanged', (chainId) => {
  console.log('Chain changed to:', chainId);
  // Recommended: reload the page
  window.location.reload();
});
```

### Event Management

```javascript
// Add listener
provider.on('accountsChanged', handleAccountsChanged);

// Remove listener
provider.removeListener('accountsChanged', handleAccountsChanged);

// One-time listener
provider.once('connect', handleConnect);
```

---

## Error Codes

StableNet Wallet uses standard EIP-1193 and EIP-1474 error codes.

### EIP-1193 Provider Errors

| Code | Name | Description |
|------|------|-------------|
| 4001 | User Rejected | User rejected the request |
| 4100 | Unauthorized | Requested method not authorized |
| 4200 | Unsupported Method | Method not supported |
| 4900 | Disconnected | Provider disconnected |
| 4901 | Chain Disconnected | Chain disconnected |
| 4902 | Chain Not Added | Requested chain not added |

### EIP-1474 JSON-RPC Errors

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON |
| -32600 | Invalid Request | Invalid request object |
| -32601 | Method Not Found | Method does not exist |
| -32602 | Invalid Params | Invalid method parameters |
| -32603 | Internal Error | Internal JSON-RPC error |

### Error Handling Example

```javascript
try {
  await provider.request({
    method: 'eth_sendTransaction',
    params: [tx]
  });
} catch (error) {
  switch (error.code) {
    case 4001:
      console.log('User rejected the transaction');
      break;
    case 4100:
      console.log('Please connect your wallet first');
      break;
    case -32602:
      console.log('Invalid transaction parameters');
      break;
    default:
      console.log('Transaction failed:', error.message);
  }
}
```

---

## Rate Limiting

StableNet Wallet implements rate limiting to prevent abuse:

- **Signing methods**: 10 requests per minute
- **State-changing methods**: 20 requests per minute
- **Read-only methods**: 100 requests per minute

Exceeding limits returns error code `-32005` (Limit Exceeded).

---

## Legacy Methods (Deprecated)

These methods are supported for compatibility but should not be used in new code.

### enable() (Deprecated)

```javascript
// Deprecated - use eth_requestAccounts instead
const accounts = await provider.enable();
```

### send() (Deprecated)

```javascript
// Deprecated - use request() instead
provider.send('eth_accounts', (err, result) => {});
```

### sendAsync() (Deprecated)

```javascript
// Deprecated - use request() instead
provider.sendAsync({ method: 'eth_accounts' }, callback);
```

---

## See Also

- [dApp Developer Guide](./DAPP_DEVELOPER_GUIDE.md) - Integration tutorial
- [Architecture](./ARCHITECTURE.md) - Technical architecture
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) - Provider specification
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) - Typed data signing
