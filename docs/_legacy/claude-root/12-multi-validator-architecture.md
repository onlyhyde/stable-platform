# 12. Multi-Validator Architecture

## 개요

Kernel v3 (ERC-7579) 스마트 계정에서 ECDSA + WebAuthn + MultiSig 3개 validator를 SDK부터 Product까지 end-to-end로 지원하는 아키텍처.

**핵심 문제**: `kernelAccount.ts:75`에서 `getNonce(address, 0n)` 하드코딩으로 root validator(ECDSA)만 동작

**해결**: Kernel v3 nonce layout을 활용하여 validator 주소를 nonce key에 인코딩

---

## Kernel v3 Nonce Layout

```
EntryPoint v0.7: getNonce(address sender, uint192 key)

192-bit key (24 bytes):
| 1B mode | 1B vType | 20B validatorAddress | 2B nonceKey |

mode:
  0x00 = DEFAULT (installed validator)
  0x01 = ENABLE (install + validate in one UserOp)

vType:
  0x00 = ROOT (root validator, key = 0n)
  0x01 = VALIDATOR (address encoded in key)
  0x02 = PERMISSION (permission-based)
```

Root validator는 항상 `key = 0n`으로 접근. Non-root validator는 주소가 key에 인코딩됨.

---

## 아키텍처 레이어

```
┌─────────────────────────────────────────────┐
│ Product Layer                                │
│  ├─ wallet-extension (ValidatorRegistry,     │
│  │   SignatureRouter, WebAuthnBridge)         │
│  └─ web (useValidatorRouter, ValidatorSelector)│
├─────────────────────────────────────────────┤
│ SDK Layer                                    │
│  ├─ core/validatorRouter.ts  (orchestration) │
│  ├─ core/nonceUtils.ts       (nonce encoding)│
│  ├─ plugins/webauthn         (WebAuthn factory)│
│  ├─ plugins/multisig         (MultiSig factory)│
│  └─ accounts/kernelAccount.ts (Router support)│
└─────────────────────────────────────────────┘
```

---

## SDK 구성요소

### 1. nonceUtils (`core/src/modules/utils/nonceUtils.ts`)

| 함수 | 설명 |
|------|------|
| `encodeValidatorNonceKey(address, options)` | validator address → 192-bit nonce key |
| `decodeValidatorNonceKey(key)` | nonce key → `{ mode, type, address, nonceKey }` |
| `isRootValidator(key)` | `key === 0n` 또는 `type === ROOT` |

상수: `VALIDATION_MODE` (DEFAULT, ENABLE), `VALIDATION_TYPE` (ROOT, VALIDATOR, PERMISSION)

### 2. WebAuthn Validator Plugin (`plugins/webauthn/`)

```typescript
createWebAuthnValidator({
  pubKeyX, pubKeyY, credentialId,
  signFn: (challenge) => Promise<WebAuthnSignatureData>,
  validatorAddress?,
}) → Validator
```

- `signFn` 콜백으로 브라우저 WebAuthn API 호출을 Product에 위임
- `encodeWebAuthnValidatorInit`/`encodeWebAuthnSignature` 재사용
- s-value malleability fix 자동 적용

### 3. MultiSig Validator Plugin (`plugins/multisig/`)

```typescript
createMultiSigValidator({
  signers, threshold,
  collectSignatures: (hash) => Promise<CollectedSignature[]>,
  validatorAddress?,
}) → Validator
```

- 서명 수집 콜백으로 UI/백엔드 coordination 위임
- threshold 미달 시 에러, 중복 signer 거부
- 서명을 signer address 오름차순 정렬 후 concatenation

### 4. ValidatorRouter (`core/src/modules/validatorRouter.ts`)

```typescript
createValidatorRouter({
  rootValidator,
  installedValidators?,
}) → ValidatorRouter
```

| 메서드 | 설명 |
|--------|------|
| `getActiveValidator()` | 현재 활성 validator 반환 |
| `setActiveValidator(address)` | 활성 validator 전환 |
| `getActiveNonceKey()` | EntryPoint용 nonce key (0n or encoded) |
| `registerValidator(v)` / `unregisterValidator(addr)` | 동적 등록/해제 |
| `isRoot(address)` | root validator 여부 |

### 5. Enhanced KernelAccount

`toKernelSmartAccount`는 `Validator | ValidatorRouter`를 duck typing으로 감지:

```typescript
// Router 감지
const isRouter = 'getActiveValidator' in validator

// getNonce: 동적 key
args: [address, isRouter ? router.getActiveNonceKey() : 0n]

// signUserOperation: 활성 validator로 서명
const activeValidator = isRouter ? router.getActiveValidator() : validator
signature = await activeValidator.signHash(userOpHash)
```

**하위호환**: 기존 `toKernelSmartAccount({ validator: ecdsaValidator })` 코드 변경 없이 동작.

---

## Product Layer: Wallet Extension

### ValidatorRegistry (`background/validators/validatorRegistry.ts`)

- 계정별 active validator state 관리
- `chrome.storage.local`에 영속화
- 기본값: ECDSA (root validator)

### SignatureRouter (`background/validators/signatureRouter.ts`)

- `keyringController` (ECDSA), `WebAuthnBridge`, MultiSig collector 간 라우팅
- `ValidatorRegistry`에서 active type 조회 후 적절한 signing mechanism 호출

### WebAuthnBridge (`background/validators/webauthnBridge.ts`)

- Service Worker에서 `navigator.credentials` 접근 불가 문제 해결
- Chrome Offscreen Document API로 WebAuthn assertion 수행

### handler.ts 수정

- 6곳의 `getNonce(account, 0n)` → `getNonce(account, getNonceKeyForAccount(account))`
- `getNonceKeyForAccount`: ValidatorRegistry에서 active validator 조회 → nonce key 계산

---

## Product Layer: Web App

### useValidatorRouter Hook

SDK의 `createValidatorRouter`를 React hook으로 래핑. `useUserOp`의 `signUserOp` 콜백에 연결.

### ValidatorSelector Component

설치된 validator 목록을 드롭다운으로 표시, active validator 전환 UI.

---

## Validator 주소 (StableNet Chain 8283)

| Validator | Address |
|-----------|---------|
| ECDSA | `0xb33dc2d82eaee723ca7687d70209ed9a861b3b46` |
| WebAuthn | `0x169844994bd5b64c3a264c54d6b0863bb7df0487` |
| MultiSig | `0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5` |

---

## 테스트

| Test Suite | Location | Count |
|-----------|----------|-------|
| nonceUtils | `core/tests/modules/nonceUtils.test.ts` | 15 |
| WebAuthn plugin | `plugins/webauthn/tests/index.test.ts` | 11 |
| MultiSig plugin | `plugins/multisig/tests/index.test.ts` | 13 |
| ValidatorRouter | `core/tests/modules/validatorRouter.test.ts` | 17 |
| KernelAccount Router | `accounts/tests/kernelAccountRouter.test.ts` | 6 |
| **Total** | | **62** |

기존 테스트 영향: 0 (전체 SDK 테스트 397개 + ECDSA 15개 모두 통과)

---

## 파일 요약

| 파일 | 작업 |
|------|------|
| `sdk-ts/core/src/modules/utils/nonceUtils.ts` | **신규** — nonce encoding/decoding |
| `sdk-ts/core/src/modules/validatorRouter.ts` | **신규** — validator routing |
| `sdk-ts/core/src/modules/utils/index.ts` | **수정** — nonce utils export |
| `sdk-ts/core/src/modules/index.ts` | **수정** — router + nonce exports |
| `sdk-ts/core/src/index.ts` | **수정** — top-level exports |
| `sdk-ts/plugins/webauthn/*` | **신규** — WebAuthn Validator plugin |
| `sdk-ts/plugins/multisig/*` | **신규** — MultiSig Validator plugin |
| `sdk-ts/accounts/src/kernel/kernelAccount.ts` | **수정** — Router support + dynamic nonce |
| `wallet-extension/.../validators/*` | **신규** — registry, router, bridge |
| `wallet-extension/.../rpc/handler.ts` | **수정** — dynamic nonce key |
| `web/hooks/useValidatorRouter.ts` | **신규** — validator router hook |
| `web/components/smart-account/ValidatorSelector.tsx` | **신규** — validator UI |
