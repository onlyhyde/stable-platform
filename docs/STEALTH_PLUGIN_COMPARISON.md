# Stealth Plugin vs Stealth SDK 비교 분석

## 개요

`@stablenet/plugin-stealth`는 `@stablenet/stealth-sdk`의 모든 기능을 re-export하면서 Core SDK 통합을 위한 추가 기능을 제공합니다.

## Export 비교

### 1. Types (타입 정의)

#### stealth-sdk에서 export하는 타입 (18개)
```typescript
- SchemeId
- StealthMetaAddress
- ParsedStealthMetaAddressUri
- GeneratedStealthAddress
- StealthAnnouncement
- AnnouncementFilterOptions
- StealthKeyPair
- StealthKeys
- ComputedStealthKey
- RegistryEntry
- StealthClientConfig
- StealthClient
- WatchAnnouncementsOptions
- GenerateStealthAddressParams
- ComputeStealthKeyParams
- RegisterStealthMetaAddressParams
- AnnounceParams
- CheckAnnouncementParams
```

#### plugin-stealth에서 export하는 타입
- ✅ **모든 stealth-sdk 타입 re-export됨** (18개)
- ➕ **추가 타입**:
  - `StealthPluginConfig` - 플러그인 전용 설정 타입
  - `ExtendedStealthClientConfig` - 확장 설정 타입

**결과**: ✅ **완전히 동일 + 추가 타입 제공**

---

### 2. Constants (상수)

#### stealth-sdk에서 export하는 상수 (14개)
```typescript
- SCHEME_ID
- DEFAULT_SCHEME_ID
- VIEW_TAG_SIZE
- COMPRESSED_PUBKEY_SIZE
- UNCOMPRESSED_PUBKEY_SIZE
- STEALTH_META_ADDRESS_PREFIX
- CHAIN_PREFIX
- type ChainPrefix
- ANNOUNCER_ADDRESSES
- REGISTRY_ADDRESSES
- getAnnouncerAddress
- getRegistryAddress
- ERC5564_ANNOUNCER_ABI
- ERC6538_REGISTRY_ABI
```

#### plugin-stealth에서 export
- ✅ **모든 상수 re-export됨** (14개)

**결과**: ✅ **완전히 동일**

---

### 3. Config (네트워크 설정)

#### stealth-sdk에서 export하는 config (5개)
```typescript
- type NetworkConfig
- NETWORKS
- getNetworkConfig
- getNetworkByPrefix
- isChainSupported
```

#### plugin-stealth에서 export
- ✅ **모든 config re-export됨** (5개)

**결과**: ✅ **완전히 동일**

---

### 4. Crypto Utilities (암호화 유틸리티)

#### stealth-sdk에서 export하는 crypto 함수 (14개)
```typescript
- generatePrivateKey
- derivePublicKey
- generateStealthKeyPair
- generateStealthAddress (as generateStealthAddressCrypto)
- computeStealthPrivateKey
- checkViewTag
- parseStealthMetaAddress
- encodeStealthMetaAddress
- parseStealthMetaAddressUri
- encodeStealthMetaAddressUri
- computeViewTag
- extractViewTag
- createMetadata
- viewTagsMatch
```

#### plugin-stealth에서 export
- ✅ **모든 crypto 함수 re-export됨** (14개)

**결과**: ✅ **완전히 동일**

---

### 5. Client (클라이언트 생성)

#### stealth-sdk에서 export하는 client 함수 (2개)
```typescript
- createStealthClient(config: StealthClientConfig): StealthClient
- extendWithStealth(publicClient, options?): StealthClient
```

#### plugin-stealth에서 export
- ✅ `extendWithStealth` - re-export됨
- 🔄 `createStealthClient` - **플러그인 버전으로 재정의됨**
  - 원본은 `createStealthClientSDK`로 re-export됨
- ➕ **추가 함수**:
  - `createStealthClient(config: StealthPluginConfig): StealthClient` - 플러그인 버전
  - `createStealthClientFromClients(publicClient, walletClient?, options?)` - 편의 함수

**차이점**:
- 플러그인의 `createStealthClient`는 `StealthPluginConfig`를 받음 (내부적으로 stealth-sdk의 `createStealthClient`를 호출)
- 원본 `createStealthClient`는 `createStealthClientSDK`로 접근 가능

**결과**: ⚠️ **기능적으로 동일하지만 인터페이스가 다름** (플러그인 버전이 래퍼 역할)

---

### 6. Actions (액션 함수)

#### stealth-sdk에서 export하는 actions (12개)
```typescript
- generateStealthAddress
- computeStealthKey
- registerStealthMetaAddress
- getStealthMetaAddress
- announce
- checkAnnouncement
- filterByViewTag
- fetchAnnouncements
- fetchAnnouncementsBatched
- getCurrentBlock
- watchAnnouncements
- watchAnnouncementsWithKey
```

#### plugin-stealth에서 export
- ✅ **모든 actions re-export됨** (12개)

**결과**: ✅ **완전히 동일**

---

## 전체 비교 요약

| 카테고리 | stealth-sdk | plugin-stealth | 상태 |
|---------|-------------|----------------|------|
| **Types** | 18개 | 18개 + 2개 추가 | ✅ 동일 + 추가 |
| **Constants** | 14개 | 14개 | ✅ 동일 |
| **Config** | 5개 | 5개 | ✅ 동일 |
| **Crypto** | 14개 | 14개 | ✅ 동일 |
| **Client** | 2개 | 2개 + 2개 추가 | ⚠️ 래퍼 제공 |
| **Actions** | 12개 | 12개 | ✅ 동일 |
| **총계** | **65개 export** | **65개 re-export + 4개 추가** | ✅ **완전 호환** |

## 주요 차이점

### 1. Client 생성 함수

**stealth-sdk**:
```typescript
import { createStealthClient } from '@stablenet/stealth-sdk'

const client = createStealthClient({
  publicClient,
  walletClient, // optional
  announcerAddress, // optional
  registryAddress, // optional
})
```

**plugin-stealth**:
```typescript
import { createStealthClient } from '@stablenet/plugin-stealth'

// 동일한 방식으로 사용 가능 (내부적으로 stealth-sdk 호출)
const client = createStealthClient({
  publicClient,
  walletClient, // optional
  announcerAddress, // optional
  registryAddress, // optional
})

// 또는 원본 SDK 함수 사용
import { createStealthClientSDK } from '@stablenet/plugin-stealth'
const client = createStealthClientSDK({ ... })
```

### 2. 추가 기능

**plugin-stealth 전용**:
- `StealthPluginConfig` 타입 - Core SDK 통합을 위한 타입
- `createStealthClientFromClients` - 편의 함수
- `createStealthClientSDK` - 원본 SDK 함수 접근

## 코드 동일성 검증

### ✅ 완전히 동일한 부분

1. **모든 타입 정의** - stealth-sdk에서 직접 re-export
2. **모든 상수** - stealth-sdk에서 직접 re-export
3. **모든 config 함수** - stealth-sdk에서 직접 re-export
4. **모든 crypto 함수** - stealth-sdk에서 직접 re-export
5. **모든 action 함수** - stealth-sdk에서 직접 re-export

### ⚠️ 래퍼로 제공되는 부분

1. **createStealthClient** - 플러그인 버전이 내부적으로 stealth-sdk 호출
   ```typescript
   // plugin-stealth/src/stealthClient.ts
   export function createStealthClient(config: StealthPluginConfig): StealthClient {
     return createStealthClientSDK({
       publicClient: config.publicClient,
       walletClient: config.walletClient,
       announcerAddress: config.announcerAddress,
       registryAddress: config.registryAddress,
     })
   }
   ```
   - **기능적으로 100% 동일**
   - **인터페이스만 플러그인 전용 타입 사용**

## 결론

### ✅ 완전한 기능 동일성

**`@stablenet/plugin-stealth`는 `@stablenet/stealth-sdk`의 모든 기능을 완전히 포함합니다.**

1. **65개의 모든 export가 re-export됨**
2. **추가 기능 4개 제공** (플러그인 전용 타입 및 편의 함수)
3. **코드 중복 없음** - 모든 기능이 stealth-sdk에 위임됨
4. **기능적으로 100% 동일** - 내부적으로 동일한 코드 실행

### 차이점 요약

| 항목 | stealth-sdk | plugin-stealth |
|------|-------------|----------------|
| **코드 중복** | 없음 | 없음 (모두 re-export) |
| **기능 동일성** | 기준 | 100% 동일 |
| **추가 기능** | 없음 | 4개 (타입 2개, 함수 2개) |
| **의존성** | 독립 | stealth-sdk 의존 |

### 권장 사항

1. ✅ **플러그인 사용 권장** - Core SDK와의 통합이 용이
2. ✅ **기존 stealth-sdk 코드와 100% 호환** - 마이그레이션 불필요
3. ✅ **추가 기능 활용** - 플러그인 전용 타입 및 편의 함수 사용 가능
