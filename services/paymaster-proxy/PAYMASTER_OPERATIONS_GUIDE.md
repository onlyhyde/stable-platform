# StableNet Paymaster 가스 대납 시스템 운영 가이드

## 1. 지원하는 Paymaster 타입 (4종)

| Paymaster | 주소 (Chain 8283) | 대납 방식 |
|-----------|-------------------|-----------|
| **VerifyingPaymaster** | `0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0` | 오프체인 서명 기반 스폰서 대납 |
| **ERC20Paymaster** | `0xaf420BFE67697a5724235E4676136F264023d099` | 유저가 ERC-20 토큰으로 가스비 지불 |
| **Permit2Paymaster** | `0x7E2845f88a6c22A912F633DCEe45291543C7bCC0` | Uniswap Permit2 서명으로 토큰 지불 (approve 불필요) |
| **SponsorPaymaster** | `0x9DeAdA1cC07E2Ff8237c0517C1c2D2b9192D6580` | 백엔드 API 기반 정책 스폰서링 |

---

## 2. 각 Paymaster별 동작 원리

### A. VerifyingPaymaster (현재 paymaster-proxy가 지원하는 타입)

**흐름:**

1. 유저가 UserOp 생성
2. paymaster-proxy가 `pm_getPaymasterStubData`로 가스 추정용 stub 데이터 반환
3. 번들러가 가스 추정 완료
4. paymaster-proxy가 `pm_getPaymasterData`로 실제 서명 포함 데이터 반환
5. EntryPoint가 paymaster 컨트랙트의 `validatePaymasterUserOp()` 호출
6. 컨트랙트가 서명 검증 + 스폰서 deposit 확인
7. 실행 후 `postOp()`에서 실제 가스비 차감 (10% 마크업 적용)

**서명 데이터 구조:**

```
[mode: 1byte(0x00)] [validUntil: 6bytes] [validAfter: 6bytes] [signature: 65bytes]
```

### B. ERC20Paymaster

**흐름:**

1. 유저가 사용할 ERC-20 토큰 선택
2. 토큰을 paymaster에 approve
3. paymasterData에 토큰 주소 + maxTokenCost 인코딩
4. `validatePaymasterUserOp()`에서 오라클로 토큰/ETH 가격 조회
5. 필요한 토큰량 계산 (마크업 적용) → `transferFrom`으로 선지불
6. `postOp()`에서 실제 사용량 재계산 → 차액 환불

### C. Permit2Paymaster

**흐름:**

1. 유저가 EIP-712 Permit2 서명 생성 (별도 approve 불필요)
2. paymasterData에 토큰 + amount + expiration + nonce + signature 인코딩
3. `validatePaymasterUserOp()`에서 `permit2.permitTransferFrom()` 호출
4. 정확한 금액만 전송 (환불 없음)

### D. SponsorPaymaster

**흐름:**

1. 백엔드 API가 정책 기반으로 스폰서링 여부 결정
2. `pm_getSponsorPolicy` → 스폰서링 가능 여부 확인
3. `pm_getPaymasterStubData` / `pm_getPaymasterData` → 서버 측 서명 생성
4. 정책: 일일 한도, 화이트/블랙리스트, 가스 한도 등

---

## 3. 운영을 위한 필수 설정 사항

### 3-1. EntryPoint에 ETH Deposit (모든 Paymaster 공통)

Paymaster가 가스를 대납하려면, EntryPoint 컨트랙트에 충분한 ETH가 예치되어 있어야 합니다.

```bash
# VerifyingPaymaster에 10 ETH deposit
cast send <ENTRYPOINT_ADDRESS> "depositTo(address)" \
  0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  --value 10ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

**잔액 확인:**

```bash
cast call <ENTRYPOINT_ADDRESS> "balanceOf(address)(uint256)" \
  0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  --rpc-url http://localhost:8501
```

### 3-2. VerifyingPaymaster 설정

| 설정 항목 | 함수 | 설명 |
|-----------|------|------|
| Signer 등록 | `setVerifyingSigner(address)` | paymaster-proxy의 서명 키에 대응하는 주소를 등록 |
| 스폰서 등록 | `addSponsor(address)` | 스폰서 주소 등록 |
| 스폰서 deposit | `addDeposit(address)` (payable) | 스폰서의 내부 잔액 충전 |

```bash
# 1. verifyingSigner 설정 (paymaster-proxy 서명 계정의 주소)
cast send 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  "setVerifyingSigner(address)" \
  0x6631cc79bf6968a715F0e911096f2c93BD316d4D \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>

# 2. 스폰서 등록 및 deposit
cast send 0xFED3fc34Af59A30C5a19ff8Caf260604dDF39Fc0 \
  "addDeposit(address)" \
  0x<SPONSOR_ADDRESS> \
  --value 5ether \
  --rpc-url http://localhost:8501 \
  --private-key 0x<SPONSOR_PRIVATE_KEY>
```

> **중요:** `SIGNER_PRIVATE_KEY`로부터 도출되는 주소(여기서는 `0x6631cc79bf6968a715F0e911096f2c93BD316d4D`)가 컨트랙트의 `verifyingSigner`와 **반드시 일치**해야 합니다. 불일치 시 모든 서명 검증이 실패합니다.

### 3-3. ERC20Paymaster 설정

| 설정 항목 | 함수 | 설명 |
|-----------|------|------|
| 토큰 허용 | `setSupportedToken(address, bool)` | 지원할 ERC-20 토큰 등록 |
| 마크업 설정 | `setTokenMarkup(address, uint256)` | 토큰별 수수료 (basis points, 100 = 1%) |
| 오라클 설정 | `setPriceOracle(address)` | 가격 오라클 컨트랙트 주소 |

```bash
# 1. USDC 토큰 지원 활성화
cast send 0xaf420BFE67697a5724235E4676136F264023d099 \
  "setSupportedToken(address,bool)" \
  0x<USDC_ADDRESS> true \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>

# 2. USDC 마크업 1% 설정 (100 basis points)
cast send 0xaf420BFE67697a5724235E4676136F264023d099 \
  "setTokenMarkup(address,uint256)" \
  0x<USDC_ADDRESS> 100 \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>

# 3. PriceOracle 설정
cast send 0xaf420BFE67697a5724235E4676136F264023d099 \
  "setPriceOracle(address)" \
  0xD318D80033a53D23dfd93e1D005F56163FC41603 \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

### 3-4. PriceOracle 설정 (ERC20Paymaster용)

PriceOracle 주소 (Chain 8283): `0xD318D80033a53D23dfd93e1D005F56163FC41603`

```bash
# 토큰별 Uniswap V3 TWAP 풀 설정
cast send 0xD318D80033a53D23dfd93e1D005F56163FC41603 \
  "setTokenConfig(address,address,uint32,bool)" \
  0x<TOKEN_ADDRESS> \
  0x<UNISWAP_V3_POOL> \
  1800 \
  true \
  --rpc-url http://localhost:8501 \
  --private-key 0x<OWNER_PRIVATE_KEY>
```

**파라미터 설명:**

| 파라미터 | 설명 |
|----------|------|
| `token` | ERC-20 토큰 주소 |
| `pool` | Uniswap V3 풀 주소 (토큰/ETH 페어) |
| `twapWindow` | TWAP 계산 시간 윈도우 (초 단위, 1800 = 30분 권장) |
| `isToken0` | 풀에서 해당 토큰이 token0인지 여부 |

### 3-5. Permit2Paymaster

별도 admin 설정 없음. 배포 시 아래 주소가 고정됩니다:

- Permit2: `0x85F101809D84D795A79CE82B348D703Fe7c9D849`
- EntryPoint: 배포 시 지정

유저가 직접 EIP-712 서명을 생성하여 토큰 전송을 승인하는 방식입니다.

---

## 4. paymaster-proxy 서비스의 역할과 한계

### 하는 것

- ERC-7677 표준 RPC 엔드포인트 제공 (`pm_getPaymasterStubData`, `pm_getPaymasterData`)
- 오프체인 서명 생성 (VerifyingPaymaster / SponsorPaymaster용)
- 정책 기반 스폰서링 관리 (일일 한도, 화이트/블랙리스트, 가스 한도)
- 가스 비용 추정 및 제한
- 헬스체크 / 메트릭스 엔드포인트 (Kubernetes 대응)

### 하지 않는 것

- ERC-20 토큰 관련 처리 (ERC20Paymaster, Permit2Paymaster의 paymasterData 생성은 SDK에서 처리)
- 온체인 컨트랙트 호출 (단, auto-deposit 활성화 시 `depositTo` 호출은 예외)

### 추가 기능 (Phase 2)

- **Time Range Validation**: 서명 생성 시 validUntil/validAfter 유효성 강제 검증 (미래 시간, 순서, 최대 24h/최소 30s 윈도우)
- **Reservation Persistence**: JSON 파일 기반 reservation 영속 저장소 (`PAYMASTER_RESERVATION_DATA_DIR` 설정 시 활성화). 서비스 재시작 시 pending reservation 복원
- **Auto-Deposit**: `PAYMASTER_DEPOSIT_AUTO_ENABLED=true` 설정 시 EntryPoint 잔액이 임계값 이하일 때 자동 `depositTo` 실행 (쿨다운 5분, 기본 0.1 ETH)

---

## 5. 비용 구조 요약

| Paymaster | 누가 비용 부담 | 비용 형태 | 마크업 |
|-----------|---------------|-----------|--------|
| VerifyingPaymaster | 스폰서 (sponsorDeposits) | ETH | 10% (postOp에서 적용) |
| ERC20Paymaster | 유저 (토큰으로 지불) | ERC-20 토큰 | 설정 가능 (basis points) |
| Permit2Paymaster | 유저 (Permit2 서명) | ERC-20 토큰 | 고정 |
| SponsorPaymaster | 스폰서 (API 정책) | ETH | 정책 기반 |

---

## 6. paymaster-proxy 정책 시스템

### 정책 설정 항목

```typescript
{
  id: string,                    // 고유 식별자
  name: string,                  // 정책 이름
  active: boolean,               // 활성화 여부
  whitelist?: Address[],         // 허용 주소 목록
  blacklist?: Address[],         // 차단 주소 목록
  maxGasLimit?: bigint,          // 단일 오퍼레이션 최대 가스
  maxGasCost?: bigint,           // 단일 오퍼레이션 최대 비용 (wei)
  dailyLimitPerSender?: bigint,  // 주소별 일일 한도 (wei)
  globalDailyLimit?: bigint,     // 전체 일일 한도 (wei)
  startTime?: number,            // 정책 시작 시간 (unix)
  endTime?: number,              // 정책 종료 시간 (unix)
}
```

### 정책 관리 API

```bash
# 정책 목록 조회
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:4338/admin/policies

# 정책 생성/수정
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"id":"default","name":"Default Policy","active":true,"maxGasLimit":"5000000","dailyLimitPerSender":"100000000000000000"}' \
  http://localhost:4338/admin/policies

# 정책 삭제
curl -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:4338/admin/policies/default
```

### 정책 검증 순서

1. 정책 존재 여부 확인
2. 정책 활성화 여부 확인
3. 시간 윈도우 확인 (startTime/endTime)
4. 화이트리스트 확인 (설정된 경우)
5. 블랙리스트 확인 (설정된 경우)
6. 가스 한도 확인
7. 가스 비용 한도 확인
8. 주소별 일일 한도 확인
9. 전체 일일 한도 확인

---

## 7. 운영 체크리스트

### 공통

- [ ] 사용할 Paymaster 컨트랙트 배포 확인
- [ ] EntryPoint에 충분한 ETH deposit

### VerifyingPaymaster

- [ ] `setVerifyingSigner(address)` → proxy 서명키 주소 등록
- [ ] `addSponsor(address)` → 스폰서 주소 등록
- [ ] `addDeposit(address)` → 스폰서 내부 deposit 충전

### ERC20Paymaster

- [ ] `setSupportedToken(address, bool)` → 지원 토큰 등록
- [ ] `setTokenMarkup(address, uint256)` → 토큰별 마크업 설정
- [ ] `setPriceOracle(address)` → 오라클 주소 설정
- [ ] PriceOracle에 토큰별 풀 설정 (`setTokenConfig`)

### paymaster-proxy 서비스

- [ ] `.env` 파일 설정 (PAYMASTER_ADDRESS, SIGNER_PRIVATE_KEY, RPC_URL)
- [ ] 서비스 시작
- [ ] `/health` 엔드포인트로 정상 동작 확인
- [ ] 테스트 UserOp으로 대납 흐름 검증

---

## 8. 서비스 실행

```bash
# 빌드
pnpm build

# 실행 (환경 변수)
node --env-file=.env dist/cli/index.js run

# 실행 (CLI 인자)
node --env-file=.env dist/cli/index.js run \
  --paymaster 0x6631cc79bf6968a715F0e911096f2c93BD316d4D \
  --signer 0xaa46885d8c0bba1bee97183a1f63455835959373dfff365d2306bd5b043efec1 \
  --rpc http://localhost:8501 \
  --port 4338 \
  --debug
```

### 헬스체크

```bash
curl http://localhost:4338/health   # 전체 상태
curl http://localhost:4338/ready    # Readiness probe
curl http://localhost:4338/live     # Liveness probe
curl http://localhost:4338/metrics  # Prometheus 메트릭
```
