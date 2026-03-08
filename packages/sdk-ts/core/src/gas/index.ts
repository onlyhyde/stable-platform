/**
 * Gas Module
 * Multi-mode gas estimation for EOA, EIP-7702, and Smart Account
 *
 * OCP-compliant: Uses Strategy pattern for extensible gas estimation.
 */

export {
  createGasEstimator,
  type ERC20GasEstimate,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
} from './gasEstimator'

// Gas Price Oracle (dynamic fee estimation via eth_feeHistory)
export {
  createGasPriceOracle,
  type GasPriceOracle,
  type GasPriceOracleConfig,
  type GasPriceTiers,
} from './oracle'

// EIP-4337 v0.9 unused gas penalty
export {
  calculateEffectiveGasCost,
  calculateUnusedGasPenalty,
  UNUSED_GAS_PENALTY_DIVISOR,
  UNUSED_GAS_PENALTY_THRESHOLD,
} from './gasPenalty'

// Strategy Pattern exports (OCP: allows custom strategy registration)
export {
  createEIP7702GasStrategy,
  createEOAGasStrategy,
  createGasStrategyRegistry,
  createSmartAccountGasStrategy,
  type GasEstimationStrategy,
  type GasPrices,
  type GasStrategyConfig,
  type GasStrategyRegistry,
} from './strategies'
