# StableNet Paymaster 시스템 기술 스펙

> **버전**: 1.0.0
> **최종 수정**: 2026-02-22
> **대상 독자**: 클라이언트(지갑, dApp) 개발자, 스마트 컨트랙트 통합 엔지니어
> **표준 기반**: ERC-4337 (account-abstraction v0.9), ERC-7677 Paymaster Web Service

---

## 목차

1. [개요](#1-개요)
2. [사전 준비: Paymaster 자금 예치 (Deposit)](#2-사전-준비-paymaster-자금-예치-deposit)
3. [사전 준비: 사용자 등록 및 토큰 협상](#3-사전-준비-사용자-등록-및-토큰-협상)
4. [메시지 포맷 상세 스펙](#4-메시지-포맷-상세-스펙)
5. [전체 흐름: 단계별 상세](#5-전체-흐름-단계별-상세)
6. [Paymaster 타입별 상세 흐름](#6-paymaster-타입별-상세-흐름)
7. [정책 시스템](#7-정책-시스템)
8. [컨트랙트 주소 및 설정 참조](#8-컨트랙트-주소-및-설정-참조)

---

## 1. 개요

### 1.1 Paymaster란 무엇인가

ERC-4337 Account Abstraction에서 **Paymaster**는 사용자 대신 가스비를 지불하는 온체인 컨트랙트이다. 은행에서의 "보증인" 역할에 비유할 수 있다.

```
일반 트랜잭션:   사용자 ---(가스비 지불)---> 블록체인
Paymaster 사용:  사용자 ---(UserOp)---> Bundler ---(가스비 대납)---> EntryPoint
                                                    ^
                                        Paymaster가 가스비 보증/지불
```

사용자는 ETH 잔액이 없어도 스마트 계정을 통해 트랜잭션을 실행할 수 있다. Paymaster가 EntryPoint 컨트랙트에 예치한 자금으로 가스비를 대신 지불하기 때문이다.

> **버전 참고**: StableNet은 eth-infinitism의 `account-abstraction` **v0.9** 구현체를 사용한다. v0.9는 EIP-7702 지원과 EIP-712 기반 `getUserOpHash()` 등의 개선이 포함된다. 코드베이스의 `ENTRY_POINT_V07` 상수명은 퍼블릭 체인의 정식 배포 주소(`0x0000000071727De22E5E9d8BAf0edAc6f37da032`)에 대한 레거시 명칭이며, StableNet Local (chain 8283)은 자체 EntryPoint를 `0xEf6817fe73741A8F10088f9511c64b666a338A14`에 v0.9로 배포한다.

### 1.2 시스템 구성 요소

```
                          pm_getPaymasterStubData
                          pm_getPaymasterData
                     +--------------------------------+
                     |                                |
                     v                                |
              +-------------------+                   |
              |  Paymaster Proxy  |                   |
              |   (이 서비스)      |                   |
              +-------------------+                   |
                     |                                |
                     | Sign (off-chain)               |
                     v                                |
              +-------------------+                   |
              | Paymaster         |            +------------------+
              | Contracts (4종)   |            |   Client/Wallet  |
              +-------------------+            |  (SDK / dApp)    |
                                               +------------------+
                                                      |
                          eth_estimateUserOperationGas |
                          eth_sendUserOperation        |
                     +--------------------------------+
                     |
                     v
              +-----------+
              |  Bundler  |-----------> EntryPoint (v0.9)
              +-----------+  handleOps     |
                                           v
                                    Smart Account
```

> **핵심**: Paymaster Proxy는 Bundler와 직접 통신하지 않는다. 클라이언트가 Proxy와 Bundler에 **각각 별도로** 요청한다. Proxy는 순수한 오프체인 서명 서버이다.

### 1.3 지원 Paymaster 타입 (4종)

| 타입 | 컨트랙트 | 가스비 부담자 | 결제 수단 | 핵심 특성 |
|------|----------|-------------|-----------|----------|
| **VerifyingPaymaster** | `0xFED3...9Fc0` | 스폰서 | ETH (예치금) | 오프체인 서명 검증, 스폰서별 deposit |
| **ERC20Paymaster** | `0xaf42...d099` | 사용자 | ERC-20 토큰 | 온체인 오라클 가격, approve 필요 |
| **Permit2Paymaster** | `0x7E28...bCC0` | 사용자 | ERC-20 토큰 | EIP-712 서명, approve 불필요 |
| **SponsorPaymaster** | `0x9DeA...6580` | 스폰서 | ETH (예치금) | API 정책 기반 스폰서링 |

---

## 2. 사전 준비: Paymaster 자금 예치 (Deposit)

### 2.1 EntryPoint Deposit 메커니즘

모든 Paymaster는 작동 전에 EntryPoint 컨트랙트에 ETH를 예치해야 한다. 이 예치금이 가스비 대납의 원천이다.

```
                    depositTo(paymaster)
   운영자 -----------------------------------------> EntryPoint
   (ETH 전송)                                        |
                                                     v
                                            deposits[paymaster] += msg.value
                                                     |
                                            (UserOp 실행 시)
                                                     v
                                            deposits[paymaster] -= actualGasCost
```

**핵심 원리**: EntryPoint는 내부적으로 `mapping(address => uint256) deposits`를 유지한다. Paymaster가 UserOp의 가스비를 보증하면, 실행 후 해당 deposit에서 실제 가스비가 차감된다.

### 2.2 EntryPoint depositTo() 호출

```solidity
// EntryPoint 인터페이스
function depositTo(address account) external payable;
function balanceOf(address account) external view returns (uint256);
function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
```

**예치 실행 (cast 명령어)**:

```bash
# EntryPoint에 Paymaster deposit (예: VerifyingPaymaster에 10 ETH)
cast send 0xEf6817fe73741A8F10088f9511c64b666a338A14 \
  "depositTo(address)" \
  0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  --value 10ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

**잔액 확인**:

```bash
cast call 0xEf6817fe73741A8F10088f9511c64b666a338A14 \
  "balanceOf(address)(uint256)" \
  0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  --rpc-url http://localhost:8501
```

### 2.3 Paymaster 타입별 예치 상세

#### VerifyingPaymaster / SponsorPaymaster

이중 구조의 deposit을 사용한다:

```
EntryPoint.deposits[paymaster]        <-- Paymaster 전체의 EntryPoint 예치금
VerifyingPaymaster.sponsorDeposits[sponsor]  <-- 개별 스폰서의 내부 잔액
```

1. **EntryPoint deposit**: Paymaster가 EntryPoint에 예치. 이 잔액으로 실제 온체인 가스비가 지불된다.
2. **스폰서 내부 deposit**: VerifyingPaymaster 컨트랙트 내부에 스폰서별 잔액을 관리. `postOp()`에서 실제 가스비 + 10% 마크업을 스폰서의 내부 잔액에서 차감한다.

```bash
# 1단계: EntryPoint에 Paymaster deposit
cast send 0xEf6817fe73741A8F10088f9511c64b666a338A14 \
  "depositTo(address)" \
  0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  --value 10ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>

# 2단계: 스폰서 내부 deposit (VerifyingPaymaster 컨트랙트에 직접 ETH 전송)
cast send 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  "addDeposit(address)" \
  0x<SPONSOR_ADDRESS> \
  --value 5ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<SPONSOR_PRIVATE_KEY>
```

#### ERC20Paymaster

```
EntryPoint.deposits[erc20Paymaster]   <-- EntryPoint 예치금 (운영자가 충전)
사용자 ERC-20 토큰 잔액               <-- 사용자가 토큰으로 가스비 지불
```

운영자는 EntryPoint에 ETH를 예치하고, 사용자는 ERC-20 토큰으로 가스비를 지불한다. Paymaster가 토큰을 수취하고 ETH deposit으로 가스비를 대납하는 구조이다.

```bash
# EntryPoint에 ERC20Paymaster deposit
cast send 0xEf6817fe73741A8F10088f9511c64b666a338A14 \
  "depositTo(address)" \
  0xaf420BFE67697a5724235E4676136F264023d099 \
  --value 10ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

#### Permit2Paymaster

ERC20Paymaster와 동일한 구조이나, 사용자가 approve 대신 EIP-712 서명을 사용한다.

```bash
# EntryPoint에 Permit2Paymaster deposit
cast send 0xEf6817fe73741A8F10088f9511c64b666a338A14 \
  "depositTo(address)" \
  0x7E2845f88a6c22A912F633DCEe45291543C7bCC0 \
  --value 10ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

### 2.4 잔액 모니터링

운영 환경에서는 deposit 잔액이 부족해지지 않도록 모니터링이 필수이다. 잔액이 0이 되면 모든 UserOp 처리가 실패한다.

```bash
# 모든 Paymaster의 EntryPoint 잔액을 일괄 확인
for addr in \
  0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  0xaf420BFE67697a5724235E4676136F264023d099 \
  0x7E2845f88a6c22A912F633DCEe45291543C7bCC0 \
  0x9DeAdA1cC07E2Ff8237c0517C1c2D2b9192D6580; do
  echo -n "$addr: "
  cast call 0xEf6817fe73741A8F10088f9511c64b666a338A14 \
    "balanceOf(address)(uint256)" "$addr" \
    --rpc-url http://localhost:8501
done
```

---

## 3. 사전 준비: 사용자 등록 및 토큰 협상

### 3.1 VerifyingPaymaster: 서명자 + 스폰서 등록

VerifyingPaymaster는 오프체인 서명을 검증하여 스폰서링을 승인하는 방식이다. 3가지 사전 설정이 필요하다.

#### (1) Verifying Signer 등록

Paymaster-proxy가 사용하는 서명 키의 주소를 컨트랙트에 등록한다. 이 주소로 서명된 데이터만 컨트랙트가 수용한다.

```bash
# SIGNER_PRIVATE_KEY에 대응하는 주소를 verifyingSigner로 등록
# 예: private key 0xaa46...efec1 -> address 0x6631cc79bf6968a715F0e911096f2c93BD316d4D
cast send 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  "setVerifyingSigner(address)" \
  0x6631cc79bf6968a715F0e911096f2c93BD316d4D \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

> **주의**: `SIGNER_PRIVATE_KEY` 환경변수에서 도출되는 주소와 컨트랙트의 `verifyingSigner`가 반드시 일치해야 한다. 불일치 시 모든 서명 검증이 실패한다.

#### (2) 스폰서 등록

가스비를 대납할 스폰서 주소를 등록한다.

```bash
cast send 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  "addSponsor(address)" \
  0x<SPONSOR_ADDRESS> \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

#### (3) 스폰서 내부 Deposit

등록된 스폰서의 내부 잔액을 충전한다. `postOp()`에서 실제 가스비 + 10% 마크업이 이 잔액에서 차감된다.

```bash
cast send 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  "addDeposit(address)" \
  0x<SPONSOR_ADDRESS> \
  --value 5ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<SPONSOR_PRIVATE_KEY>
```

#### 검증 흐름

```
validatePaymasterUserOp() 내부:
  1. paymasterData에서 mode, validUntil, validAfter, signature 디코딩
  2. UserOp 필드들로 해시 생성
  3. ecrecover(hash, signature) == verifyingSigner 검증
  4. block.timestamp가 validAfter ~ validUntil 범위 내인지 확인
  5. sponsor의 내부 deposit 잔액 확인
  6. 통과 시 → context 반환, 실패 시 → revert
```

### 3.2 ERC20Paymaster: 토큰 설정 + 사용자 approve

ERC20Paymaster는 사용자가 ERC-20 토큰으로 가스비를 지불하는 방식이다. 관리자 설정과 사용자 측 approve가 모두 필요하다.

#### 관리자 설정 (토큰 등록)

```bash
# 1. USDC 토큰 지원 활성화
cast send 0xaf420BFE67697a5724235E4676136F264023d099 \
  "setSupportedToken(address,bool)" \
  0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699 true \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>

# 2. USDC 마크업 설정 (100 basis points = 1%)
cast send 0xaf420BFE67697a5724235E4676136F264023d099 \
  "setTokenMarkup(address,uint256)" \
  0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699 100 \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>

# 3. PriceOracle 설정
cast send 0xaf420BFE67697a5724235E4676136F264023d099 \
  "setPriceOracle(address)" \
  0xD318D80033a53D23dfd93e1D005F56163FC41603 \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

#### PriceOracle 토큰 풀 설정

```bash
# Uniswap V3 TWAP 풀 설정
cast send 0xD318D80033a53D23dfd93e1D005F56163FC41603 \
  "setTokenConfig(address,address,uint32,bool)" \
  0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699 \
  0x<UNISWAP_V3_POOL_ADDRESS> \
  1800 \
  true \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `token` | `address` | ERC-20 토큰 주소 |
| `pool` | `address` | Uniswap V3 풀 주소 (토큰/ETH 페어) |
| `twapWindow` | `uint32` | TWAP 시간 윈도우 (초). 1800 = 30분 권장 |
| `isToken0` | `bool` | 풀에서 해당 토큰이 token0인지 여부 |

#### 사용자 측: Token Approve

사용자는 스마트 계정을 통해 ERC-20 토큰의 spending allowance를 ERC20Paymaster에 승인해야 한다.

```solidity
// 사용자의 스마트 계정이 실행하는 callData:
IERC20(tokenAddress).approve(erc20PaymasterAddress, type(uint256).max);
```

```bash
# 사용자가 USDC를 ERC20Paymaster에 approve (최대값)
cast send 0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699 \
  "approve(address,uint256)" \
  0xaf420BFE67697a5724235E4676136F264023d099 \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url http://localhost:8501 \
  --private-key 0x<USER_PRIVATE_KEY>
```

#### 검증 흐름

```
validatePaymasterUserOp() 내부:
  1. paymasterData에서 tokenAddress 디코딩 (20 bytes)
  2. isTokenSupported(tokenAddress) 확인
  3. PriceOracle.getPrice(tokenAddress) 호출 -> ETH/토큰 가격 조회
  4. 필요 토큰량 = gasEstimate * maxFeePerGas * exchangeRate * (1 + markup)
  5. IERC20(tokenAddress).transferFrom(sender, address(this), requiredAmount)
  6. 통과 시 -> context에 (tokenAddress, preCharged) 저장
```

### 3.3 Permit2Paymaster: Approve 불필요 (서명 기반)

Permit2Paymaster는 Uniswap Permit2 프로토콜을 활용하여 별도의 approve 트랜잭션 없이 토큰 전송을 승인한다. 사용자는 EIP-712 표준의 typed data 서명만 생성하면 된다.

#### 관리자 설정

배포 시점에 EntryPoint와 Permit2 주소가 고정되므로, 별도의 admin 설정이 필요 없다.

- Permit2 주소: `0x85F101809D84D795A79CE82B348D703Fe7c9D849`
- EntryPoint 주소: 배포 시 지정

#### 사용자 측: EIP-712 서명 생성

사용자는 Permit2의 EIP-712 typed data에 서명한다. 이 서명이 `paymasterData`에 인코딩되어 UserOp에 포함된다.

```typescript
// EIP-712 Domain
const domain = {
  name: "Permit2",
  chainId: 8283,
  verifyingContract: "0x85F101809D84D795A79CE82B348D703Fe7c9D849" // Permit2 주소
};

// EIP-712 Types
const types = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
};

// EIP-712 Value
const value = {
  details: {
    token: "0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699",   // USDC
    amount: BigInt("1000000000"),                             // 1000 USDC (6 decimals)
    expiration: Math.floor(Date.now() / 1000) + 3600,        // 1시간 후
    nonce: 0,                                                 // Permit2 nonce
  },
  spender: "0x7E2845f88a6c22A912F633DCEe45291543C7bCC0",    // Permit2Paymaster
  sigDeadline: Math.floor(Date.now() / 1000) + 3600,
};
```

> **주의**: Permit2를 사용하더라도, 사용자는 토큰을 Permit2 컨트랙트에 대해서는 **1회 approve**가 필요하다 (Permit2 자체가 래퍼 역할). Paymaster에 대한 직접 approve는 불필요하다.

#### 검증 흐름

```
validatePaymasterUserOp() 내부:
  1. paymasterData에서 (token, amount, expiration, nonce, signature) 디코딩
  2. permit2.permit(sender, {token, amount, expiration, nonce}, spender, sigDeadline, signature) 호출
  3. permit2.transferFrom(sender, address(this), amount, token) 호출
  4. 통과 시 -> context 반환
```

### 3.4 SponsorPaymaster: 정책 기반 화이트리스트

SponsorPaymaster는 VerifyingPaymaster와 동일한 서명 메커니즘을 사용하되, paymaster-proxy의 정책 시스템에 의해 스폰서링 대상이 결정된다.

#### 정책 기반 승인

스마트 컨트랙트 레벨에서는 VerifyingPaymaster와 동일하게 동작한다. 차이점은 paymaster-proxy가 정책 검사를 수행한다는 것이다.

```
클라이언트 요청 --> paymaster-proxy 정책 검사 --> 통과 시 서명 생성 --> 컨트랙트 검증
                           |
                    Policy Manager
                    - 화이트/블랙리스트
                    - 가스 한도
                    - 일일 한도
                    - 시간 윈도우
```

사용자 측에서는 별도의 등록 절차가 필요 없다. 관리자가 정책을 통해 허용 범위를 결정한다. 정책 시스템의 상세 내용은 [7장 정책 시스템](#7-정책-시스템)을 참조한다.

---

## 4. 메시지 포맷 상세 스펙

### 4.1 UserOperation (ERC-4337)

ERC-4337은 두 가지 UserOperation 포맷을 지원한다: **Unpacked**(클라이언트 표준)와 **Packed**(온체인 효율).

#### 4.1.1 Unpacked UserOperation (JSON-RPC 표준)

클라이언트에서 paymaster-proxy와 bundler로 전송하는 기본 포맷이다.

```typescript
interface UserOperationRpc {
  sender: Address                       // 20 bytes - 스마트 계정 주소
  nonce: Hex                            // 32 bytes - 계정 논스 (uint256)
  factory?: Address                     // 20 bytes - 계정 팩토리 (최초 배포 시)
  factoryData?: Hex                     // 가변   - 팩토리 초기화 데이터
  callData: Hex                         // 가변   - 실행할 호출 데이터
  callGasLimit: Hex                     // 32 bytes - 실행 단계 가스 한도
  verificationGasLimit: Hex             // 32 bytes - 검증 단계 가스 한도
  preVerificationGas: Hex               // 32 bytes - 사전 검증 오버헤드 가스
  maxFeePerGas: Hex                     // 32 bytes - EIP-1559 최대 수수료
  maxPriorityFeePerGas: Hex             // 32 bytes - EIP-1559 우선 수수료
  paymaster?: Address                   // 20 bytes - Paymaster 주소
  paymasterVerificationGasLimit?: Hex   // 32 bytes - Paymaster 검증 가스
  paymasterPostOpGasLimit?: Hex         // 32 bytes - Paymaster postOp 가스
  paymasterData?: Hex                   // 가변   - Paymaster 전용 데이터
  signature: Hex                        // 가변   - 계정 서명 (보통 65 bytes)
}
```

#### 4.1.2 Packed UserOperation (온체인 효율 포맷)

가스 필드들을 32-byte words로 패킹하여 calldata 비용을 절감한다. SDK에서 온체인 전송 시 사용한다.

```typescript
interface PackedUserOperationRpc {
  sender: Address          // 20 bytes
  nonce: Hex               // 32 bytes
  initCode: Hex            // factory(20) + factoryData, 없으면 "0x"
  callData: Hex            // 가변
  accountGasLimits: Hex    // 32 bytes = verificationGasLimit(16) | callGasLimit(16)
  preVerificationGas: Hex  // 32 bytes
  gasFees: Hex             // 32 bytes = maxPriorityFeePerGas(16) | maxFeePerGas(16)
  paymasterAndData: Hex    // paymaster(20) + paymasterVerificationGasLimit(16)
                           //   + paymasterPostOpGasLimit(16) + paymasterData
  signature: Hex           // 가변
}
```

**패킹 규칙**:

```
accountGasLimits (32 bytes):
  [verificationGasLimit: 16 bytes (상위)] [callGasLimit: 16 bytes (하위)]

gasFees (32 bytes):
  [maxPriorityFeePerGas: 16 bytes (상위)] [maxFeePerGas: 16 bytes (하위)]

initCode:
  factory == null ? "0x" : concat(factory, factoryData)

paymasterAndData:
  paymaster == null ? "0x" : concat(paymaster, paymasterVerificationGasLimit(16), paymasterPostOpGasLimit(16), paymasterData)
```

**예시 (accountGasLimits)**:

```
verificationGasLimit = 0x186A0 (100,000)
callGasLimit         = 0x30D40 (200,000)

accountGasLimits = 0x000000000000000000000000000186A000000000000000000000000000030D40
                     |<--- verificationGasLimit --->||<------- callGasLimit -------->|
                                 16 bytes                        16 bytes
```

### 4.2 paymasterData 인코딩 (타입별)

`paymasterData` 필드는 Paymaster 타입에 따라 다른 형식으로 인코딩된다.

#### 4.2.1 VerifyingPaymaster paymasterData (paymaster-proxy 생성)

paymaster-proxy가 `pm_getPaymasterStubData`와 `pm_getPaymasterData` 응답으로 반환하는 포맷이다.

```
paymasterData (78 bytes total):
+--------+-------------+-------------+----------------------------------+
| Offset | Length      | Field       | Description                      |
+--------+-------------+-------------+----------------------------------+
| 0      | 1 byte      | mode        | 0x00 = TIMESTAMP 모드            |
| 1      | 6 bytes     | validUntil  | 서명 만료 시각 (uint48, unix)     |
| 7      | 6 bytes     | validAfter  | 서명 유효 시작 시각 (uint48, unix) |
| 13     | 65 bytes    | signature   | ECDSA 서명 (r: 32, s: 32, v: 1) |
+--------+-------------+-------------+----------------------------------+
 Total: 1 + 6 + 6 + 65 = 78 bytes
```

**Stub 데이터** (가스 추정용, 서명 없음):

```
0x00                           // mode = TIMESTAMP
  000001932A4B5C00             // validUntil (예: 2026-02-22T01:00:00Z)
  000001932A3B4200             // validAfter (예: 2026-02-22T00:59:00Z, 1분 clock skew)
  0000000000000000000000000000 // 65 bytes of zeros (stub signature)
  0000000000000000000000000000
  0000000000000000000000000000
  0000000000000000000000000000
  00000000000000000000000000
```

**서명된 데이터** (최종, 실제 서명 포함):

```
0x00                           // mode = TIMESTAMP
  000001932A4B5C00             // validUntil
  000001932A3B4200             // validAfter
  a1b2c3d4e5f6...              // 65 bytes ECDSA signature (r + s + v)
```

#### 4.2.2 VerifyingPaymaster paymasterData (SDK 버전, mode byte 없음)

SDK에서 직접 생성하는 경우 mode byte가 생략된 77-byte 포맷을 사용한다.

```
paymasterData (77 bytes total):
+--------+-------------+-------------+----------------------------------+
| Offset | Length      | Field       | Description                      |
+--------+-------------+-------------+----------------------------------+
| 0      | 6 bytes     | validUntil  | 서명 만료 시각 (uint48, unix)     |
| 6      | 6 bytes     | validAfter  | 서명 유효 시작 시각 (uint48, unix) |
| 12     | 65 bytes    | signature   | ECDSA 서명 (r: 32, s: 32, v: 1) |
+--------+-------------+-------------+----------------------------------+
 Total: 6 + 6 + 65 = 77 bytes
```

> **주의**: paymaster-proxy와 SDK가 사용하는 해시 계산 방식이 다르다. 아래 4.3절의 해시 계산 수식을 참조하여 올바른 포맷을 사용해야 한다.

#### 4.2.3 ERC20Paymaster paymasterData

```
paymasterData (20 bytes):
+--------+----------+---------------+------------------------------+
| Offset | Length   | Field         | Description                  |
+--------+----------+---------------+------------------------------+
| 0      | 20 bytes | tokenAddress  | 결제에 사용할 ERC-20 토큰 주소 |
+--------+----------+---------------+------------------------------+
 Total: 20 bytes
```

**예시**:

```
paymasterData = 0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699  // USDC 주소
```

Paymaster 컨트랙트가 온체인에서 직접 오라클 가격 조회 및 토큰 `transferFrom`을 수행하므로, paymasterData는 토큰 주소만 포함한다.

#### 4.2.4 Permit2Paymaster paymasterData (클라이언트 생성)

```
paymasterData (117 bytes total):
+--------+----------+--------------+-----------------------------------------------+
| Offset | Length   | Field        | Description                                   |
+--------+----------+--------------+-----------------------------------------------+
| 0      | 20 bytes | token        | ERC-20 토큰 주소                               |
| 20     | 20 bytes | amount       | 허용 금액 (uint160, 좌측 0 패딩)                |
| 40     | 6 bytes  | expiration   | 허가 만료 시각 (uint48, unix timestamp)         |
| 46     | 6 bytes  | nonce        | Permit2 nonce (uint48)                        |
| 52     | 65 bytes | signature    | EIP-712 Permit2 서명 (r: 32, s: 32, v: 1)    |
+--------+----------+--------------+-----------------------------------------------+
 Total: 20 + 20 + 6 + 6 + 65 = 117 bytes
```

**예시** (USDC 1000개 허용):

```
0x
  085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699  // token (USDC)
  00000000000000000000000000000000E8D4A510  // amount (1000 * 10^6 = 1000000000 = 0x3B9ACA00... 20 bytes)
  000001932A4B5C                            // expiration (uint48)
  000000000000                              // nonce (uint48)
  <65 bytes EIP-712 signature>              // Permit2 서명
```

> **참고**: Permit2Paymaster의 paymasterData는 클라이언트(지갑/SDK)가 직접 생성한다. paymaster-proxy는 `pm_getPaymasterStubData` 응답에서 paymaster 주소와 가스 한도만 반환하고, paymasterData는 `0x`를 반환한다.

### 4.3 EntryPoint의 getUserOpHash() (v0.9 EIP-712)

EntryPoint v0.9는 `getUserOpHash()`에 **EIP-712 typed data hashing**을 사용한다. 이는 v0.7의 단순 `abi.encode` 방식과 다르다. 이 해시는 사용자의 **계정 서명** 대상이며, paymaster 서명과는 별개이다.

#### 상수

```solidity
PACKED_USEROP_TYPEHASH = keccak256(
  "PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,"
  "bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)"
)

EIP712_DOMAIN_TYPEHASH = keccak256(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
)

DOMAIN_NAME = "ERC4337"
DOMAIN_VERSION = "1"
```

#### Step 1: Struct Hash

```solidity
structHash = keccak256(abi.encode(
    PACKED_USEROP_TYPEHASH,
    sender,
    nonce,
    keccak256(initCode),
    keccak256(callData),
    accountGasLimits,       // bytes32, 해시하지 않음
    preVerificationGas,
    gasFees,                // bytes32, 해시하지 않음
    keccak256(paymasterAndData)
))
```

#### Step 2: Domain Separator

```solidity
domainSeparator = keccak256(abi.encode(
    EIP712_DOMAIN_TYPEHASH,
    keccak256("ERC4337"),
    keccak256("1"),
    chainId,
    entryPointAddress
))
```

#### Step 3: Final Hash

```solidity
userOpHash = keccak256("\x19\x01" + domainSeparator + structHash)
```

#### v0.7 vs v0.9 비교

| 항목 | v0.7 | v0.9 |
|------|------|------|
| Struct encoding | TYPEHASH 없음 | `PACKED_USEROP_TYPEHASH`가 첫 필드 |
| Final hash | `keccak256(abi.encode(structHash, entryPoint, chainId))` | `keccak256("\x19\x01" + domainSep + structHash)` |
| Domain separator | 없음 | EIP-712 domain (`name="ERC4337"`, `version="1"`) |

> **주의**: `userOpHash`는 사용자의 스마트 계정이 서명하는 대상이다. 아래 4.4절의 paymaster 해시와 혼동하지 않도록 주의한다. Paymaster 해시는 VerifyingPaymaster 컨트랙트의 `getHash()` 함수가 정의하며, paymaster-proxy의 서명 대상이다.

### 4.4 Paymaster 서명 해시 계산 수식

#### 4.4.1 paymaster-proxy 해시 (mode byte 포함 버전)

paymaster-proxy의 `PaymasterSigner.createPaymasterHash()`가 사용하는 방식:

```solidity
hash = keccak256(abi.encode(
    sender,              // address
    nonce,               // uint256
    keccak256(initCode), // bytes32 (factory + factoryData, 또는 "0x"의 keccak256)
    keccak256(callData), // bytes32
    callGasLimit,        // uint256
    verificationGasLimit,// uint256
    preVerificationGas,  // uint256
    maxFeePerGas,        // uint256
    maxPriorityFeePerGas,// uint256
    paymasterAddress,    // address (VerifyingPaymaster 컨트랙트 주소)
    validUntil,          // uint48
    validAfter,          // uint48
    entryPoint,          // address
    chainId              // uint256
))
```

**TypeScript 구현** (paymaster-proxy `paymasterSigner.ts` 기준):

```typescript
import { encodeAbiParameters, keccak256, concat, type Hex, type Address } from 'viem';

const encoded = encodeAbiParameters(
  [
    { type: 'address' },  // sender
    { type: 'uint256' },  // nonce
    { type: 'bytes32' },  // initCode hash
    { type: 'bytes32' },  // callData hash
    { type: 'uint256' },  // callGasLimit
    { type: 'uint256' },  // verificationGasLimit
    { type: 'uint256' },  // preVerificationGas
    { type: 'uint256' },  // maxFeePerGas
    { type: 'uint256' },  // maxPriorityFeePerGas
    { type: 'address' },  // paymaster
    { type: 'uint48' },   // validUntil
    { type: 'uint48' },   // validAfter
    { type: 'address' },  // entryPoint
    { type: 'uint256' },  // chainId
  ],
  [
    sender,
    BigInt(nonce),
    keccak256(initCode),  // initCode = factory ? concat([factory, factoryData]) : '0x'
    keccak256(callData),
    BigInt(callGasLimit),
    BigInt(verificationGasLimit),
    BigInt(preVerificationGas),
    BigInt(maxFeePerGas),
    BigInt(maxPriorityFeePerGas),
    paymasterAddress,
    validUntil,            // number (uint48)
    validAfter,            // number (uint48)
    entryPoint,
    chainId,               // bigint
  ]
);

const hash = keccak256(encoded);
// 이 hash를 signMessage({ message: { raw: hash }, privateKey })로 서명
```

#### 4.4.2 SDK 해시 (Packed UserOperation, mode byte 없음 버전)

SDK에서 직접 서명을 생성할 때 사용하는 Packed 포맷 기반 해시:

```solidity
hash = keccak256(abi.encode(
    sender,                // address
    nonce,                 // uint256
    keccak256(initCode),   // bytes32
    keccak256(callData),   // bytes32
    accountGasLimits,      // bytes32 (packed: verificationGasLimit | callGasLimit)
    preVerificationGas,    // uint256
    gasFees,               // bytes32 (packed: maxPriorityFeePerGas | maxFeePerGas)
    chainId,               // uint256
    paymasterAddress,      // address
    validUntil,            // uint48
    validAfter,            // uint48
    senderNonce            // uint256 (스마트 계정의 nonce, 별도 필드)
))
```

> **차이점 요약**: proxy 버전은 가스 필드가 개별 uint256으로, SDK 버전은 packed bytes32로 인코딩된다. 또한 SDK 버전은 `entryPoint` 대신 `senderNonce`를 사용하고 필드 순서가 다르다. 클라이언트 구현 시 반드시 올바른 해시 함수를 사용해야 한다.

### 4.5 가스 한도 기본값

paymaster-proxy가 `pm_getPaymasterStubData` 응답에서 반환하는 가스 한도 기본값:

| Paymaster Type | paymasterVerificationGasLimit | paymasterPostOpGasLimit |
|----------------|-------------------------------|------------------------|
| verifying      | 100,000 (`0x186a0`)           | 50,000 (`0xc350`)      |
| sponsor        | 100,000 (`0x186a0`)           | 50,000 (`0xc350`)      |
| erc20          | 150,000 (`0x249f0`)           | 100,000 (`0x186a0`)    |
| permit2 (proxy)| 200,000 (`0x30d40`)           | 100,000 (`0x186a0`)    |
| permit2 (SDK)  | 150,000 (`0x249f0`)           | 80,000 (`0x13880`)     |

### 4.6 JSON-RPC 요청/응답 포맷

paymaster-proxy는 ERC-7677 표준에 따라 JSON-RPC 2.0 프로토콜을 사용한다.

#### 4.6.1 pm_getPaymasterStubData

가스 추정 단계에서 호출한다. Paymaster 주소, stub paymasterData, 가스 한도를 반환한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "pm_getPaymasterStubData",
  "params": [
    {
      "sender": "0x1234567890abcdef1234567890abcdef12345678",
      "nonce": "0x01",
      "callData": "0xb61d27f6000000000000000000000000...",
      "callGasLimit": "0x0",
      "verificationGasLimit": "0x0",
      "preVerificationGas": "0x0",
      "maxFeePerGas": "0x59682f00",
      "maxPriorityFeePerGas": "0x1dcd6500",
      "signature": "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
    },
    "0xEf6817fe73741A8F10088f9511c64b666a338A14",
    "0x205b",
    {
      "paymasterType": "verifying"
    }
  ]
}
```

**응답 (VerifyingPaymaster)**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "paymaster": "0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0",
    "paymasterData": "0x00000001932a4b5c00000001932a3b42000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "paymasterVerificationGasLimit": "0x186a0",
    "paymasterPostOpGasLimit": "0xc350",
    "sponsor": {
      "name": "StableNet Paymaster"
    },
    "isFinal": false
  }
}
```

**응답 (ERC20Paymaster)**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "paymaster": "0xaf420BFE67697a5724235E4676136F264023d099",
    "paymasterData": "0x085ee10cc10be8fb2ce51feb13e809a0c3f98699",
    "paymasterVerificationGasLimit": "0x249f0",
    "paymasterPostOpGasLimit": "0x186a0",
    "isFinal": false
  }
}
```

**응답 (Permit2Paymaster)**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "paymaster": "0x7E2845f88a6c22A912F633DCEe45291543C7bCC0",
    "paymasterData": "0x",
    "paymasterVerificationGasLimit": "0x30d40",
    "paymasterPostOpGasLimit": "0x186a0",
    "isFinal": false
  }
}
```

#### 4.6.2 pm_getPaymasterData

가스 추정 완료 후 호출한다. 최종 서명이 포함된 paymasterData를 반환한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "pm_getPaymasterData",
  "params": [
    {
      "sender": "0x1234567890abcdef1234567890abcdef12345678",
      "nonce": "0x01",
      "callData": "0xb61d27f6000000000000000000000000...",
      "callGasLimit": "0x30d40",
      "verificationGasLimit": "0x186a0",
      "preVerificationGas": "0xb708",
      "maxFeePerGas": "0x59682f00",
      "maxPriorityFeePerGas": "0x1dcd6500",
      "paymaster": "0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0",
      "paymasterVerificationGasLimit": "0x186a0",
      "paymasterPostOpGasLimit": "0xc350",
      "paymasterData": "0x00000001932a4b5c00000001932a3b42000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "signature": "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
    },
    "0xEf6817fe73741A8F10088f9511c64b666a338A14",
    "0x205b",
    {
      "paymasterType": "verifying"
    }
  ]
}
```

**응답**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "paymaster": "0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0",
    "paymasterData": "0x00000001932a4b5c00000001932a3b4200a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12341b"
  }
}
```

#### 4.6.3 pm_supportedTokens

ERC20Paymaster가 지원하는 토큰 목록을 조회한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "pm_supportedTokens",
  "params": ["0x205b"]
}
```

**응답**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": [
    {
      "address": "0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699",
      "symbol": "USDC",
      "decimals": 6,
      "exchangeRate": "2500000000000000000000"
    },
    {
      "address": "0x7186e5C27Cb08eAF041005D193268006889083f6",
      "symbol": "WKRC",
      "decimals": 18,
      "exchangeRate": "1000000000000000000"
    }
  ]
}
```

#### 4.6.4 pm_estimateTokenPayment

특정 UserOp의 가스비를 ERC-20 토큰으로 환산한 예상 금액을 조회한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "pm_estimateTokenPayment",
  "params": [
    { "sender": "0x1234...", "nonce": "0x01", "callData": "0x...", "callGasLimit": "0x30d40", "verificationGasLimit": "0x186a0", "preVerificationGas": "0xb708", "maxFeePerGas": "0x59682f00", "maxPriorityFeePerGas": "0x1dcd6500", "signature": "0x..." },
    "0xEf6817fe73741A8F10088f9511c64b666a338A14",
    "0x205b",
    "0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699"
  ]
}
```

**응답**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "tokenAddress": "0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699",
    "estimatedAmount": "2500000",
    "exchangeRate": "0",
    "markup": 100
  }
}
```

#### 4.6.5 pm_getSponsorPolicy

특정 주소에 대한 스폰서 정책 가용성을 조회한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "pm_getSponsorPolicy",
  "params": [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0x205b"
  ]
}
```

**응답**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "isAvailable": true,
    "dailyLimitRemaining": "100000000000000000",
    "perTxLimit": "1000000000000000000"
  }
}
```

#### 4.6.6 pm_supportedPaymasterTypes

현재 paymaster-proxy에 설정된 Paymaster 타입 목록을 반환한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "pm_supportedPaymasterTypes",
  "params": []
}
```

**응답**:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": ["verifying", "erc20", "permit2", "sponsor"]
}
```

#### 4.6.7 pm_supportedChainIds

지원하는 체인 ID 목록을 반환한다.

**요청**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "pm_supportedChainIds",
  "params": []
}
```

**응답**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": [8283, 1, 11155111, 84532]
}
```

#### 4.6.8 Context 파라미터를 통한 Paymaster 타입 라우팅

`pm_getPaymasterStubData`와 `pm_getPaymasterData`의 4번째 파라미터인 `context` 객체로 Paymaster 타입을 지정한다. 생략 시 기본값은 `"verifying"`이다.

```json
// VerifyingPaymaster (기본값, context 생략 가능)
{ "paymasterType": "verifying" }

// ERC20Paymaster (tokenAddress 필수)
{ "paymasterType": "erc20", "tokenAddress": "0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699" }

// Permit2Paymaster
{ "paymasterType": "permit2" }

// SponsorPaymaster (policyId 선택)
{ "paymasterType": "sponsor", "policyId": "default" }
```

### 4.7 JSON-RPC 에러 코드

| 코드 | 상수 | 의미 |
|------|------|------|
| `-32700` | `PARSE_ERROR` | JSON 파싱 오류 |
| `-32600` | `INVALID_REQUEST` | 유효하지 않은 JSON-RPC 요청 |
| `-32601` | `METHOD_NOT_FOUND` | 지원하지 않는 메서드 |
| `-32602` | `INVALID_PARAMS` | 유효하지 않은 파라미터 |
| `-32603` | `INTERNAL_ERROR` | 내부 서버 오류 |
| `-32001` | `REJECTED_BY_POLICY` | 정책에 의해 거부됨 |
| `-32002` | `UNSUPPORTED_CHAIN` | 지원하지 않는 체인 ID |
| `-32003` | `UNSUPPORTED_ENTRY_POINT` | 지원하지 않는 EntryPoint |
| `-32004` | `RATE_LIMITED` | 일일 한도 초과 (rate limited) |
| `-32005` | `UNSUPPORTED_PAYMASTER_TYPE` | 지원하지 않는 Paymaster 타입 |
| `-32006` | `UNSUPPORTED_TOKEN` | 지원하지 않는 토큰 |

**에러 응답 예시**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Sender not in whitelist"
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32004,
    "message": "Daily spending limit exceeded for sender",
    "data": {
      "spent": "95000000000000000",
      "limit": "100000000000000000"
    }
  }
}
```

---

## 5. 전체 흐름: 단계별 상세

아래는 UserOp 생성부터 온체인 실행까지의 전체 흐름이다.

### Phase 0: Setup (사전 준비)

모든 것이 시작되기 전, 운영자가 수행해야 하는 1회성 설정이다.

```
[운영자]
  |
  |--> EntryPoint.depositTo(paymaster)          // Paymaster에 ETH 예치
  |--> VerifyingPaymaster.setVerifyingSigner()   // 서명자 등록
  |--> VerifyingPaymaster.addSponsor()           // 스폰서 등록
  |--> VerifyingPaymaster.addDeposit()           // 스폰서 내부 잔액 충전
  |--> ERC20Paymaster.setSupportedToken()        // 토큰 등록
  |--> ERC20Paymaster.setTokenMarkup()           // 마크업 설정
  |--> ERC20Paymaster.setPriceOracle()           // 오라클 설정
  |--> PriceOracle.setTokenConfig()              // 토큰 풀 설정
  |
  |--> paymaster-proxy 서비스 시작
```

### Phase 1: UserOp 생성 (클라이언트)

클라이언트(지갑/SDK)가 UserOp의 기본 필드를 구성한다.

```typescript
const userOp = {
  sender: "0x1234...",          // 사용자의 스마트 계정 주소
  nonce: "0x01",                // 계정 논스
  callData: "0xb61d27f6...",    // execute(to, value, data) 인코딩
  callGasLimit: "0x0",          // 아직 모름 → 가스 추정 후 채움
  verificationGasLimit: "0x0",  // 아직 모름
  preVerificationGas: "0x0",    // 아직 모름
  maxFeePerGas: "0x59682f00",   // 현재 네트워크 가스 가격
  maxPriorityFeePerGas: "0x1dcd6500",
  signature: "0xff...1c",       // dummy 서명 (가스 추정용)
};
```

### Phase 2: Stub Data 요청 (클라이언트 -> paymaster-proxy)

클라이언트가 `pm_getPaymasterStubData`를 호출하여 Paymaster 정보를 받는다.

```
Client                          paymaster-proxy
  |                                    |
  |--- pm_getPaymasterStubData ------->|
  |    [userOp, entryPoint,            |
  |     chainId, context]              |
  |                                    |--- context.paymasterType 확인
  |                                    |--- 정책 검사 (sponsor/verifying)
  |                                    |--- stub paymasterData 생성
  |                                    |     (서명 없음, 65 bytes 0x00)
  |<-- {paymaster, paymasterData, -----|
  |     paymasterVerificationGasLimit, |
  |     paymasterPostOpGasLimit,       |
  |     isFinal: false}               |
  |                                    |
```

클라이언트는 응답의 필드를 UserOp에 채운다:

```typescript
userOp.paymaster = response.paymaster;
userOp.paymasterData = response.paymasterData;
userOp.paymasterVerificationGasLimit = response.paymasterVerificationGasLimit;
userOp.paymasterPostOpGasLimit = response.paymasterPostOpGasLimit;
```

### Phase 3: 가스 추정 (클라이언트 -> Bundler)

Bundler에게 `eth_estimateUserOperationGas`를 호출하여 가스 값을 추정한다.

```
Client                          Bundler
  |                                |
  |--- eth_estimateUserOperationGas ->|
  |    [userOp, entryPoint]          |
  |                                  |--- EntryPoint.simulateValidation() 실행
  |                                  |--- 각 가스 필드 추정
  |<-- {callGasLimit,            ----|
  |     verificationGasLimit,        |
  |     preVerificationGas}          |
  |                                  |
```

클라이언트는 추정된 가스 값을 UserOp에 반영한다:

```typescript
userOp.callGasLimit = gasEstimate.callGasLimit;
userOp.verificationGasLimit = gasEstimate.verificationGasLimit;
userOp.preVerificationGas = gasEstimate.preVerificationGas;
```

### Phase 4: 최종 서명 데이터 요청 (클라이언트 -> paymaster-proxy)

가스 값이 확정된 UserOp로 `pm_getPaymasterData`를 호출하여 실제 서명을 받는다.

```
Client                          paymaster-proxy
  |                                    |
  |--- pm_getPaymasterData ---------->|
  |    [userOp(가스 확정), entryPoint, |
  |     chainId, context]             |
  |                                    |--- context.paymasterType 확인
  |                                    |--- 정책 재검사 + 가스비용 계산
  |                                    |--- UserOp 필드로 해시 생성
  |                                    |--- SIGNER_PRIVATE_KEY로 서명
  |                                    |--- spending 기록
  |<-- {paymaster, paymasterData} ----|
  |     (실제 서명 포함)               |
  |                                    |
```

클라이언트는 최종 paymasterData를 UserOp에 반영한다:

```typescript
userOp.paymasterData = response.paymasterData;
// 이제 UserOp에 계정 서명 추가
userOp.signature = await smartAccount.signUserOp(userOp);
```

### Phase 5: Bundler에 제출 (클라이언트 -> Bundler)

완성된 UserOp를 Bundler에 제출한다.

```
Client                          Bundler
  |                                |
  |--- eth_sendUserOperation ----->|
  |    [userOp, entryPoint]        |
  |                                |--- UserOp 유효성 검증
  |                                |--- 번들에 포함
  |<-- userOpHash             ----|
  |                                |
```

### Phase 6: EntryPoint 실행 (Bundler -> EntryPoint -> Paymaster)

Bundler가 `handleOps()`를 호출하여 UserOp를 실행한다.

```
Bundler                    EntryPoint                  Paymaster          Smart Account
  |                            |                           |                    |
  |--- handleOps([userOp]) --->|                           |                    |
  |                            |                           |                    |
  |                            |--- validatePaymasterUserOp() -->|              |
  |                            |                           |--- 서명 검증       |
  |                            |                           |--- 잔액 확인       |
  |                            |                           |<-- context 반환    |
  |                            |                           |                    |
  |                            |--- validateUserOp() -------------------------------->|
  |                            |                           |                    |--- 계정 서명 검증
  |                            |                           |                    |<-- 통과
  |                            |                           |                    |
  |                            |--- execute callData ------------------------------->|
  |                            |                           |                    |--- 실행
  |                            |                           |                    |
```

### Phase 7: postOp 정산 (EntryPoint -> Paymaster)

실행 완료 후 EntryPoint가 Paymaster의 `postOp()`을 호출하여 실제 가스비를 정산한다.

```
EntryPoint                  Paymaster
  |                            |
  |--- postOp(mode,         -->|
  |    context,                |
  |    actualGasCost,          |
  |    actualUserOpFeePerGas)  |
  |                            |--- 실제 가스비 계산
  |                            |--- [VerifyingPaymaster] sponsor 잔액에서 차감 (+ 10% 마크업)
  |                            |--- [ERC20Paymaster] 초과 지불 토큰 환불
  |                            |--- [Permit2Paymaster] 정산 완료 (환불 없음)
  |                            |
  |--- deposits[paymaster] -= actualGasCost
  |
```

**비용 차감 구조**:

```
VerifyingPaymaster:
  actualCost = actualGasCost * 110% (10% 마크업)
  sponsorDeposits[sponsor] -= actualCost
  EntryPoint.deposits[paymaster] -= actualGasCost

ERC20Paymaster:
  preCharged (Phase 6에서 미리 가져간 토큰량)
  actualTokenCost = calculateTokenAmount(actualGasCost)
  refund = preCharged - actualTokenCost
  IERC20.transfer(sender, refund) // 차액 환불
  EntryPoint.deposits[paymaster] -= actualGasCost

Permit2Paymaster:
  정확한 금액만 전송됨 (환불 없음)
  EntryPoint.deposits[paymaster] -= actualGasCost
```

---

## 6. Paymaster 타입별 상세 흐름

### 6.1 VerifyingPaymaster 전체 흐름

```
시간축
  |
  |  [사전 준비]
  |  운영자: setVerifyingSigner(proxySignerAddr)
  |  운영자: addSponsor(sponsorAddr)
  |  스폰서: addDeposit{value: 5 ETH}(sponsorAddr)
  |  운영자: EntryPoint.depositTo{value: 10 ETH}(verifyingPaymasterAddr)
  |
  |  [런타임]
  |  1. Client -> pm_getPaymasterStubData
  |     context: { paymasterType: "verifying" }
  |
  |  2. paymaster-proxy:
  |     a. resolvePaymasterType(context) -> "verifying"
  |     b. checkPolicy(userOp, "default") -> allowed
  |     c. generateStubData():
  |        - validUntil = now + 3600
  |        - validAfter = now - 60
  |        - paymasterData = 0x00 + validUntil(6) + validAfter(6) + zeros(65)
  |     d. 반환: { paymaster, paymasterData, gasLimits, isFinal: false }
  |
  |  3. Client -> Bundler: eth_estimateUserOperationGas
  |     (stub paymasterData 포함 UserOp으로 가스 추정)
  |
  |  4. Client -> pm_getPaymasterData
  |     (가스 값 확정된 UserOp)
  |
  |  5. paymaster-proxy:
  |     a. resolvePaymasterType(context) -> "verifying"
  |     b. estimateGasCost(userOp) = totalGas * maxFeePerGas
  |     c. checkPolicy(userOp, "default", estimatedGasCost) -> allowed
  |     d. generateSignedData(userOp, entryPoint, chainId):
  |        - hash = createPaymasterHash(userOp, entryPoint, chainId, validUntil, validAfter)
  |        - signature = signMessage({ raw: hash }, SIGNER_PRIVATE_KEY)
  |        - paymasterData = 0x00 + validUntil(6) + validAfter(6) + signature(65)
  |     e. recordSpending(sender, estimatedGasCost)
  |     f. 반환: { paymaster, paymasterData }
  |
  |  6. Client: UserOp에 paymasterData 반영 + 계정 서명
  |
  |  7. Client -> Bundler: eth_sendUserOperation
  |
  |  8. Bundler -> EntryPoint.handleOps():
  |     a. Paymaster.validatePaymasterUserOp():
  |        - 서명 디코딩 (mode=0x00, validUntil, validAfter, sig)
  |        - 해시 재생성 + ecrecover == verifyingSigner 확인
  |        - validAfter <= block.timestamp <= validUntil 확인
  |     b. Account.validateUserOp(): 계정 서명 확인
  |     c. execute(callData): 트랜잭션 실행
  |     d. Paymaster.postOp():
  |        - actualCost = actualGasCost * 110/100
  |        - sponsorDeposits[sponsor] -= actualCost
  v
```

### 6.2 ERC20Paymaster 전체 흐름

```
시간축
  |
  |  [사전 준비 - 관리자]
  |  setSupportedToken(USDC, true)
  |  setTokenMarkup(USDC, 100)   // 1% 마크업
  |  setPriceOracle(oracleAddr)
  |  PriceOracle.setTokenConfig(USDC, pool, 1800, true)
  |  EntryPoint.depositTo{value: 10 ETH}(erc20PaymasterAddr)
  |
  |  [사전 준비 - 사용자]
  |  USDC.approve(erc20PaymasterAddr, type(uint256).max)
  |
  |  [런타임]
  |  1. Client: 지원 토큰 조회
  |     -> pm_supportedTokens(chainId)
  |     <- [{ address: USDC, symbol: "USDC", decimals: 6, exchangeRate: "..." }]
  |
  |  2. Client: 토큰 비용 추정 (선택사항)
  |     -> pm_estimateTokenPayment(userOp, entryPoint, chainId, USDC)
  |     <- { estimatedAmount: "2500000", markup: 100 }
  |
  |  3. Client -> pm_getPaymasterStubData
  |     context: { paymasterType: "erc20", tokenAddress: USDC }
  |
  |  4. paymaster-proxy:
  |     - tokenAddress 필수 확인
  |     - paymasterData = tokenAddress (20 bytes)
  |     - 반환: { paymaster, paymasterData: "0x085ee10c...", gasLimits }
  |
  |  5. Client -> Bundler: eth_estimateUserOperationGas
  |
  |  6. Client -> pm_getPaymasterData
  |     context: { paymasterType: "erc20", tokenAddress: USDC }
  |
  |  7. paymaster-proxy:
  |     - paymasterData = tokenAddress (동일)
  |     - 반환: { paymaster, paymasterData: "0x085ee10c..." }
  |
  |  8. Client: UserOp 완성 + 계정 서명 + Bundler 제출
  |
  |  9. EntryPoint.handleOps():
  |     a. Paymaster.validatePaymasterUserOp():
  |        - tokenAddress 디코딩
  |        - PriceOracle.getPrice(tokenAddress)
  |        - requiredAmount = gasCost * exchangeRate * (1 + markup/10000)
  |        - USDC.transferFrom(sender, paymaster, requiredAmount)  // 선지불
  |        - context = (tokenAddress, requiredAmount, sender)
  |     b. Account.validateUserOp() + execute(callData)
  |     c. Paymaster.postOp():
  |        - actualTokenCost = actualGasCost * exchangeRate * (1 + markup/10000)
  |        - refund = requiredAmount - actualTokenCost
  |        - USDC.transfer(sender, refund)  // 차액 환불
  v
```

### 6.3 Permit2Paymaster 전체 흐름

```
시간축
  |
  |  [사전 준비 - 관리자]
  |  EntryPoint.depositTo{value: 10 ETH}(permit2PaymasterAddr)
  |
  |  [사전 준비 - 사용자]
  |  USDC.approve(permit2ContractAddr, type(uint256).max)  // Permit2 컨트랙트에 1회 approve
  |  (Paymaster에 대한 approve는 불필요)
  |
  |  [런타임]
  |  1. Client -> pm_getPaymasterStubData
  |     context: { paymasterType: "permit2" }
  |
  |  2. paymaster-proxy:
  |     - paymasterData = "0x" (빈 값)
  |     - 반환: { paymaster, paymasterData: "0x", gasLimits }
  |     (Permit2 데이터는 클라이언트가 생성)
  |
  |  3. Client -> Bundler: eth_estimateUserOperationGas
  |
  |  4. Client: EIP-712 Permit2 서명 생성
  |     domain = { name: "Permit2", chainId, verifyingContract: permit2Addr }
  |     value = {
  |       details: { token: USDC, amount, expiration, nonce },
  |       spender: permit2PaymasterAddr,
  |       sigDeadline
  |     }
  |     permit2Signature = signTypedData(domain, types, value)
  |
  |  5. Client: paymasterData 직접 인코딩
  |     paymasterData = concat([
  |       token(20), amount(20), expiration(6), nonce(6), permit2Signature(65)
  |     ])  // total 117 bytes
  |
  |  6. Client: UserOp에 paymasterData 설정 + 계정 서명 + Bundler 제출
  |     (pm_getPaymasterData 호출 불필요 -- 클라이언트가 직접 생성)
  |
  |  7. EntryPoint.handleOps():
  |     a. Paymaster.validatePaymasterUserOp():
  |        - paymasterData 디코딩: token, amount, expiration, nonce, sig
  |        - permit2.permit(sender, permitSingle, sig)
  |        - permit2.transferFrom(sender, paymaster, amount, token)
  |        - context 반환
  |     b. Account.validateUserOp() + execute(callData)
  |     c. Paymaster.postOp(): 정산 (환불 없음)
  v
```

> **주의**: Permit2Paymaster의 경우 `pm_getPaymasterData`를 호출할 필요가 없다. paymaster-proxy는 paymaster 주소와 가스 한도만 제공하고, 실제 `paymasterData`는 클라이언트가 직접 생성한다. paymaster-proxy에 `pm_getPaymasterData`를 호출하면 `paymasterData: "0x"`가 반환된다.

### 6.4 SponsorPaymaster 전체 흐름

```
시간축
  |
  |  [사전 준비 - 관리자]
  |  setVerifyingSigner(proxySignerAddr)
  |  EntryPoint.depositTo{value: 10 ETH}(sponsorPaymasterAddr)
  |  정책 설정 (REST API):
  |    POST /admin/policies
  |    { id: "premium", whitelist: ["0xABC..."], dailyLimitPerSender: "1000000000000000000" }
  |
  |  [런타임]
  |  1. Client: 스폰서 정책 조회 (선택사항)
  |     -> pm_getSponsorPolicy(senderAddr, chainId)
  |     <- { isAvailable: true, dailyLimitRemaining: "950000000000000000", perTxLimit: "..." }
  |
  |  2. Client -> pm_getPaymasterStubData
  |     context: { paymasterType: "sponsor", policyId: "premium" }
  |
  |  3. paymaster-proxy:
  |     a. resolvePaymasterType(context) -> "sponsor"
  |     b. policyManager.checkPolicy(userOp, "premium"):
  |        - 정책 존재 확인
  |        - active 확인
  |        - 시간 윈도우 확인
  |        - 화이트리스트 확인 (sender in whitelist?)
  |        - 블랙리스트 확인
  |        - 가스 한도 확인
  |     c. generateStubData() -> stub paymasterData
  |     d. 반환: { paymaster: sponsorPaymasterAddr, paymasterData, gasLimits }
  |
  |  4. Client -> Bundler: eth_estimateUserOperationGas
  |
  |  5. Client -> pm_getPaymasterData
  |     context: { paymasterType: "sponsor", policyId: "premium" }
  |
  |  6. paymaster-proxy:
  |     a. estimateGasCost(userOp)
  |     b. policyManager.checkPolicy(userOp, "premium", estimatedGasCost):
  |        - 위의 모든 검사 + 가스 비용 한도 + 일일 한도 확인
  |     c. generateSignedData(userOp, entryPoint, chainId)
  |     d. policyManager.recordSpending(sender, estimatedGasCost)
  |     e. 반환: { paymaster, paymasterData }
  |
  |  7. 이후 VerifyingPaymaster와 동일 (Phase 6-7)
  v
```

---

## 7. 정책 시스템

### 7.1 정책 구조

```typescript
interface SponsorPolicy {
  id: string;                    // 고유 식별자 (예: "default", "premium", "campaign-2024")
  name: string;                  // 표시 이름
  active: boolean;               // 활성화 여부 (false면 모든 요청 거부)
  whitelist?: Address[];         // 허용 주소 목록 (설정 시 목록 외 주소 거부)
  blacklist?: Address[];         // 차단 주소 목록 (설정 시 목록 내 주소 거부)
  maxGasLimit?: bigint;          // 단일 UserOp의 총 가스 한도
  maxGasCost?: bigint;           // 단일 UserOp의 총 가스 비용 한도 (wei)
  dailyLimitPerSender?: bigint;  // 주소별 일일 가스 비용 한도 (wei)
  globalDailyLimit?: bigint;     // 시스템 전체 일일 가스 비용 한도 (wei)
  allowedTargets?: Address[];    // 허용 대상 컨트랙트 주소
  blockedTargets?: Address[];    // 차단 대상 컨트랙트 주소
  startTime?: number;            // 정책 시작 시각 (unix timestamp)
  endTime?: number;              // 정책 종료 시각 (unix timestamp)
}
```

### 7.2 기본 정책 (환경변수로 설정 가능)

paymaster-proxy가 시작될 때 `"default"` 정책이 자동 생성된다. 환경변수로 기본값을 조정할 수 있다.

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `PAYMASTER_DEFAULT_MAX_GAS_LIMIT` | `5,000,000` | 단일 UserOp 최대 가스 |
| `PAYMASTER_DEFAULT_MAX_GAS_COST` | `1,000,000,000,000,000,000` (1 ETH) | 단일 UserOp 최대 비용 |
| `PAYMASTER_DEFAULT_DAILY_LIMIT_PER_SENDER` | `100,000,000,000,000,000` (0.1 ETH) | 주소별 일일 한도 |
| `PAYMASTER_DEFAULT_GLOBAL_DAILY_LIMIT` | `10,000,000,000,000,000,000` (10 ETH) | 전체 일일 한도 |

### 7.3 정책 검증 순서

`checkPolicy()` 함수는 다음 순서로 검사를 수행한다. 어느 단계에서든 실패하면 즉시 거부 응답을 반환한다.

```
1. 정책 존재 확인
   -> 실패: { code: -32001, message: "Policy {id} not found" }

2. 정책 활성화 확인 (active == true)
   -> 실패: { code: -32001, message: "Policy is not active" }

3. 시간 윈도우 확인
   a. startTime이 설정된 경우: now >= startTime
      -> 실패: { code: -32001, message: "Policy not yet active" }
   b. endTime이 설정된 경우: now <= endTime
      -> 실패: { code: -32001, message: "Policy has expired" }

4. 화이트리스트 확인 (whitelist가 비어있지 않은 경우)
   -> sender가 whitelist에 없으면 거부
   -> 실패: { code: -32001, message: "Sender not in whitelist" }

5. 블랙리스트 확인 (blacklist가 비어있지 않은 경우)
   -> sender가 blacklist에 있으면 거부
   -> 실패: { code: -32001, message: "Sender is blacklisted" }

6. 가스 한도 확인 (maxGasLimit이 설정된 경우)
   -> totalGas = callGasLimit + verificationGasLimit + preVerificationGas
   -> totalGas > maxGasLimit이면 거부
   -> 실패: { code: -32001, message: "Gas limit exceeds maximum: {totalGas} > {maxGasLimit}" }

7. 가스 비용 한도 확인 (maxGasCost가 설정되고 estimatedGasCost가 제공된 경우)
   -> estimatedGasCost > maxGasCost이면 거부
   -> 실패: { code: -32001, message: "Gas cost exceeds maximum: ..." }

8. 주소별 일일 한도 확인 (dailyLimitPerSender가 설정되고 estimatedGasCost가 제공된 경우)
   -> dailyGasSpent + estimatedGasCost > dailyLimitPerSender이면 거부
   -> 실패: { code: -32004, message: "Daily spending limit exceeded for sender",
              data: { spent, limit } }

9. 전체 일일 한도 확인 (globalDailyLimit가 설정되고 estimatedGasCost가 제공된 경우)
   -> globalDailySpent + estimatedGasCost > globalDailyLimit이면 거부
   -> 실패: { code: -32004, message: "Global daily spending limit exceeded" }

모든 검사 통과 -> { allowed: true }
```

일일 한도는 UTC 기준 자정(00:00)에 자동 리셋된다.

### 7.4 정책 관리 REST API

정책은 REST API를 통해 관리한다. 프로덕션 환경에서는 `PAYMASTER_ADMIN_TOKEN` 환경변수 설정이 필수이다.

#### 인증

```
Authorization: Bearer <PAYMASTER_ADMIN_TOKEN>
```

프로덕션 환경에서 `PAYMASTER_ADMIN_TOKEN`이 미설정이면 admin 엔드포인트가 비활성화된다 (HTTP 503 반환). 개발 환경에서는 인증 없이 접근 가능하다 (경고 로그 출력).

#### 엔드포인트

**전체 정책 조회**:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4338/admin/policies
```

```json
{
  "policies": [
    {
      "id": "default",
      "name": "Default Policy",
      "active": true,
      "maxGasLimit": "5000000",
      "maxGasCost": "1000000000000000000",
      "dailyLimitPerSender": "100000000000000000",
      "globalDailyLimit": "10000000000000000000"
    }
  ]
}
```

**특정 정책 조회**:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4338/admin/policies/default
```

**정책 생성/수정**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "campaign-2026",
    "name": "Launch Campaign",
    "active": true,
    "whitelist": [
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    ],
    "maxGasLimit": "3000000",
    "maxGasCost": "500000000000000000",
    "dailyLimitPerSender": "200000000000000000",
    "globalDailyLimit": "5000000000000000000",
    "startTime": 1740000000,
    "endTime": 1742592000
  }' \
  http://localhost:4338/admin/policies
```

**정책 삭제**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4338/admin/policies/campaign-2026
```

---

## 8. 컨트랙트 주소 및 설정 참조

### 8.1 Chain 8283 (StableNet Local) 컨트랙트 주소

| 컨트랙트 | 주소 | 용도 |
|----------|------|------|
| **EntryPoint** | `0xEf6817fe73741A8F10088f9511c64b666a338A14` | ERC-4337 엔트리포인트 (account-abstraction v0.9) |
| **VerifyingPaymaster** | `0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0` | 오프체인 서명 기반 스폰서 페이마스터 |
| **ERC20Paymaster** | `0xaf420BFE67697a5724235E4676136F264023d099` | ERC-20 토큰 결제 페이마스터 |
| **Permit2Paymaster** | `0x7E2845f88a6c22A912F633DCEe45291543C7bCC0` | Permit2 기반 토큰 결제 페이마스터 |
| **SponsorPaymaster** | `0x9DeAdA1cC07E2Ff8237c0517C1c2D2b9192D6580` | API 정책 기반 스폰서 페이마스터 |
| **PriceOracle** | `0xD318D80033a53D23dfd93e1D005F56163FC41603` | Uniswap V3 TWAP 가격 오라클 |
| **Permit2** | `0x85F101809D84D795A79CE82B348D703Fe7c9D849` | Uniswap Permit2 컨트랙트 |
| **USDC** | `0x085Ee10CC10BE8FB2cE51fEB13E809a0c3f98699` | 테스트 USDC 토큰 |
| **WKRC** | `0x7186e5C27Cb08eAF041005D193268006889083f6` | Wrapped KRC 토큰 |

### 8.2 환경변수 전체 목록

#### 필수 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `PAYMASTER_ADDRESS` | 기본 Paymaster 주소 (하위 호환) | `0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0` |
| `SIGNER_PRIVATE_KEY` | Paymaster 서명에 사용하는 개인키 | `0xaa46885d8c0bba1bee...` |
| `RPC_URL` | 블록체인 노드 RPC URL | `http://localhost:8501` |

#### 서버 설정

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PAYMASTER_PORT` | `4338` | RPC 서버 포트 |
| `PAYMASTER_DEBUG` | `false` | 디버그 모드 (요청 로깅) |
| `PAYMASTER_SPONSOR_NAME` | `StableNet Paymaster` | 응답에 포함되는 스폰서 이름 |
| `PAYMASTER_SUPPORTED_CHAIN_IDS` | `8283,1,11155111,84532` | 지원 체인 ID (쉼표 구분) |

#### 서명 설정

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PAYMASTER_VALIDITY_SECONDS` | `3600` (1시간) | 서명 유효 기간 (초) |
| `PAYMASTER_CLOCK_SKEW_SECONDS` | `60` (1분) | 허용 시계 오차 (초). validAfter = now - skew |

#### 정책 기본값

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PAYMASTER_DEFAULT_MAX_GAS_LIMIT` | `5,000,000` | 단일 UserOp 최대 가스 |
| `PAYMASTER_DEFAULT_MAX_GAS_COST` | `1 ETH (10^18 wei)` | 단일 UserOp 최대 비용 |
| `PAYMASTER_DEFAULT_DAILY_LIMIT_PER_SENDER` | `0.1 ETH (10^17 wei)` | 주소별 일일 한도 |
| `PAYMASTER_DEFAULT_GLOBAL_DAILY_LIMIT` | `10 ETH (10^19 wei)` | 전체 일일 한도 |

#### 멀티 Paymaster 주소 (선택)

| 변수명 | 설명 |
|--------|------|
| `VERIFYING_PAYMASTER_ADDRESS` | VerifyingPaymaster 주소 (미설정 시 `PAYMASTER_ADDRESS` 사용) |
| `ERC20_PAYMASTER_ADDRESS` | ERC20Paymaster 주소 |
| `PERMIT2_PAYMASTER_ADDRESS` | Permit2Paymaster 주소 |
| `SPONSOR_PAYMASTER_ADDRESS` | SponsorPaymaster 주소 (미설정 시 `VERIFYING_PAYMASTER_ADDRESS` 사용) |

#### 추가 컨트랙트 주소 (선택)

| 변수명 | 설명 |
|--------|------|
| `PRICE_ORACLE_ADDRESS` | PriceOracle 주소 (ERC20 토큰 가격 조회용) |
| `PERMIT2_CONTRACT_ADDRESS` | Permit2 컨트랙트 주소 |

#### 보안

| 변수명 | 설명 |
|--------|------|
| `PAYMASTER_ADMIN_TOKEN` | Admin REST API 인증 토큰. 프로덕션에서 필수 |

### 8.3 CLI 인자

```bash
node dist/cli/index.js run [options]
```

| 인자 | 단축 | 타입 | 기본값 | 설명 |
|------|------|------|--------|------|
| `--port` | `-p` | number | `3001` | 서버 포트 |
| `--paymaster` | `-m` | string | - | Paymaster 주소 |
| `--signer` | `-s` | string | - | 서명 개인키 |
| `--rpc` | `-r` | string | - | RPC URL |
| `--chain-ids` | `-c` | string | - | 지원 체인 ID (쉼표 구분) |
| `--debug` | `-d` | boolean | `false` | 디버그 모드 |
| `--log-level` | `-l` | string | `info` | 로그 레벨 (debug/info/warn/error) |
| `--env` | `-e` | boolean | `false` | 환경변수 우선 모드 |

CLI 인자(`--paymaster`, `--signer`, `--rpc`)가 제공되면 최우선 적용된다. 생략 시 환경변수에서 자동 로드한다.

### 8.4 서비스 실행

```bash
# 빌드
pnpm build

# 환경변수 기반 실행
node --env-file=.env dist/cli/index.js run

# CLI 인자 기반 실행
node --env-file=.env dist/cli/index.js run \
  --paymaster 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  --signer 0xaa46885d8c0bba1bee97183a1f63455835959373dfff365d2306bd5b043efec1 \
  --rpc http://localhost:8501 \
  --port 4338 \
  --debug
```

### 8.5 상태 확인 엔드포인트

| 엔드포인트 | 설명 | 사용 사례 |
|-----------|------|----------|
| `GET /health` | 전체 서비스 상태 (paymaster 주소, signer 주소, 지원 체인 등) | 대시보드 모니터링 |
| `GET /ready` | Kubernetes readiness probe | 트래픽 수신 준비 확인 |
| `GET /live` | Kubernetes liveness probe | 프로세스 생존 확인 |
| `GET /metrics` | Prometheus 메트릭 (uptime, 요청 수, 에러 수) | 모니터링 시스템 연동 |

**health 응답 예시**:

```json
{
  "status": "ok",
  "service": "paymaster-proxy",
  "version": "1.0.0",
  "timestamp": "2026-02-22T00:00:00.000Z",
  "uptime": "3600s",
  "paymaster": "0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0",
  "paymasterTypes": ["verifying", "erc20", "permit2", "sponsor"],
  "signer": "0x6631cc79bf6968a715F0e911096f2c93BD316d4D",
  "supportedChainIds": [8283, 1, 11155111, 84532]
}
```

### 8.6 JSON-RPC 엔드포인트

paymaster-proxy는 두 경로에서 동일한 JSON-RPC 요청을 처리한다:

- `POST /` -- 기본 경로
- `POST /rpc` -- 대안 경로

배치 요청도 지원한다 (JSON 배열로 여러 요청을 한 번에 전송).

---

## 부록 A: 비용 구조 요약

| Paymaster | 가스비 부담자 | 결제 수단 | 마크업 | 정산 시점 |
|-----------|-------------|-----------|--------|----------|
| VerifyingPaymaster | 스폰서 (sponsorDeposits) | ETH | 10% (postOp) | postOp에서 스폰서 내부 잔액 차감 |
| ERC20Paymaster | 사용자 | ERC-20 토큰 | 설정 가능 (basis points) | validatePaymasterUserOp에서 선지불, postOp에서 환불 |
| Permit2Paymaster | 사용자 | ERC-20 토큰 | 고정 | validatePaymasterUserOp에서 전액 전송 |
| SponsorPaymaster | 스폰서 (API 정책) | ETH | 정책 기반 | postOp에서 차감 |

## 부록 B: 가스비 계산 공식

```
estimatedGasCost = (callGasLimit + verificationGasLimit + preVerificationGas) * maxFeePerGas

actualGasCost = actualGasUsed * actualGasPrice
// actualGasPrice = min(maxFeePerGas, baseFee + maxPriorityFeePerGas)
```

ERC-20 토큰 환산:

```
requiredTokenAmount = estimatedGasCost * exchangeRate * (10000 + markupBps) / 10000
// exchangeRate: PriceOracle에서 조회한 토큰/ETH 환율
// markupBps: basis points 단위 마크업 (100 = 1%)
```

## 부록 C: 지원 체인 ID

| Chain ID | 네트워크 | Hex |
|----------|---------|-----|
| `8283` | StableNet Local | `0x205b` |
| `1` | Ethereum Mainnet | `0x1` |
| `11155111` | Sepolia Testnet | `0xaa36a7` |
| `84532` | Base Sepolia | `0x14a34` |
