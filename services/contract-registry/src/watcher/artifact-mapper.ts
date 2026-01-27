const DEFAULT_MAPPINGS: Record<string, string> = {
  EntryPoint: 'entryPoint',
  Kernel: 'kernel',
  KernelFactory: 'kernelFactory',
  ECDSAValidator: 'ecdsaValidator',
  WebAuthnValidator: 'webAuthnValidator',
  MultiECDSAValidator: 'multiEcdsaValidator',
  OwnableExecutor: 'ownableExecutor',
  SpendingLimitHook: 'spendingLimitHook',
  VerifyingPaymaster: 'verifyingPaymaster',
  TokenPaymaster: 'tokenPaymaster',
  StealthAnnouncer: 'stealthAnnouncer',
  StealthRegistry: 'stealthRegistry',
  KYCRegistry: 'kycRegistry',
  ComplianceValidator: 'complianceValidator',
  SubscriptionManager: 'subscriptionManager',
  RecurringPaymentExecutor: 'recurringPaymentExecutor',
  PermissionManager: 'permissionManager',
}

export function mapArtifactName(
  artifactName: string,
  customMappings?: Record<string, string>
): string {
  const mappings = { ...DEFAULT_MAPPINGS, ...customMappings }
  return mappings[artifactName] ?? toCamelCase(artifactName)
}

function toCamelCase(name: string): string {
  if (!name) return name
  return name.charAt(0).toLowerCase() + name.slice(1)
}
