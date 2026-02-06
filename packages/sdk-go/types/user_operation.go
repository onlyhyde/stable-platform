package types

import "math/big"

// UserOperation represents an ERC-4337 v0.7 user operation.
type UserOperation struct {
	// Sender is the account making the operation
	Sender Address `json:"sender"`

	// Nonce is the anti-replay parameter (combined key and sequence)
	Nonce *big.Int `json:"nonce"`

	// Factory is the account factory address (optional, for new accounts)
	Factory *Address `json:"factory,omitempty"`

	// FactoryData is the data for the account factory (optional)
	FactoryData Hex `json:"factoryData,omitempty"`

	// CallData is the data to pass to the sender for execution
	CallData Hex `json:"callData"`

	// CallGasLimit is the gas limit for the main execution call
	CallGasLimit *big.Int `json:"callGasLimit"`

	// VerificationGasLimit is the gas limit for the verification step
	VerificationGasLimit *big.Int `json:"verificationGasLimit"`

	// PreVerificationGas is the gas for pre-verification (bundler compensation)
	PreVerificationGas *big.Int `json:"preVerificationGas"`

	// MaxFeePerGas is the maximum fee per gas (EIP-1559)
	MaxFeePerGas *big.Int `json:"maxFeePerGas"`

	// MaxPriorityFeePerGas is the maximum priority fee per gas (EIP-1559)
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`

	// Paymaster is the paymaster address (optional)
	Paymaster *Address `json:"paymaster,omitempty"`

	// PaymasterVerificationGasLimit is gas for paymaster verification (optional)
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit,omitempty"`

	// PaymasterPostOpGasLimit is gas for paymaster postOp (optional)
	PaymasterPostOpGasLimit *big.Int `json:"paymasterPostOpGasLimit,omitempty"`

	// PaymasterData is the data for the paymaster (optional)
	PaymasterData Hex `json:"paymasterData,omitempty"`

	// Signature is the signature over the entire operation
	Signature Hex `json:"signature"`
}

// PartialUserOperation represents a partially filled user operation
// used during construction before gas estimation.
type PartialUserOperation struct {
	Sender                        Address  `json:"sender"`
	Nonce                         *big.Int `json:"nonce,omitempty"`
	Factory                       *Address `json:"factory,omitempty"`
	FactoryData                   Hex      `json:"factoryData,omitempty"`
	CallData                      Hex      `json:"callData"`
	CallGasLimit                  *big.Int `json:"callGasLimit,omitempty"`
	VerificationGasLimit          *big.Int `json:"verificationGasLimit,omitempty"`
	PreVerificationGas            *big.Int `json:"preVerificationGas,omitempty"`
	MaxFeePerGas                  *big.Int `json:"maxFeePerGas,omitempty"`
	MaxPriorityFeePerGas          *big.Int `json:"maxPriorityFeePerGas,omitempty"`
	Paymaster                     *Address `json:"paymaster,omitempty"`
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit,omitempty"`
	PaymasterPostOpGasLimit       *big.Int `json:"paymasterPostOpGasLimit,omitempty"`
	PaymasterData                 Hex      `json:"paymasterData,omitempty"`
	Signature                     Hex      `json:"signature,omitempty"`
}

// PackedUserOperation represents a packed user operation for RPC transmission.
// Uses combined fields as specified in ERC-4337 v0.7.
type PackedUserOperation struct {
	Sender             Address  `json:"sender"`
	Nonce              *big.Int `json:"nonce"`
	InitCode           Hex      `json:"initCode"`           // factory + factoryData
	CallData           Hex      `json:"callData"`
	AccountGasLimits   Hash     `json:"accountGasLimits"`   // verificationGasLimit + callGasLimit
	PreVerificationGas *big.Int `json:"preVerificationGas"`
	GasFees            Hash     `json:"gasFees"`            // maxPriorityFeePerGas + maxFeePerGas
	PaymasterAndData   Hex      `json:"paymasterAndData"`   // paymaster + limits + data
	Signature          Hex      `json:"signature"`
}

// UserOperationReceipt represents the receipt after a UserOp is executed.
type UserOperationReceipt struct {
	UserOpHash    Hash     `json:"userOpHash"`
	Sender        Address  `json:"sender"`
	Nonce         *big.Int `json:"nonce"`
	Paymaster     *Address `json:"paymaster,omitempty"`
	ActualGasCost *big.Int `json:"actualGasCost"`
	ActualGasUsed *big.Int `json:"actualGasUsed"`
	Success       bool     `json:"success"`
	Logs          []Log    `json:"logs"`
	Receipt       *TransactionReceipt `json:"receipt"`
}

// Log represents an Ethereum event log.
type Log struct {
	Address          Address  `json:"address"`
	Topics           []Hash   `json:"topics"`
	Data             Hex      `json:"data"`
	BlockNumber      uint64   `json:"blockNumber"`
	TransactionHash  Hash     `json:"transactionHash"`
	TransactionIndex uint     `json:"transactionIndex"`
	BlockHash        Hash     `json:"blockHash"`
	LogIndex         uint     `json:"logIndex"`
	Removed          bool     `json:"removed"`
}

// TransactionReceipt represents an Ethereum transaction receipt.
type TransactionReceipt struct {
	TransactionHash   Hash     `json:"transactionHash"`
	TransactionIndex  uint64   `json:"transactionIndex"`
	BlockHash         Hash     `json:"blockHash"`
	BlockNumber       uint64   `json:"blockNumber"`
	From              Address  `json:"from"`
	To                *Address `json:"to,omitempty"`
	CumulativeGasUsed *big.Int `json:"cumulativeGasUsed"`
	GasUsed           *big.Int `json:"gasUsed"`
	EffectiveGasPrice *big.Int `json:"effectiveGasPrice"`
	Logs              []Log    `json:"logs"`
	Status            uint64   `json:"status"` // 1 = success, 0 = failure
}

// UserOperationGasEstimation contains gas estimates for a UserOperation.
type UserOperationGasEstimation struct {
	CallGasLimit                  *big.Int `json:"callGasLimit"`
	VerificationGasLimit          *big.Int `json:"verificationGasLimit"`
	PreVerificationGas            *big.Int `json:"preVerificationGas"`
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit,omitempty"`
	PaymasterPostOpGasLimit       *big.Int `json:"paymasterPostOpGasLimit,omitempty"`
}

// Call represents a single call to be executed.
type Call struct {
	To    Address  `json:"to"`
	Value *big.Int `json:"value,omitempty"`
	Data  Hex      `json:"data,omitempty"`
}

// ExecutionCall is an alias for Call used in execution contexts.
type ExecutionCall = Call
