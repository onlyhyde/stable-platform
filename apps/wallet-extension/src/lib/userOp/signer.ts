import type { Address, Hex } from 'viem'
import { getUserOpHash, packUserOperation } from './builder'
import type { UserOperation, PackedUserOperation } from './types'
import { keyringController } from '../../background/keyring'

/**
 * UserOperation Signer
 * Signs UserOperations using the keyring controller
 */

export class UserOpSigner {
  private chainId: number
  private entryPoint: Address

  constructor(
    chainId: number,
    entryPoint: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
  ) {
    this.chainId = chainId
    this.entryPoint = entryPoint
  }

  /**
   * Sign a UserOperation
   */
  async sign(userOp: UserOperation): Promise<UserOperation> {
    const hash = getUserOpHash(userOp, this.entryPoint, this.chainId)
    const signature = await keyringController.signMessage(userOp.sender, hash)

    return {
      ...userOp,
      signature,
    }
  }

  /**
   * Sign and pack a UserOperation
   */
  async signAndPack(userOp: UserOperation): Promise<PackedUserOperation> {
    const signed = await this.sign(userOp)
    return packUserOperation(signed)
  }

  /**
   * Get the hash that will be signed
   */
  getHashToSign(userOp: UserOperation): Hex {
    return getUserOpHash(userOp, this.entryPoint, this.chainId)
  }

  /**
   * Verify a signature
   */
  verifySignature(
    userOp: UserOperation,
    expectedSigner: Address
  ): boolean {
    // TODO: Implement signature verification
    // This would require ecrecover
    return true
  }
}

/**
 * Create a UserOp signer for a specific chain
 */
export function createUserOpSigner(
  chainId: number,
  entryPoint?: Address
): UserOpSigner {
  return new UserOpSigner(chainId, entryPoint)
}
