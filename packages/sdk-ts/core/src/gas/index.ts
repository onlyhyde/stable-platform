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
