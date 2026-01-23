# Phase 4: DeFi & Extensions

## 개요

Phase 4는 DeFi 기능과 구독/결제 확장 모듈을 구현합니다.

| 구분 | 내용 |
|------|------|
| **기간** | 4주 (예상) |
| **의존성** | Phase 1 Core, Phase 2 Modules |
| **핵심 표준** | ERC-20, Uniswap V3, AAVE V3 Interfaces |

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     DeFi Extensions Layer                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Swap Module   │  Lending Module │      Staking Module         │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────┐              │
│  │SwapRouter │  │  │LendingPool│  │  │StakingVault│             │
│  │ (Executor)│  │  │ (Executor)│  │  │ (Executor) │             │
│  └─────┬─────┘  │  └─────┬─────┘  │  └─────┬──────┘             │
│        │        │        │        │        │                     │
│  ┌─────┴─────┐  │  ┌─────┴─────┐  │  ┌─────┴──────┐             │
│  │PriceOracle│  │  │RateModel  │  │  │RewardCalc  │             │
│  └───────────┘  │  └───────────┘  │  └────────────┘             │
├─────────────────┴─────────────────┴─────────────────────────────┤
│                     Subscription & Payments                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │SubscriptionManager│  │ PaymentScheduler │  │ MerchantRegistry│ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component 4.1: Swap Module

### C4.1.1: SwapExecutor

Smart Account에서 토큰 스왑을 실행하는 Executor 모듈.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor} from "@rhinestone/modulekit/interfaces/IExecutor.sol";
import {IERC7579Account} from "erc7579/interfaces/IERC7579Account.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/interfaces/ISwapRouter.sol";

contract SwapExecutor is IExecutor {
    ISwapRouter public immutable swapRouter;

    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function executeSwap(
        IERC7579Account account,
        SwapParams calldata params
    ) external returns (uint256 amountOut);

    function executeMultiHopSwap(
        IERC7579Account account,
        bytes calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut);
}
```

#### Tasks

##### T4.1.1.1: SwapExecutor 기본 구조
```yaml
task_id: T4.1.1.1
title: "SwapExecutor 컨트랙트 기본 구조"
priority: high
estimated_hours: 4
dependencies: [Phase2.Executor]
acceptance_criteria:
  - IExecutor 인터페이스 구현
  - Uniswap V3 SwapRouter 연동
  - 기본 스왑 파라미터 구조체 정의
subtasks:
  - id: T4.1.1.1.1
    title: "컨트랙트 스켈레톤 생성"
    hours: 1
  - id: T4.1.1.1.2
    title: "SwapRouter 인터페이스 연동"
    hours: 1.5
  - id: T4.1.1.1.3
    title: "SwapParams 구조체 정의"
    hours: 1.5
```

##### T4.1.1.2: 단일 홉 스왑 구현
```yaml
task_id: T4.1.1.2
title: "exactInputSingle 스왑 구현"
priority: high
estimated_hours: 6
dependencies: [T4.1.1.1]
acceptance_criteria:
  - Smart Account에서 토큰 approve 실행
  - SwapRouter.exactInputSingle 호출
  - 슬리피지 보호 적용
  - 스왑 결과 이벤트 발생
subtasks:
  - id: T4.1.1.2.1
    title: "토큰 승인 로직 구현"
    hours: 2
  - id: T4.1.1.2.2
    title: "exactInputSingle 호출 구현"
    hours: 2
  - id: T4.1.1.2.3
    title: "슬리피지 검증 로직"
    hours: 1
  - id: T4.1.1.2.4
    title: "이벤트 및 로깅"
    hours: 1
```

##### T4.1.1.3: 멀티 홉 스왑 구현
```yaml
task_id: T4.1.1.3
title: "Multi-hop 스왑 (path 기반)"
priority: medium
estimated_hours: 5
dependencies: [T4.1.1.2]
acceptance_criteria:
  - bytes path 인코딩/디코딩
  - exactInput 호출 구현
  - 중간 토큰 처리
subtasks:
  - id: T4.1.1.3.1
    title: "Path 인코딩 유틸리티"
    hours: 2
  - id: T4.1.1.3.2
    title: "exactInput 호출 구현"
    hours: 2
  - id: T4.1.1.3.3
    title: "멀티홉 테스트"
    hours: 1
```

##### T4.1.1.4: 스왑 제한 및 보안
```yaml
task_id: T4.1.1.4
title: "스왑 제한 및 보안 기능"
priority: high
estimated_hours: 4
dependencies: [T4.1.1.3]
acceptance_criteria:
  - 허용된 토큰 쌍 화이트리스트
  - 최대 스왑 금액 제한
  - 최소 출력 금액 검증
subtasks:
  - id: T4.1.1.4.1
    title: "토큰 화이트리스트 구현"
    hours: 1.5
  - id: T4.1.1.4.2
    title: "금액 제한 로직"
    hours: 1.5
  - id: T4.1.1.4.3
    title: "보안 테스트"
    hours: 1
```

### C4.1.2: ChainlinkOracle (프로덕션용)

Chainlink 기반 가격 오라클 - **IPriceOracle 구현체**.

> **IPriceOracle 아키텍처** (Phase 2에서 정의):
>
> ```
> ┌─────────────────────────────────────────┐
> │      ERC20Paymaster / DeFi Modules     │
> │              depends on                 │
> │            IPriceOracle                 │
> └─────────────┬───────────────────────────┘
>               │
>     ┌─────────┴─────────┐
>     ▼                   ▼
> ┌─────────────┐   ┌─────────────────┐
> │ TWAPOracle  │   │ ChainlinkOracle │
> │  (Phase 2)  │   │   (Phase 4)     │
> │ 개발/테스트  │   │   프로덕션용     │
> └─────────────┘   └─────────────────┘
> ```
>
> **ChainlinkOracle 장점**:
> - 오프체인 집계로 Flash Loan 공격 면역
> - 다수의 데이터 소스로 신뢰성 높음
> - 가격 이상 감지 내장
>
> **ChainlinkOracle 단점**:
> - Heartbeat 간격으로 인한 업데이트 지연 (최대 1시간)
> - 외부 의존성 (Chainlink 노드)
> - 지원 토큰 제한적

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/interfaces/AggregatorV3Interface.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ChainlinkOracle
/// @notice Chainlink Aggregator 기반 가격 오라클
/// @dev IPriceOracle 인터페이스 구현 - 프로덕션 환경 권장
contract ChainlinkOracle is IPriceOracle, Ownable {
    struct FeedConfig {
        address feed;           // Chainlink price feed 주소
        uint8 decimals;         // Feed decimals
        uint256 stalePeriod;    // 유효 기간 (초)
    }

    mapping(address => FeedConfig) public priceFeeds; // token => FeedConfig

    uint256 public constant DEFAULT_STALE_PERIOD = 3600; // 1 hour

    error StalePrice(address token, uint256 updatedAt);
    error UnsupportedToken(address token);
    error InvalidPrice(address token, int256 price);

    function getPrice(address token) external view returns (uint256 price) {
        FeedConfig memory config = priceFeeds[token];
        if (config.feed == address(0)) revert UnsupportedToken(token);

        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
        ) = AggregatorV3Interface(config.feed).latestRoundData();

        // Staleness 검증
        if (block.timestamp - updatedAt > config.stalePeriod) {
            revert StalePrice(token, updatedAt);
        }

        // 음수 가격 검증
        if (answer <= 0) revert InvalidPrice(token, answer);

        // 18 decimals로 정규화
        price = uint256(answer) * 10 ** (18 - config.decimals);
    }

    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        uint256 priceIn = this.getPrice(tokenIn);
        uint256 priceOut = this.getPrice(tokenOut);
        amountOut = (amountIn * priceIn) / priceOut;
    }

    function isSupportedToken(address token) external view returns (bool) {
        return priceFeeds[token].feed != address(0);
    }

    function setPriceFeed(
        address token,
        address feed,
        uint256 stalePeriod
    ) external onlyOwner {
        uint8 decimals = AggregatorV3Interface(feed).decimals();
        priceFeeds[token] = FeedConfig({
            feed: feed,
            decimals: decimals,
            stalePeriod: stalePeriod > 0 ? stalePeriod : DEFAULT_STALE_PERIOD
        });
    }
}
```

> **프로덕션 배포 시**:
> 1. ERC20Paymaster의 `priceOracle`을 ChainlinkOracle 주소로 설정
> 2. 지원할 토큰의 Chainlink Price Feed 등록
> 3. 적절한 `stalePeriod` 설정 (토큰별 Heartbeat 고려)

#### Tasks

##### T4.1.2.1: ChainlinkOracle 기본 구현
```yaml
task_id: T4.1.2.1
title: "ChainlinkOracle 구현 (IPriceOracle)"
priority: high
estimated_hours: 5
dependencies: [Phase2.T2.3.1]  # IPriceOracle 인터페이스
acceptance_criteria:
  - IPriceOracle 인터페이스 구현
  - Chainlink AggregatorV3 연동
  - Staleness 검증 (configurable period)
  - Decimals 정규화 (18 decimals)
subtasks:
  - id: T4.1.2.1.1
    title: "IPriceOracle 구현 및 AggregatorV3 연동"
    hours: 2
  - id: T4.1.2.1.2
    title: "getPrice/getQuote/isSupportedToken 구현"
    hours: 1.5
  - id: T4.1.2.1.3
    title: "Staleness 및 유효성 검증"
    hours: 1.5
```

##### T4.1.2.2: 가격 피드 관리
```yaml
task_id: T4.1.2.2
title: "가격 피드 관리 기능"
priority: medium
estimated_hours: 4
dependencies: [T4.1.2.1]
acceptance_criteria:
  - 토큰별 가격 피드 매핑
  - 관리자 전용 업데이트 함수
  - 피드 제거 기능
subtasks:
  - id: T4.1.2.2.1
    title: "피드 매핑 관리"
    hours: 2
  - id: T4.1.2.2.2
    title: "관리자 권한 검증"
    hours: 1
  - id: T4.1.2.2.3
    title: "피드 업데이트 이벤트"
    hours: 1
```

##### T4.1.2.3: Quote 계산
```yaml
task_id: T4.1.2.3
title: "토큰 간 Quote 계산"
priority: medium
estimated_hours: 4
dependencies: [T4.1.2.1]
acceptance_criteria:
  - 두 토큰 간 환율 계산
  - Decimal 정규화 처리
  - 역환율 지원
subtasks:
  - id: T4.1.2.3.1
    title: "getQuote 구현"
    hours: 2
  - id: T4.1.2.3.2
    title: "Decimal 변환 로직"
    hours: 1
  - id: T4.1.2.3.3
    title: "Quote 테스트"
    hours: 1
```

---

## Component 4.2: Lending Module

### C4.2.1: LendingExecutor

AAVE V3 프로토콜 연동 Lending Executor.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor} from "@rhinestone/modulekit/interfaces/IExecutor.sol";
import {IPool} from "@aave/v3-core/interfaces/IPool.sol";

contract LendingExecutor is IExecutor {
    IPool public immutable lendingPool;

    function supply(
        IERC7579Account account,
        address asset,
        uint256 amount,
        uint16 referralCode
    ) external;

    function withdraw(
        IERC7579Account account,
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    function borrow(
        IERC7579Account account,
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode
    ) external;

    function repay(
        IERC7579Account account,
        address asset,
        uint256 amount,
        uint256 interestRateMode
    ) external returns (uint256);
}
```

#### Tasks

##### T4.2.1.1: LendingExecutor 기본 구조
```yaml
task_id: T4.2.1.1
title: "LendingExecutor 컨트랙트 구조"
priority: high
estimated_hours: 4
dependencies: [Phase2.Executor]
acceptance_criteria:
  - IExecutor 인터페이스 구현
  - AAVE V3 Pool 연동
  - 기본 구조체 정의
subtasks:
  - id: T4.2.1.1.1
    title: "컨트랙트 스켈레톤"
    hours: 1
  - id: T4.2.1.1.2
    title: "IPool 인터페이스 연동"
    hours: 2
  - id: T4.2.1.1.3
    title: "상수 및 에러 정의"
    hours: 1
```

##### T4.2.1.2: Supply 기능 구현
```yaml
task_id: T4.2.1.2
title: "Supply (예치) 기능"
priority: high
estimated_hours: 5
dependencies: [T4.2.1.1]
acceptance_criteria:
  - 토큰 approve 후 supply 호출
  - aToken 수령 확인
  - 이벤트 발생
subtasks:
  - id: T4.2.1.2.1
    title: "토큰 승인 로직"
    hours: 1.5
  - id: T4.2.1.2.2
    title: "supply 함수 구현"
    hours: 2
  - id: T4.2.1.2.3
    title: "aToken 잔액 검증"
    hours: 1.5
```

##### T4.2.1.3: Withdraw 기능 구현
```yaml
task_id: T4.2.1.3
title: "Withdraw (출금) 기능"
priority: high
estimated_hours: 4
dependencies: [T4.2.1.2]
acceptance_criteria:
  - aToken 소각 후 underlying 반환
  - 최대 출금 금액 계산
  - 출금 대상 주소 지정
subtasks:
  - id: T4.2.1.3.1
    title: "withdraw 함수 구현"
    hours: 2
  - id: T4.2.1.3.2
    title: "최대 출금 계산"
    hours: 1
  - id: T4.2.1.3.3
    title: "Withdraw 테스트"
    hours: 1
```

##### T4.2.1.4: Borrow 기능 구현
```yaml
task_id: T4.2.1.4
title: "Borrow (대출) 기능"
priority: medium
estimated_hours: 6
dependencies: [T4.2.1.3]
acceptance_criteria:
  - 담보 대비 대출 한도 확인
  - 변동/고정 금리 선택
  - debtToken 발행 확인
subtasks:
  - id: T4.2.1.4.1
    title: "담보 확인 로직"
    hours: 2
  - id: T4.2.1.4.2
    title: "borrow 함수 구현"
    hours: 2
  - id: T4.2.1.4.3
    title: "금리 모드 처리"
    hours: 1
  - id: T4.2.1.4.4
    title: "Borrow 테스트"
    hours: 1
```

##### T4.2.1.5: Repay 기능 구현
```yaml
task_id: T4.2.1.5
title: "Repay (상환) 기능"
priority: medium
estimated_hours: 4
dependencies: [T4.2.1.4]
acceptance_criteria:
  - 원금 + 이자 상환
  - 부분/전체 상환 지원
  - debtToken 소각 확인
subtasks:
  - id: T4.2.1.5.1
    title: "repay 함수 구현"
    hours: 2
  - id: T4.2.1.5.2
    title: "이자 계산 로직"
    hours: 1
  - id: T4.2.1.5.3
    title: "Repay 테스트"
    hours: 1
```

### C4.2.2: HealthFactorHook

담보 건전성 검증 Hook 모듈.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHook} from "@rhinestone/modulekit/interfaces/IHook.sol";

contract HealthFactorHook is IHook {
    uint256 public constant MIN_HEALTH_FACTOR = 1.2e18; // 1.2

    function preCheck(
        address account,
        bytes calldata executionData
    ) external view returns (bool);

    function postCheck(
        address account,
        bytes calldata executionData
    ) external;
}
```

#### Tasks

##### T4.2.2.1: HealthFactorHook 구현
```yaml
task_id: T4.2.2.1
title: "담보 건전성 Hook"
priority: high
estimated_hours: 5
dependencies: [T4.2.1.4]
acceptance_criteria:
  - AAVE getUserAccountData 연동
  - Health Factor 임계값 검증
  - 청산 위험 시 트랜잭션 거부
subtasks:
  - id: T4.2.2.1.1
    title: "IHook 인터페이스 구현"
    hours: 1
  - id: T4.2.2.1.2
    title: "Health Factor 조회"
    hours: 2
  - id: T4.2.2.1.3
    title: "preCheck 검증 로직"
    hours: 1
  - id: T4.2.2.1.4
    title: "postCheck 검증"
    hours: 1
```

---

## Component 4.3: Staking Module

### C4.3.1: StakingExecutor

스테이킹 풀 연동 Executor.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor} from "@rhinestone/modulekit/interfaces/IExecutor.sol";

interface IStakingPool {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function claimRewards() external returns (uint256);
    function getStaked(address account) external view returns (uint256);
    function getPendingRewards(address account) external view returns (uint256);
}

contract StakingExecutor is IExecutor {
    mapping(bytes32 => address) public stakingPools; // poolId => poolAddress

    function stake(
        IERC7579Account account,
        bytes32 poolId,
        uint256 amount
    ) external;

    function unstake(
        IERC7579Account account,
        bytes32 poolId,
        uint256 amount
    ) external;

    function claimRewards(
        IERC7579Account account,
        bytes32 poolId
    ) external returns (uint256);

    function compoundRewards(
        IERC7579Account account,
        bytes32 poolId
    ) external;
}
```

#### Tasks

##### T4.3.1.1: StakingExecutor 기본 구조
```yaml
task_id: T4.3.1.1
title: "StakingExecutor 컨트랙트 구조"
priority: medium
estimated_hours: 4
dependencies: [Phase2.Executor]
acceptance_criteria:
  - IExecutor 인터페이스 구현
  - 스테이킹 풀 레지스트리
  - 기본 스테이킹 인터페이스
subtasks:
  - id: T4.3.1.1.1
    title: "컨트랙트 스켈레톤"
    hours: 1
  - id: T4.3.1.1.2
    title: "풀 레지스트리 구현"
    hours: 2
  - id: T4.3.1.1.3
    title: "IStakingPool 정의"
    hours: 1
```

##### T4.3.1.2: Stake 기능 구현
```yaml
task_id: T4.3.1.2
title: "Stake (스테이킹) 기능"
priority: medium
estimated_hours: 4
dependencies: [T4.3.1.1]
acceptance_criteria:
  - 토큰 approve 후 stake 호출
  - 스테이킹 잔액 업데이트
  - 이벤트 발생
subtasks:
  - id: T4.3.1.2.1
    title: "stake 함수 구현"
    hours: 2
  - id: T4.3.1.2.2
    title: "잔액 추적 로직"
    hours: 1
  - id: T4.3.1.2.3
    title: "Stake 테스트"
    hours: 1
```

##### T4.3.1.3: Unstake 기능 구현
```yaml
task_id: T4.3.1.3
title: "Unstake (언스테이킹) 기능"
priority: medium
estimated_hours: 4
dependencies: [T4.3.1.2]
acceptance_criteria:
  - 언스테이킹 락업 기간 확인
  - 원금 + 보상 반환
  - 잔액 업데이트
subtasks:
  - id: T4.3.1.3.1
    title: "unstake 함수 구현"
    hours: 2
  - id: T4.3.1.3.2
    title: "락업 검증"
    hours: 1
  - id: T4.3.1.3.3
    title: "Unstake 테스트"
    hours: 1
```

##### T4.3.1.4: Rewards 관리
```yaml
task_id: T4.3.1.4
title: "보상 클레임 및 복리"
priority: medium
estimated_hours: 5
dependencies: [T4.3.1.3]
acceptance_criteria:
  - 보상 클레임 기능
  - 자동 복리 (compound) 기능
  - 보상 계산 조회
subtasks:
  - id: T4.3.1.4.1
    title: "claimRewards 구현"
    hours: 2
  - id: T4.3.1.4.2
    title: "compoundRewards 구현"
    hours: 2
  - id: T4.3.1.4.3
    title: "보상 테스트"
    hours: 1
```

---

## Component 4.4: Subscription Module

### C4.4.1: SubscriptionManager

구독 결제 관리 컨트랙트.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SubscriptionManager {
    enum BillingCycle { WEEKLY, MONTHLY, QUARTERLY, YEARLY }

    struct Subscription {
        bytes32 planId;
        address subscriber;
        address merchant;
        address paymentToken;
        uint256 amount;
        BillingCycle cycle;
        uint256 nextPaymentTime;
        uint256 createdAt;
        bool active;
    }

    struct Plan {
        bytes32 planId;
        address merchant;
        string name;
        uint256 price;
        BillingCycle cycle;
        bool active;
    }

    mapping(bytes32 => Plan) public plans;
    mapping(bytes32 => Subscription) public subscriptions;
    mapping(address => bytes32[]) public userSubscriptions;

    function createPlan(Plan calldata plan) external;
    function subscribe(bytes32 planId, address paymentToken) external;
    function processPayment(bytes32 subscriptionId) external;
    function cancelSubscription(bytes32 subscriptionId) external;
}
```

#### Tasks

##### T4.4.1.1: Plan 관리 기능
```yaml
task_id: T4.4.1.1
title: "구독 플랜 관리"
priority: high
estimated_hours: 5
dependencies: []
acceptance_criteria:
  - 플랜 생성/수정/비활성화
  - 플랜 ID 생성 (해시)
  - 판매자별 플랜 조회
subtasks:
  - id: T4.4.1.1.1
    title: "Plan 구조체 정의"
    hours: 1
  - id: T4.4.1.1.2
    title: "createPlan 구현"
    hours: 2
  - id: T4.4.1.1.3
    title: "updatePlan 구현"
    hours: 1
  - id: T4.4.1.1.4
    title: "플랜 조회 기능"
    hours: 1
```

##### T4.4.1.2: Subscription 생성
```yaml
task_id: T4.4.1.2
title: "구독 생성 기능"
priority: high
estimated_hours: 6
dependencies: [T4.4.1.1]
acceptance_criteria:
  - 구독 ID 생성
  - 첫 결제 처리
  - 다음 결제 시간 설정
  - 구독 활성화
subtasks:
  - id: T4.4.1.2.1
    title: "Subscription 구조체"
    hours: 1
  - id: T4.4.1.2.2
    title: "subscribe 함수 구현"
    hours: 2
  - id: T4.4.1.2.3
    title: "첫 결제 처리"
    hours: 2
  - id: T4.4.1.2.4
    title: "구독 이벤트"
    hours: 1
```

##### T4.4.1.3: 자동 결제 처리
```yaml
task_id: T4.4.1.3
title: "자동 결제 처리"
priority: high
estimated_hours: 8
dependencies: [T4.4.1.2]
acceptance_criteria:
  - 결제 시간 검증
  - Smart Account에서 토큰 전송
  - 다음 결제 시간 업데이트
  - 결제 실패 처리
subtasks:
  - id: T4.4.1.3.1
    title: "processPayment 구현"
    hours: 3
  - id: T4.4.1.3.2
    title: "결제 시간 검증"
    hours: 1
  - id: T4.4.1.3.3
    title: "Smart Account 연동"
    hours: 2
  - id: T4.4.1.3.4
    title: "결제 실패 처리"
    hours: 2
```

##### T4.4.1.4: 구독 취소 및 관리
```yaml
task_id: T4.4.1.4
title: "구독 취소 및 상태 관리"
priority: medium
estimated_hours: 4
dependencies: [T4.4.1.3]
acceptance_criteria:
  - 즉시/기간 만료 취소 옵션
  - 환불 정책 적용
  - 구독 상태 업데이트
subtasks:
  - id: T4.4.1.4.1
    title: "cancelSubscription 구현"
    hours: 2
  - id: T4.4.1.4.2
    title: "환불 로직"
    hours: 1
  - id: T4.4.1.4.3
    title: "상태 관리"
    hours: 1
```

### C4.4.2: MerchantRegistry

판매자 등록 및 관리.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MerchantRegistry {
    struct Merchant {
        address wallet;
        string name;
        string uri;
        uint256 feeRate; // basis points (100 = 1%)
        bool verified;
        bool active;
    }

    mapping(address => Merchant) public merchants;
    mapping(address => bool) public verifiers;

    function registerMerchant(Merchant calldata merchant) external;
    function verifyMerchant(address merchant) external;
    function updateFeeRate(address merchant, uint256 newRate) external;
}
```

#### Tasks

##### T4.4.2.1: MerchantRegistry 구현
```yaml
task_id: T4.4.2.1
title: "판매자 레지스트리"
priority: medium
estimated_hours: 5
dependencies: []
acceptance_criteria:
  - 판매자 등록/수정
  - 인증자 관리
  - 수수료율 설정
subtasks:
  - id: T4.4.2.1.1
    title: "Merchant 구조체"
    hours: 1
  - id: T4.4.2.1.2
    title: "registerMerchant 구현"
    hours: 2
  - id: T4.4.2.1.3
    title: "인증 기능"
    hours: 1
  - id: T4.4.2.1.4
    title: "수수료 관리"
    hours: 1
```

### C4.4.3: RecurringPaymentExecutor

ERC-7579 Executor로서 구독 결제 실행.

> **Phase 2 RecurringPaymentExecutor와의 관계**:
> - **Phase 2 RecurringPaymentExecutor**: 간단한 정기 결제 Executor
>   - 고정 금액, 고정 간격, 단순 토큰 전송
>   - Smart Account에 직접 설치하여 사용
>
> - **Phase 4 RecurringPaymentExecutor (이 문서)**: SubscriptionManager 연동
>   - 다양한 플랜 지원 (주간/월간/연간)
>   - 판매자 등록 및 수수료 관리
>   - 결제 실패 처리, 구독 상태 관리
>
> **통합 방안**:
> - Phase 2 버전은 기본 기능으로 유지
> - Phase 4 버전은 고급 구독 서비스용
> - 인터페이스 공유 가능: `IRecurringExecutor`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor} from "@rhinestone/modulekit/interfaces/IExecutor.sol";

contract SubscriptionExecutor is IExecutor {
    SubscriptionManager public subscriptionManager;

    function executePayment(
        IERC7579Account account,
        bytes32 subscriptionId
    ) external;

    function batchExecutePayments(
        IERC7579Account account,
        bytes32[] calldata subscriptionIds
    ) external;
}
```

#### Tasks

##### T4.4.3.1: RecurringPaymentExecutor 구현
```yaml
task_id: T4.4.3.1
title: "반복 결제 Executor"
priority: high
estimated_hours: 6
dependencies: [T4.4.1.3, Phase2.Executor]
acceptance_criteria:
  - IExecutor 인터페이스 구현
  - 단일/배치 결제 실행
  - Smart Account 권한 검증
subtasks:
  - id: T4.4.3.1.1
    title: "Executor 스켈레톤"
    hours: 1
  - id: T4.4.3.1.2
    title: "executePayment 구현"
    hours: 2
  - id: T4.4.3.1.3
    title: "batchExecutePayments 구현"
    hours: 2
  - id: T4.4.3.1.4
    title: "권한 검증"
    hours: 1
```

---

## Component 4.5: Perpetual Trading (Advanced)

### C4.5.1: PerpetualExecutor

무기한 선물 거래 연동 (GMX, dYdX 등).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor} from "@rhinestone/modulekit/interfaces/IExecutor.sol";

interface IPerpetualProtocol {
    function increasePosition(
        address collateralToken,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong
    ) external;

    function decreasePosition(
        address collateralToken,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong,
        address receiver
    ) external;
}

contract PerpetualExecutor is IExecutor {
    function openPosition(
        IERC7579Account account,
        address protocol,
        address collateralToken,
        address indexToken,
        uint256 collateral,
        uint256 size,
        bool isLong
    ) external;

    function closePosition(
        IERC7579Account account,
        address protocol,
        address collateralToken,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong
    ) external;

    function addCollateral(
        IERC7579Account account,
        address protocol,
        bytes32 positionId,
        uint256 amount
    ) external;
}
```

#### Tasks

##### T4.5.1.1: PerpetualExecutor 기본 구조
```yaml
task_id: T4.5.1.1
title: "Perpetual Executor 구조"
priority: low
estimated_hours: 4
dependencies: [Phase2.Executor]
acceptance_criteria:
  - IExecutor 인터페이스 구현
  - 프로토콜 어댑터 패턴
  - GMX/dYdX 인터페이스
subtasks:
  - id: T4.5.1.1.1
    title: "프로토콜 어댑터 정의"
    hours: 2
  - id: T4.5.1.1.2
    title: "Executor 스켈레톤"
    hours: 2
```

##### T4.5.1.2: Position 관리
```yaml
task_id: T4.5.1.2
title: "포지션 열기/닫기"
priority: low
estimated_hours: 8
dependencies: [T4.5.1.1]
acceptance_criteria:
  - 롱/숏 포지션 열기
  - 포지션 부분/전체 청산
  - 담보 추가/제거
subtasks:
  - id: T4.5.1.2.1
    title: "openPosition 구현"
    hours: 3
  - id: T4.5.1.2.2
    title: "closePosition 구현"
    hours: 3
  - id: T4.5.1.2.3
    title: "담보 관리"
    hours: 2
```

##### T4.5.1.3: Risk 관리 Hook
```yaml
task_id: T4.5.1.3
title: "리스크 관리 Hook"
priority: low
estimated_hours: 6
dependencies: [T4.5.1.2]
acceptance_criteria:
  - 최대 레버리지 제한
  - 포지션 사이즈 제한
  - 청산 가격 경고
subtasks:
  - id: T4.5.1.3.1
    title: "레버리지 검증"
    hours: 2
  - id: T4.5.1.3.2
    title: "사이즈 제한"
    hours: 2
  - id: T4.5.1.3.3
    title: "청산 경고"
    hours: 2
```

---

## 테스트 전략

### Unit Tests

```yaml
test_categories:
  swap:
    - SwapExecutor.executeSwap
    - SwapExecutor.executeMultiHopSwap
    - PriceOracle.getPrice
    - PriceOracle.getQuote

  lending:
    - LendingExecutor.supply
    - LendingExecutor.withdraw
    - LendingExecutor.borrow
    - LendingExecutor.repay
    - HealthFactorHook.preCheck

  staking:
    - StakingExecutor.stake
    - StakingExecutor.unstake
    - StakingExecutor.claimRewards
    - StakingExecutor.compoundRewards

  subscription:
    - SubscriptionManager.createPlan
    - SubscriptionManager.subscribe
    - SubscriptionManager.processPayment
    - SubscriptionManager.cancelSubscription
    - MerchantRegistry.registerMerchant
```

### Integration Tests

```yaml
integration_scenarios:
  - name: "Full Swap Flow"
    steps:
      - Smart Account 생성
      - SwapExecutor 설치
      - ETH → USDC 스왑
      - 잔액 검증

  - name: "Lending Cycle"
    steps:
      - USDC supply
      - ETH borrow
      - Health Factor 확인
      - Repay 및 withdraw

  - name: "Subscription Lifecycle"
    steps:
      - 판매자 등록
      - 플랜 생성
      - 구독 시작
      - 결제 처리 (시간 이동)
      - 구독 취소
```

### Fork Tests (Mainnet Fork)

```yaml
fork_tests:
  - name: "Uniswap V3 Integration"
    network: mainnet
    contracts: [SwapRouter, WETH, USDC]

  - name: "AAVE V3 Integration"
    network: mainnet
    contracts: [Pool, aTokens]
```

---

## 의존성 그래프

```
Phase 2 Executor Base
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐
│ SwapExecutor  │  │LendingExecutor│  │StakingExecutor│  │SubscriptionMgr  │
│   [T4.1.1]    │  │   [T4.2.1]    │  │   [T4.3.1]    │  │   [T4.4.1]      │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘
        │                  │                  │                   │
        ▼                  ▼                  ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐
│  PriceOracle  │  │HealthFactorHk│  │  RewardCalc   │  │MerchantRegistry │
│   [T4.1.2]    │  │   [T4.2.2]    │  │   [T4.3.1.4]  │  │   [T4.4.2]      │
└───────────────┘  └───────────────┘  └───────────────┘  └─────────────────┘
                                                                  │
                                                                  ▼
                                                         ┌─────────────────┐
                                                         │RecurringPayExec │
                                                         │   [T4.4.3]      │
                                                         └─────────────────┘
```

---

## 시간 추정

| Component | Tasks | 예상 시간 |
|-----------|-------|-----------|
| C4.1 Swap Module | 7 | 32h |
| C4.2 Lending Module | 6 | 28h |
| C4.3 Staking Module | 4 | 17h |
| C4.4 Subscription | 6 | 34h |
| C4.5 Perpetual | 3 | 18h |
| **Total** | **26** | **~129h (3-4 weeks)** |

---

## 보안 고려사항

### Swap Module
- [ ] 슬리피지 보호 필수
- [ ] 가격 오라클 조작 방지
- [ ] Flash Loan 공격 대응
- [ ] Deadline 파라미터 검증

### Lending Module
- [ ] Reentrancy 보호
- [ ] Health Factor 실시간 검증
- [ ] Oracle 지연 대응
- [ ] 청산 봇 인센티브 설계

### Subscription Module
- [ ] 결제 시간 조작 방지
- [ ] 이중 결제 방지
- [ ] 권한 검증 철저
- [ ] 환불 로직 안전성

### Perpetual Module
- [ ] 레버리지 제한
- [ ] 강제 청산 로직
- [ ] 가격 갭 대응
- [ ] 포지션 사이즈 제한

---

## 다음 단계

Phase 4 완료 후:
1. Phase 5: Integration & Testing으로 이동
2. SDK 연동 작업 시작
3. 메인넷 배포 준비
