# StableNet Go SDK

Go SDK for [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) Account Abstraction, providing a Go implementation of the StableNet platform. Build applications with smart accounts, modular modules (ERC-7579), stealth addresses (EIP-5564), and multi-mode transaction routing (EOA / EIP-7702 / Smart Account).

## Features

- **ERC-4337 v0.7**: Full UserOperation building, packing, hashing, and signing
- **Kernel v3 Smart Account**: ERC-7579 modular smart account with ECDSA validator
- **Multi-Mode Transactions**: Strategy-based routing across EOA, EIP-7702 delegate, and Smart Account modes
- **ERC-7579 Module System**: Registry with 15+ built-in modules (validators, executors, hooks, fallbacks)
- **Bundler Client**: Send, estimate gas, and monitor UserOperations via JSON-RPC
- **Paymaster Client**: Gas sponsorship, ERC-20 token payment, and Permit2 paymaster support
- **Stealth Addresses**: EIP-5564/6538 privacy-preserving one-time addresses
- **EIP-7702 Support**: Type-4 delegation transactions with authorization lifecycle
- **Security Layer**: Input validation, transaction risk analysis, phishing detection, signature verification, rate limiting
- **Multi-Chain Support**: Contract address resolution for Ethereum, Polygon, StableNet, and testnets
- **Crypto Abstraction**: Pluggable crypto providers (go-ethereum included)
- **Plugin Architecture**: Session keys, subscriptions, DeFi integrations, stealth addresses

## Installation

```bash
go get github.com/stablenet/sdk-go
```

**Requirements**: Go 1.24+, go-ethereum v1.17.0

## Quick Start

### Create a Bundler Client

```go
package main

import (
    "context"
    "log"

    "github.com/stablenet/sdk-go/core"
    "github.com/stablenet/sdk-go/core/bundler"
)

func main() {
    ctx := context.Background()

    client := bundler.NewClient(bundler.ClientConfig{
        URL:        "https://bundler.example.com",
        EntryPoint: core.EntryPointV07Address,
    })

    entryPoints, err := client.GetSupportedEntryPoints(ctx)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Supported EntryPoints: %v", entryPoints)

    chainID, err := client.GetChainID(ctx)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Chain ID: %d", chainID)
}
```

### Build and Send a UserOperation

```go
package main

import (
    "context"
    "log"
    "math/big"

    "github.com/ethereum/go-ethereum/common"

    "github.com/stablenet/sdk-go/core"
    "github.com/stablenet/sdk-go/core/bundler"
    "github.com/stablenet/sdk-go/core/userop"
    "github.com/stablenet/sdk-go/types"
)

func main() {
    ctx := context.Background()

    client := bundler.NewClient(bundler.ClientConfig{
        URL:        "https://bundler.sepolia.example.com",
        EntryPoint: core.EntryPointV07Address,
    })

    userOp := &types.UserOperation{
        Sender:               common.HexToAddress("0xYourSmartAccount"),
        Nonce:                big.NewInt(0),
        CallData:             types.Hex([]byte{/* encoded call */}),
        CallGasLimit:         big.NewInt(100000),
        VerificationGasLimit: big.NewInt(100000),
        PreVerificationGas:   big.NewInt(50000),
        MaxFeePerGas:         big.NewInt(1000000000),
        MaxPriorityFeePerGas: big.NewInt(100000000),
        Signature:            types.Hex([]byte{/* signature */}),
    }

    hash, err := userop.GetUserOperationHash(
        userOp,
        core.EntryPointV07Address,
        big.NewInt(11155111), // Sepolia
    )
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("UserOp Hash: %s", hash.Hex())

    opHash, err := client.SendUserOperation(ctx, userOp)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Submitted: %s", opHash.Hex())

    receipt, err := client.WaitForUserOperationReceipt(ctx, opHash, nil)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Success: %v, Gas Used: %s", receipt.Success, receipt.ActualGasUsed)
}
```

### Create a Kernel Smart Account

```go
package main

import (
    "context"
    "log"

    "github.com/ethereum/go-ethereum/ethclient"
    ethcrypto "github.com/ethereum/go-ethereum/crypto"

    "github.com/stablenet/sdk-go/accounts/kernel"
)

func main() {
    ctx := context.Background()

    client, err := ethclient.DialContext(ctx, "https://rpc.sepolia.example.com")
    if err != nil {
        log.Fatal(err)
    }

    privateKey, err := ethcrypto.HexToECDSA("your-private-key-hex")
    if err != nil {
        log.Fatal(err)
    }

    validator, err := kernel.NewECDSAValidator(kernel.ECDSAValidatorConfig{
        PrivateKey:       privateKey,
        ValidatorAddress: yourValidatorAddress,
    })
    if err != nil {
        log.Fatal(err)
    }

    account, err := kernel.NewAccount(ctx, kernel.AccountConfig{
        Client:    client,
        Validator: validator,
        Index:     0,
    })
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Smart Account: %s", account.Address().Hex())
    deployed, _ := account.IsDeployed(ctx)
    log.Printf("Deployed: %v", deployed)
}
```

### Multi-Mode Transaction Routing

```go
package main

import (
    "context"
    "log"

    "github.com/stablenet/sdk-go/transaction"
    "github.com/stablenet/sdk-go/types"
)

func main() {
    ctx := context.Background()

    // Register strategies
    registry := transaction.NewRegistry()
    // registry.Register(eoaStrategy)
    // registry.Register(smartAccountStrategy)
    // registry.Register(eip7702Strategy)

    router := transaction.NewRouter(registry)

    // Route auto-selects the best strategy for the account type
    result, err := router.Route(ctx, &types.MultiModeTransactionRequest{
        Mode: types.TransactionModeSmartAccount,
        To:    targetAddress,
        Value: value,
        Data:  callData,
    }, account, signer, nil)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("TX Hash: %s", result.Hash.Hex())
}
```

### Use Paymaster for Gas Sponsorship

```go
import "github.com/stablenet/sdk-go/core/paymaster"

pm := paymaster.NewClient(paymaster.ClientConfig{
    URL:     "https://paymaster.sepolia.example.com",
    ChainID: types.ChainIDSepolia,
    APIKey:  "your-api-key",
})

pmData, err := pm.GetSponsoredPaymasterData(ctx, partialOp)
if err != nil {
    log.Fatal(err)
}
log.Printf("Paymaster: %s", pmData.Paymaster.Hex())
```

### Stealth Addresses (EIP-5564)

```go
import (
    stealthcrypto "github.com/stablenet/sdk-go/plugins/stealth/crypto"
    "github.com/stablenet/sdk-go/plugins/stealth/actions"
)

// Generate stealth keys
keys, err := stealthcrypto.GenerateStealthKeys()
uri, _ := stealthcrypto.EncodeStealthMetaAddressURI("eth", keys.Spending.PublicKey, keys.Viewing.PublicKey)

// Generate a one-time stealth address for the recipient
result, _ := actions.GenerateStealthAddress(actions.GenerateStealthAddressParams{
    StealthMetaAddressURI: uri,
})
// Send funds to result.StealthAddress, then announce
```

### Contract Address Resolution

```go
addrs, err := addresses.GetChainAddresses(types.ChainIDSepolia)
if err != nil {
    log.Fatal(err)
}
log.Printf("EntryPoint: %s", addrs.Core.EntryPoint.Hex())
log.Printf("ECDSA Validator: %s", addrs.Validators.ECDSAValidator.Hex())

urls, _ := addresses.GetServiceURLs(types.ChainIDSepolia)
log.Printf("Bundler: %s", urls.Bundler)
```

## Architecture

### Package Dependency Graph

```
sdk.go (root facade)
 |
 +-- types/              (base types: Address, Hash, Hex, UserOperation)
 |
 +-- crypto/             (CryptoProvider interface)
 |   +-- geth/           (go-ethereum implementation)
 |
 +-- addresses/          (per-chain contract address registry)
 +-- errors/             (structured SDK errors with codes)
 +-- eip7702/            (EIP-7702 authorization lifecycle)
 |
 +-- accounts/           (SmartAccount + Validator interfaces)
 |   +-- kernel/         (Kernel v3 implementation)
 |
 +-- modules/            (ERC-7579 module registry)
 |   +-- config/         (15+ built-in module definitions)
 |   +-- utils/          (init data encoders)
 |   +-- client/         (on-chain query + operation client)
 |
 +-- transaction/        (Strategy pattern router)
 |   +-- strategies/     (EOA, SmartAccount, EIP7702)
 |
 +-- core/
 |   +-- bundler/        (ERC-4337 bundler RPC client)
 |   +-- paymaster/      (paymaster RPC client)
 |   +-- rpc/            (JSON-RPC utilities)
 |   +-- userop/         (UserOp hash, pack, validation)
 |
 +-- security/           (5-layer protection)
 +-- plugins/            (independent feature plugins)
 +-- clients/            (high-level orchestrating clients)
 +-- config/             (gas config, client config)
 +-- gas/                (gas estimation)
```

### Design Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Strategy** | `transaction/` | Multi-mode TX routing (EOA/EIP-7702/SmartAccount) |
| **Registry** | `transaction/`, `modules/` | Strategy and module discovery |
| **Factory** | `accounts/kernel/` | `NewAccount()` with CREATE2 address derivation |
| **Facade** | `crypto/interfaces.go` | `CryptoProvider` composing 4 sub-interfaces |
| **Builder** | `transaction/router.go` | Fluent `TransactionBuilder` API |
| **Observer** | `core/bundler/` | Polling-based receipt waiting |

### Security Layer

The `security/` package provides five independent protection mechanisms:

| Component | File | Purpose |
|-----------|------|---------|
| Input Validation | `input_validator.go` | Address/hex/chainID/transaction/RPC validation |
| Transaction Risk | `transaction_risk.go` | Static calldata analysis (approvals, suspicious selectors) |
| Phishing Detection | `phishing.go` | URL analysis (homograph, typosquatting, suspicious TLDs) |
| Signature Verification | `signature_verifier.go` | EIP-191/712/1271 aware verification |
| Rate Limiting | `rate_limiter.go` | Per-category sliding window + token bucket |

### ERC-7579 Module Catalog

**Validators**: ECDSA, WebAuthn, Multi-ECDSA
**Executors**: Session Key, Recurring Payment, Swap, Staking, Lending
**Hooks**: Spending Limit, Audit, Whitelist, Timelock
**Fallbacks**: Token Receiver, Flash Loan Receiver, ERC-777 Receiver

### Plugin System

| Plugin | Package | Standard |
|--------|---------|----------|
| Stealth Addresses | `plugins/stealth/` | EIP-5564 / EIP-6538 |
| Session Keys | `plugins/sessionkeys/` | ERC-7579 Executor |
| Subscriptions | `plugins/subscription/` | Recurring Payment Executor |
| DeFi | `plugins/defi/` | Swap/Staking/Lending |
| Paymaster | `plugins/paymaster/` | Sponsor/Verifying/Permit2 |
| ECDSA Validator | `plugins/ecdsa/` | ERC-7579 Validator |
| Module Management | `plugins/modules/` | Install/Uninstall modules |

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| StableNet | 8283 | Active |
| Sepolia | 11155111 | Active |
| Polygon Amoy | 80002 | Partial |
| Ethereum Mainnet | 1 | Coming Soon |
| Local (Anvil) | 31337 | Development |

## Standards Implemented

- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) v0.7 - Account Abstraction
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) - Modular Smart Accounts
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) - EOA Delegation (Type-4 TX)
- [EIP-5564](https://eips.ethereum.org/EIPS/eip-5564) - Stealth Addresses
- [EIP-6538](https://eips.ethereum.org/EIPS/eip-6538) - Stealth Meta-Address Registry
- [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) - Contract Signature Validation
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) - Typed Structured Data Hashing
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) - Personal Message Signing
- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) - Fee Market (gas pricing)

## License

MIT
