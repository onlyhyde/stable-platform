# StableNet Wallet - Architecture Diagrams

> Version: 1.0.0
> Last Updated: 2026-01-30

Visual documentation of the StableNet Wallet architecture.

---

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Message Flow](#message-flow)
- [Component Architecture](#component-architecture)
- [Security Model](#security-model)
- [State Management](#state-management)
- [Approval Flow](#approval-flow)

---

## High-Level Architecture

### Extension Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                                 │
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Popup     │    │  Approval   │    │  Options    │                 │
│  │    UI       │    │   Popup     │    │   Page      │                 │
│  │  (React)    │    │  (React)    │    │  (React)    │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            │                                            │
│                   chrome.runtime.sendMessage                            │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Background Service Worker                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   Keyring   │  │   Wallet    │  │   Approval  │              │   │
│  │  │ Controller  │  │   State     │  │ Controller  │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   Network   │  │    RPC      │  │   Token     │              │   │
│  │  │ Controller  │  │  Handler    │  │ Controller  │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                            │                                            │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
              chrome.runtime.sendMessage
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Web Page (dApp)                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Content Script                                │   │
│  │                  (Message Bridge)                                │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                           │
│                    window.postMessage                                   │
│                             │                                           │
│                             ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Inpage Script                                 │   │
│  │              (EIP-1193 Provider)                                 │   │
│  │           window.stablenet / window.ethereum                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                             ▲                                           │
│                             │                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    dApp JavaScript                               │   │
│  │              (ethers.js / viem / web3.js)                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Message Flow

### RPC Request Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   dApp   │     │  Inpage  │     │ Content  │     │Background│
│          │     │  Script  │     │  Script  │     │ Worker   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ request()      │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │ postMessage    │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │ sendMessage    │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │        ┌───────┴───────┐
     │                │                │        │ Validate Origin│
     │                │                │        │ Rate Limit     │
     │                │                │        │ Handle RPC     │
     │                │                │        └───────┬───────┘
     │                │                │                │
     │                │                │   response     │
     │                │                │<───────────────│
     │                │                │                │
     │                │  postMessage   │                │
     │                │<───────────────│                │
     │                │                │                │
     │   Promise      │                │                │
     │<───────────────│                │                │
     │   resolved     │                │                │
     │                │                │                │
```

### User Approval Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   dApp   │     │Background│     │ Approval │     │   User   │
│          │     │ Worker   │     │  Popup   │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ eth_sendTx     │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │ Create         │                │
     │                │ Approval       │                │
     │                │ Request        │                │
     │                │                │                │
     │                │ Open Popup     │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │  Display       │
     │                │                │  Transaction   │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │    Approve/    │
     │                │                │    Reject      │
     │                │                │<───────────────│
     │                │                │                │
     │                │  Approval      │                │
     │                │  Response      │                │
     │                │<───────────────│                │
     │                │                │                │
     │                │ Sign & Submit  │                │
     │                │ (if approved)  │                │
     │                │                │                │
     │   tx hash      │                │                │
     │<───────────────│                │                │
     │   or error     │                │                │
     │                │                │                │
```

---

## Component Architecture

### Background Service Worker

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Background Service Worker                           │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Message Handler                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │ │
│  │  │ Origin      │  │ Rate        │  │ Input       │                 │ │
│  │  │ Validator   │──│ Limiter     │──│ Validator   │                 │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│                               │                                          │
│                               ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         RPC Handler                                 │ │
│  │                                                                     │ │
│  │  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  │ Method Router                                                  │ │ │
│  │  │  ├─ eth_requestAccounts  → ApprovalController                 │ │ │
│  │  │  ├─ eth_sendTransaction  → ApprovalController → KeyringCtrl   │ │ │
│  │  │  ├─ personal_sign        → ApprovalController → KeyringCtrl   │ │ │
│  │  │  ├─ eth_signTypedData_v4 → TypedDataValidator → ApprovalCtrl  │ │ │
│  │  │  ├─ eth_chainId          → NetworkController                  │ │ │
│  │  │  ├─ eth_accounts         → WalletState                        │ │ │
│  │  │  ├─ eth_call             → RPC Proxy                          │ │ │
│  │  │  └─ ...                                                       │ │ │
│  │  └───────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │   Keyring      │  │   Approval     │  │   Network      │             │
│  │   Controller   │  │   Controller   │  │   Controller   │             │
│  │                │  │                │  │                │             │
│  │ - HDKeyring    │  │ - Pending      │  │ - Networks[]   │             │
│  │ - SimpleKeyring│  │   Requests     │  │ - Selected     │             │
│  │ - Vault        │  │ - Popup Mgmt   │  │ - RPC Client   │             │
│  │ - SessionCrypto│  │ - Timeout      │  │                │             │
│  └────────────────┘  └────────────────┘  └────────────────┘             │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │   Wallet       │  │   Token        │  │   GasFee       │             │
│  │   State        │  │   Controller   │  │   Controller   │             │
│  │                │  │                │  │                │             │
│  │ - Accounts     │  │ - Token List   │  │ - Estimation   │             │
│  │ - Connected    │  │ - Balances     │  │ - EIP-1559     │             │
│  │   Sites        │  │ - Transfers    │  │ - History      │             │
│  │ - Settings     │  │                │  │                │             │
│  └────────────────┘  └────────────────┘  └────────────────┘             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Keyring Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Keyring Controller                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                            Vault                                    │ │
│  │                                                                     │ │
│  │   ┌─────────────────────────────────────────────────────────────┐  │ │
│  │   │                 Encrypted Storage                            │  │ │
│  │   │                                                              │  │ │
│  │   │   Password ──┬──> PBKDF2 (100k iterations)                  │  │ │
│  │   │              │                                               │  │ │
│  │   │              └──> Encryption Key                            │  │ │
│  │   │                        │                                     │  │ │
│  │   │                        ▼                                     │  │ │
│  │   │              AES-256-GCM Encryption                         │  │ │
│  │   │                        │                                     │  │ │
│  │   │                        ▼                                     │  │ │
│  │   │   ┌─────────────────────────────────────────────────────┐   │  │ │
│  │   │   │              chrome.storage.local                    │   │  │ │
│  │   │   │   { vault: "encrypted_keyring_data" }               │   │  │ │
│  │   │   └─────────────────────────────────────────────────────┘   │  │ │
│  │   │                                                              │  │ │
│  │   └─────────────────────────────────────────────────────────────┘  │ │
│  │                                                                     │ │
│  │   ┌─────────────────────────────────────────────────────────────┐  │ │
│  │   │              Session Storage (Encrypted)                     │  │ │
│  │   │                                                              │  │ │
│  │   │   Vault Salt ──> Session Key Derivation                     │  │ │
│  │   │                           │                                  │  │ │
│  │   │                           ▼                                  │  │ │
│  │   │                  AES-256-GCM Encryption                      │  │ │
│  │   │                           │                                  │  │ │
│  │   │                           ▼                                  │  │ │
│  │   │   ┌─────────────────────────────────────────────────────┐   │  │ │
│  │   │   │              chrome.storage.session                  │   │  │ │
│  │   │   │   { session: "encrypted_unlocked_state" }           │   │  │ │
│  │   │   └─────────────────────────────────────────────────────┘   │  │ │
│  │   │                                                              │  │ │
│  │   └─────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────┐    ┌────────────────────────┐               │
│  │      HD Keyring        │    │    Simple Keyring      │               │
│  │                        │    │                        │               │
│  │  Mnemonic (BIP-39)     │    │  Imported Private Keys │               │
│  │         │              │    │         │              │               │
│  │         ▼              │    │         ▼              │               │
│  │  BIP-44 Derivation     │    │  Account Management    │               │
│  │  m/44'/60'/0'/0/n      │    │                        │               │
│  │         │              │    │                        │               │
│  │         ▼              │    │                        │               │
│  │  Multiple Accounts     │    │  Single Account Each   │               │
│  │                        │    │                        │               │
│  └────────────────────────┘    └────────────────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Security Model

### Origin Validation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Origin Security Model                             │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Content Script                               │   │
│   │                                                                  │   │
│   │   dApp Origin: "https://app.example.com"                        │   │
│   │         │                                                        │   │
│   │         │  chrome.runtime.sendMessage({ type: 'RPC_REQUEST' })  │   │
│   │         │                                                        │   │
│   │         ▼                                                        │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                               │                                          │
│                               │  MessageSender object                    │
│                               │  (provided by Chrome)                    │
│                               │                                          │
│                               ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                  Background Worker                               │   │
│   │                                                                  │   │
│   │   ┌───────────────────────────────────────────────────────────┐ │   │
│   │   │                Origin Extraction                          │ │   │
│   │   │                                                           │ │   │
│   │   │   // SECURE: Extract from sender, NOT message             │ │   │
│   │   │   if (sender.tab?.url) {                                  │ │   │
│   │   │     origin = new URL(sender.tab.url).origin               │ │   │
│   │   │   }                                                       │ │   │
│   │   │                                                           │ │   │
│   │   │   // NEVER trust message.origin - can be spoofed!         │ │   │
│   │   │                                                           │ │   │
│   │   └───────────────────────────────────────────────────────────┘ │   │
│   │                               │                                  │   │
│   │                               ▼                                  │   │
│   │   ┌───────────────────────────────────────────────────────────┐ │   │
│   │   │              Permission Check                             │ │   │
│   │   │                                                           │ │   │
│   │   │   connectedSites.find(s => s.origin === origin)          │ │   │
│   │   │                                                           │ │   │
│   │   │   ✓ Has permission → Return permitted accounts           │ │   │
│   │   │   ✗ No permission  → Return [] or request approval       │ │   │
│   │   │                                                           │ │   │
│   │   └───────────────────────────────────────────────────────────┘ │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Defense in Depth                                  │
│                                                                          │
│   Layer 1: Input Validation                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  • Address validation (EIP-55 checksum)                         │   │
│   │  • Hex string validation                                        │   │
│   │  • Chain ID validation                                          │   │
│   │  • Transaction parameter validation                             │   │
│   │  • Typed data structure validation                              │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Layer 2: Rate Limiting                                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  • Per-origin request limits                                    │   │
│   │  • Method-specific limits (signing: 10/min, read: 100/min)     │   │
│   │  • Cooldown periods for rejected requests                       │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Layer 3: Risk Analysis                                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  • Transaction risk scoring                                     │   │
│   │  • Unlimited approval detection                                 │   │
│   │  • NFT setApprovalForAll warning                               │   │
│   │  • High gas price detection                                     │   │
│   │  • Typed data domain validation                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Layer 4: User Approval                                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  • Connection approval with origin display                      │   │
│   │  • Transaction approval with risk warnings                      │   │
│   │  • Signature approval with message preview                      │   │
│   │  • Network change confirmation                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Layer 5: Audit Logging                                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  • Security events logging                                      │   │
│   │  • Transaction audit trail                                      │   │
│   │  • Permission changes                                           │   │
│   │  • Failed authentication attempts                               │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## State Management

### State Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         State Architecture                               │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    chrome.storage.local                          │   │
│   │                    (Persistent Storage)                          │   │
│   │                                                                  │   │
│   │   {                                                              │   │
│   │     vault: "encrypted_keyring_data",                            │   │
│   │     walletState: {                                              │   │
│   │       accounts: [...],                                          │   │
│   │       selectedAccount: "0x...",                                 │   │
│   │       connectedSites: [...],                                    │   │
│   │       networks: [...],                                          │   │
│   │       selectedNetwork: 1,                                       │   │
│   │       settings: {...}                                           │   │
│   │     }                                                           │   │
│   │   }                                                              │   │
│   │                                                                  │   │
│   └───────────────────────────┬─────────────────────────────────────┘   │
│                               │                                          │
│                               │  Load on startup                         │
│                               ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Background Memory                             │   │
│   │                    (Runtime State)                               │   │
│   │                                                                  │   │
│   │   WalletState                                                   │   │
│   │     │                                                           │   │
│   │     ├── getState()                                             │   │
│   │     ├── subscribe(listener) ─────────────────────┐             │   │
│   │     ├── selectAccount(address)                   │             │   │
│   │     ├── addConnectedSite(site)                   │             │   │
│   │     └── ...                                       │             │   │
│   │                                                   │             │   │
│   └───────────────────────────────────────────────────┼─────────────┘   │
│                                                       │                  │
│                       State Changes                   │                  │
│                               │                       │                  │
│           ┌───────────────────┴───────────────────┐   │                  │
│           │                                       │   │                  │
│           ▼                                       ▼   │                  │
│   ┌───────────────┐                       ┌───────────────┐             │
│   │    Persist    │                       │   Broadcast   │             │
│   │   to Storage  │                       │   to UIs      │             │
│   └───────────────┘                       └───────┬───────┘             │
│                                                   │                      │
│           ┌───────────────────────────────────────┘                      │
│           │                                                              │
│           ▼                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                       UI Components                              │   │
│   │                                                                  │   │
│   │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │   │
│   │   │ Popup   │   │ Approval│   │ Options │   │ Inpage  │        │   │
│   │   │   UI    │   │  Popup  │   │  Page   │   │Provider │        │   │
│   │   └─────────┘   └─────────┘   └─────────┘   └─────────┘        │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Approval Flow

### Connection Approval

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Connection Flow                                    │
│                                                                          │
│   ┌─────────┐                                                            │
│   │  dApp   │  eth_requestAccounts                                       │
│   └────┬────┘                                                            │
│        │                                                                  │
│        ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Is origin already connected?                                    │   │
│   │                                                                  │   │
│   │     YES ─────────────────────────────────────────────────────┐  │   │
│   │                                                               │  │   │
│   │     NO                                                        │  │   │
│   │      │                                                        │  │   │
│   │      ▼                                                        │  │   │
│   │   ┌────────────────────────────────────────────────────────┐ │  │   │
│   │   │              Create Approval Request                    │ │  │   │
│   │   │                                                         │ │  │   │
│   │   │   {                                                     │ │  │   │
│   │   │     id: "random-uuid",                                  │ │  │   │
│   │   │     type: "connect",                                    │ │  │   │
│   │   │     origin: "https://app.example.com",                  │ │  │   │
│   │   │     favicon: "https://app.example.com/icon.png",        │ │  │   │
│   │   │     status: "pending",                                  │ │  │   │
│   │   │     expiresAt: Date.now() + 300000                      │ │  │   │
│   │   │   }                                                     │ │  │   │
│   │   │                                                         │ │  │   │
│   │   └────────────────────────────────────────────────────────┘ │  │   │
│   │      │                                                        │  │   │
│   │      ▼                                                        │  │   │
│   │   ┌────────────────────────────────────────────────────────┐ │  │   │
│   │   │              Open Approval Popup                        │ │  │   │
│   │   │                                                         │ │  │   │
│   │   │   ┌──────────────────────────────────────────────────┐ │ │  │   │
│   │   │   │           Connect to app.example.com             │ │ │  │   │
│   │   │   │                                                  │ │ │  │   │
│   │   │   │   This site wants to:                           │ │ │  │   │
│   │   │   │   • View your wallet addresses                  │ │ │  │   │
│   │   │   │                                                  │ │ │  │   │
│   │   │   │   Select accounts:                              │ │ │  │   │
│   │   │   │   ☑ 0x1234...5678 (Main)                       │ │ │  │   │
│   │   │   │   ☐ 0xabcd...efgh (Trading)                    │ │ │  │   │
│   │   │   │                                                  │ │ │  │   │
│   │   │   │   [Cancel]              [Connect]               │ │ │  │   │
│   │   │   └──────────────────────────────────────────────────┘ │ │  │   │
│   │   │                                                         │ │  │   │
│   │   └────────────────────────────────────────────────────────┘ │  │   │
│   │      │                                        │               │  │   │
│   │      │ Cancel                                 │ Connect       │  │   │
│   │      ▼                                        ▼               │  │   │
│   │   ┌────────────┐                      ┌────────────┐         │  │   │
│   │   │   Reject   │                      │  Approve   │         │  │   │
│   │   │  (4001)    │                      │            │         │  │   │
│   │   └────────────┘                      └─────┬──────┘         │  │   │
│   │                                             │                 │  │   │
│   │                                             ▼                 │  │   │
│   │                                     Save to connectedSites    │  │   │
│   │                                             │                 │  │   │
│   └─────────────────────────────────────────────┼─────────────────┘  │   │
│                                                 │                     │   │
│                                                 ▼                     │   │
│                                   Return selected accounts ◄─────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Transaction Approval

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       Transaction Approval Flow                           │
│                                                                          │
│   eth_sendTransaction                                                    │
│         │                                                                 │
│         ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Risk Analysis                                 │   │
│   │                                                                  │   │
│   │   ┌─────────────────────────────────────────────────────────┐   │   │
│   │   │  Check Transaction Type                                  │   │   │
│   │   │                                                          │   │   │
│   │   │  • Native transfer (ETH)                                │   │   │
│   │   │  • Contract interaction                                  │   │   │
│   │   │  • Contract deployment                                   │   │   │
│   │   │  • Token approval                                        │   │   │
│   │   │  • Token transfer                                        │   │   │
│   │   └─────────────────────────────────────────────────────────┘   │   │
│   │                          │                                       │   │
│   │                          ▼                                       │   │
│   │   ┌─────────────────────────────────────────────────────────┐   │   │
│   │   │  Analyze Risks                                           │   │   │
│   │   │                                                          │   │   │
│   │   │  ⚠ High value (>10 ETH)                                 │   │   │
│   │   │  ⚠ Unlimited token approval                             │   │   │
│   │   │  ⚠ Sending to zero address                              │   │   │
│   │   │  ⚠ NFT setApprovalForAll                                │   │   │
│   │   │  ⚠ High gas price (>100 gwei)                           │   │   │
│   │   │                                                          │   │   │
│   │   └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                  Approval Popup                                  │   │
│   │                                                                  │   │
│   │   ┌──────────────────────────────────────────────────────────┐  │   │
│   │   │   ⚠ HIGH RISK TRANSACTION                                │  │   │
│   │   │                                                          │  │   │
│   │   │   From: 0x1234...5678                                    │  │   │
│   │   │   To:   0xabcd...efgh (Uniswap Router)                  │  │   │
│   │   │                                                          │  │   │
│   │   │   Action: Approve USDC                                   │  │   │
│   │   │   Amount: UNLIMITED ⚠                                   │  │   │
│   │   │                                                          │  │   │
│   │   │   ┌────────────────────────────────────────────────────┐│  │   │
│   │   │   │ ⚠ This allows unlimited spending of your USDC     ││  │   │
│   │   │   │   Consider approving only the needed amount        ││  │   │
│   │   │   └────────────────────────────────────────────────────┘│  │   │
│   │   │                                                          │  │   │
│   │   │   Est. Gas: 0.002 ETH (~$5.00)                          │  │   │
│   │   │                                                          │  │   │
│   │   │   [Reject]                     [Approve]                │  │   │
│   │   └──────────────────────────────────────────────────────────┘  │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                          │                                               │
│                          │ Approved                                      │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Sign & Submit                                │   │
│   │                                                                  │   │
│   │   Keyring.signTransaction(address, txParams)                    │   │
│   │         │                                                        │   │
│   │         ▼                                                        │   │
│   │   eth_sendRawTransaction → RPC Node                             │   │
│   │         │                                                        │   │
│   │         ▼                                                        │   │
│   │   Return txHash                                                  │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
apps/wallet-extension/
├── src/
│   ├── background/                 # Service Worker
│   │   ├── index.ts               # Entry point, message handler
│   │   ├── controllers/           # Business logic
│   │   │   ├── approvalController.ts
│   │   │   ├── networkController.ts
│   │   │   ├── tokenController.ts
│   │   │   └── gasFeeController.ts
│   │   ├── keyring/               # Key management
│   │   │   ├── vault.ts           # Encrypted storage
│   │   │   ├── hdKeyring.ts       # BIP-44 HD wallet
│   │   │   ├── simpleKeyring.ts   # Imported keys
│   │   │   └── sessionCrypto.ts   # Session encryption
│   │   ├── rpc/                   # RPC handling
│   │   │   └── handler.ts         # Method router
│   │   └── state/                 # State management
│   │       └── walletState.ts
│   │
│   ├── contentscript/             # Content Script
│   │   └── index.ts               # Message bridge
│   │
│   ├── inpage/                    # Injected Script
│   │   └── index.ts               # EIP-1193 Provider
│   │
│   ├── ui/                        # Popup UI (React)
│   │   ├── App.tsx
│   │   ├── pages/
│   │   └── components/
│   │
│   ├── approval/                  # Approval Popup (React)
│   │   ├── App.tsx
│   │   └── pages/
│   │       ├── ConnectApproval.tsx
│   │       ├── SignatureApproval.tsx
│   │       └── TransactionApproval.tsx
│   │
│   ├── shared/                    # Shared utilities
│   │   ├── security/              # Security modules
│   │   │   ├── inputValidator.ts
│   │   │   ├── rateLimiter.ts
│   │   │   ├── errorSanitizer.ts
│   │   │   └── auditLogger.ts
│   │   └── utils/
│   │
│   └── types/                     # TypeScript types
│
├── tests/                         # Test suites
│   └── unit/
│
├── e2e/                          # E2E tests
│   └── tests/
│
└── docs/                         # Documentation
    ├── ARCHITECTURE.md
    ├── ARCHITECTURE_DIAGRAM.md
    ├── API_REFERENCE.md
    └── DAPP_DEVELOPER_GUIDE.md
```

---

## See Also

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [dApp Developer Guide](./DAPP_DEVELOPER_GUIDE.md) - Integration tutorial
- [Architecture](./ARCHITECTURE.md) - Detailed architecture documentation
