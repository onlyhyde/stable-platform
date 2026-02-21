# StableNet Transaction Format Reference

This document describes the exact encoding formats used in StableNet's ERC-4337 transaction pipeline, from building execution calldata through signing and submitting UserOperations.

## 1. Kernel v3 Execute Function

Kernel v3 smart accounts use the ERC-7579 execute interface:

```solidity
function execute(bytes32 mode, bytes calldata executionCalldata) external payable
```

### ExecMode (bytes32)

```
Byte:  0         1         2-5       6-9       10-31
       callType  execMode  unused    selector  context
       (1 byte)  (1 byte)  (4 bytes) (4 bytes) (22 bytes)
```

| Call Type | Value | Description |
|-----------|-------|-------------|
| Single    | `0x00` | Execute one call |
| Batch     | `0x01` | Execute multiple calls |
| Delegate  | `0xff` | Delegate call |

| Exec Mode | Value | Description |
|-----------|-------|-------------|
| Default   | `0x00` | Revert on failure |
| Try       | `0x01` | Continue on failure |

**Default single call mode**: `0x0000000000000000000000000000000000000000000000000000000000000000`

## 2. Single Call Packed Encoding

Kernel v3 uses Solady's `LibERC7579.decodeSingle()` which expects **`abi.encodePacked`**, NOT `abi.encode`:

```
abi.encodePacked(address target, uint256 value, bytes callData)
```

| Offset | Size | Field |
|--------|------|-------|
| 0      | 20 bytes | `target` — raw address, NOT padded to 32 |
| 20     | 32 bytes | `value` — uint256, left-padded |
| 52     | variable | `callData` — raw bytes, no length prefix |

### Solidity decoding (Solady LibERC7579)

```solidity
target = address(bytes20(executionData[0:20]))
value  = uint256(bytes32(executionData[20:52]))
data   = executionData[52:]
```

### TypeScript (viem)

```typescript
import { concat, pad, toHex } from 'viem'

const executionCalldata = concat([
  to,                              // 20 bytes: address (no padding)
  pad(toHex(value), { size: 32 }), // 32 bytes: uint256
  data,                            // variable: raw calldata
])
```

### Go

```go
encoded := make([]byte, 0, 20+32+len(data))
encoded = append(encoded, call.To.Bytes()...)                         // 20 bytes
encoded = append(encoded, common.LeftPadBytes(value.Bytes(), 32)...)  // 32 bytes
encoded = append(encoded, data...)                                     // variable
```

### Common mistake

Using `abi.encode(address, uint256, bytes)` pads the address to 32 bytes and adds offset/length for the bytes field, producing completely different output that will fail at the contract level.

## 3. Batch Call ABI Encoding

Batch calls use standard ABI encoding:

```solidity
abi.encode(Execution[] calldata executions)

struct Execution {
    address target;
    uint256 value;
    bytes callData;
}
```

This is standard `abi.encode` (NOT packed), since Solady's `decodeBatch()` uses `abi.decode`.

## 4. Packed UserOp RPC Format

The bundler RPC uses the "packed" v0.7 format with composite fields:

| Field | Type | Composition |
|-------|------|-------------|
| `sender` | `address` | Smart account address |
| `nonce` | `uint256` | Account nonce (Kernel v3: encodes validator info) |
| `initCode` | `bytes` | `factory (20 bytes) + factoryData` or `0x` |
| `callData` | `bytes` | `execute(mode, executionCalldata)` ABI encoded |
| `accountGasLimits` | `bytes32` | `verificationGasLimit (16 bytes) + callGasLimit (16 bytes)` |
| `preVerificationGas` | `uint256` | Pre-verification gas |
| `gasFees` | `bytes32` | `maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)` |
| `paymasterAndData` | `bytes` | `paymaster (20) + pmVerificationGas (16) + pmPostOpGas (16) + pmData` or `0x` |
| `signature` | `bytes` | Validator-specific signature |

### TypeScript (SDK)

```typescript
import { packUserOperation } from '@stablenet/core'

const packed = packUserOperation(userOp) // UserOperation → PackedUserOperation
```

### Go (SDK)

```go
import "github.com/stablenet/sdk-go/core/userop"

packed := userop.Pack(userOp) // *UserOperation → *PackedUserOperation
```

## 5. EIP-712 UserOp Hash (EntryPoint v0.9)

The EntryPoint v0.9 uses EIP-712 typed data hashing, unlike v0.7 which used a simpler format.

### Constants

```
PACKED_USEROP_TYPEHASH = keccak256(
  "PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,
   bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)"
)

EIP712_DOMAIN_TYPEHASH = keccak256(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
)

DOMAIN_NAME = "ERC4337"
DOMAIN_VERSION = "1"
```

### Step 1: Struct Hash

```
structHash = keccak256(abi.encode(
    PACKED_USEROP_TYPEHASH,
    sender,
    nonce,
    keccak256(initCode),
    keccak256(callData),
    accountGasLimits,       // bytes32, not hashed
    preVerificationGas,
    gasFees,                // bytes32, not hashed
    keccak256(paymasterAndData)
))
```

### Step 2: Domain Separator

```
domainSeparator = keccak256(abi.encode(
    EIP712_DOMAIN_TYPEHASH,
    keccak256("ERC4337"),
    keccak256("1"),
    chainId,
    entryPointAddress
))
```

### Step 3: Final Hash

```
userOpHash = keccak256("\x19\x01" + domainSeparator + structHash)
```

### TypeScript (SDK)

```typescript
import { getUserOperationHash } from '@stablenet/core'

const hash = getUserOperationHash(userOp, entryPointAddress, chainId)
```

### Go (SDK)

```go
import "github.com/stablenet/sdk-go/core/userop"

hash, err := userop.GetUserOperationHash(userOp, entryPoint, chainID)
```

### v0.7 vs v0.9 difference

| Aspect | v0.7 | v0.9 |
|--------|------|------|
| Struct encoding | No TYPEHASH prefix | TYPEHASH as first field |
| Final hash | `keccak256(abi.encode(structHash, entryPoint, chainId))` | `keccak256("\x19\x01" + domainSep + structHash)` |
| Domain separator | None | EIP-712 domain with name="ERC4337", version="1" |

## 6. Kernel ECDSA Signature Format

Kernel v3 ECDSA validator expects a mode-prefixed signature:

```
signature = 0x02 + rawECDSASignature(65 bytes)
```

Where `rawECDSASignature` is an EIP-191 personal_sign over the UserOp hash:

```
rawSig = signMessage({ message: { raw: userOpHash } })
```

The `0x02` prefix tells Kernel's validation to use the ECDSA path.

### TypeScript (SDK)

```typescript
import { signUserOpForKernel } from '@stablenet/core'

const rawSig = await walletClient.signMessage({ message: { raw: userOpHash } })
const signature = signUserOpForKernel(rawSig) // prepends 0x02
```

### Go (SDK)

```go
import "github.com/stablenet/sdk-go/core/userop"

signature := userop.SignUserOpForKernel(rawSignature) // prepends 0x02
```

## 7. SDK Function Reference

### TypeScript (`@stablenet/core`)

| Function | Purpose |
|----------|---------|
| `packUserOperation(userOp)` | Convert UserOperation → PackedUserOperation for RPC |
| `unpackUserOperation(packed)` | Convert PackedUserOperation → UserOperation |
| `getUserOperationHash(userOp, entryPoint, chainId)` | Compute EIP-712 UserOp hash (v0.9) |
| `computeDomainSeparator(entryPoint, chainId)` | Compute EIP-712 domain separator |
| `signUserOpForKernel(rawSignature)` | Wrap ECDSA sig with 0x02 prefix for Kernel |

### TypeScript (`@stablenet/accounts`)

| Function | Purpose |
|----------|---------|
| `encodeKernelExecuteCallData(calls)` | Encode calls into Kernel execute calldata |

### Go (`github.com/stablenet/sdk-go/core/userop`)

| Function | Purpose |
|----------|---------|
| `Pack(userOp)` | Convert UserOperation → PackedUserOperation |
| `Unpack(packed)` | Convert PackedUserOperation → UserOperation |
| `GetUserOperationHash(userOp, entryPoint, chainID)` | Compute EIP-712 UserOp hash (v0.9) |
| `ComputeDomainSeparator(entryPoint, chainID)` | Compute EIP-712 domain separator |
| `SignUserOpForKernel(rawSignature)` | Wrap ECDSA sig with 0x02 prefix |

### Go (`github.com/stablenet/sdk-go/accounts/kernel`)

| Function | Purpose |
|----------|---------|
| `EncodeSingleCall(call)` | Encode single call with packed encoding |
| `EncodeBatchCalls(calls)` | Encode batch calls with ABI encoding |
| `EncodeKernelExecuteCallData(calls)` | Full execute calldata encoding |

## 8. Full Transaction Flow

```
1. Build execution calldata
   └─ encodeKernelExecuteCallData([{ to, value, data }])
      └─ Single: abi.encodePacked(target[20], value[32], callData)
      └─ Batch:  abi.encode(Execution[])

2. Pack UserOp for RPC
   └─ packUserOperation(userOp)
      └─ accountGasLimits = verificationGas(16) + callGas(16)
      └─ gasFees = maxPriority(16) + maxFee(16)
      └─ paymasterAndData = paymaster(20) + pmVerifGas(16) + pmPostGas(16) + pmData

3. Compute UserOp hash (EIP-712 v0.9)
   └─ getUserOperationHash(userOp, entryPoint, chainId)
      └─ structHash = keccak256(TYPEHASH + fields...)
      └─ domainSep = keccak256(DOMAIN_TYPEHASH + "ERC4337" + "1" + chainId + entryPoint)
      └─ hash = keccak256("\x19\x01" + domainSep + structHash)

4. Sign for Kernel ECDSA validator
   └─ rawSig = signMessage({ message: { raw: hash } })
   └─ signature = signUserOpForKernel(rawSig) → 0x02 + rawSig

5. Submit to bundler
   └─ eth_sendUserOperation([packedUserOp, entryPoint])
```
