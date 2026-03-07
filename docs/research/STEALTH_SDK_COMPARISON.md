# Stealth SDK 비교 분석

## 개요

현재 프로젝트에는 Stealth Address 기능을 제공하는 두 개의 패키지가 존재합니다:

1. **`@stablenet/stealth-sdk`** - 독립적인 SDK 패키지
2. **`@stablenet/plugin-stealth`** - Core SDK 플러그인 (미구현)

## 1. 패키지 구조 비교

### 1.1 `@stablenet/stealth-sdk` (완전 구현됨)

**위치**: `packages/stealth-sdk/`

**구조**:
```
packages/stealth-sdk/
├── src/
│   ├── actions/              # ✅ 구현됨
│   │   ├── announce.ts
│   │   ├── checkAnnouncement.ts
│   │   ├── computeStealthKey.ts
│   │   ├── fetchAnnouncements.ts
│   │   ├── generateStealthAddress.ts
│   │   ├── registerStealthMetaAddress.ts
│   │   └── watchAnnouncements.ts
│   ├── client/               # ✅ 구현됨
│   │   ├── createStealthClient.ts
│   │   └── index.ts
│   ├── config/               # ✅ 구현됨
│   │   ├── networks.ts
│   │   └── index.ts
│   ├── constants/            # ✅ 구현됨
│   │   ├── abis.ts
│   │   ├── contracts.ts
│   │   ├── schemes.ts
│   │   └── index.ts
│   ├── crypto/               # ✅ 구현됨
│   │   ├── stealth.ts
│   │   ├── viewTag.ts
│   │   └── index.ts
│   ├── types/                # ✅ 구현됨
│   │   └── index.ts
│   └── index.ts              # ✅ 완전한 export
```

**의존성**:
- `@noble/curves`: ^1.7.0
- `@noble/hashes`: ^1.6.1
- `viem`: ^2.21.0

**특징**:
- ✅ 완전히 독립적인 SDK
- ✅ 모든 기능 구현 완료
- ✅ 실제 사용 중 (`apps/web/next.config.js`에서 transpile)
- ✅ EIP-5564, EIP-6538 완전 지원

### 1.2 `@stablenet/plugin-stealth` (미구현)

**위치**: `packages/sdk/plugins/stealth/`

**구조**:
```
packages/sdk/plugins/stealth/
├── src/
│   └── index.ts              # ❌ 거의 비어있음 (export {} 만 존재)
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**의존성**:
- `@stablenet/core`: workspace:*
- `@stablenet/types`: workspace:*
- `viem`: ^2.21.0

**특징**:
- ❌ 구현되지 않음 (빈 export만 존재)
- ✅ Core SDK 플러그인 구조 준비됨
- ✅ 다른 플러그인들(session-keys, paymaster)과 동일한 구조

## 2. 기능 비교

### 2.1 `@stablenet/stealth-sdk` 제공 기능

| 기능 | 구현 상태 | 설명 |
|------|----------|------|
| `generateStealthAddress` | ✅ | 스텔스 주소 생성 |
| `computeStealthKey` | ✅ | 스텔스 키 계산 |
| `registerStealthMetaAddress` | ✅ | 스텔스 메타 주소 등록 |
| `getStealthMetaAddress` | ✅ | 등록된 메타 주소 조회 |
| `announce` | ✅ | 스텔스 주소 공개 |
| `checkAnnouncement` | ✅ | 공개 확인 |
| `fetchAnnouncements` | ✅ | 공개 목록 조회 |
| `watchAnnouncements` | ✅ | 공개 감시 |
| `createStealthClient` | ✅ | 클라이언트 생성 |
| Crypto utilities | ✅ | 암호화 유틸리티 |

### 2.2 `@stablenet/plugin-stealth` 제공 기능

| 기능 | 구현 상태 | 설명 |
|------|----------|------|
| 모든 기능 | ❌ | 미구현 |

## 3. 사용 현황

### 3.1 `@stablenet/stealth-sdk` 사용

**실제 사용 중**:
- `apps/web/next.config.js`: transpile 패키지로 포함
- `apps/web/hooks/useStealth.ts`: 실제 사용
- `apps/web/app/stealth/receive/page.tsx`: 실제 사용

**사용 예시**:
```typescript
import {
  createStealthClient,
  generateStealthAddress,
  computeStealthKey,
  watchAnnouncementsWithKey,
} from '@stablenet/stealth-sdk'
```

### 3.2 `@stablenet/plugin-stealth` 사용

**사용 없음**: 프로젝트 전체에서 import되지 않음

## 4. 아키텍처 차이점

### 4.1 독립 SDK vs 플러그인

**`@stablenet/stealth-sdk`**:
- 독립적인 패키지
- viem 기반 직접 구현
- 자체 클라이언트 (`createStealthClient`)
- Core SDK와 무관

**`@stablenet/plugin-stealth`** (계획):
- Core SDK 플러그인
- `@stablenet/core` 의존
- Smart Account Client와 통합 예정
- 다른 플러그인들(session-keys, paymaster)과 유사한 패턴

### 4.2 다른 플러그인 패턴 참고

**`@stablenet/plugin-session-keys`** 예시:
```typescript
// 플러그인은 core SDK와 통합되어 사용
import { createSessionKeyExecutor } from '@stablenet/plugin-session-keys'

const executor = createSessionKeyExecutor({
  executorAddress: '0x...',
  chainId: 1n,
})
```

**`@stablenet/plugin-paymaster`** 예시:
```typescript
// Smart Account Client에 통합
import { createVerifyingPaymaster } from '@stablenet/plugin-paymaster'

const client = createSmartAccountClient({
  account,
  chain,
  transport,
  paymaster: verifyingPaymaster, // 플러그인 통합
})
```

## 5. 문서상 계획

`docs/poc/09_Implementation_Plan.md`에 따르면:

| ID | 작업 | 상태 |
|----|------|------|
| ST-01 | `@stablenet/stealth-sdk` | ✅ 완료 |
| ST-02 | Stealth Server (Rust) | ✅ 완료 |
| ST-03 | SDK 플러그인 통합 | ❌ 미완료 |

**ST-03 작업**: `stealth-sdk`를 플러그인 형태로 core SDK에 통합하는 작업으로 보임

## 6. 권장 사항

### 6.1 현재 상황

1. **`@stablenet/stealth-sdk`**는 완전히 구현되어 있고 실제로 사용 중
2. **`@stablenet/plugin-stealth`**는 구조만 준비되어 있고 구현되지 않음
3. 두 패키지는 **동일한 목적**이지만 **다른 아키텍처** 접근

### 6.2 옵션

#### 옵션 A: 플러그인 구현 (권장)

**장점**:
- Core SDK와의 일관성 유지
- Smart Account Client와 통합 가능
- 다른 플러그인들과 동일한 패턴

**작업**:
1. `@stablenet/stealth-sdk`의 기능을 `@stablenet/plugin-stealth`로 이식
2. Core SDK의 Smart Account Client와 통합
3. 기존 `stealth-sdk` 사용처를 플러그인으로 마이그레이션

#### 옵션 B: 독립 SDK 유지

**장점**:
- 이미 구현되어 있음
- Core SDK와 독립적
- 유연한 사용

**작업**:
1. `@stablenet/plugin-stealth` 삭제
2. `@stablenet/stealth-sdk`만 유지

#### 옵션 C: 하이브리드 접근

**장점**:
- 독립 SDK는 유지 (외부 사용 가능)
- 플러그인은 Core SDK 통합용 래퍼로 구현

**작업**:
1. `@stablenet/stealth-sdk`는 독립 패키지로 유지
2. `@stablenet/plugin-stealth`는 `stealth-sdk`를 래핑하여 Core SDK 통합

## 7. 결론

현재 **동일한 목적의 코드가 2개로 분리**되어 있습니다:

1. **`@stablenet/stealth-sdk`**: 완전 구현, 실제 사용 중
2. **`@stablenet/plugin-stealth`**: 미구현, Core SDK 통합 계획

**권장 조치**:
- **단기**: `@stablenet/plugin-stealth` 구현 또는 삭제 결정
- **장기**: 아키텍처 일관성을 위해 플러그인 패턴으로 통합 고려
