# StableNet Go SDK

Go SDK for ERC-4337 Account Abstraction, providing a Go implementation of the StableNet TypeScript SDK.

## Features

- **ERC-4337 v0.7 Support**: Full UserOperation building, packing, and signing
- **Kernel Smart Account**: ERC-7579 modular smart account implementation
- **Bundler Client**: Send and monitor UserOperations
- **Paymaster Client**: Gas sponsorship and ERC20 payment
- **Multi-Chain Support**: Address resolution for Ethereum, Polygon, and testnets
- **Crypto Abstraction**: Pluggable crypto providers (go-ethereum included)
- **ECDSA Validator**: Built-in ECDSA signing for smart accounts

## Installation

```bash
go get github.com/stablenet/sdk-go
```

## Quick Start

### Create a Bundler Client

```go
package main

import (
    "context"
    "log"

    "github.com/stablenet/sdk-go/core"
    "github.com/stablenet/sdk-go/core/bundler"
    "github.com/stablenet/sdk-go/types"
)

func main() {
    ctx := context.Background()

    // Create bundler client
    client := bundler.NewClient(bundler.ClientConfig{
        URL:        "https://bundler.example.com",
        EntryPoint: core.EntryPointV07Address,
    })

    // Get supported entry points
    entryPoints, err := client.GetSupportedEntryPoints(ctx)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Supported EntryPoints: %v", entryPoints)

    // Get chain ID
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

    // Create bundler client
    client := bundler.NewClient(bundler.ClientConfig{
        URL:        "https://bundler.sepolia.example.com",
        EntryPoint: core.EntryPointV07Address,
    })

    // Build UserOperation
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

    // Calculate UserOperation hash
    hash, err := userop.GetUserOperationHash(
        userOp,
        core.EntryPointV07Address,
        big.NewInt(11155111), // Sepolia
    )
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("UserOp Hash: %s", hash.Hex())

    // Send UserOperation
    opHash, err := client.SendUserOperation(ctx, userOp)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Submitted UserOp: %s", opHash.Hex())

    // Wait for receipt
    receipt, err := client.WaitForUserOperationReceipt(ctx, opHash, nil)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Success: %v, Gas Used: %s", receipt.Success, receipt.ActualGasUsed)
}
```

### Use Paymaster for Gas Sponsorship

```go
package main

import (
    "context"
    "log"
    "math/big"

    "github.com/stablenet/sdk-go/core/paymaster"
    "github.com/stablenet/sdk-go/types"
)

func main() {
    ctx := context.Background()

    // Create paymaster client
    pm := paymaster.NewClient(paymaster.ClientConfig{
        URL:     "https://paymaster.sepolia.example.com",
        ChainID: types.ChainIDSepolia,
        APIKey:  "your-api-key",
    })

    // Check if service is available
    if !pm.IsAvailable(ctx) {
        log.Fatal("Paymaster service not available")
    }

    // Get sponsored paymaster data
    partialOp := &paymaster.PartialUserOperation{
        Sender:               yourSenderAddress,
        Nonce:                big.NewInt(0),
        CallData:             callData,
        CallGasLimit:         big.NewInt(100000),
        VerificationGasLimit: big.NewInt(100000),
        PreVerificationGas:   big.NewInt(50000),
        MaxFeePerGas:         big.NewInt(1000000000),
        MaxPriorityFeePerGas: big.NewInt(100000000),
    }

    pmData, err := pm.GetSponsoredPaymasterData(ctx, partialOp)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Paymaster: %s", pmData.Paymaster.Hex())
    log.Printf("Paymaster Data: %s", pmData.PaymasterData.String())
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

    // Connect to Ethereum node
    client, err := ethclient.DialContext(ctx, "https://rpc.sepolia.example.com")
    if err != nil {
        log.Fatal(err)
    }

    // Create ECDSA validator with your private key
    privateKey, err := ethcrypto.HexToECDSA("your-private-key-hex")
    if err != nil {
        log.Fatal(err)
    }

    validator, err := kernel.NewECDSAValidator(kernel.ECDSAValidatorConfig{
        PrivateKey:       privateKey,
        ValidatorAddress: yourValidatorAddress, // deployed ECDSA validator
    })
    if err != nil {
        log.Fatal(err)
    }

    // Create Kernel smart account
    account, err := kernel.NewAccount(ctx, kernel.AccountConfig{
        Client:    client,
        Validator: validator,
        Index:     0, // Account index for deterministic address
    })
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Smart Account Address: %s", account.Address().Hex())

    // Check if deployed
    deployed, err := account.IsDeployed(ctx)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Is Deployed: %v", deployed)

    // Get init code for deployment
    initCode, err := account.GetInitCode(ctx)
    if err != nil {
        log.Fatal(err)
    }
    if len(initCode) > 0 {
        log.Printf("Init Code Length: %d bytes", len(initCode))
    }
}
```

### Get Contract Addresses

```go
package main

import (
    "log"

    "github.com/stablenet/sdk-go/addresses"
    "github.com/stablenet/sdk-go/types"
)

func main() {
    // Check if chain is supported
    if !addresses.IsChainSupported(types.ChainIDSepolia) {
        log.Fatal("Chain not supported")
    }

    // Get all addresses for a chain
    addrs, err := addresses.GetChainAddresses(types.ChainIDSepolia)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("EntryPoint: %s", addrs.Core.EntryPoint.Hex())
    log.Printf("Kernel Factory: %s", addrs.Core.KernelFactory.Hex())
    log.Printf("ECDSA Validator: %s", addrs.Validators.ECDSAValidator.Hex())

    // Get service URLs
    urls, err := addresses.GetServiceURLs(types.ChainIDSepolia)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Bundler: %s", urls.Bundler)
    log.Printf("Paymaster: %s", urls.Paymaster)

    // Get default tokens
    tokens := addresses.GetDefaultTokens(types.ChainIDSepolia)
    for _, token := range tokens {
        log.Printf("Token: %s (%s)", token.Name, token.Symbol)
    }
}
```

## Package Structure

```
sdk-go/
├── accounts/        # Smart account implementations
│   ├── kernel/         # Kernel v3 smart account
│   │   ├── account.go      # Account implementation
│   │   ├── abi.go          # ABI definitions
│   │   ├── constants.go    # Kernel constants
│   │   ├── ecdsa_validator.go  # ECDSA validator
│   │   └── utils.go        # Encoding utilities
│   └── types.go        # Account types & interfaces
├── addresses/       # Contract address resolution
│   ├── addresses.go    # Address lookup functions
│   ├── generated.go    # Generated address data
│   └── types.go        # Address types
├── core/            # Core SDK functionality
│   ├── bundler/        # Bundler client
│   ├── paymaster/      # Paymaster client
│   ├── rpc/            # JSON-RPC client
│   ├── userop/         # UserOperation utilities
│   └── constants.go    # SDK constants
├── crypto/          # Crypto interfaces
│   ├── geth/           # go-ethereum implementation
│   └── interfaces.go   # Crypto interfaces
├── types/           # Core type definitions
│   ├── primitives.go   # Address, Hash, Hex
│   ├── user_operation.go
│   ├── module.go
│   ├── network.go
│   └── signature.go
├── tests/           # SDK tests
└── sdk.go           # Main package documentation
```

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum Mainnet | 1 | Coming Soon |
| Sepolia | 11155111 | ✅ |
| Polygon Amoy | 80002 | ✅ |
| Local (Anvil) | 31337 | ✅ |

## Requirements

- Go 1.22 or later
- go-ethereum v1.14.12

## License

MIT
