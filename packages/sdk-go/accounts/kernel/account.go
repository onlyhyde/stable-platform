package kernel

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/accounts"
	"github.com/stablenet/sdk-go/types"
)

// AccountConfig configures a Kernel smart account.
type AccountConfig struct {
	// Client is the Ethereum client for chain interaction.
	Client *ethclient.Client

	// Validator is the validator module to use for signing.
	Validator accounts.Validator

	// EntryPoint is the EntryPoint address (defaults to v0.7).
	EntryPoint types.Address

	// FactoryAddress is the Kernel factory address (defaults to v3.1).
	FactoryAddress types.Address

	// Index is the optional index for counterfactual address generation.
	Index uint64
}

// Account is a Kernel v3 smart account implementation.
type Account struct {
	address        types.Address
	entryPoint     types.Address
	factoryAddress types.Address
	validator      accounts.Validator
	initData       types.Hex
	salt           [32]byte
	client         *ethclient.Client
	isDeployedCache *bool
}

// NewAccount creates a new Kernel smart account instance.
func NewAccount(ctx context.Context, config AccountConfig) (*Account, error) {
	entryPoint := config.EntryPoint
	if entryPoint == (types.Address{}) {
		entryPoint = EntryPointV07Address
	}

	factoryAddress := config.FactoryAddress
	if factoryAddress == (types.Address{}) {
		factoryAddress = KernelV31FactoryAddress
	}

	// Get validator initialization data
	validatorInitData, err := config.Validator.GetInitData(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get validator init data: %w", err)
	}

	// Encode the initialization data
	initData, err := EncodeKernelInitializeData(config.Validator, validatorInitData)
	if err != nil {
		return nil, fmt.Errorf("failed to encode init data: %w", err)
	}

	// Calculate the salt
	salt := CalculateSalt(config.Index)

	// Calculate the counterfactual address
	address, err := getKernelAddress(ctx, config.Client, factoryAddress, initData, salt)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate address: %w", err)
	}

	return &Account{
		address:        address,
		entryPoint:     entryPoint,
		factoryAddress: factoryAddress,
		validator:      config.Validator,
		initData:       initData,
		salt:           salt,
		client:         config.Client,
	}, nil
}

// Address returns the account address.
func (a *Account) Address() types.Address {
	return a.address
}

// EntryPoint returns the EntryPoint address.
func (a *Account) EntryPoint() types.Address {
	return a.entryPoint
}

// GetNonce returns the current nonce from EntryPoint.
func (a *Account) GetNonce(ctx context.Context) (uint64, error) {
	// Call EntryPoint.getNonce(address sender, uint192 key)
	// For default validator, key is 0
	data, err := EntryPointABI.Pack("getNonce", a.address, big.NewInt(0))
	if err != nil {
		return 0, fmt.Errorf("failed to pack getNonce: %w", err)
	}

	result, err := a.client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&a.entryPoint),
		Data: data,
	}, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to call getNonce: %w", err)
	}

	// Unpack result
	outputs, err := EntryPointABI.Unpack("getNonce", result)
	if err != nil {
		return 0, fmt.Errorf("failed to unpack getNonce result: %w", err)
	}

	if len(outputs) == 0 {
		return 0, fmt.Errorf("no nonce returned")
	}

	nonce, ok := outputs[0].(*big.Int)
	if !ok {
		return 0, fmt.Errorf("unexpected nonce type")
	}

	return nonce.Uint64(), nil
}

// GetInitCode returns the init code for account deployment.
// Returns empty if already deployed.
func (a *Account) GetInitCode(ctx context.Context) (types.Hex, error) {
	deployed, err := a.IsDeployed(ctx)
	if err != nil {
		return nil, err
	}

	if deployed {
		return types.Hex{}, nil
	}

	factoryData, err := a.GetFactoryData(ctx)
	if err != nil {
		return nil, err
	}

	if len(factoryData) == 0 {
		return types.Hex{}, nil
	}

	// InitCode = factory address + factory data
	initCode := append(a.factoryAddress.Bytes(), factoryData.Bytes()...)
	return types.Hex(initCode), nil
}

// EncodeCallData encodes calls into the account's execute format.
func (a *Account) EncodeCallData(calls []accounts.Call) (types.Hex, error) {
	return EncodeKernelExecuteCallData(calls)
}

// SignUserOperation signs a UserOperation hash.
func (a *Account) SignUserOperation(ctx context.Context, userOpHash types.Hash) (types.Hex, error) {
	// Sign with the validator
	signature, err := a.validator.SignHash(ctx, userOpHash)
	if err != nil {
		return nil, fmt.Errorf("failed to sign: %w", err)
	}

	// For Kernel v3, the signature format is:
	// - 1 byte: mode (0x00 for enable mode, 0x01 for enable with signature, 0x02 for validation mode)
	// - signature data
	// For a simple validator signature, we use mode 0x02 (validation mode)
	result := make([]byte, 1+len(signature))
	result[0] = SignatureModeValidation
	copy(result[1:], signature.Bytes())

	return types.Hex(result), nil
}

// GetFactory returns the factory address (nil if deployed).
func (a *Account) GetFactory(ctx context.Context) (*types.Address, error) {
	deployed, err := a.IsDeployed(ctx)
	if err != nil {
		return nil, err
	}

	if deployed {
		return nil, nil
	}

	return &a.factoryAddress, nil
}

// GetFactoryData returns the factory call data (nil if deployed).
func (a *Account) GetFactoryData(ctx context.Context) (types.Hex, error) {
	deployed, err := a.IsDeployed(ctx)
	if err != nil {
		return nil, err
	}

	if deployed {
		return nil, nil
	}

	return EncodeFactoryData(a.initData, a.salt)
}

// IsDeployed returns whether the account is deployed on-chain.
func (a *Account) IsDeployed(ctx context.Context) (bool, error) {
	if a.isDeployedCache != nil {
		return *a.isDeployedCache, nil
	}

	code, err := a.client.CodeAt(ctx, a.address, nil)
	if err != nil {
		return false, fmt.Errorf("failed to get code: %w", err)
	}

	deployed := len(code) > 0
	a.isDeployedCache = &deployed
	return deployed, nil
}

// ClearDeployedCache clears the cached deployment status.
// Call this after deploying the account.
func (a *Account) ClearDeployedCache() {
	a.isDeployedCache = nil
}

// getKernelAddress calculates the counterfactual address for a Kernel account.
func getKernelAddress(
	ctx context.Context,
	client *ethclient.Client,
	factoryAddress types.Address,
	initData types.Hex,
	salt [32]byte,
) (types.Address, error) {
	// Call factory.getAddress(bytes initData, bytes32 salt)
	data, err := KernelFactoryABI.Pack("getAddress", initData.Bytes(), salt)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to pack getAddress: %w", err)
	}

	result, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   (*common.Address)(&factoryAddress),
		Data: data,
	}, nil)
	if err != nil {
		// If factory call fails, we can't calculate the address
		// This might happen if the factory is not deployed
		return types.Address{}, fmt.Errorf("failed to call getAddress: %w", err)
	}

	// Unpack result
	outputs, err := KernelFactoryABI.Unpack("getAddress", result)
	if err != nil {
		return types.Address{}, fmt.Errorf("failed to unpack getAddress result: %w", err)
	}

	if len(outputs) == 0 {
		return types.Address{}, fmt.Errorf("no address returned")
	}

	address, ok := outputs[0].(common.Address)
	if !ok {
		return types.Address{}, fmt.Errorf("unexpected address type")
	}

	return address, nil
}
