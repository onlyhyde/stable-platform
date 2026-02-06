/**
 * Gas Estimation Strategies
 *
 * OCP-compliant strategy pattern for multi-mode gas estimation.
 * New transaction modes can be added by implementing GasEstimationStrategy.
 */

export {
  type GasEstimationStrategy,
  type GasStrategyConfig,
  type GasPrices,
  type GasStrategyRegistry,
  createGasStrategyRegistry,
} from './types'

export { createEOAGasStrategy } from './eoaGasStrategy'
export { createEIP7702GasStrategy } from './eip7702GasStrategy'
export { createSmartAccountGasStrategy } from './smartAccountGasStrategy'
