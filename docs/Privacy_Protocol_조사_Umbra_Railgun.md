# Privacy Protocol 조사: Umbra & Railgun

**문서 버전**: 1.0
**작성일**: 2026-01-15
**목적**: StableNet Secret Account 구현 참조를 위한 기존 프라이버시 프로토콜 조사

---

## 목차

1. [조사 배경](#1-조사-배경)
2. [Umbra Protocol](#2-umbra-protocol)
3. [Railgun](#3-railgun)
4. [비교 분석](#4-비교-분석)
5. [StableNet PoC 적용 검토](#5-stablenet-poc-적용-검토)

---

## 1. 조사 배경

### 1.1 목적

StableNet의 **Secret Account** (Stealth Address 기반 프라이버시) 구현을 위해 기존 검증된 프로토콜을 조사하고 참조 가능성을 평가합니다.

### 1.2 조사 대상

| 프로토콜 | 선정 이유 |
|----------|----------|
| **Umbra Protocol** | EIP-5564 기반 Stealth Address의 대표적 구현체 |
| **Railgun** | zk-SNARK 기반 온체인 프라이버시의 대표적 구현체 |

### 1.3 평가 기준

- 기술적 성숙도 (프로덕션 운영 여부)
- 라이선스 및 재사용 가능성
- StableNet 요구사항과의 적합성
- 구현 복잡도

---

## 2. Umbra Protocol

### 2.1 개요

| 항목 | 정보 |
|------|------|
| **프로젝트명** | Umbra Protocol |
| **개발사** | ScopeLift |
| **GitHub** | https://github.com/ScopeLift/umbra-protocol |
| **기술 방식** | Stealth Address (타원곡선 암호화) |
| **지원 체인** | Ethereum, Polygon, Arbitrum, Optimism 등 EVM 체인 |
| **상태** | 프로덕션 운영 중 |

### 2.2 GitHub 저장소

#### 메인 저장소

```
https://github.com/ScopeLift/umbra-protocol
```

#### 저장소 구조 (모노레포)

```
umbra-protocol/
├── packages/
│   ├── frontend/           # React 기반 프론트엔드
│   ├── contracts/          # Solidity 스마트 컨트랙트
│   └── umbra-js/           # JavaScript/TypeScript SDK
├── README.md
└── ...
```

#### 관련 저장소

| 저장소 | 설명 | URL |
|--------|------|-----|
| **umbra-v2-experimental** | V2 실험 버전 (WalletConnect 통합) | https://github.com/ScopeLift/umbra-v2-experimental |
| **Scopelift-Umbra-js** | 보안 감사용 (Least Authority) | https://github.com/LeastAuthority/Scopelift-Umbra-js |

### 2.3 기술 아키텍처

#### Stealth Address 동작 원리

```
┌─────────────────────────────────────────────────────────────────┐
│                     Umbra Stealth Address Flow                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 수신자: 계정 설정                                            │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  서명 메시지 → Hash → Spending Key + Viewing Key     │     │
│     │                    → Public Keys를 온체인 등록        │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
│  2. 송신자: 결제 전송                                            │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  Random Number 생성                                   │     │
│     │  → Spending Public Key로 Stealth Address 생성         │     │
│     │  → Viewing Public Key로 Random Number 암호화          │     │
│     │  → Umbra Contract로 자금 전송 + Announcement 발행     │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
│  3. 수신자: 자금 수령                                            │
│     ┌─────────────────────────────────────────────────────┐     │
│     │  Viewing Key로 Announcement 스캔                      │     │
│     │  → 암호화된 Random Number 복호화                      │     │
│     │  → Spending Key로 Stealth Address 제어권 획득         │     │
│     │  → 자금 인출                                          │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 핵심 특징

| 특징 | 설명 |
|------|------|
| **Non-Mixer** | Mixer가 아닌 1:1 결제 프라이버시 |
| **No ZK Proofs** | Zero Knowledge 미사용, 타원곡선 암호화만 사용 |
| **Dual Key System** | Spending Key (자금 제어) + Viewing Key (트랜잭션 조회) |
| **On-chain Registry** | 공개키를 온체인에 등록하여 누구나 송금 가능 |

#### 스마트 컨트랙트 구조

```solidity
// 핵심 컨트랙트 (개념적 구조)
contract Umbra {
    // 스텔스 메타 주소 등록
    mapping(address => StealthKeyRegistry) public keys;

    // 송금 실행 + Announcement 발행
    function sendEth(
        address payable receiver,      // Stealth Address
        uint256 tollCommitment,
        bytes32 pkx,                   // 암호화된 랜덤 넘버
        bytes32 ciphertext
    ) external payable;

    // ERC-20 토큰 송금
    function sendToken(
        address receiver,
        address tokenAddr,
        uint256 amount,
        bytes32 pkx,
        bytes32 ciphertext
    ) external;

    // Announcement 이벤트
    event Announcement(
        address indexed receiver,
        uint256 amount,
        address indexed token,
        bytes32 pkx,
        bytes32 ciphertext
    );
}
```

### 2.4 보안 감사

| 감사 기관 | 시기 | 결과 |
|----------|------|------|
| **Least Authority** | 2021 | 완료 (보고서 공개) |

### 2.5 라이선스

```
MIT License (확인 필요 - 저장소에서 직접 확인 권장)
```

---

## 3. Railgun

### 3.1 개요

| 항목 | 정보 |
|------|------|
| **프로젝트명** | RAILGUN |
| **GitHub (Core)** | https://github.com/Railgun-Privacy |
| **GitHub (Community)** | https://github.com/Railgun-Community |
| **기술 방식** | zk-SNARK (Zero Knowledge Proof) |
| **지원 체인** | Ethereum, Polygon, BNB Chain, Arbitrum |
| **상태** | 프로덕션 운영 중 |

### 3.2 GitHub 저장소

#### 조직 구조

```
Railgun-Privacy (Core)
├── contract              # 스마트 컨트랙트
├── circuits-v2           # ZK 회로 V2
└── circuits-ppoi         # Private Proof of Innocence 회로

Railgun-Community (SDK & Tools)
├── wallet                # Wallet SDK (TypeScript)
├── waku-broadcaster-client
└── explorer              # Privacy Pools Explorer
```

#### 주요 저장소

| 저장소 | 설명 | URL |
|--------|------|-----|
| **contract** | 스마트 컨트랙트 (TypeScript) | https://github.com/Railgun-Privacy/contract |
| **wallet** | Wallet SDK | https://github.com/Railgun-Community/wallet |
| **circuits-v2** | ZK 회로 V2 | https://github.com/Railgun-Privacy |

### 3.3 기술 아키텍처

#### zk-SNARK 프라이버시 시스템

```
┌─────────────────────────────────────────────────────────────────┐
│                     Railgun Privacy System                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    Shield    ┌──────────────────────────┐     │
│  │  Public      │  ─────────►  │  Private Balance         │     │
│  │  Wallet      │              │  (Shielded Pool)         │     │
│  │  (0x...)     │  ◄─────────  │                          │     │
│  └──────────────┘    Unshield  │  • Merkle Tree 저장      │     │
│                                │  • UTXO 기반             │     │
│                                │  • ZK Proof 검증         │     │
│                                └──────────────────────────┘     │
│                                          │                       │
│                                          │ Private Transfer      │
│                                          ▼                       │
│                                ┌──────────────────────────┐     │
│                                │  Private DeFi 상호작용   │     │
│                                │  • Uniswap               │     │
│                                │  • Aave                  │     │
│                                │  • 기타 DeFi             │     │
│                                └──────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 핵심 특징

| 특징 | 설명 |
|------|------|
| **On-chain ZK** | L2/브릿지 없이 L1에서 직접 ZK 프라이버시 |
| **UTXO Model** | Bitcoin/Zcash와 유사한 UTXO 기반 트랜잭션 |
| **Merkle Tree** | 암호화된 잔액/소유권 관리 |
| **DeFi Compatible** | 프라이빗하게 DeFi 스마트 컨트랙트 상호작용 |
| **Private Proof of Innocence** | 규제 준수를 위한 프라이버시 증명 |

#### UTXO 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                     Railgun UTXO System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input UTXOs              Transaction              Output UTXOs  │
│  ┌─────────┐                                       ┌─────────┐  │
│  │ UTXO A  │──┐                                ┌──▶│ UTXO C  │  │
│  │ 50 ETH  │  │        ┌─────────────┐        │   │ 30 ETH  │  │
│  └─────────┘  ├───────▶│  ZK Proof   │────────┤   └─────────┘  │
│  ┌─────────┐  │        │  Generation │        │   ┌─────────┐  │
│  │ UTXO B  │──┘        └─────────────┘        └──▶│ UTXO D  │  │
│  │ 30 ETH  │                                      │ 50 ETH  │  │
│  └─────────┘                                      └─────────┘  │
│                                                                  │
│  • Input UTXOs는 소비됨 (Nullifier 생성)                         │
│  • Output UTXOs는 새로 생성됨 (Commitment)                       │
│  • 모든 과정이 ZK Proof로 검증됨                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Wallet SDK

```typescript
// Railgun Wallet SDK 사용 예시 (개념적)
import { RailgunWallet } from '@railgun-community/wallet';

// 지갑 초기화
const wallet = await RailgunWallet.create(encryptionKey);

// Shield (공개 → 프라이빗)
await wallet.shield({
  tokenAddress: '0x...',
  amount: '1000000000000000000', // 1 ETH
});

// Private Transfer
await wallet.transfer({
  to: railgunAddress,
  tokenAddress: '0x...',
  amount: '500000000000000000',
});

// Unshield (프라이빗 → 공개)
await wallet.unshield({
  to: '0x...',
  tokenAddress: '0x...',
  amount: '500000000000000000',
});
```

### 3.5 라이선스

```
확인 필요 - 저장소에서 직접 확인 권장
```

---

## 4. 비교 분석

### 4.1 기술 비교

| 항목 | Umbra Protocol | Railgun |
|------|----------------|---------|
| **프라이버시 방식** | Stealth Address | zk-SNARK |
| **암호화 기술** | 타원곡선 (ECDH) | Zero Knowledge Proof |
| **복잡도** | 낮음 | 높음 |
| **증명 생성 시간** | 없음 (즉시) | 수 초 ~ 수십 초 |
| **가스비** | 낮음 | 높음 (ZK 검증) |
| **프라이버시 수준** | 수신자 주소 은닉 | 전체 트랜잭션 은닉 |

### 4.2 기능 비교

| 기능 | Umbra Protocol | Railgun |
|------|----------------|---------|
| **1:1 결제** | ✅ | ✅ |
| **DeFi 상호작용** | ❌ | ✅ |
| **토큰 전송** | ✅ ETH + ERC-20 | ✅ ETH + ERC-20 |
| **Viewing Key 분리** | ✅ | ✅ |
| **규제 대응** | ⚠️ 제한적 | ✅ Private PoI |
| **다중 체인** | ✅ EVM 체인 | ✅ 4개 체인 |

### 4.3 구현 복잡도 비교

| 항목 | Umbra Protocol | Railgun |
|------|----------------|---------|
| **스마트 컨트랙트** | 단순 | 복잡 |
| **클라이언트 SDK** | 단순 | 복잡 (ZK 회로) |
| **인프라 요구사항** | 낮음 | 높음 (증명 생성) |
| **개발 기간 예상** | 짧음 | 김 |
| **유지보수** | 쉬움 | 어려움 |

### 4.4 장단점 요약

#### Umbra Protocol

| 장점 | 단점 |
|------|------|
| ✅ 구현이 단순함 | ❌ 수신자 주소만 은닉 |
| ✅ 가스비가 낮음 | ❌ 금액/송신자 노출 |
| ✅ 즉시 처리 | ❌ DeFi 상호작용 불가 |
| ✅ EIP-5564 표준 기반 | ❌ 프라이버시 수준 제한적 |

#### Railgun

| 장점 | 단점 |
|------|------|
| ✅ 완전한 트랜잭션 프라이버시 | ❌ 구현 복잡 |
| ✅ DeFi 상호작용 가능 | ❌ 높은 가스비 |
| ✅ Private Proof of Innocence | ❌ 증명 생성 시간 필요 |
| ✅ UTXO 모델로 유연함 | ❌ 학습 곡선 높음 |

---

## 5. StableNet PoC 적용 검토

### 5.1 StableNet 요구사항

StableNet의 **Secret Account** 요구사항:

| 요구사항 | 설명 |
|----------|------|
| **프라이버시** | 급여/거래 내역 은닉 |
| **규제 준수** | 규제 기관의 조회 가능성 |
| **사용성** | 일반 사용자도 쉽게 사용 |
| **성능** | 1초 Finality와 호환 |

### 5.2 적합성 평가

| 요구사항 | Umbra | Railgun | 평가 |
|----------|-------|---------|------|
| **프라이버시** | ⚠️ 제한적 | ✅ 완전 | Railgun 우위 |
| **규제 준수** | ⚠️ 별도 구현 필요 | ✅ Private PoI | Railgun 우위 |
| **사용성** | ✅ 단순 | ⚠️ 복잡 | Umbra 우위 |
| **성능** | ✅ 즉시 | ⚠️ 증명 시간 | Umbra 우위 |
| **구현 난이도** | ✅ 낮음 | ❌ 높음 | Umbra 우위 |

### 5.3 권장 사항

#### PoC 단계: Umbra 방식 권장

```
이유:
1. 구현 복잡도가 낮아 빠른 PoC 가능
2. EIP-5564 표준 기반으로 참조 자료 풍부
3. StableNet의 Stealth Payment Contract가 이미 Umbra 방식 채택
4. 규제 대응은 Viewing Key 공유로 별도 구현 가능
```

#### 프로덕션 단계: 하이브리드 고려

```
옵션 1: Umbra 방식 + 규제 대응 레이어
  - Viewing Key를 규제 기관에 선택적 공유
  - 구현 단순, 빠른 출시

옵션 2: Railgun 방식 도입
  - 완전한 프라이버시 필요 시
  - Private Proof of Innocence 활용
  - 구현 복잡, 긴 개발 기간
```

### 5.4 참조 구현 전략

#### Phase 1: Umbra 컨트랙트 분석

```
1. umbra-protocol/packages/contracts 분석
2. StealthKeyRegistry 구조 이해
3. Announcement 이벤트 구조 파악
4. umbra-js SDK 통합 방법 검토
```

#### Phase 2: StableNet 적용

```
1. 기존 stable-poc-contract의 Stealth Payment와 비교
2. 필요한 커스터마이징 식별
3. 규제 대응 레이어 설계
4. SDK 개발 또는 umbra-js 포크
```

#### Phase 3: 테스트 및 검증

```
1. 단위 테스트
2. 통합 테스트
3. 보안 검토
4. 성능 벤치마크
```

---

## 부록: GitHub 링크 요약

### A. Umbra Protocol

| 저장소 | URL |
|--------|-----|
| **메인 저장소** | https://github.com/ScopeLift/umbra-protocol |
| **V2 실험** | https://github.com/ScopeLift/umbra-v2-experimental |
| **보안 감사** | https://github.com/LeastAuthority/Scopelift-Umbra-js |

### B. Railgun

| 저장소 | URL |
|--------|-----|
| **Core Organization** | https://github.com/Railgun-Privacy |
| **Community Organization** | https://github.com/Railgun-Community |
| **Contract** | https://github.com/Railgun-Privacy/contract |
| **Wallet SDK** | https://github.com/Railgun-Community/wallet |

### C. 관련 문서

| 문서 | URL |
|------|-----|
| **Umbra 소개** | https://scopelift.co/blog/introducing-umbra |
| **Railgun Docs** | https://docs.railgun.org/wiki |
| **EIP-5564 (Stealth Address)** | https://eips.ethereum.org/EIPS/eip-5564 |
| **ERC-6538 (Stealth Registry)** | https://eips.ethereum.org/EIPS/eip-6538 |

---

**문서 끝**

*본 문서는 StableNet PoC의 Secret Account 구현 참조를 위해 작성되었습니다.*
