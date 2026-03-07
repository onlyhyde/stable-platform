# Tempo vs Reth 상세 기술 비교

## 1. 컨센서스 메커니즘 (Consensus)

### Reth
```rust
// reth/crates/consensus/consensus/src/lib.rs
pub trait Consensus: HeaderValidator + Debug + Send + Sync {
    fn validate_body_against_header(...) -> Result<(), ConsensusError>;
}
```
- **Engine API** 기반: CL(Consensus Layer)과 EL(Execution Layer) 분리
- 일반적인 `Consensus` trait 정의
- ~40개의 `ConsensusError` 변형
- 다양한 이더리움 컨센서스 구현 지원

### Tempo
```rust
// tempo/crates/consensus/src/lib.rs
pub struct TempoConsensus {
    inner: EthBeaconConsensus<TempoChainSpec>,
}
```
- **Commonware Simplex**: 서브초(sub-second) 최종성을 위한 독자적 컨센서스
- `EthBeaconConsensus`를 래핑하여 결제 특화 검증 추가
- 추가 검증 항목:
  - `shared_gas_limit` / `general_gas_limit` 검증
  - `timestamp_millis_part` (밀리초 정밀도)
  - 블록 끝 시스템 트랜잭션 검증
- 상수: `TEMPO_GENERAL_GAS_DIVISOR = 2`, `TEMPO_SHARED_GAS_DIVISOR = 10`

---

## 2. EVM / 프리컴파일 (Precompiles)

### Reth
- 표준 이더리움 프리컴파일만 지원 (ecRecover, SHA256, RIPEMD160, identity 등)
- EIP 스펙에 따른 하드포크별 프리컴파일 활성화

### Tempo
```rust
// tempo/crates/precompiles/src/lib.rs
pub fn extend_tempo_precompiles(precompiles: &mut PrecompilesMap, cfg: &CfgEnv<TempoHardfork>) {
    // 8개의 커스텀 프리컴파일
}
```

| 프리컴파일 | 기능 | 주소 |
|-----------|------|------|
| **TIP20Token** | Enshrined ERC-20 토큰 | 동적 (TIP20 접두사) |
| **TIP20Factory** | 토큰 팩토리 | 고정 |
| **TIP403Registry** | 정책 레지스트리 (KYC/컴플라이언스) | 고정 |
| **TipFeeManager** | 수수료 관리 | 고정 |
| **StablecoinDEX** | 온체인 스테이블코인 DEX | 고정 |
| **NonceManager** | 2D 논스 관리 | 고정 |
| **ValidatorConfig** | 밸리데이터 설정 | 고정 |
| **AccountKeychain** | 키 관리 (P256/WebAuthn) | 고정 |

---

## 3. 트랜잭션 타입 (Transaction Types)

### Reth
- 표준 이더리움 트랜잭션: Legacy, EIP-2930, EIP-1559, EIP-4844, EIP-7702
- 1차원 논스 시스템

### Tempo
```rust
// tempo/crates/primitives/src/transaction/tempo_transaction.rs
pub const TEMPO_TX_TYPE_ID: u8 = 0x76;

pub struct TempoTransaction {
    pub chain_id: ChainId,
    pub fee_token: Option<Address>,           // 수수료 토큰 선택
    pub max_priority_fee_per_gas: u128,
    pub max_fee_per_gas: u128,
    pub gas_limit: u64,
    pub calls: Vec<Call>,                     // 다중 호출
    pub access_list: AccessList,

    // 2D 논스 시스템
    pub nonce_key: U256,                      // 논스 키
    pub nonce: u64,                           // 해당 키의 논스

    // 가스 스폰서십
    pub fee_payer_signature: Option<Signature>,

    // 스케줄된 트랜잭션
    pub valid_before: Option<u64>,
    pub valid_after: Option<u64>,

    // 키 인증
    pub key_authorization: Option<SignedKeyAuthorization>,
    pub tempo_authorization_list: Vec<TempoSignedAuthorization>,
}
```

**서명 타입**:
```rust
pub enum SignatureType {
    Secp256k1 = 0,  // 65 bytes
    P256 = 1,       // 129 bytes
    WebAuthn = 2,   // 최대 2KB
}
```

---

## 4. 트랜잭션 풀 (Transaction Pool)

### Reth
- 표준 1차원 논스 기반 풀
- sender → nonce → transaction 매핑
- Pending/Queued 구분

### Tempo
```rust
// tempo/crates/transaction-pool/src/tt_2d_pool.rs
pub struct AA2dPool {
    submission_id: u64,
    independent_transactions: HashMap<AASequenceId, PendingTransaction<Ordering>>,
    by_id: BTreeMap<AA2dTransactionId, AA2dInternalTransaction>,
    by_hash: HashMap<TxHash, Arc<ValidPoolTransaction<TempoPooledTransaction>>>,
    slot_to_seq_id: HashMap<U256, AASequenceId>,  // NonceManager 스토리지 슬롯 역색인
    seq_id_to_slot: HashMap<AASequenceId, U256>,
    config: AA2dPoolConfig,
    metrics: AA2dPoolMetrics,
}
```

**2D 논스 시스템**:
- `nonce_key = 0`: 프로토콜 논스 (순차적)
- `nonce_key = 1~N`: 사용자 논스 (병렬 처리 가능)
- 동일 계정에서 여러 독립적인 트랜잭션 동시 제출 가능

---

## 5. 헤더 (Header)

### Reth
```rust
// 표준 이더리움 헤더
pub struct Header {
    pub parent_hash, ommers_hash, beneficiary, state_root,
    pub transactions_root, receipts_root, logs_bloom,
    pub difficulty, number, gas_limit, gas_used, timestamp,
    pub extra_data, mix_hash, nonce, base_fee_per_gas,
    pub withdrawals_root, blob_gas_used, excess_blob_gas,
    pub parent_beacon_block_root, requests_hash
}
```

### Tempo
```rust
// tempo/crates/primitives/src/header.rs
pub struct TempoHeader {
    pub general_gas_limit: u64,        // 비결제 트랜잭션 가스 한도
    pub shared_gas_limit: u64,         // 서브블록 섹션 가스 한도
    pub timestamp_millis_part: u64,    // 밀리초 정밀도 타임스탬프
    pub inner: Header,                 // 표준 이더리움 헤더
}
```

---

## 6. 체인스펙 / 하드포크 (ChainSpec / Hardforks)

### Reth
```rust
// 전체 이더리움 하드포크 히스토리
Frontier → Homestead → DAO Fork → Tangerine Whistle →
Spurious Dragon → Byzantium → Constantinople → Petersburg →
Istanbul → Muir Glacier → Berlin → London → Arrow Glacier →
Gray Glacier → Paris (Merge) → Shanghai → Cancun → Prague
```

### Tempo
```rust
// tempo/crates/chainspec/src/hardfork.rs
pub enum TempoHardfork {
    Genesis,  // 플레이스홀더
}

impl EthereumHardforks for TempoHardforks {
    fn is_osaka_active(&self) -> bool { true }  // OSAKA 기본 활성화
}

// tempo/crates/chainspec/src/spec.rs
pub const TEMPO_BASE_FEE: u64 = 10_000_000_000;  // 10 Gwei
```

지원 체인:
- `moderato` (메인넷)
- `andantino` (테스트넷, Chain ID: 42429)

---

## 7. 아키텍처 비교 요약

| 영역 | Reth | Tempo |
|-----|------|-------|
| **목적** | 범용 이더리움 클라이언트 | 결제 특화 L1 |
| **컨센서스** | Engine API (CL-EL 분리) | Commonware Simplex |
| **최종성** | ~12초 | 서브초 |
| **트랜잭션** | 표준 이더리움 | 0x76 (다중 서명, 다중 호출) |
| **논스** | 1D (순차적) | 2D (병렬 가능) |
| **프리컴파일** | 표준 | +8개 커스텀 |
| **수수료** | ETH 전용 | 스테이블코인 지원 (Fee AMM) |
| **헤더** | 표준 | +3개 필드 |
| **하드포크** | 전체 이더리움 | OSAKA 기반 |
| **서명** | secp256k1 | +P256, WebAuthn |

---

## 8. 핵심 기술 혁신 (Tempo)

1. **TIP-20**: EVM 레벨에서 네이티브 ERC-20 지원
2. **Fee AMM**: 스테이블코인 → 밸리데이터 선호 토큰 자동 변환
3. **2D Nonce**: 병렬 트랜잭션 처리로 처리량 향상
4. **서브블록**: 밀리초 단위 트랜잭션 포함
5. **WebAuthn/P256**: 하드웨어 키 및 패스키 네이티브 지원

---

## 9. 소스 코드 참조

### Tempo 핵심 파일
- `tempo/crates/consensus/src/lib.rs` - 컨센서스 구현
- `tempo/crates/precompiles/src/lib.rs` - 커스텀 프리컴파일
- `tempo/crates/primitives/src/header.rs` - 확장 헤더
- `tempo/crates/primitives/src/transaction/tempo_transaction.rs` - 트랜잭션 타입
- `tempo/crates/transaction-pool/src/tt_2d_pool.rs` - 2D 논스 풀
- `tempo/crates/chainspec/src/hardfork.rs` - 하드포크 정의

### Reth 핵심 파일
- `reth/crates/consensus/consensus/src/lib.rs` - Consensus trait
- `reth/crates/primitives/src/` - 표준 이더리움 타입
- `reth/crates/transaction-pool/src/` - 표준 트랜잭션 풀

---

*생성일: 2026-01-10*
