/**
 * Merchant Registry ABI
 * Contract for merchant registration and verification
 */
export const MERCHANT_REGISTRY_ABI = [
  // Registration
  {
    type: 'function',
    name: 'registerMerchant',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'email', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateMerchantInfo',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'email', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Verification
  {
    type: 'function',
    name: 'verifyMerchant',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeVerification',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Suspension
  {
    type: 'function',
    name: 'suspendMerchant',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unsuspendMerchant',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Fee Management
  {
    type: 'function',
    name: 'setMerchantFee',
    inputs: [
      { name: 'merchant', type: 'address' },
      { name: 'feeBps', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMerchantFee',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Verifier Management
  {
    type: 'function',
    name: 'addVerifier',
    inputs: [{ name: 'verifier', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeVerifier',
    inputs: [{ name: 'verifier', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // View Functions
  {
    type: 'function',
    name: 'isMerchantRegistered',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMerchantVerified',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMerchantSuspended',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMerchantActive',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isVerifier',
    inputs: [{ name: 'verifier', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMerchantInfo',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'isVerified', type: 'bool' },
      { name: 'isSuspended', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVerifiedMerchants',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalMerchants',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'MerchantRegistered',
    inputs: [
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MerchantVerified',
    inputs: [
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'VerificationRevoked',
    inputs: [
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'revoker', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'MerchantSuspended',
    inputs: [{ name: 'merchant', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'MerchantUnsuspended',
    inputs: [{ name: 'merchant', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'MerchantFeeUpdated',
    inputs: [
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'feeBps', type: 'uint256', indexed: false },
    ],
  },
] as const
