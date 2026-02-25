import type { Hex, Address } from 'viem'
import { encodeAbiParameters, decodeAbiParameters, parseAbiParameters } from 'viem'

// ============ Verifying Payload (Type 0) ============

export interface VerifyingPayloadData {
  policyId: Hex
  sponsor: Address
  maxCost: bigint
  verifierExtra: Hex
}

export function encodeVerifyingPayload(data: VerifyingPayloadData): Hex {
  return encodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256, bytes'),
    [data.policyId, data.sponsor, data.maxCost, data.verifierExtra]
  )
}

export function decodeVerifyingPayload(payload: Hex): VerifyingPayloadData {
  const [policyId, sponsor, maxCost, verifierExtra] = decodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256, bytes'),
    payload
  )
  return { policyId, sponsor, maxCost, verifierExtra }
}

// ============ Sponsor Payload (Type 1) ============

export interface SponsorPayloadData {
  campaignId: Hex           // bytes32
  perUserLimit: bigint      // uint256
  targetContract: Address   // address
  targetSelector: Hex       // bytes4
  sponsorExtra: Hex         // bytes
}

export function encodeSponsorPayload(data: SponsorPayloadData): Hex {
  return encodeAbiParameters(
    parseAbiParameters('bytes32, uint256, address, bytes4, bytes'),
    [data.campaignId, data.perUserLimit, data.targetContract, data.targetSelector, data.sponsorExtra]
  )
}

export function decodeSponsorPayload(payload: Hex): SponsorPayloadData {
  const [campaignId, perUserLimit, targetContract, targetSelector, sponsorExtra] = decodeAbiParameters(
    parseAbiParameters('bytes32, uint256, address, bytes4, bytes'),
    payload
  )
  return { campaignId, perUserLimit, targetContract, targetSelector, sponsorExtra }
}

// ============ ERC20 Payload (Type 2) ============

export interface Erc20PayloadData {
  token: Address
  maxTokenCost: bigint
  quoteId: bigint
  erc20Extra: Hex
}

export function encodeErc20Payload(data: Erc20PayloadData): Hex {
  return encodeAbiParameters(
    parseAbiParameters('address, uint256, uint256, bytes'),
    [data.token, data.maxTokenCost, data.quoteId, data.erc20Extra]
  )
}

export function decodeErc20Payload(payload: Hex): Erc20PayloadData {
  const [token, maxTokenCost, quoteId, erc20Extra] = decodeAbiParameters(
    parseAbiParameters('address, uint256, uint256, bytes'),
    payload
  )
  return { token, maxTokenCost, quoteId, erc20Extra }
}

// ============ Permit2 Payload (Type 3) ============

export interface Permit2PayloadData {
  token: Address
  permitAmount: bigint
  permitExpiration: number
  permitNonce: number
  permitSig: Hex
  permit2Extra: Hex
}

export function encodePermit2Payload(data: Permit2PayloadData): Hex {
  return encodeAbiParameters(
    parseAbiParameters('address, uint160, uint48, uint48, bytes, bytes'),
    [
      data.token,
      data.permitAmount,
      data.permitExpiration,
      data.permitNonce,
      data.permitSig,
      data.permit2Extra,
    ]
  )
}

export function decodePermit2Payload(payload: Hex): Permit2PayloadData {
  const [token, permitAmount, permitExpiration, permitNonce, permitSig, permit2Extra] =
    decodeAbiParameters(
      parseAbiParameters('address, uint160, uint48, uint48, bytes, bytes'),
      payload
    )
  return {
    token,
    permitAmount,
    permitExpiration: Number(permitExpiration),
    permitNonce: Number(permitNonce),
    permitSig,
    permit2Extra,
  }
}
