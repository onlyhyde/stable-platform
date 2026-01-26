# 10. Code Review Report

> **작성일**: 2026-01-26
> **대상**: StableNet PoC Platform 전체 코드베이스
> **범위**: packages/, services/, apps/, infra/

## 목차

1. [개요](#1-개요)
2. [심각도 분류 기준](#2-심각도-분류-기준)
3. [CRITICAL 이슈](#3-critical-이슈)
4. [HIGH 이슈](#4-high-이슈)
5. [MEDIUM 이슈](#5-medium-이슈)
6. [LOW 이슈](#6-low-이슈)
7. [영역별 요약](#7-영역별-요약)
8. [권장 조치 우선순위](#8-권장-조치-우선순위)

---

## 1. 개요

StableNet PoC Platform 전체 코드베이스를 대상으로 보안, 구현 완성도, 타입 안전성, 에러 처리, 코드 품질을 검토한 결과를 정리한다.

### 검토 대상

| 영역 | 패키지/서비스 수 | 주요 언어 |
|------|-----------------|----------|
| packages/ | 8개 (types, config, contracts, core, accounts, plugin-ecdsa, plugin-paymaster, plugin-session-keys, plugin-stealth) | TypeScript |
| services/ | 6개 (bundler, paymaster-proxy, stealth-server, order-router, subscription-executor, bridge-relayer) + 3개 simulator | TypeScript, Go, Rust |
| apps/ | 2개 (web, wallet-extension) | TypeScript (React, Next.js) |
| infra/ | Docker, docker-compose | Dockerfile, YAML |

### 이슈 현황 요약

| 심각도 | 건수 | 설명 |
|--------|------|------|
| CRITICAL | 7 | 즉시 수정 필요. 보안 취약점 또는 핵심 기능 미구현 |
| HIGH | 10 | 빠른 수정 필요. 보안 위험 또는 주요 품질 문제 |
| MEDIUM | 16 | 계획적 수정 필요. 운영 안정성 및 코드 품질 |
| LOW | 12 | 개선 권장. 유지보수성 향상 |

---

## 2. 심각도 분류 기준

- **CRITICAL**: 보안 취약점(인증 우회, 비밀키 노출), 핵심 비즈니스 로직 미구현
- **HIGH**: 보안 위험(CORS, 입력 검증 부재), 주요 기능 결함
- **MEDIUM**: 운영 안정성(에러 처리, 로깅), 코드 품질(타입 안전성)
- **LOW**: 코드 스타일, 하드코딩 상수, 테스트 부재(비핵심)

---

## 3. CRITICAL 이슈

### C-01. Docker Compose 비밀키 하드코딩

| 항목 | 내용 |
|------|------|
| **파일** | `docker-compose.yml:86,94,119,124` |
| **분류** | 보안 - Secret 관리 |
| **설명** | Bundler/Paymaster 비밀키가 docker-compose.yml에 기본값으로 하드코딩됨 |
| **위험** | 리포지토리 접근 시 비밀키 탈취 가능. 운영 환경 배포 시 자금 손실 위험 |

```yaml
# 현재 (취약)
BUNDLER_PRIVATE_KEY: ${BUNDLER_PRIVATE_KEY:-0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6}
PAYMASTER_SIGNER_PRIVATE_KEY: ${PAYMASTER_SIGNER_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}
```

**권장 조치**: 기본값 제거, Docker Secrets 또는 .env 파일 필수화, 시작 시 환경변수 존재 검증

---

### C-02. 데이터베이스 인증정보 노출

| 항목 | 내용 |
|------|------|
| **파일** | `docker-compose.yml:42-44,149` |
| **분류** | 보안 - 인증 |
| **설명** | PostgreSQL 기본 비밀번호 `stablenet` 하드코딩, SSL 미적용(`sslmode=disable`) |
| **위험** | DB 무단 접근 가능, 중간자 공격에 의한 데이터 탈취 |

**권장 조치**: 강력한 비밀번호 필수화, `sslmode=require` 적용, 네트워크 격리

---

### C-03. SDK 테스트 커버리지 0%

| 항목 | 내용 |
|------|------|
| **파일** | `packages/sdk/plugins/*/tests/index.test.ts` (6개 파일) |
| **분류** | 품질 - 테스트 |
| **설명** | SDK의 모든 테스트 파일이 `.todo()` stub 상태. 실제 테스트 코드 없음 |
| **위험** | 핵심 암호화 로직(stealth, ECDSA, paymaster) 검증 없이 사용 |

**해당 파일 목록**:
- `packages/sdk/plugins/ecdsa/tests/index.test.ts`
- `packages/sdk/plugins/paymaster/tests/index.test.ts`
- `packages/sdk/plugins/session-keys/tests/index.test.ts`
- `packages/sdk/plugins/stealth/tests/index.test.ts`
- `packages/sdk/packages/core/tests/index.test.ts`
- `packages/sdk/packages/accounts/tests/index.test.ts`

**권장 조치**: 최소 80% 커버리지 목표로 단위/통합 테스트 작성

---

### C-04. @stablenet/types, @stablenet/config 빈 패키지

| 항목 | 내용 |
|------|------|
| **파일** | `packages/types/src/index.ts`, `packages/config/src/index.ts` |
| **분류** | 구현 - 완성도 |
| **설명** | 두 패키지 모두 `export {}` 만 존재. 공유 타입/설정 정의 없음 |
| **위험** | SDK 소비자가 타입 참조 불가, 설정 관리 부재 |

**권장 조치**: 공유 타입 정의 이전, 설정 스키마 구현

---

### C-05. Stealth Server 서명 검증 미구현

| 항목 | 내용 |
|------|------|
| **파일** | `services/stealth-server/` (Rust) |
| **분류** | 보안 - 인증 |
| **설명** | Stealth announcement 등록 시 서명 검증 로직 미구현 |
| **위험** | 악의적 announcement 등록으로 스텔스 주소 시스템 무결성 훼손 |

**권장 조치**: secp256k1 서명 검증 구현, 중복 announcement 방지

---

### C-06. Subscription Executor UserOp 실행 미구현

| 항목 | 내용 |
|------|------|
| **파일** | `services/subscription-executor/internal/service/executor.go:195` |
| **분류** | 구현 - 핵심 로직 |
| **설명** | `TODO: Build and submit UserOperation via bundler` - 핵심 실행 로직이 stub 상태 |
| **위험** | 구독 결제 실행 불가, 타임스탬프만 업데이트하는 mock 동작 |

**권장 조치**: UserOperation 빌드/서명/제출 파이프라인 구현

---

### C-07. Wallet Extension eth_sendUserOperation 미구현

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/background/rpc/handler.ts:339,357` |
| **분류** | 구현 - 핵심 기능 |
| **설명** | UserOperation 제출 및 번들러 전달 로직 TODO 상태 |
| **위험** | 지갑에서 트랜잭션 전송 불가 |

**권장 조치**: bundler RPC 연동 구현, UserOp 서명/전달 파이프라인 완성

---

## 4. HIGH 이슈

### H-01. Bundler CORS 전체 허용

| 항목 | 내용 |
|------|------|
| **파일** | `services/bundler/src/rpc/server.ts:116` |
| **분류** | 보안 - 네트워크 |
| **설명** | `cors: { origin: true }` 설정으로 모든 origin 허용 |
| **위험** | 악의적 웹사이트에서 bundler API 직접 호출 가능 |

**권장 조치**: origin 화이트리스트 적용

---

### H-02. Simulator Webhook Secret 하드코딩

| 항목 | 내용 |
|------|------|
| **파일** | `services/bank-simulator/internal/config/config.go:24`, `services/onramp-simulator/`, `services/pg-simulator/` |
| **분류** | 보안 - Secret 관리 |
| **설명** | 기본 webhook secret `"bank-webhook-secret"` 등이 코드에 하드코딩 |
| **위험** | Webhook 위조 가능 |

**권장 조치**: 환경변수 필수화, 기본값 제거

---

### H-03. Go 서비스 입력 검증 부재

| 항목 | 내용 |
|------|------|
| **파일** | `services/order-router/internal/handler/router.go:40-58` 외 Go 서비스 전체 |
| **분류** | 보안 - 입력 검증 |
| **설명** | 쿼리 파라미터(토큰 주소, 금액)에 대한 형식 검증 없음. 주소 형식 미검증 |
| **위험** | 잘못된 입력으로 인한 예기치 않은 동작, injection 가능성 |

**권장 조치**: 이더리움 주소 형식 검증, 금액 범위 검증, 필수 파라미터 체크

---

### H-04. UserOperation Unpack Bounds Checking 없음

| 항목 | 내용 |
|------|------|
| **파일** | `services/bundler/src/validation/validator.ts` |
| **분류** | 보안 - 입력 검증 |
| **설명** | UserOperation 데이터 언패킹 시 바이트 길이 검증 부재 |
| **위험** | 비정상 UserOp에 의한 서비스 오류 또는 예기치 않은 동작 |

**권장 조치**: callData, paymasterAndData 등 필드별 길이 검증 추가

---

### H-05. 네트워크 격리 없는 서비스 노출

| 항목 | 내용 |
|------|------|
| **파일** | `docker-compose.yml` 전체 포트 매핑 |
| **분류** | 인프라 - 네트워크 보안 |
| **설명** | 모든 서비스가 `0.0.0.0`에 바인딩, PostgreSQL/Redis 포함 외부 노출 |
| **위험** | DB/캐시 무단 접근, 서비스 간 격리 없음 |

**권장 조치**: Docker network 분리, 필요 포트만 외부 노출, Redis 인증 활성화

---

### H-06. Wallet Extension 주소 체크섬 검증 결함

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/shared/security/inputValidator.ts:62-82,87-99` |
| **분류** | 보안 - 암호화 |
| **설명** | `toChecksumAddress()`가 keccak256 대신 간이 해시 사용. `hasValidChecksum()`이 mixed-case 주소에 대해 항상 true 반환 |
| **위험** | 잘못된 체크섬 주소로 자금 전송 가능 |

**권장 조치**: viem의 `getAddress()` 또는 keccak256 기반 EIP-55 체크섬 구현

---

### H-07. Vault 비밀번호 메모리 캐싱 취약점

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/background/keyring/vault.ts:229-231,266` |
| **분류** | 보안 - 인증 |
| **설명** | 비밀번호가 메모리에 평문 캐시, 세션 스토리지에 평문 저장 |
| **위험** | 메모리 접근 공격으로 비밀번호 탈취 가능 |

**권장 조치**: 메모리 캐시 시간 제한, 세션 복원 시 재인증 요구

---

### H-08. Smart Account 페이지 비밀키 React State 노출

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/app/smart-account/page.tsx:55,71,98,150` |
| **분류** | 보안 - 키 관리 |
| **설명** | 비밀키가 React state에 저장, 컴포넌트 언마운트 시 메모리 정리 없음, React DevTools에서 노출 |
| **위험** | 브라우저 도구로 비밀키 열람 가능 |

**권장 조치**: 비밀키는 ref 또는 일회성 처리, 사용 후 즉시 제거

---

### H-09. `as any` 타입 우회 사용

| 항목 | 내용 |
|------|------|
| **파일** | bundler, wallet-extension 등 다수 |
| **분류** | 품질 - 타입 안전성 |
| **설명** | TypeScript strict 모드에서 `as any`를 사용하여 타입 검사 우회 |
| **위험** | 런타임 타입 오류 가능성 |

**권장 조치**: 명시적 타입 정의로 대체, unknown + 타입 가드 패턴 사용

---

### H-10. Promise Rejection 미처리

| 항목 | 내용 |
|------|------|
| **파일** | 서비스 및 앱 전반 |
| **분류** | 안정성 - 에러 처리 |
| **설명** | async 함수의 rejection이 catch 없이 전파되는 경우 존재 |
| **위험** | 미처리 rejection으로 서비스 중단 가능 |

**권장 조치**: 모든 async 호출에 에러 핸들링 추가, global unhandledRejection 핸들러 설정

---

## 5. MEDIUM 이슈

### M-01. Rate Limiting 미구현

| 항목 | 내용 |
|------|------|
| **파일** | 모든 서비스 |
| **분류** | 보안 - DoS 방지 |
| **설명** | RPC 엔드포인트, API에 요청 제한 없음 |

**권장 조치**: IP/origin 기반 rate limiter 적용 (예: bundler RPC, order-router API)

---

### M-02. Request Body Size Limit 미설정

| 항목 | 내용 |
|------|------|
| **파일** | `services/bundler/src/rpc/server.ts`, Go 서비스 핸들러 |
| **분류** | 보안 - 리소스 보호 |
| **설명** | 요청 본문 크기 제한 미설정 |

**권장 조치**: 서비스별 적정 body size limit 설정

---

### M-03. 에러 응답 정보 노출

| 항목 | 내용 |
|------|------|
| **파일** | `services/bundler/src/rpc/server.ts:150,175`, Go simulator 핸들러 전체 |
| **분류** | 보안 - 정보 노출 |
| **설명** | 디버그 로그에 파라미터 포함, 에러 메시지에 내부 상태 노출(provider명, aggregator명), 스택 트레이스 클라이언트 전달 |

**권장 조치**: 운영 환경 에러 메시지 마스킹, 디버그 로깅 조건부 활성화

---

### M-04. Gas Price 0 Fallback

| 항목 | 내용 |
|------|------|
| **파일** | `services/bundler/src/` gas 관련 로직 |
| **분류** | 안정성 - 비즈니스 로직 |
| **설명** | gas price 조회 실패 시 0으로 fallback하는 경우 존재 |

**권장 조치**: 최소 gas price 하한선 설정, 0 fallback 방지

---

### M-05. Docker 컨테이너 root 실행

| 항목 | 내용 |
|------|------|
| **파일** | `infra/docker/Dockerfile.node`, `infra/docker/Dockerfile.go` |
| **분류** | 인프라 - 보안 |
| **설명** | `USER` 지시어 없음. 컨테이너가 root로 실행 |

**권장 조치**: 비특권 사용자(`node`, `appuser`) 지정

---

### M-06. Webhook 비동기 경쟁 조건

| 항목 | 내용 |
|------|------|
| **파일** | `services/onramp-simulator/internal/service/onramp.go:120` |
| **분류** | 안정성 - 동시성 |
| **설명** | Webhook 전송이 데이터 저장 전에 발생하여 데이터 불일치 가능 |

**권장 조치**: 데이터 저장 완료 후 webhook 전송

---

### M-07. Simulator 에러 메시지 존재 여부 노출

| 항목 | 내용 |
|------|------|
| **파일** | Go simulator 서비스 전체 핸들러 |
| **분류** | 보안 - 정보 노출 |
| **설명** | "account not found", "payment not found" 등 존재 여부를 노출하는 에러 메시지 |

**권장 조치**: 존재 여부와 무관한 일반적 에러 메시지 사용

---

### M-08. PG Simulator 카드 데이터 처리

| 항목 | 내용 |
|------|------|
| **파일** | `services/pg-simulator/internal/service/payment.go:58-61,204-222` |
| **분류** | 보안 - 데이터 보호 |
| **설명** | 카드 번호 전체 저장, 간이 브랜드 감지(첫 자리만), Luhn/CVV/만료일 검증 없음 |

**권장 조치**: 카드 데이터 마스킹, PCI DSS 기본 검증 추가 (시뮬레이터라도 패턴 수립)

---

### M-09. API BaseApi 에러 처리 미흡

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/lib/api/baseApi.ts:67,80-92` |
| **분류** | 안정성 - 에러 처리 |
| **설명** | JSON 파싱 실패 시 빈 객체 반환(`.catch(() => ({}))`), 클라이언트/서버/네트워크 에러 미구분 |

**권장 조치**: 에러 유형별 처리, 재시도 로직 추가

---

### M-10. 세션 복원 시 재인증 없음

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/background/keyring/vault.ts:204-240` |
| **분류** | 보안 - 인증 |
| **설명** | 확장 프로그램 재시작 시 비밀번호 재입력 없이 세션 복원 |

**권장 조치**: 만료 시간 단축, 재인증 요구 옵션 제공

---

### M-11. Phishing Detection 미지 도메인 기본값

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/shared/security/phishingDetector.ts:274-277` |
| **분류** | 보안 - 피싱 방지 |
| **설명** | 미지 도메인에 대해 "safe" 기본값 반환, 외부 피싱 DB 미연동 |

**권장 조치**: 미지 도메인 MEDIUM 위험으로 분류, PhishTank 등 외부 목록 연동

---

### M-12. Console.log 운영 코드 잔존

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/background/controllers/approvalController.ts:389`, `src/ui/components/Header.tsx:20`, `src/inpage/index.ts:392-403`, `src/approval/pages/ConnectApproval.tsx:52` |
| **분류** | 품질 - 로깅 |
| **설명** | 운영 코드에 `console.error`, `console.warn` 잔존 |

**권장 조치**: 구조화된 로거로 대체, 빌드 시 console 제거

---

### M-13. Web App 에러 메시지 UI 노출

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/app/smart-account/page.tsx:117-124,169-176` |
| **분류** | 보안 - 정보 노출 |
| **설명** | 원시 에러 메시지를 사용자 UI에 그대로 표시 |

**권장 조치**: 사용자 친화적 에러 메시지로 매핑, 상세 에러는 로그에만 기록

---

### M-14. Order Router 환경변수 검증 없음

| 항목 | 내용 |
|------|------|
| **파일** | `services/order-router/cmd/main.go:14` |
| **분류** | 안정성 - 설정 관리 |
| **설명** | `config.Load()` 에러 처리 없음, 필수 환경변수 존재 검증 없음, RPC URL 연결 테스트 없음 |

**권장 조치**: 시작 시 필수 설정 검증, 연결 health check 추가

---

### M-15. Paymaster API Key 검증 부재

| 항목 | 내용 |
|------|------|
| **파일** | `packages/sdk/plugins/paymaster/src/sponsorPaymaster.ts:32` |
| **분류** | 보안 - 인증 |
| **설명** | API key가 빈 문자열이어도 Authorization 헤더에 포함 |

**권장 조치**: API key 존재/형식 검증 후 헤더 추가

---

### M-16. Subscription Executor 멱등성 미보장

| 항목 | 내용 |
|------|------|
| **파일** | `services/subscription-executor/internal/service/executor.go` |
| **분류** | 안정성 - 동시성 |
| **설명** | 재시작 시 중복 실행 방지 메커니즘 없음, 실패 시 재시도 로직 없음 |

**권장 조치**: 실행 ID 기반 멱등성 체크, 지수 백오프 재시도 구현

---

## 6. LOW 이슈

### L-01. 하드코딩된 Gas Limit

| 항목 | 내용 |
|------|------|
| **파일** | bundler 서비스 내 gas 관련 상수 |
| **분류** | 유지보수 - 설정 |
| **설명** | gas limit 값이 코드에 직접 지정 |

**권장 조치**: 설정 파일 또는 환경변수로 외부화

---

### L-02. 하드코딩된 Validity Window

| 항목 | 내용 |
|------|------|
| **파일** | paymaster 관련 코드 |
| **분류** | 유지보수 - 설정 |
| **설명** | 유효기간 창(validity window) 값이 하드코딩 |

**권장 조치**: 설정으로 외부화

---

### L-03. Go 서비스 테스트 부재

| 항목 | 내용 |
|------|------|
| **파일** | `services/order-router/`, `services/subscription-executor/`, `services/bank-simulator/`, `services/onramp-simulator/`, `services/pg-simulator/` |
| **분류** | 품질 - 테스트 |
| **설명** | Go 서비스에 테스트 파일 없음 |

**권장 조치**: 핵심 로직 단위 테스트 작성

---

### L-04. Bridge Relayer Stub 상태

| 항목 | 내용 |
|------|------|
| **파일** | `services/bridge-relayer/` |
| **분류** | 구현 - 완성도 |
| **설명** | 크로스 체인 브릿지 릴레이어가 기본 구조만 존재 |

**권장 조치**: PoC 범위에 따라 구현 또는 명시적 제외

---

### L-05. Webhook 타임아웃 10초

| 항목 | 내용 |
|------|------|
| **파일** | Go simulator 서비스 전체 |
| **분류** | 안정성 - 네트워크 |
| **설명** | Webhook 전송 타임아웃이 10초로 설정, 실패 시 무시(silent failure) |

**권장 조치**: 재시도 큐 구현, 실패 알림

---

### L-06. Simulator 비암호학적 난수 사용

| 항목 | 내용 |
|------|------|
| **파일** | `services/onramp-simulator/internal/service/onramp.go:220` |
| **분류** | 품질 - 코드 정확성 |
| **설명** | 시뮬레이션 결과 결정에 `rng.Intn()` 사용 (비시드 상태) |

**권장 조치**: 시뮬레이터 맥락에서는 허용 가능하나, 시드 기반 재현 가능한 난수 고려

---

### L-07. EOF 비교 취약 패턴

| 항목 | 내용 |
|------|------|
| **파일** | `services/pg-simulator/internal/handler/payment.go:106` |
| **분류** | 품질 - 에러 처리 |
| **설명** | `err.Error() != "EOF"` 문자열 비교로 에러 판단 |

**권장 조치**: `errors.Is(err, io.EOF)` 사용

---

### L-08. Simulator 중복 결제 감지 없음

| 항목 | 내용 |
|------|------|
| **파일** | `services/pg-simulator/` |
| **분류** | 품질 - 비즈니스 로직 |
| **설명** | 동일 결제 중복 요청 감지 메커니즘 없음 |

**권장 조치**: idempotency key 기반 중복 방지 (시뮬레이터 품질 향상)

---

### L-09. Contracts 패키지 Zero Address 기본값

| 항목 | 내용 |
|------|------|
| **파일** | `packages/contracts/src/addresses.ts:152` 부근 |
| **분류** | 품질 - 안전성 |
| **설명** | 컨트랙트 주소 기본값으로 zero address 사용 |

**권장 조치**: PoC 맥락에서 허용 가능하나, 런타임 zero address 체크 추가 권장

---

### L-10. Web App 비밀키 자동 채움

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/app/smart-account/page.tsx:71` |
| **분류** | UX - 보안 |
| **설명** | Anvil 계정 비밀키가 자동 채움되며, 사용자 확인 없음 |

**권장 조치**: 개발 환경 전용 표시, 운영 환경 비활성화

---

### L-11. Inpage Script 다중 Console 출력

| 항목 | 내용 |
|------|------|
| **파일** | `apps/wallet-extension/src/inpage/index.ts:392-403` |
| **분류** | 품질 - 로깅 |
| **설명** | 인페이지 스크립트에 다수의 `console.warn`, `console.error` 호출 |

**권장 조치**: 빌드 시 제거 또는 조건부 로깅

---

### L-12. Go 서비스 로그에 민감 정보

| 항목 | 내용 |
|------|------|
| **파일** | Go simulator/executor 서비스 전체 |
| **분류** | 보안 - 로깅 |
| **설명** | `log.Printf`로 구독 ID, 거래 상세, nonce 등 로깅 |

**권장 조치**: 구조화된 로거(zerolog 등) 도입, 민감 필드 마스킹

---

## 7. 영역별 요약

### 7.1 Packages (SDK)

| 패키지 | 구현 상태 | 테스트 | 타입 안전성 | 보안 |
|--------|----------|--------|-----------|------|
| @stablenet/types | ❌ 빈 패키지 | ❌ 없음 | N/A | N/A |
| @stablenet/config | ❌ 빈 패키지 | ❌ 없음 | N/A | N/A |
| @stablenet/contracts | ✅ 완전 | ❌ 없음 | ✅ 우수 | ✅ 양호 |
| plugin-ecdsa | ✅ 완전 | ❌ Stub | ✅ 우수 | ✅ 양호 |
| plugin-paymaster | ✅ 완전 | ❌ Stub | ✅ 우수 | ⚠️ API Key |
| plugin-session-keys | ✅ 완전 | ❌ Stub | ✅ 우수 | ✅ 양호 |
| plugin-stealth | ✅ 완전 | ❌ Stub | ✅ 우수 | ✅ 우수 |
| core | ❌ Stub | ❌ Stub | N/A | N/A |

### 7.2 Services

| 서비스 | 보안 | 입력 검증 | 에러 처리 | 구현 완성도 |
|--------|------|----------|----------|-----------|
| bundler | ⚠️ CORS 허용 | ✅ 우수 (6단계) | ✅ 우수 | ✅ 완전 |
| paymaster-proxy | ✅ 양호 | ✅ 양호 | ✅ 양호 | ✅ 완전 |
| stealth-server | ⚠️ 서명 미검증 | ⚠️ 부분적 | ✅ 양호 | ⚠️ 부분적 |
| order-router | ⚠️ Rate Limit 없음 | ⚠️ 부분적 | ✅ 양호 | ✅ 완전 |
| subscription-executor | ❌ 핵심 미구현 | ⚠️ 최소 | ⚠️ Silent 실패 | ❌ Stub |
| bridge-relayer | ⚠️ 기본 구조만 | N/A | N/A | ❌ Stub |
| bank-simulator | ⚠️ 하드코딩 Secret | ⚠️ 최소 | ⚠️ 정보 노출 | ✅ 완전 |
| onramp-simulator | ⚠️ 하드코딩 Secret | ⚠️ 최소 | ⚠️ 정보 노출 | ⚠️ Mock |
| pg-simulator | ⚠️ PII 처리 | ⚠️ 카드 미검증 | ⚠️ 정보 노출 | ⚠️ 부분적 |

### 7.3 Apps

| 앱 | 보안 | 에러 처리 | 구현 완성도 | 코드 품질 |
|---|------|----------|-----------|----------|
| web | ⚠️ 비밀키 State 저장 | ⚠️ 원시 에러 노출 | ✅ 양호 | ✅ 양호 |
| wallet-extension | ⚠️ 체크섬/Vault | ⚠️ BaseApi 미흡 | ⚠️ 핵심 TODO 존재 | ⚠️ console 잔존 |

### 7.4 Infrastructure

| 항목 | 상태 | 주요 이슈 |
|------|------|----------|
| docker-compose.yml | ⚠️ | 비밀키 하드코딩, 네트워크 격리 없음 |
| Dockerfile.node | ⚠️ | root 실행 |
| Dockerfile.go | ⚠️ | root 실행 |

---

## 8. 권장 조치 우선순위

### Phase 1: 즉시 조치 (CRITICAL + 보안 HIGH)

| 순서 | 이슈 ID | 조치 내용 |
|------|---------|----------|
| 1 | C-01, C-02 | docker-compose.yml 비밀키/비밀번호 기본값 제거 |
| 2 | H-05 | Docker network 분리, 불필요 포트 노출 제거 |
| 3 | H-06 | 주소 체크섬 검증을 keccak256 기반으로 교체 |
| 4 | H-07, H-08 | Vault 비밀번호 캐싱 개선, React state 비밀키 처리 개선 |
| 5 | H-01 | Bundler CORS origin 화이트리스트 적용 |
| 6 | H-02 | Simulator webhook secret 환경변수 필수화 |

### Phase 2: 핵심 기능 완성 (구현 CRITICAL)

| 순서 | 이슈 ID | 조치 내용 |
|------|---------|----------|
| 7 | C-06 | Subscription Executor UserOp 실행 파이프라인 구현 |
| 8 | C-07 | Wallet Extension eth_sendUserOperation 구현 |
| 9 | C-05 | Stealth Server 서명 검증 구현 |
| 10 | C-04 | @stablenet/types, @stablenet/config 구현 |

### Phase 3: 품질 강화 (테스트 + 안정성)

| 순서 | 이슈 ID | 조치 내용 |
|------|---------|----------|
| 11 | C-03 | SDK 전 플러그인 테스트 작성 (80%+ 커버리지) |
| 12 | L-03 | Go 서비스 단위 테스트 작성 |
| 13 | M-01, M-02 | Rate limiting, body size limit 적용 |
| 14 | M-05 | Dockerfile에 비특권 사용자 지정 |
| 15 | H-03 | Go 서비스 입력 검증 강화 |

### Phase 4: 운영 준비 (MEDIUM + LOW)

| 순서 | 이슈 ID | 조치 내용 |
|------|---------|----------|
| 16 | M-03, M-07, M-13 | 에러 메시지 마스킹 |
| 17 | M-12, L-11, L-12 | 구조화된 로깅 도입 |
| 18 | M-06, M-16 | 비동기 처리 안정성 강화 |
| 19 | 나머지 | 하드코딩 상수 외부화, 코드 정리 |
