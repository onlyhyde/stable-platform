import type { Address, Hex, PublicClient } from 'viem'
import { encodeAbiParameters, encodeFunctionData } from 'viem'
import type {
  GrantPermissionParams,
  GrantPermissionWithSignatureParams,
  GrantSubscriptionPermissionParams,
  PermissionManagerConfig,
  PermissionRecord,
} from './types'
import { PERMISSION_MANAGER_ABI, PERMISSION_TYPES, RULE_TYPES } from './types'

/**
 * ERC7715 Permission Manager client for subscription workflows
 *
 * Provides methods to grant, revoke, and query permissions used
 * by the SubscriptionManager for recurring payment authorization.
 */
export interface SubscriptionPermissionClient {
  /** The PermissionManager contract address */
  readonly managerAddress: Address

  // ---- Write encoders ----

  /** Encode calldata to grant a permission directly */
  encodeGrantPermission: (params: GrantPermissionParams) => Hex
  /** Encode calldata to grant a permission with signature (meta-tx) */
  encodeGrantPermissionWithSignature: (params: GrantPermissionWithSignatureParams) => Hex
  /** Encode calldata to revoke a permission */
  encodeRevokePermission: (permissionId: Hex) => Hex
  /** Encode calldata to adjust permission data */
  encodeAdjustPermission: (permissionId: Hex, newData: Hex) => Hex

  /**
   * Encode calldata to grant a subscription-specific recurring allowance.
   * Convenience method that builds the correct permission type and rules
   * for subscription payment flows.
   */
  encodeGrantSubscriptionPermission: (params: GrantSubscriptionPermissionParams) => Hex

  // ---- Read functions ----

  /** Get full permission record */
  getPermission: (client: PublicClient, permissionId: Hex) => Promise<PermissionRecord>
  /** Check if a permission is currently valid */
  isPermissionValid: (client: PublicClient, permissionId: Hex) => Promise<boolean>
  /** Compute a permission ID */
  getPermissionId: (
    client: PublicClient,
    granter: Address,
    grantee: Address,
    target: Address,
    permissionType: string,
    nonce: bigint
  ) => Promise<Hex>
  /** Get remaining allowance for the current period */
  getRemainingAllowance: (client: PublicClient, permissionId: Hex) => Promise<bigint>
  /** Get total cumulative usage */
  getTotalUsage: (client: PublicClient, permissionId: Hex) => Promise<bigint>
  /** Check if a permission type is supported */
  isPermissionTypeSupported: (client: PublicClient, permissionType: string) => Promise<boolean>
  /** Get current nonce for an address */
  getNonce: (client: PublicClient, account: Address) => Promise<bigint>
}

/**
 * Create a SubscriptionPermissionClient
 *
 * @example
 * ```ts
 * import { createSubscriptionPermissionClient } from '@stablenet/plugin-subscription'
 * import { parseEther } from 'viem'
 *
 * const permissions = createSubscriptionPermissionClient({
 *   managerAddress: '0x...',
 * })
 *
 * // Grant a subscription permission with spending limit and expiry
 * const calldata = permissions.encodeGrantSubscriptionPermission({
 *   grantee: subscriptionManagerAddress,
 *   target: subscriptionManagerAddress,
 *   spendingLimit: parseEther('100'),
 *   expiry: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
 * })
 *
 * // Check if permission is still valid
 * const valid = await permissions.isPermissionValid(publicClient, permissionId)
 * ```
 */
export function createSubscriptionPermissionClient(
  config: PermissionManagerConfig
): SubscriptionPermissionClient {
  const { managerAddress } = config

  return {
    managerAddress,

    // ---- Write encoders ----

    encodeGrantPermission(params: GrantPermissionParams): Hex {
      return encodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'grantPermission',
        args: [params.grantee, params.target, params.permission, params.rules],
      })
    },

    encodeGrantPermissionWithSignature(params: GrantPermissionWithSignatureParams): Hex {
      return encodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'grantPermissionWithSignature',
        args: [
          params.granter,
          params.grantee,
          params.target,
          params.permission,
          params.rules,
          params.signature,
        ],
      })
    },

    encodeRevokePermission(permissionId: Hex): Hex {
      return encodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'revokePermission',
        args: [permissionId],
      })
    },

    encodeAdjustPermission(permissionId: Hex, newData: Hex): Hex {
      return encodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'adjustPermission',
        args: [permissionId, newData],
      })
    },

    encodeGrantSubscriptionPermission(params: GrantSubscriptionPermissionParams): Hex {
      const spendingLimitData = encodeAbiParameters([{ type: 'uint256' }], [params.spendingLimit])

      const rules: Array<{ ruleType: string; data: Hex }> = []

      if (params.expiry !== undefined && params.expiry > 0n) {
        rules.push({
          ruleType: RULE_TYPES.EXPIRY,
          data: encodeAbiParameters([{ type: 'uint256' }], [params.expiry]),
        })
      }

      rules.push({
        ruleType: RULE_TYPES.SPENDING_LIMIT,
        data: spendingLimitData,
      })

      return encodeFunctionData({
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'grantPermission',
        args: [
          params.grantee,
          params.target,
          {
            permissionType: PERMISSION_TYPES.SUBSCRIPTION,
            isAdjustmentAllowed: params.isAdjustmentAllowed ?? false,
            data: spendingLimitData,
          },
          rules,
        ],
      })
    },

    // ---- Read functions ----

    async getPermission(client: PublicClient, permissionId: Hex): Promise<PermissionRecord> {
      const result = (await client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'getPermission',
        args: [permissionId],
      })) as {
        granter: Address
        grantee: Address
        chainId: bigint
        target: Address
        permission: { permissionType: string; isAdjustmentAllowed: boolean; data: Hex }
        rules: readonly { ruleType: string; data: Hex }[]
        createdAt: bigint
        active: boolean
      }

      return {
        granter: result.granter,
        grantee: result.grantee,
        chainId: result.chainId,
        target: result.target,
        permission: {
          permissionType: result.permission
            .permissionType as PermissionRecord['permission']['permissionType'],
          isAdjustmentAllowed: result.permission.isAdjustmentAllowed,
          data: result.permission.data,
        },
        rules: result.rules.map((r) => ({
          ruleType: r.ruleType,
          data: r.data,
        })),
        createdAt: result.createdAt,
        active: result.active,
      }
    },

    async isPermissionValid(client: PublicClient, permissionId: Hex): Promise<boolean> {
      return client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'isPermissionValid',
        args: [permissionId],
      }) as Promise<boolean>
    },

    async getPermissionId(
      client: PublicClient,
      granter: Address,
      grantee: Address,
      target: Address,
      permissionType: string,
      nonce: bigint
    ): Promise<Hex> {
      return client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'getPermissionId',
        args: [granter, grantee, target, permissionType, nonce],
      }) as Promise<Hex>
    },

    async getRemainingAllowance(client: PublicClient, permissionId: Hex): Promise<bigint> {
      return client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'getRemainingAllowance',
        args: [permissionId],
      }) as Promise<bigint>
    },

    async getTotalUsage(client: PublicClient, permissionId: Hex): Promise<bigint> {
      return client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'getTotalUsage',
        args: [permissionId],
      }) as Promise<bigint>
    },

    async isPermissionTypeSupported(
      client: PublicClient,
      permissionType: string
    ): Promise<boolean> {
      return client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'isPermissionTypeSupported',
        args: [permissionType],
      }) as Promise<boolean>
    },

    async getNonce(client: PublicClient, account: Address): Promise<bigint> {
      return client.readContract({
        address: managerAddress,
        abi: PERMISSION_MANAGER_ABI,
        functionName: 'nonces',
        args: [account],
      }) as Promise<bigint>
    },
  }
}
