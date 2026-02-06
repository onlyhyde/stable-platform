// Package errors provides error types and codes for the StableNet Go SDK.
package errors

// SdkErrorCode represents SDK error codes.
type SdkErrorCode string

// SDK error codes.
const (
	// General errors
	ErrUnknown           SdkErrorCode = "UNKNOWN_ERROR"
	ErrInvalidConfig     SdkErrorCode = "INVALID_CONFIG"
	ErrValidation        SdkErrorCode = "VALIDATION_ERROR"
	ErrNetworkError      SdkErrorCode = "NETWORK_ERROR"
	ErrRPCError          SdkErrorCode = "RPC_ERROR"
	ErrUnauthorized      SdkErrorCode = "UNAUTHORIZED"
	ErrNotSupported      SdkErrorCode = "NOT_SUPPORTED"
	ErrTimeout           SdkErrorCode = "TIMEOUT"

	// Account errors
	ErrAccountNotDeployed SdkErrorCode = "ACCOUNT_NOT_DEPLOYED"
	ErrAccountNotFound    SdkErrorCode = "ACCOUNT_NOT_FOUND"
	ErrInvalidAccount     SdkErrorCode = "INVALID_ACCOUNT"

	// Transaction errors
	ErrTransactionFailed   SdkErrorCode = "TRANSACTION_FAILED"
	ErrTransactionRejected SdkErrorCode = "TRANSACTION_REJECTED"
	ErrTransactionTimeout  SdkErrorCode = "TRANSACTION_TIMEOUT"

	// UserOperation errors
	ErrUserOpFailed   SdkErrorCode = "USER_OP_FAILED"
	ErrUserOpRejected SdkErrorCode = "USER_OP_REJECTED"
	ErrUserOpTimeout  SdkErrorCode = "USER_OP_TIMEOUT"

	// Signature errors
	ErrSignatureFailed   SdkErrorCode = "SIGNATURE_FAILED"
	ErrSignatureRejected SdkErrorCode = "SIGNATURE_REJECTED"
	ErrInvalidSignature  SdkErrorCode = "INVALID_SIGNATURE"

	// Gas errors
	ErrGasEstimationFailed SdkErrorCode = "GAS_ESTIMATION_FAILED"
	ErrInsufficientGas     SdkErrorCode = "INSUFFICIENT_GAS"
	ErrGasLimitExceeded    SdkErrorCode = "GAS_LIMIT_EXCEEDED"

	// Bundler errors
	ErrBundlerError SdkErrorCode = "BUNDLER_ERROR"

	// Paymaster errors
	ErrPaymasterError            SdkErrorCode = "PAYMASTER_ERROR"
	ErrPaymasterNotAvailable     SdkErrorCode = "PAYMASTER_NOT_AVAILABLE"
	ErrPaymasterRejected         SdkErrorCode = "PAYMASTER_REJECTED"
	ErrInsufficientSponsorBalance SdkErrorCode = "INSUFFICIENT_SPONSOR_BALANCE"

	// Module errors
	ErrModuleNotInstalled SdkErrorCode = "MODULE_NOT_INSTALLED"
	ErrModuleInstallFailed SdkErrorCode = "MODULE_INSTALL_FAILED"
	ErrInvalidModuleConfig SdkErrorCode = "INVALID_MODULE_CONFIG"
)

// BundlerErrorCode represents ERC-4337 bundler error codes.
type BundlerErrorCode int

// Bundler error codes from ERC-4337 specification.
const (
	BundlerErrInvalidFields           BundlerErrorCode = -32602
	BundlerErrSimulationFailed        BundlerErrorCode = -32500
	BundlerErrRejectedByEPOrAccount   BundlerErrorCode = -32501
	BundlerErrRejectedByPaymaster     BundlerErrorCode = -32502
	BundlerErrBannedOpcode            BundlerErrorCode = -32503
	BundlerErrShortDeadline           BundlerErrorCode = -32504
	BundlerErrInvalidSignature        BundlerErrorCode = -32505
	BundlerErrInvalidPaymasterData    BundlerErrorCode = -32506
	BundlerErrBannedOrThrottled       BundlerErrorCode = -32507
	BundlerErrStakeOrDelayTooLow      BundlerErrorCode = -32508
	BundlerErrUnsupportedSignature    BundlerErrorCode = -32509
	BundlerErrInternalError           BundlerErrorCode = -32000
)

// String returns the string representation of the bundler error code.
func (c BundlerErrorCode) String() string {
	switch c {
	case BundlerErrInvalidFields:
		return "INVALID_FIELDS"
	case BundlerErrSimulationFailed:
		return "SIMULATION_FAILED"
	case BundlerErrRejectedByEPOrAccount:
		return "REJECTED_BY_EP_OR_ACCOUNT"
	case BundlerErrRejectedByPaymaster:
		return "REJECTED_BY_PAYMASTER"
	case BundlerErrBannedOpcode:
		return "BANNED_OPCODE"
	case BundlerErrShortDeadline:
		return "SHORT_DEADLINE"
	case BundlerErrInvalidSignature:
		return "INVALID_SIGNATURE"
	case BundlerErrInvalidPaymasterData:
		return "INVALID_PAYMASTER_DATA"
	case BundlerErrBannedOrThrottled:
		return "BANNED_OR_THROTTLED"
	case BundlerErrStakeOrDelayTooLow:
		return "STAKE_OR_DELAY_TOO_LOW"
	case BundlerErrUnsupportedSignature:
		return "UNSUPPORTED_SIGNATURE"
	case BundlerErrInternalError:
		return "INTERNAL_ERROR"
	default:
		return "UNKNOWN"
	}
}

// PaymasterErrorCode represents paymaster-specific error codes.
type PaymasterErrorCode string

// Paymaster error codes.
const (
	PaymasterErrNotAvailable           PaymasterErrorCode = "SPONSOR_NOT_AVAILABLE"
	PaymasterErrInsufficientBalance    PaymasterErrorCode = "INSUFFICIENT_SPONSOR_BALANCE"
	PaymasterErrTokenNotSupported      PaymasterErrorCode = "TOKEN_NOT_SUPPORTED"
	PaymasterErrInsufficientAllowance  PaymasterErrorCode = "INSUFFICIENT_TOKEN_ALLOWANCE"
	PaymasterErrTimeout                PaymasterErrorCode = "TIMEOUT"
	PaymasterErrHTTPError              PaymasterErrorCode = "HTTP_ERROR"
	PaymasterErrInvalidResponse        PaymasterErrorCode = "INVALID_RESPONSE"
	PaymasterErrRejected               PaymasterErrorCode = "REJECTED"
)

// retryableSdkErrors contains error codes that are retryable.
var retryableSdkErrors = map[SdkErrorCode]bool{
	ErrNetworkError:       true,
	ErrRPCError:           true,
	ErrTransactionTimeout: true,
	ErrUserOpTimeout:      true,
	ErrTimeout:            true,
}

// IsRetryable returns whether the SDK error code is retryable.
func (c SdkErrorCode) IsRetryable() bool {
	return retryableSdkErrors[c]
}

// retryableBundlerErrors contains bundler error codes that are retryable.
var retryableBundlerErrors = map[BundlerErrorCode]bool{
	BundlerErrInternalError:  true,
	BundlerErrShortDeadline:  true,
}

// IsRetryable returns whether the bundler error code is retryable.
func (c BundlerErrorCode) IsRetryable() bool {
	return retryableBundlerErrors[c]
}

// retryablePaymasterErrors contains paymaster error codes that are retryable.
var retryablePaymasterErrors = map[PaymasterErrorCode]bool{
	PaymasterErrTimeout:   true,
	PaymasterErrHTTPError: true,
}

// IsRetryable returns whether the paymaster error code is retryable.
func (c PaymasterErrorCode) IsRetryable() bool {
	return retryablePaymasterErrors[c]
}
