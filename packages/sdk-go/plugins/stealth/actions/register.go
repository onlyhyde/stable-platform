package actions

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/plugins/stealth"
	"github.com/stablenet/sdk-go/plugins/stealth/client"
	"github.com/stablenet/sdk-go/plugins/stealth/constants"
	"github.com/stablenet/sdk-go/types"
)

// RegisterResult contains the result of a registration.
type RegisterResult struct {
	// TxHash is the transaction hash.
	TxHash types.Hash
}

// RegisterStealthMetaAddress registers a stealth meta-address in the EIP-6538 Registry.
//
// This allows others to look up your stealth meta-address by your Ethereum address.
//
// Example:
//
//	metaAddr, _ := crypto.EncodeStealthMetaAddress(spendingPubKey, viewingPubKey)
//	result, err := RegisterStealthMetaAddress(ctx, client, RegisterStealthMetaAddressParams{
//	    SchemeID:           1,
//	    StealthMetaAddress: metaAddr,
//	})
func RegisterStealthMetaAddress(ctx context.Context, c *client.Client, params stealth.RegisterStealthMetaAddressParams) (*RegisterResult, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}

	if c.Signer == nil {
		return nil, fmt.Errorf("signer is required for registration")
	}

	// Get transaction options
	opts, err := c.GetTransactOpts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction options: %w", err)
	}

	// Pack the function call
	data, err := constants.ERC6538RegistryABI.Pack(
		"registerKeys",
		big.NewInt(int64(params.SchemeID)),
		params.StealthMetaAddress.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack registerKeys call: %w", err)
	}

	// Send transaction
	registryAddr := common.Address(c.RegistryAddress)
	tx, err := c.SendTransaction(ctx, opts, &registryAddr, data)
	if err != nil {
		return nil, fmt.Errorf("failed to send register transaction: %w", err)
	}

	return &RegisterResult{
		TxHash: types.Hash(tx.Hash()),
	}, nil
}

// EncodeRegisterStealthMetaAddress encodes the registerKeys function call without sending.
func EncodeRegisterStealthMetaAddress(params stealth.RegisterStealthMetaAddressParams) (types.Hex, error) {
	data, err := constants.ERC6538RegistryABI.Pack(
		"registerKeys",
		big.NewInt(int64(params.SchemeID)),
		params.StealthMetaAddress.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack registerKeys call: %w", err)
	}

	return types.Hex(data), nil
}

// LookupStealthMetaAddress looks up a registered stealth meta-address.
func LookupStealthMetaAddress(ctx context.Context, c *client.Client, registrant types.Address, schemeID stealth.SchemeID) (*stealth.StealthMetaAddress, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}

	// Pack the call
	data, err := constants.ERC6538RegistryABI.Pack(
		"stealthMetaAddressOf",
		common.Address(registrant),
		big.NewInt(int64(schemeID)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack stealthMetaAddressOf call: %w", err)
	}

	// Call the contract
	result, err := c.Call(ctx, c.RegistryAddress, types.Hex(data))
	if err != nil {
		return nil, fmt.Errorf("failed to call stealthMetaAddressOf: %w", err)
	}

	// Unpack the result
	unpacked, err := constants.ERC6538RegistryABI.Unpack("stealthMetaAddressOf", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack stealthMetaAddressOf result: %w", err)
	}

	if len(unpacked) == 0 {
		return nil, fmt.Errorf("empty result from stealthMetaAddressOf")
	}

	metaAddrBytes, ok := unpacked[0].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid result type from stealthMetaAddressOf")
	}

	if len(metaAddrBytes) == 0 {
		return nil, fmt.Errorf("no stealth meta-address registered for this address")
	}

	// Parse the stealth meta address
	return parseStealthMetaAddressBytes(metaAddrBytes, schemeID)
}

// GetRegistrantNonce gets the nonce for a registrant (used for registerKeysOnBehalf).
func GetRegistrantNonce(ctx context.Context, c *client.Client, registrant types.Address) (*big.Int, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}

	// Pack the call
	data, err := constants.ERC6538RegistryABI.Pack(
		"nonceOf",
		common.Address(registrant),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack nonceOf call: %w", err)
	}

	// Call the contract
	result, err := c.Call(ctx, c.RegistryAddress, types.Hex(data))
	if err != nil {
		return nil, fmt.Errorf("failed to call nonceOf: %w", err)
	}

	// Unpack the result
	unpacked, err := constants.ERC6538RegistryABI.Unpack("nonceOf", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack nonceOf result: %w", err)
	}

	if len(unpacked) == 0 {
		return big.NewInt(0), nil
	}

	nonce, ok := unpacked[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid nonce type")
	}

	return nonce, nil
}

// parseStealthMetaAddressBytes parses stealth meta address bytes.
func parseStealthMetaAddressBytes(data []byte, schemeID stealth.SchemeID) (*stealth.StealthMetaAddress, error) {
	if len(data) != constants.StealthMetaAddressSize {
		return nil, fmt.Errorf("invalid stealth meta address length: expected %d, got %d",
			constants.StealthMetaAddressSize, len(data))
	}

	return &stealth.StealthMetaAddress{
		SpendingPubKey: types.Hex(data[:constants.CompressedPubKeySize]),
		ViewingPubKey:  types.Hex(data[constants.CompressedPubKeySize:]),
		SchemeID:       schemeID,
	}, nil
}
