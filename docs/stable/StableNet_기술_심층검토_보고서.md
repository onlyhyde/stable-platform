# StableNet 기술 심층 검토 보고서

**문서 버전**: 2.0
**작성일**: 2026-01-09
**검토 목적**: 기술적 실현 가능성 10점 달성을 위한 요구사항 도출 및 VASP 라이센스 기술 요건 분석

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [기술 표준 현황 업데이트](#2-기술-표준-현황-업데이트)
3. [경쟁 체인 기술 스펙 비교](#3-경쟁-체인-기술-스펙-비교)
4. [StableNet 기술 주장 검증](#4-stablenet-기술-주장-검증)
5. [10점 달성을 위한 필수 요구사항](#5-10점-달성을-위한-필수-요구사항)
6. [VASP 라이센스 기술 요건](#6-vasp-라이센스-기술-요건)
7. [기술적 모호성 및 해결 과제](#7-기술적-모호성-및-해결-과제)
8. [권장 로드맵](#8-권장-로드맵)

---

## 1. Executive Summary

### 1.1 이전 검토의 오류 수정

| 항목 | 이전 평가 | 수정된 현황 (2026.01 기준) |
|------|----------|--------------------------|
| EIP-7702 | "아직 Draft, 미검증" | ✅ **2025년 5월 Pectra 업그레이드로 메인넷 라이브** |
| ERC-5564 | "Draft 상태" | ⚠️ **Release Candidate 단계, 컨트랙트 배포 완료, Trail of Bits 감사 중** |
| QBFT 3000 TPS | "조건부 가능" | ❌ **벤치마크상 200 TPS 수준, 3000 TPS는 검증 필요** |

### 1.2 업데이트된 기술 평가

| 항목 | 이전 점수 | 수정 점수 | 근거 |
|------|----------|----------|------|
| EIP-7702 구현 | 7/10 | 9/10 | 메인넷 라이브, 인프라 구축 완료 |
| ERC-5564 활용 | 5/10 | 7/10 | RC 단계, 실사용 가능 |
| QBFT 3000 TPS | 7/10 | 4/10 | 학술 벤치마크와 불일치, 증명 필요 |
| 전체 기술 | 7/10 | 6/10 | TPS 주장 검증 필요 |

---

## 2. 기술 표준 현황 업데이트

### 2.1 EIP-7702 (Native Account Abstraction)

#### 현재 상태: ✅ 프로덕션 준비 완료

```
타임라인:
- 2024년 5월: EIP 제안 (Vitalik Buterin 공동 저자)
- 2025년 5월 7일: Pectra 업그레이드로 이더리움 메인넷 적용
- 2025년 10월: Etherspot 공개 인프라 런칭 (EF 그랜트)
- 현재: 이더리움 메인넷 + Optimism에서 라이브
```

#### 핵심 기능

| 기능 | 설명 | StableNet 적용 |
|------|------|---------------|
| EOA 코드 위임 | EOA가 스마트컨트랙트처럼 동작 | Smart Account 구현 가능 |
| 트랜잭션 배칭 | 여러 작업을 하나의 TX로 | UX 개선 |
| 유연한 가스 지불 | ERC-20으로 가스비 지불 | 스테이블코인 가스비 |
| 소셜 리커버리 | 멀티시그, 복구 메커니즘 | 키 분실 대응 |

#### StableNet 적용 검증

```
✅ 검증됨: EIP-7702는 프로덕션 레디
✅ 검증됨: Smart Account 기능 구현 가능
✅ 검증됨: ERC-4337과 호환 (상호보완적)

⚠️ 확인 필요: StableNet의 자체 구현 감사 보고서
⚠️ 확인 필요: EIP-7702 트랜잭션 타입(0x04) 지원 여부
```

**출처**: [ethereum.org](https://ethereum.org/roadmap/account-abstraction/), [Etherspot Medium](https://medium.com/etherspot/eip-7702-infrastructure-launches-to-support-account-abstraction-for-eoas-3ef006497aed), [QuickNode Guide](https://www.quicknode.com/guides/ethereum-development/smart-contracts/eip-7702-smart-accounts)

---

### 2.2 ERC-5564 & ERC-6538 (Stealth Addresses)

#### 현재 상태: ⚠️ Release Candidate (프로덕션 근접)

```
타임라인:
- 2023년: ERC 제안
- 2024년: 커뮤니티 리뷰 및 피드백 반영
- 2025년: Release Candidate 단계, Trail of Bits 감사 진행 중
- 현재: 컨트랙트 배포 완료, SDK 알파 버전 제공
```

#### 배포된 컨트랙트

| 컨트랙트 | 주소 | 역할 |
|----------|------|------|
| ERC5564Announcer | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` | Stealth 주소 이벤트 발행 |
| ERC6538Registry | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` | Stealth 메타주소 레지스트리 |

#### StableNet Secret Account 검증

```
✅ 검증됨: ERC-5564 컨트랙트 배포 및 사용 가능
✅ 검증됨: TypeScript SDK 제공 (ScopeLift)
⚠️ 주의: Trail of Bits 감사 진행 중 (완료 아님)

❌ 문제점 유지:
- StableNet의 Secret Transfer Server는 ERC-5564와 별개
- 서버가 모든 정보 보유 → 진정한 Stealth가 아님
- 이는 표준 문제가 아닌 StableNet 설계 문제
```

**출처**: [ScopeLift Blog](https://scopelift.co/blog/progress-update-stealth-address-ercs), [ERC-5564 Spec](https://eips.ethereum.org/EIPS/eip-5564)

---

### 2.3 QBFT 합의 알고리즘 성능

#### 학술 벤치마크 결과

| 연구 | 검증자 수 | TPS | 지연시간 |
|------|----------|-----|---------|
| Web3 Labs (2022) | 4개 | 100-250 | 5-12초 |
| Hyperledger Besu (2023) | 4-12개 | 190-200 | 5초 |
| IEEE (2022) | 24개 | ~120 (42% 감소) | 증가 |

#### 핵심 발견

```
⚠️ QBFT 실제 성능:
- 4-12 검증자: 약 190-200 TPS
- 24 검증자: 약 120 TPS (42% 처리량 감소)
- 메시지 복잡도: O(n²) → 검증자 증가 시 급격한 성능 저하

❌ StableNet 주장 검증:
- 문서 주장: 3000 TPS
- 벤치마크 현실: 200 TPS 수준
- 격차: 15배 차이 → 검증 필수
```

#### 3000 TPS 달성 가능 조건

```
조건 1: 검증자 수 최소화 (4-7개)
  → 탈중앙화 vs 성능 트레이드오프

조건 2: 하드웨어 최적화
  → 고성능 서버, 전용 네트워크

조건 3: 블록 크기 및 가스 리밋 조정
  → 네트워크 안정성 리스크

조건 4: 자체 QBFT 최적화 (WBFT)
  → 구현체 감사 및 벤치마크 공개 필요
```

**출처**: [Web3 Labs Blog](https://blog.web3labs.com/blockchain-benchmarking-hyperledger-besu-with-hyperledger-caliper/), [IEEE Paper](https://ieeexplore.ieee.org/document/9899854/), [MDPI Research](https://www.mdpi.com/2504-2889/9/8/196)

---

## 3. 경쟁 체인 기술 스펙 비교

### 3.1 2025년 스테이블코인 네이티브 L1 체인 현황

| 체인 | 발행사 | 합의 | TPS | Finality | 가스 토큰 | 상태 |
|------|-------|------|-----|----------|----------|------|
| **Arc** | Circle | Malachite (BFT) | N/A | <1초 (780ms) | USDC | 테스트넷 (2025.10) |
| **Tempo** | Stripe/Paradigm | 자체 | 100K+ | <1초 | 모든 스테이블코인 | 테스트넷 (2025.12) |
| **Stable** | Tether/Bitfinex | N/A | N/A | N/A | USDT | 테스트넷 |
| **Plasma** | Plasma | N/A | N/A | N/A | USDT/ERC-20 | 개발중 |
| **StableNet** | ? | WBFT (QBFT 기반) | 3000 (주장) | 1초 | 원화 스테이블코인 | 불명확 |

### 3.2 Circle Arc 상세 스펙

```yaml
합의:
  알고리즘: Malachite (Tendermint 파생 BFT)
  검증자: 100개 (테스트넷 벤치마크)
  Finality: 780ms

수수료:
  기반: EIP-1559 확장
  변동성 완화: 블록 레벨 → 네트워크 수요 이동평균
  단위: USDC
  목적지: 온체인 Treasury

프라이버시:
  기술: TEE (Trusted Execution Environment)
  기능: 선택적 공개 (view keys)

호환성:
  EVM: 완전 호환
  도구: Solidity, Foundry, Hardhat

파트너:
  - 금융: BlackRock, Goldman Sachs, Deutsche Bank, Visa, Mastercard
  - 거래소: Coinbase, Kraken, Robinhood
  - 인프라: AWS, Cloudflare
```

**출처**: [Circle Blog](https://www.circle.com/blog/introducing-arc-an-open-layer-1-blockchain-purpose-built-for-stablecoin-finance), [CoinGecko](https://www.coingecko.com/learn/what-is-arc-stablechain)

### 3.3 Stripe Tempo 상세 스펙

```yaml
성능:
  TPS: 100,000+
  Finality: Sub-second
  수수료: $0.001 미만

핵심 기능:
  - Dedicated Payment Lanes
  - Enshrined AMM (스테이블코인 간 교환)
  - Memo Fields (결제 메타데이터)
  - Batch Transfers

가스:
  방식: 스테이블코인 애그노스틱
  지원: 모든 스테이블코인으로 가스비 지불

파트너:
  - 테크: OpenAI, Anthropic, Shopify, DoorDash
  - 금융: Deutsche Bank, Visa, UBS, Mastercard, Standard Chartered
  - 핀테크: Nubank, Revolut, Mercury, Klarna

투자:
  규모: $500M Series A
  밸류에이션: $5B
  투자자: Thrive Capital, Greenoaks, Sequoia, Ribbit Capital
```

**출처**: [Paradigm Blog](https://www.paradigm.xyz/2025/09/tempo-payments-first-blockchain), [Fortune](https://fortune.com/crypto/2025/10/17/stripe-paradigm-tempo-series-a-5-billion-thrive-capital-greenoaks-joshua-kushner/)

### 3.4 StableNet vs 경쟁 체인 GAP 분석

| 항목 | Arc | Tempo | StableNet | GAP |
|------|-----|-------|-----------|-----|
| **합의 상세** | Malachite 공개 | 자체 개발 | WBFT (상세 미공개) | ❌ |
| **TPS 검증** | 벤치마크 미공개 | 100K+ (주장) | 3000 (미검증) | ❌ |
| **Finality** | 780ms 벤치마크 | Sub-second | 1초 (미검증) | ⚠️ |
| **테스트넷** | 2025.10 공개 | 2025.12 공개 | 미공개 | ❌ |
| **파트너십** | 100+ 기업 | 50+ 기업 | 미공개 | ❌ |
| **자금 조달** | Circle (상장사) | $500M | 미공개 | ❌ |
| **소스코드** | 미공개 | 미공개 | "공개" (링크 없음) | ⚠️ |

---

## 4. StableNet 기술 주장 검증

### 4.1 검증된 주장

| 주장 | 상태 | 근거 |
|------|------|------|
| EIP-7702 지원 | ✅ 기술적 가능 | 표준 라이브, 구현 용이 |
| EVM 호환 | ✅ 기술적 가능 | go-ethereum 기반 |
| NativeCoinAdapter | ✅ 기술적 가능 | WETH 패턴, Arc도 동일 방식 |
| Blacklist 기능 | ✅ 기술적 가능 | 스마트컨트랙트로 구현 가능 |
| 1초 블록타임 | ✅ 가능 | QBFT 설정 가능 |

### 4.2 검증 필요한 주장

| 주장 | 상태 | 필요 검증 |
|------|------|----------|
| 3000 TPS | ❌ 의심 | 벤치마크 공개, 검증자 수 공개 |
| WBFT 알고리즘 | ⚠️ 미확인 | QBFT 대비 개선점 명시 |
| 1 block finality | ⚠️ 조건부 | 네트워크 조건에 따른 변동 |
| 1원 수수료 | ⚠️ 조건부 | 혼잡 시 수수료 상승 메커니즘 |
| No Inflation | ⚠️ 지속가능성 의문 | 검증자 인센티브 구조 |

### 4.3 문제있는 주장

| 주장 | 상태 | 문제점 |
|------|------|--------|
| Secret Account "프라이버시" | ❌ 오해 소지 | 서버가 모든 정보 보유, 진정한 stealth 아님 |
| Arc 대비 "거버넌스 우위" | ⚠️ 상대적 | Arc도 규제 준수 설계, 차이점 미미할 수 있음 |
| "소스코드 공개" | ⚠️ 미확인 | 공개 링크 없음 |

---

## 5. 10점 달성을 위한 필수 요구사항

### 5.1 필수 문서화

```
□ 기술 백서 (Technical Whitepaper)
  - WBFT 합의 알고리즘 상세 스펙
  - QBFT 대비 개선점 명시
  - 메시지 복잡도 분석
  - 검증자 선정/탈락 메커니즘

□ 성능 벤치마크 보고서
  - 테스트 환경 (하드웨어, 네트워크)
  - 검증자 수별 TPS 측정
  - 지연시간 분포
  - 부하 테스트 결과

□ 보안 감사 보고서
  - 합의 알고리즘 감사 (Consensus Audit)
  - 스마트컨트랙트 감사 (Contract Audit)
  - 인프라 보안 감사
  - 권장: Trail of Bits, OpenZeppelin, Certik

□ 토크노믹스 문서
  - 검증자 인센티브 구조
  - 수수료 분배 메커니즘
  - 인플레이션/디플레이션 정책
  - Treasury 운영 방안
```

### 5.2 필수 인프라

```
□ 퍼블릭 테스트넷
  - RPC 엔드포인트 공개
  - 블록 익스플로러
  - Faucet (테스트 토큰 배포)
  - 개발자 문서

□ 소스코드 공개
  - GitHub 저장소
  - 빌드 가이드
  - 노드 운영 가이드
  - 기여 가이드라인

□ 개발자 도구
  - SDK (JavaScript/TypeScript)
  - CLI 도구
  - 스마트컨트랙트 템플릿
  - 테스트 프레임워크 통합
```

### 5.3 필수 검증 항목

| 항목 | 검증 방법 | 수용 기준 |
|------|----------|----------|
| TPS | 독립 벤치마크 | 주장치의 80% 이상 |
| Finality | 네트워크 테스트 | 99.9% 1초 이내 |
| 가용성 | 장기 운영 테스트 | 99.9% 업타임 |
| 보안 | 외부 감사 | Critical 취약점 0개 |

### 5.4 점수 상향 로드맵

```
현재 → 7점:
  □ 테스트넷 공개
  □ 기술 문서 초안

7점 → 8점:
  □ 독립 기관 벤치마크
  □ 보안 감사 착수
  □ SDK 베타 공개

8점 → 9점:
  □ 보안 감사 완료
  □ 메인넷 베타
  □ 첫 번째 Minter 온보딩

9점 → 10점:
  □ 메인넷 정식 런칭
  □ 1년 이상 무사고 운영
  □ 다수 Minter 운영 중
  □ 외부 DApp 연동 실적
```

---

## 6. VASP 라이센스 기술 요건

### 6.1 한국 VASP 신고 필수 요건

```
1. ISMS 인증 (필수)
   - 정보보호 관리체계 인증
   - 예비인증 → 본인증 순서
   - 관리체계 16개 + 보호대책 64개 + 개인정보 21개 기준

2. 실명확인 입출금계정 (필수)
   - 은행 파트너십 필수
   - 실명계좌 연동 시스템

3. FIU 신고 수리 (필수)
   - 사업 내용 신고
   - 내부통제 체계 심사
   - 평균 소요 기간: 11-16개월
```

**출처**: [금융위원회 VASP 매뉴얼](https://www.fsc.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=75409&fileTy=ATTACH&fileNo=6), [KISA ISMS](https://isms.kisa.or.kr/main/)

### 6.2 ISMS 인증 기술 요구사항

#### 관리체계 수립 (16개 항목)

| 분류 | 항목 수 | 핵심 요구사항 |
|------|--------|-------------|
| 관리체계 기반 마련 | 4개 | 정책, 조직, 범위 정의 |
| 위험 관리 | 3개 | 위험 평가, 대응 계획 |
| 관리체계 운영 | 4개 | 구현, 교육, 모니터링 |
| 관리체계 점검 및 개선 | 5개 | 내부 감사, 개선 조치 |

#### 보호대책 요구사항 (64개 항목)

| 분류 | 항목 수 | StableNet 적용 |
|------|--------|---------------|
| 정책/조직/자산 관리 | 12개 | 거버넌스 문서화 필요 |
| 인적 보안 | 6개 | 팀 보안 교육 |
| 외부자 보안 | 4개 | Minter 계약 보안 조항 |
| 물리적 보안 | 7개 | 서버/HSM 보안 |
| 인증 및 권한관리 | 6개 | 다중서명, 권한분리 |
| 접근통제 | 7개 | 네트워크/시스템 접근제어 |
| 암호화 적용 | 2개 | 키 관리, 전송 암호화 |
| 개발 보안 | 6개 | 보안 개발 프로세스 |
| 시스템/서비스 운영관리 | 9개 | 변경관리, 백업 |
| 시스템/서비스 보안관리 | 5개 | 취약점 관리 |

#### 가상자산사업자 추가 요구사항

| 요구사항 | 설명 | 기술 구현 |
|----------|------|----------|
| **콜드월렛 보관** | 고객 자산 일정 비율 이상 | HSM + 다중서명 |
| **고객확인(KYC)** | 신원 확인 체계 | 신분증 OCR, 생체인증 |
| **의심거래보고(STR)** | 이상거래 탐지/보고 | AML 모니터링 시스템 |
| **고액현금거래보고(CTR)** | 1천만원 이상 거래 보고 | 자동 보고 시스템 |
| **Travel Rule** | 100만원 이상 이전 시 정보 전송 | VASP간 정보교환 프로토콜 |

**출처**: [KISA ISMS-P 인증기준 안내서](https://www.isac.or.kr/upload/ISMS-P%20인증기준%20안내서(2022.4.22).pdf), [IT Wiki](https://itwiki.kr/w/ISMS-P_인증_기준)

### 6.3 StableNet VASP 준비도 GAP 분석

| 요구사항 | StableNet 현황 | GAP |
|----------|---------------|-----|
| ISMS 인증 | 미확인 | ❌ |
| 실명계좌 연동 | 구조상 Minter 통해 가능 | ⚠️ |
| KYC 시스템 | Minter Manager 언급 | ⚠️ 상세 미확인 |
| AML 모니터링 | Chainalysis 연동 언급 | ⚠️ 계약 여부 미확인 |
| 콜드월렛 | 미언급 | ❌ |
| Travel Rule | 미언급 | ❌ |
| STR/CTR | 미언급 | ❌ |

### 6.4 스테이블코인 규제 전망 (2026-2027)

#### 현재 입법 현황

| 법안 | 발의자 | 자본금 요건 | 발행 주체 |
|------|--------|-----------|----------|
| 디지털자산기본법 | 민병덕 | 5억원 | 개방적 |
| 가치안정형자산법 | 안도걸 | 50억원 | 제한적 |
| 지급혁신법 | 김은혜 | 50억원 | 상환권 10일 |

#### 핵심 쟁점

```
쟁점 1: 발행 주체
  - 한국은행: 은행 51% 지분 보유 기관만 허용
  - 금융위: 지분율 법제화에 신중
  - 업계: 개방적 발행 요구

쟁점 2: 자본금 요건
  - 5억원 vs 50억원
  - StableNet 운영 주체의 자본금 확보 필요

쟁점 3: 담보 관리
  - 예치금 관리 주체
  - Proof of Reserve 요구 가능성
  - 은행 파트너십 필수
```

#### 예상 타임라인

```
2026년 상반기: 디지털자산기본법 국회 발의
2026년 하반기: 법안 심의
2027년 상반기: 법안 통과 (예상)
2027년 하반기: 시행령/시행규칙/가이드라인
2028년: 스테이블코인 발행 라이센스 신청 가능
```

**출처**: [ZDNet Korea](https://zdnet.co.kr/view/?no=20251218194000), [한경 비즈니스](https://magazine.hankyung.com/business/article/202512244162b), [Law.asia](https://law.asia/ko/korea-stablecoin-regulation-framework/)

---

## 7. 기술적 모호성 및 해결 과제

### 7.1 Critical 해결 과제

#### 과제 1: 3000 TPS 검증

```
문제:
- QBFT 벤치마크: 200 TPS (4-12 검증자)
- StableNet 주장: 3000 TPS
- 격차: 15배

해결 방안:
1. WBFT 알고리즘 상세 공개
   - QBFT 대비 어떤 최적화?
   - 메시지 복잡도 개선 방법?

2. 독립 벤치마크 실행
   - 환경: 검증자 수, 하드웨어 스펙
   - 측정: TPS, 지연시간, 장애 대응

3. 검증자 구성 공개
   - 몇 개의 검증자?
   - 지리적 분포?
   - 탈중앙화 수준?
```

#### 과제 2: 검증자 인센티브 구조

```
문제:
- 블록 보상 없음 (No Inflation)
- 수수료 1원
- 검증자 운영 비용 >> 수익

의문:
- 누가 왜 검증자를 운영하나?
- 지속 가능한가?

해결 방안:
1. 검증자 인센티브 모델 공개
   - 보조금 모델? Minter 의무?
   - Treasury 분배?

2. 경제성 분석
   - 검증자당 예상 비용
   - 검증자당 예상 수익
   - 손익분기점

3. 거버넌스 연계
   - 검증자 = Minter?
   - 이해관계 일치 설계?
```

#### 과제 3: Secret Account 설계 재검토

```
문제:
- "Secret"이라 하지만 서버가 모든 정보 보유
- ERC-5564의 stealth와 다른 구조
- 사용자 오해 가능

현재 구조:
User → Secret Transfer Server → PrivateBank Contract
         (모든 정보 보유)

개선 방안:
1. 명칭 변경
   - "Privacy Account" 또는 "Escrow Account"
   - 정확한 프라이버시 범위 명시

2. 또는 진정한 Stealth 구현
   - 서버 없는 온체인 Stealth
   - ZK-proof 활용 (성능 트레이드오프)

3. 규제 대응 명확화
   - 어떤 정보가 누구에게 공개되나?
   - 규제 당국 접근 절차
```

### 7.2 High Priority 해결 과제

#### 과제 4: 거버넌스 구조 상세화

```
4가지 거버넌스 역할 명시되었으나:
- GovValidator
- GovMasterMinter
- GovMinter
- GovCouncil

미해결 질문:
- 각 역할의 구체적 권한은?
- 멤버 선출/해임 절차는?
- 투표 메커니즘 (온체인/오프체인)?
- 정족수 및 결의 요건?
- 권한 남용 방지 메커니즘?
```

#### 과제 5: Bridge 보안

```
주장: Burn and Mint 방식 Native Bridge

미해결:
- Bridge 운영 주체?
- 다중서명 구조? (몇 of 몇?)
- 브릿지 자산 보험?
- 해킹 시 대응 절차?
- 감사 계획?
```

#### 과제 6: Minter 출금 독점

```
현재 설계:
- 일반인 직접 출금 불가
- Minter만 원화 출금 가능

리스크:
- Minter 독점적 지위
- 수수료 남용 가능
- Minter 부도 시 사용자 구제?

검토 필요:
- Minter 다중화 강제?
- 출금 수수료 상한선?
- 사용자 보호 기금?
```

### 7.3 Medium Priority 해결 과제

| 과제 | 현황 | 필요 조치 |
|------|------|----------|
| **Authorized Account 남용** | 기관 TX 우선처리 | 남용 방지 메커니즘 |
| **Blacklist 적법 절차** | 즉시 동결 가능 | 이의신청 절차 |
| **수수료 급등 시나리오** | BaseFee 증가 언급 | 상한선 및 완화 메커니즘 |
| **크로스체인 USDC/USDT** | CCIP 연동 예정 | 구체적 계획 |

---

## 8. 권장 로드맵

### 8.1 Phase 1: 기술 검증 (3-6개월)

```
□ Week 1-4: 문서화
  - 기술 백서 작성
  - WBFT 알고리즘 상세 공개
  - 토크노믹스 설계

□ Week 5-8: 테스트넷
  - 퍼블릭 테스트넷 런칭
  - 블록 익스플로러
  - 개발자 문서

□ Week 9-16: 검증
  - 독립 기관 벤치마크
  - 보안 감사 착수
  - 커뮤니티 테스트
```

### 8.2 Phase 2: VASP 준비 (6-12개월)

```
□ ISMS 인증
  - 예비인증 신청
  - 본인증 준비

□ 은행 파트너십
  - 실명계좌 연동 협의
  - 예치금 관리 계약

□ AML/KYC 인프라
  - Chainalysis 정식 계약
  - KYC 시스템 구축
  - STR/CTR 시스템

□ 법률 검토
  - 금융법 적법성 의견서
  - 규제 당국 사전 협의
```

### 8.3 Phase 3: 메인넷 런칭 (12-18개월)

```
□ 보안 감사 완료
□ 첫 Minter 온보딩
□ 메인넷 베타
□ 버그 바운티 프로그램
□ 메인넷 정식 런칭
```

### 8.4 Phase 4: 규제 대응 (18-24개월+)

```
□ 스테이블코인 라이센스 신청 (법안 통과 시)
□ 규제 요구사항 충족
□ 정기 감사 체계 구축
□ 글로벌 확장 (Bridge 활성화)
```

---

## 부록: 체크리스트

### A. 기술 10점 달성 체크리스트

```
문서화:
□ 기술 백서
□ WBFT 알고리즘 스펙
□ 벤치마크 보고서
□ 보안 감사 보고서
□ 토크노믹스 문서
□ 거버넌스 프레임워크

인프라:
□ GitHub 저장소 공개
□ 퍼블릭 테스트넷
□ 블록 익스플로러
□ SDK/CLI 도구
□ 개발자 문서

검증:
□ 독립 TPS 벤치마크
□ 보안 감사 통과
□ 6개월+ 테스트넷 운영
□ 외부 DApp 연동 테스트
```

### B. VASP 준비 체크리스트

```
필수 인증:
□ ISMS 예비인증
□ ISMS 본인증
□ 실명계좌 연동

필수 시스템:
□ KYC 시스템
□ AML 모니터링
□ STR/CTR 보고
□ Travel Rule 대응
□ 콜드월렛 (고객 자산)

필수 문서:
□ 내부통제 규정
□ 자금세탁방지 정책
□ 개인정보처리방침
□ 이용약관

파트너십:
□ 은행 (실명계좌)
□ AML 서비스 (Chainalysis 등)
□ 보안 감사 기관
□ 법률 자문
```

---

**문서 끝**

*본 문서는 2026년 1월 기준 공개 정보를 바탕으로 작성되었습니다.*

**참고 출처:**
- [Ethereum.org - Account Abstraction](https://ethereum.org/roadmap/account-abstraction/)
- [Circle Arc Blog](https://www.circle.com/blog/introducing-arc-an-open-layer-1-blockchain-purpose-built-for-stablecoin-finance)
- [Paradigm - Tempo](https://www.paradigm.xyz/2025/09/tempo-payments-first-blockchain)
- [KISA ISMS](https://isms.kisa.or.kr/main/)
- [금융위원회 VASP 매뉴얼](https://www.fsc.go.kr)
