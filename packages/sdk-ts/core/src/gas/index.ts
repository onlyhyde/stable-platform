/**
 * Gas Module
 * Multi-mode gas estimation for EOA, EIP-7702, and Smart Account
 *
 * OCP-compliant: Uses Strategy pattern for extensible gas estimation.
 */

export {
  createGasEstimator,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
  type ERC20GasEstimate,
} from './gasEstimator'

// Strategy Pattern exports (OCP: allows custom strategy registration)
export {
  type GasEstimationStrategy,
  type GasStrategyConfig,
  type GasPrices,
  type GasStrategyRegistry,
  createGasStrategyRegistry,
  createEOAGasStrategy,
  createEIP7702GasStrategy,
  createSmartAccountGasStrategy,
} from './strategies'
