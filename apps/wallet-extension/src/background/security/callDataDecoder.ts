/**
 * CallData Decoder
 *
 * Decodes ERC-20/721/1155 transaction calldata into human-readable format
 * using well-known function selectors.
 */

import type { Address } from 'viem'

/**
 * Decoded calldata result
 */
export interface DecodedCallData {
  /** Function name (e.g. 'transfer', 'approve') */
  functionName: string
  /** Function selector (e.g. '0xa9059cbb') */
  selector: string
  /** Decoded arguments with names and values */
  args: DecodedArg[]
  /** Human-readable description */
  description: string
}

export interface DecodedArg {
  name: string
  type: string
  value: string
}

/**
 * Known function selectors and their ABI definitions
 */
const KNOWN_FUNCTIONS: Record<
  string,
  { name: string; params: Array<{ name: string; type: string }> }
> = {
  // ERC-20
  '0xa9059cbb': {
    name: 'transfer',
    params: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  '0x095ea7b3': {
    name: 'approve',
    params: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  '0x23b872dd': {
    name: 'transferFrom',
    params: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  '0x39509351': {
    name: 'increaseAllowance',
    params: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  '0xa457c2d7': {
    name: 'decreaseAllowance',
    params: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  // ERC-721
  '0xa22cb465': {
    name: 'setApprovalForAll',
    params: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
  },
  '0x42842e0e': {
    name: 'safeTransferFrom',
    params: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
  },
  // ERC-1155
  '0xf242432a': {
    name: 'safeTransferFrom',
    params: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
  },
}

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

/**
 * Decode a hex-encoded ABI parameter from calldata
 */
function decodeParam(data: string, offset: number, type: string): string {
  const chunk = data.slice(offset, offset + 64)
  if (!chunk || chunk.length < 64) return '0x'

  switch (type) {
    case 'address':
      return `0x${chunk.slice(24)}` as Address
    case 'uint256': {
      const val = BigInt(`0x${chunk}`)
      if (val === MAX_UINT256) return 'UNLIMITED'
      return val.toString()
    }
    case 'bool':
      return chunk.endsWith('1') ? 'true' : 'false'
    case 'bytes':
      return `0x${chunk}`
    default:
      return `0x${chunk}`
  }
}

/**
 * Decode calldata into a human-readable format.
 * Returns null if the calldata is not a recognized function.
 */
export function decodeCallData(data: string): DecodedCallData | null {
  if (!data || data === '0x' || data.length < 10) {
    return null
  }

  const selector = data.slice(0, 10).toLowerCase()
  const funcDef = KNOWN_FUNCTIONS[selector]

  if (!funcDef) {
    return {
      functionName: 'unknown',
      selector,
      args: [],
      description: `Unknown function call (${selector})`,
    }
  }

  const args: DecodedArg[] = []
  const paramsData = data.slice(10)

  for (let i = 0; i < funcDef.params.length; i++) {
    const param = funcDef.params[i]
    if (!param) continue
    const offset = i * 64
    const value = decodeParam(paramsData, offset, param.type)
    args.push({ name: param.name, type: param.type, value })
  }

  const description = generateDescription(funcDef.name, args)

  return {
    functionName: funcDef.name,
    selector,
    args,
    description,
  }
}

/**
 * Generate a human-readable description for a decoded function call
 */
function generateDescription(functionName: string, args: DecodedArg[]): string {
  switch (functionName) {
    case 'transfer': {
      const to = args.find((a) => a.name === 'to')?.value ?? 'unknown'
      const amount = args.find((a) => a.name === 'amount')?.value ?? '0'
      return `Transfer ${amount} tokens to ${shortenAddress(to)}`
    }
    case 'approve': {
      const spender = args.find((a) => a.name === 'spender')?.value ?? 'unknown'
      const amount = args.find((a) => a.name === 'amount')?.value ?? '0'
      if (amount === 'UNLIMITED') {
        return `Approve UNLIMITED tokens for ${shortenAddress(spender)}`
      }
      return `Approve ${amount} tokens for ${shortenAddress(spender)}`
    }
    case 'transferFrom': {
      const from = args.find((a) => a.name === 'from')?.value ?? 'unknown'
      const to = args.find((a) => a.name === 'to')?.value ?? 'unknown'
      const amount = args.find((a) => a.name === 'amount')?.value ?? '0'
      return `Transfer ${amount} tokens from ${shortenAddress(from)} to ${shortenAddress(to)}`
    }
    case 'setApprovalForAll': {
      const operator = args.find((a) => a.name === 'operator')?.value ?? 'unknown'
      const approved = args.find((a) => a.name === 'approved')?.value ?? 'false'
      if (approved === 'true') {
        return `Grant full collection access to ${shortenAddress(operator)}`
      }
      return `Revoke collection access from ${shortenAddress(operator)}`
    }
    case 'safeTransferFrom': {
      const to = args.find((a) => a.name === 'to')?.value ?? 'unknown'
      return `Transfer NFT to ${shortenAddress(to)}`
    }
    case 'increaseAllowance': {
      const spender = args.find((a) => a.name === 'spender')?.value ?? 'unknown'
      const amount = args.find((a) => a.name === 'amount')?.value ?? '0'
      return `Increase allowance by ${amount} for ${shortenAddress(spender)}`
    }
    case 'decreaseAllowance': {
      const spender = args.find((a) => a.name === 'spender')?.value ?? 'unknown'
      const amount = args.find((a) => a.name === 'amount')?.value ?? '0'
      return `Decrease allowance by ${amount} for ${shortenAddress(spender)}`
    }
    default:
      return `Call ${functionName}`
  }
}

function shortenAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
