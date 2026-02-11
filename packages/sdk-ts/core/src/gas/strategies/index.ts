/**
 * Gas Estimation Strategies
 *
 * OCP-compliant strategy pattern for multi-mode gas estimation.
 * New transaction modes can be added by implementing GasEstimationStrategy.
 */

export { createEIP7702GasStrategy } from './eip7702GasStrategy'

export { createEOAGasStrategy } from './eoaGasStrategy'
export { createSmartAccountGasStrategy } from './smartAccountGasStrategy'
export {
  createGasStrategyRegistry,
  type GasEstimationStrategy,
  type GasPrices,
  type GasStrategyConfig,
  type GasStrategyRegistry,
} from './types'
