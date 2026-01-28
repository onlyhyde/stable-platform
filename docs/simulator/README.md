# Simulator Services Documentation

PoC를 위한 시뮬레이터 서비스 문서입니다.

## 개요

이 프로젝트는 실제 금융 서비스 연동 없이 다양한 사용자 시나리오를 테스트할 수 있도록 세 가지 시뮬레이터 서비스를 제공합니다.

| 서비스 | 포트 | 목적 |
|--------|------|------|
| bank-simulator | 4350 | 전통 은행/디지털 은행 기능 시뮬레이션 |
| pg-simulator | 4351 | 결제 게이트웨이 (PG) 기능 시뮬레이션 |
| onramp-simulator | 4352 | Fiat → Crypto 온램프 기능 시뮬레이션 |

## 기술 스택

- **언어**: Go 1.24
- **프레임워크**: Gin Web Framework
- **스토리지**: In-memory (PoC용)
- **보안**: HMAC-SHA256 웹훅 서명, Rate limiting

## 문서 구조

```
docs/simulator/
├── README.md                      # 이 문서
├── common/                        # 공통 스펙
│   ├── types.md                   # 공통 타입 정의
│   ├── status-mapping.md          # 서비스 간 상태 매핑
│   └── webhook-spec.md            # 웹훅 통합 스펙
├── bank-simulator/
│   ├── README.md                  # 서비스 개요 및 API 스펙
│   └── feature-specs/             # 기능별 상세 스펙
├── pg-simulator/
│   ├── README.md
│   └── feature-specs/
├── onramp-simulator/
│   ├── README.md
│   └── feature-specs/
└── cross-service/
    ├── README.md                  # 서비스 간 연동 개요
    └── integration-specs.md       # 연동 상세 스펙
```

## 우선순위 요약

### P0 - PoC 핵심 시나리오에 반드시 필요
1. bank-simulator: 입금/출금, 계좌 인증, Direct Debit API
2. pg-simulator: bank_transfer 결제 플로우 (bank-simulator 연동)
3. onramp-simulator: 결제 수단별 실제 연동 (PG/Bank 연동), KYC 플로우
4. cross-service: 서비스 간 HTTP 호출 연동 구현

### P1 - 현실적인 시나리오 구현에 필요
5. onramp-simulator: 지원 자산/네트워크 조회 API, 다중 환율
6. pg-simulator: 결제 완료 redirect URL, Checkout Session
7. bank-simulator: 통합 거래 내역 조회, 계좌 해지

### P2 - 완성도 향상
8. pg-simulator: 정산 시뮬레이션, 구독/정기결제
9. onramp-simulator: 월렛 주소 검증, 거래 한도
10. bank-simulator: 거래 한도

## 서비스 간 연동 플로우

```
┌─────────────────┐     bank_transfer      ┌─────────────────┐
│  pg-simulator   │ ────────────────────▶  │ bank-simulator  │
└─────────────────┘                        └─────────────────┘
        ▲                                          ▲
        │ card payment                             │ bank_transfer
        │                                          │
┌─────────────────┐                                │
│onramp-simulator │ ───────────────────────────────┘
└─────────────────┘
```

## 관련 문서

### 서비스별 문서
- [Bank Simulator](./bank-simulator/README.md)
- [PG Simulator](./pg-simulator/README.md)
- [Onramp Simulator](./onramp-simulator/README.md)
- [Cross-Service Integration](./cross-service/README.md)

### 공통 스펙
- [공통 타입 정의](./common/types.md) - 금액, 결제 수단, 체인, 통화 타입
- [상태 매핑](./common/status-mapping.md) - 서비스 간 상태값 매핑
- [웹훅 스펙](./common/webhook-spec.md) - 웹훅 페이로드, 서명, 재시도 정책

