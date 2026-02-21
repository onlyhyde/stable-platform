# StableNet Web App - Implementation Task Index

## Overview
apps/web 미완성 기능 구현 및 wallet-extension/SDK 기능 포팅 작업 목록.
각 문서는 순번대로 작업하며, 앞 작업의 핵심 요약이 문서 상단에 포함됨.

## Task List

| # | 파일 | 제목 | 난이도 | 영향도 |
|---|------|------|--------|--------|
| 1 | `01-DEFI-POOL.md` | DeFi Pool 유동성 로직 구현 | 중 | 높음 |
| 2 | `02-MERCHANT-DASHBOARD.md` | Merchant Dashboard 완성 | 중 | 중 |
| 3 | `03-MARKETPLACE-REGISTRY.md` | Marketplace 레지스트리 API 연동 | 낮음 | 중 |
| 4 | `04-TX-SPEEDUP-CANCEL.md` | Tx Speed-Up/Cancel 기능 추가 | 중 | 높음 |
| 5 | `05-BATCH-TRANSACTIONS.md` | Batch 트랜잭션 지원 | 중 | 중 |
| 6 | `06-FIAT-ONRAMP.md` | Fiat On-Ramp 페이지 추가 | 높음 | 높음 |
| 7 | `07-STAKING-LENDING.md` | Staking/Lending UI 추가 | 높음 | 중 |

## Architecture Context
- **Runtime**: Next.js 13+ (App Router), React, TypeScript
- **State**: Zustand (wallet), React Query (server), wagmi (wallet connection)
- **Chain**: StableNet Local (8283) - 로컬 전용
- **SDK**: `@stablenet/core`, `@stablenet/wallet-sdk`, `@stablenet/contracts`
- **Tx Modes**: EOA, EIP-7702, Smart Account (ERC-4337)
- **Bundler**: `http://127.0.0.1:4337`
- **Services**: Order Router (8087), Bank Simulator (3001), OnRamp Simulator (3002)

## Dependencies Between Tasks
```
Task 1 (Pool) ─── standalone
Task 2 (Merchant) ─── standalone
Task 3 (Marketplace) ─── standalone
Task 4 (SpeedUp/Cancel) ──┐
Task 5 (Batch) ───────────┤── 4, 5 모두 트랜잭션 관련이나 독립 구현 가능
                           │   5는 Send 페이지 확장이므로 4 이후 권장
Task 6 (OnRamp) ─── standalone (bank-simulator, onramp-simulator 필요)
Task 7 (Staking/Lending) ─── standalone (DeFi 섹션 확장)
```
