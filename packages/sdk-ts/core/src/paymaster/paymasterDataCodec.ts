import type { Hex } from 'viem'
import { concatHex, hexToBigInt, hexToNumber, numberToHex, sliceHex, size as hexSize } from 'viem'

// ============ Constants (matching PaymasterDataLib.sol) ============

export const PAYMASTER_DATA_VERSION = 0x01
export const VERSION_OFFSET = 0
export const TYPE_OFFSET = 1
export const FLAGS_OFFSET = 2
export const VALID_UNTIL_OFFSET = 3
export const VALID_AFTER_OFFSET = 9
export const NONCE_OFFSET = 15
export const PAYLOAD_LEN_OFFSET = 23
export const PAYLOAD_OFFSET = 25
export const HEADER_SIZE = 25

// ============ Types ============

export enum PaymasterType {
  VERIFYING = 0,
  SPONSOR = 1,
  ERC20 = 2,
  PERMIT2 = 3,
}

export interface PaymasterDataEnvelope {
  version: number
  paymasterType: PaymasterType
  flags: number
  validUntil: bigint
  validAfter: bigint
  nonce: bigint
  payload: Hex
}

// ============ Encode ============

/**
 * Encode paymaster data envelope (matching PaymasterDataLib.encode in Solidity)
 * Layout: [version(1)][type(1)][flags(1)][validUntil(6)][validAfter(6)][nonce(8)][payloadLen(2)][payload(N)]
 */
export function encodePaymasterData(
  envelope: Omit<PaymasterDataEnvelope, 'version'>
): Hex {
  const { paymasterType, flags, validUntil, validAfter, nonce, payload } = envelope

  if (paymasterType > PaymasterType.PERMIT2) {
    throw new Error(`Invalid paymaster type: ${paymasterType}`)
  }

  const payloadBytes = payload === '0x' ? '' : payload.slice(2)
  const payloadLength = payloadBytes.length / 2

  if (payloadLength > 0xffff) {
    throw new Error(`Payload too large: ${payloadLength}`)
  }

  return concatHex([
    numberToHex(PAYMASTER_DATA_VERSION, { size: 1 }),
    numberToHex(paymasterType, { size: 1 }),
    numberToHex(flags, { size: 1 }),
    numberToHex(validUntil, { size: 6 }),
    numberToHex(validAfter, { size: 6 }),
    numberToHex(nonce, { size: 8 }),
    numberToHex(payloadLength, { size: 2 }),
    payload === '0x' ? ('0x' as Hex) : payload,
  ])
}

// ============ Decode ============

/**
 * Decode paymaster data envelope (matching PaymasterDataLib.decode in Solidity)
 */
export function decodePaymasterData(data: Hex): PaymasterDataEnvelope {
  const dataSize = hexSize(data)

  if (dataSize < HEADER_SIZE) {
    throw new Error(`Invalid length: ${dataSize}, minimum ${HEADER_SIZE}`)
  }

  const version = hexToNumber(sliceHex(data, VERSION_OFFSET, VERSION_OFFSET + 1))
  if (version !== PAYMASTER_DATA_VERSION) {
    throw new Error(`Invalid version: ${version}, expected ${PAYMASTER_DATA_VERSION}`)
  }

  const paymasterType = hexToNumber(sliceHex(data, TYPE_OFFSET, TYPE_OFFSET + 1))
  if (paymasterType > PaymasterType.PERMIT2) {
    throw new Error(`Invalid paymaster type: ${paymasterType}`)
  }

  const flags = hexToNumber(sliceHex(data, FLAGS_OFFSET, FLAGS_OFFSET + 1))
  const validUntil = hexToBigInt(sliceHex(data, VALID_UNTIL_OFFSET, VALID_UNTIL_OFFSET + 6))
  const validAfter = hexToBigInt(sliceHex(data, VALID_AFTER_OFFSET, VALID_AFTER_OFFSET + 6))
  const nonce = hexToBigInt(sliceHex(data, NONCE_OFFSET, NONCE_OFFSET + 8))
  const payloadLen = hexToNumber(sliceHex(data, PAYLOAD_LEN_OFFSET, PAYLOAD_LEN_OFFSET + 2))

  const expectedLen = PAYLOAD_OFFSET + payloadLen
  if (dataSize !== expectedLen) {
    throw new Error(`Invalid length: ${dataSize}, expected ${expectedLen}`)
  }

  const payload =
    payloadLen > 0
      ? sliceHex(data, PAYLOAD_OFFSET, PAYLOAD_OFFSET + payloadLen)
      : ('0x' as Hex)

  return {
    version,
    paymasterType,
    flags,
    validUntil,
    validAfter,
    nonce,
    payload,
  }
}

// ============ Detection ============

/**
 * Check if data uses the supported paymaster data format
 */
export function isPaymasterDataSupported(data: Hex): boolean {
  const dataSize = hexSize(data)
  if (dataSize < HEADER_SIZE) return false
  const version = hexToNumber(sliceHex(data, 0, 1))
  return version === PAYMASTER_DATA_VERSION
}

// ============ Envelope Length ============

/**
 * Compute envelope length from raw data (header + payload, no trailing signature)
 */
export function envelopeLength(data: Hex): number {
  const dataSize = hexSize(data)
  if (dataSize < HEADER_SIZE) {
    throw new Error(`Invalid length: ${dataSize}`)
  }
  const payloadLen = hexToNumber(sliceHex(data, PAYLOAD_LEN_OFFSET, PAYLOAD_LEN_OFFSET + 2))
  return PAYLOAD_OFFSET + payloadLen
}

// ============ Signature Helpers ============

/**
 * Concatenate envelope with signature
 */
export function encodePaymasterDataWithSignature(envelopeHex: Hex, signature: Hex): Hex {
  return concatHex([envelopeHex, signature])
}

/**
 * Split paymaster data into envelope and trailing signature
 */
export function splitEnvelopeAndSignature(
  data: Hex,
  signatureLength: number = 65
): { envelope: Hex; signature: Hex } {
  const envLen = envelopeLength(data)
  const dataSize = hexSize(data)

  if (dataSize < envLen + signatureLength) {
    throw new Error(`Data too short for envelope + signature: ${dataSize}`)
  }

  return {
    envelope: sliceHex(data, 0, envLen),
    signature: sliceHex(data, envLen),
  }
}
