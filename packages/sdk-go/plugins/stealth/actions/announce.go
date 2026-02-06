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

// AnnounceResult contains the result of an announcement.
type AnnounceResult struct {
	// TxHash is the transaction hash.
	TxHash types.Hash
}

// Announce announces a stealth payment via the EIP-5564 Announcer.
//
// This action publishes the ephemeral public key and metadata
// so that the recipient can discover the stealth address.
//
// Example:
//
//	result, err := generateStealthAddress(...)
//	// Send tokens to result.StealthAddress first, then announce
//	txHash, err := Announce(ctx, client, AnnounceParams{
//	    SchemeID:        1,
//	    StealthAddress:  result.StealthAddress,
//	    EphemeralPubKey: result.EphemeralPubKey,
//	    Metadata:        result.ViewTag,
//	})
func Announce(ctx context.Context, c *client.Client, params stealth.AnnounceParams) (*AnnounceResult, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}

	if c.Signer == nil {
		return nil, fmt.Errorf("signer is required for announcements")
	}

	// Get transaction options
	opts, err := c.GetTransactOpts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction options: %w", err)
	}

	// Pack the function call
	data, err := constants.ERC5564AnnouncerABI.Pack(
		"announce",
		big.NewInt(int64(params.SchemeID)),
		common.Address(params.StealthAddress),
		params.EphemeralPubKey.Bytes(),
		params.Metadata.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack announce call: %w", err)
	}

	// Send transaction
	announcerAddr := common.Address(c.AnnouncerAddress)
	tx, err := c.SendTransaction(ctx, opts, &announcerAddr, data)
	if err != nil {
		return nil, fmt.Errorf("failed to send announce transaction: %w", err)
	}

	return &AnnounceResult{
		TxHash: types.Hash(tx.Hash()),
	}, nil
}

// EncodeAnnounce encodes the announce function call without sending.
// This is useful for batch transactions or when using a different transaction method.
func EncodeAnnounce(params stealth.AnnounceParams) (types.Hex, error) {
	data, err := constants.ERC5564AnnouncerABI.Pack(
		"announce",
		big.NewInt(int64(params.SchemeID)),
		common.Address(params.StealthAddress),
		params.EphemeralPubKey.Bytes(),
		params.Metadata.Bytes(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to pack announce call: %w", err)
	}

	return types.Hex(data), nil
}

// EstimateAnnounceGas estimates the gas required for an announce transaction.
func EstimateAnnounceGas(ctx context.Context, c *client.Client, params stealth.AnnounceParams) (uint64, error) {
	if c == nil {
		return 0, fmt.Errorf("client is required")
	}

	data, err := EncodeAnnounce(params)
	if err != nil {
		return 0, err
	}

	return c.EstimateGas(ctx, c.AnnouncerAddress, data)
}
