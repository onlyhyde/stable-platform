package paymaster

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// ABI types used for payload encoding.
var (
	uint48Type, _  = abi.NewType("uint48", "", nil)
	uint160Type, _ = abi.NewType("uint160", "", nil)
	bytes4Type, _  = abi.NewType("bytes4", "", nil)
	bytesType, _   = abi.NewType("bytes", "", nil)
)

// ============================================================================
// Verifying Payload (Type 0)
// ============================================================================

// VerifyingPayload represents the payload for a verifying paymaster (type 0).
type VerifyingPayload struct {
	PolicyID      [32]byte
	Sponsor       common.Address
	MaxCost       *big.Int
	VerifierExtra []byte
}

// EncodeVerifyingPayload ABI-encodes a verifying payload.
// Format: abi.encode(bytes32, address, uint256, bytes)
func EncodeVerifyingPayload(p *VerifyingPayload) ([]byte, error) {
	arguments := abi.Arguments{
		{Type: bytes32Type},
		{Type: addressType},
		{Type: uint256Type},
		{Type: bytesType},
	}

	data, err := arguments.Pack(
		p.PolicyID,
		p.Sponsor,
		p.MaxCost,
		p.VerifierExtra,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode verifying payload: %w", err)
	}

	return data, nil
}

// DecodeVerifyingPayload ABI-decodes a verifying payload.
func DecodeVerifyingPayload(data []byte) (*VerifyingPayload, error) {
	arguments := abi.Arguments{
		{Type: bytes32Type},
		{Type: addressType},
		{Type: uint256Type},
		{Type: bytesType},
	}

	values, err := arguments.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode verifying payload: %w", err)
	}

	if len(values) != 4 {
		return nil, fmt.Errorf("expected 4 values, got %d", len(values))
	}

	policyID, ok := values[0].([32]byte)
	if !ok {
		return nil, fmt.Errorf("invalid policyID type")
	}

	sponsor, ok := values[1].(common.Address)
	if !ok {
		return nil, fmt.Errorf("invalid sponsor type")
	}

	maxCost, ok := values[2].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid maxCost type")
	}

	verifierExtra, ok := values[3].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid verifierExtra type")
	}

	return &VerifyingPayload{
		PolicyID:      policyID,
		Sponsor:       sponsor,
		MaxCost:       new(big.Int).Set(maxCost),
		VerifierExtra: verifierExtra,
	}, nil
}

// ============================================================================
// Sponsor Payload (Type 1)
// ============================================================================

// SponsorPayload represents the payload for a sponsor paymaster (type 1).
type SponsorPayload struct {
	CampaignID     [32]byte       // bytes32 — campaign identifier
	PerUserLimit   *big.Int       // uint256 — per-user gas limit
	TargetContract common.Address // address — allowed target contract
	TargetSelector [4]byte        // bytes4  — allowed function selector
	SponsorExtra   []byte         // bytes   — extension data
}

// EncodeSponsorPayload ABI-encodes a sponsor payload.
// Format: abi.encode(bytes32, uint256, address, bytes4, bytes)
func EncodeSponsorPayload(p *SponsorPayload) ([]byte, error) {
	arguments := abi.Arguments{
		{Type: bytes32Type},
		{Type: uint256Type},
		{Type: addressType},
		{Type: bytes4Type},
		{Type: bytesType},
	}

	data, err := arguments.Pack(
		p.CampaignID,
		p.PerUserLimit,
		p.TargetContract,
		p.TargetSelector,
		p.SponsorExtra,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode sponsor payload: %w", err)
	}

	return data, nil
}

// DecodeSponsorPayload ABI-decodes a sponsor payload.
func DecodeSponsorPayload(data []byte) (*SponsorPayload, error) {
	arguments := abi.Arguments{
		{Type: bytes32Type},
		{Type: uint256Type},
		{Type: addressType},
		{Type: bytes4Type},
		{Type: bytesType},
	}

	values, err := arguments.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode sponsor payload: %w", err)
	}

	if len(values) != 5 {
		return nil, fmt.Errorf("expected 5 values, got %d", len(values))
	}

	campaignID, ok := values[0].([32]byte)
	if !ok {
		return nil, fmt.Errorf("invalid campaignID type")
	}

	perUserLimit, ok := values[1].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid perUserLimit type")
	}

	targetContract, ok := values[2].(common.Address)
	if !ok {
		return nil, fmt.Errorf("invalid targetContract type")
	}

	targetSelector, ok := values[3].([4]byte)
	if !ok {
		return nil, fmt.Errorf("invalid targetSelector type")
	}

	sponsorExtra, ok := values[4].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid sponsorExtra type")
	}

	return &SponsorPayload{
		CampaignID:     campaignID,
		PerUserLimit:   new(big.Int).Set(perUserLimit),
		TargetContract: targetContract,
		TargetSelector: targetSelector,
		SponsorExtra:   sponsorExtra,
	}, nil
}

// ============================================================================
// ERC20 Payload (Type 2)
// ============================================================================

// ERC20Payload represents the payload for an ERC20 paymaster (type 2).
type ERC20Payload struct {
	Token        common.Address
	MaxTokenCost *big.Int
	QuoteID      *big.Int
	ERC20Extra   []byte
}

// EncodeERC20Payload ABI-encodes an ERC20 payload.
// Format: abi.encode(address, uint256, uint256, bytes)
func EncodeERC20Payload(p *ERC20Payload) ([]byte, error) {
	arguments := abi.Arguments{
		{Type: addressType},
		{Type: uint256Type},
		{Type: uint256Type},
		{Type: bytesType},
	}

	data, err := arguments.Pack(
		p.Token,
		p.MaxTokenCost,
		p.QuoteID,
		p.ERC20Extra,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode erc20 payload: %w", err)
	}

	return data, nil
}

// DecodeERC20Payload ABI-decodes an ERC20 payload.
func DecodeERC20Payload(data []byte) (*ERC20Payload, error) {
	arguments := abi.Arguments{
		{Type: addressType},
		{Type: uint256Type},
		{Type: uint256Type},
		{Type: bytesType},
	}

	values, err := arguments.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode erc20 payload: %w", err)
	}

	if len(values) != 4 {
		return nil, fmt.Errorf("expected 4 values, got %d", len(values))
	}

	token, ok := values[0].(common.Address)
	if !ok {
		return nil, fmt.Errorf("invalid token type")
	}

	maxTokenCost, ok := values[1].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid maxTokenCost type")
	}

	quoteID, ok := values[2].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid quoteID type")
	}

	erc20Extra, ok := values[3].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid erc20Extra type")
	}

	return &ERC20Payload{
		Token:        token,
		MaxTokenCost: new(big.Int).Set(maxTokenCost),
		QuoteID:      new(big.Int).Set(quoteID),
		ERC20Extra:   erc20Extra,
	}, nil
}

// ============================================================================
// Permit2 Payload (Type 3)
// ============================================================================

// Permit2Payload represents the payload for a Permit2 paymaster (type 3).
type Permit2Payload struct {
	Token            common.Address
	PermitAmount     *big.Int // uint160
	PermitExpiration uint64   // uint48
	PermitNonce      uint64   // uint48
	PermitSig        []byte
	Permit2Extra     []byte
}

// EncodePermit2Payload ABI-encodes a Permit2 payload.
// Format: abi.encode(address, uint160, uint48, uint48, bytes, bytes)
func EncodePermit2Payload(p *Permit2Payload) ([]byte, error) {
	arguments := abi.Arguments{
		{Type: addressType},
		{Type: uint160Type},
		{Type: uint48Type},
		{Type: uint48Type},
		{Type: bytesType},
		{Type: bytesType},
	}

	data, err := arguments.Pack(
		p.Token,
		p.PermitAmount,
		new(big.Int).SetUint64(p.PermitExpiration),
		new(big.Int).SetUint64(p.PermitNonce),
		p.PermitSig,
		p.Permit2Extra,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encode permit2 payload: %w", err)
	}

	return data, nil
}

// DecodePermit2Payload ABI-decodes a Permit2 payload.
func DecodePermit2Payload(data []byte) (*Permit2Payload, error) {
	arguments := abi.Arguments{
		{Type: addressType},
		{Type: uint160Type},
		{Type: uint48Type},
		{Type: uint48Type},
		{Type: bytesType},
		{Type: bytesType},
	}

	values, err := arguments.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode permit2 payload: %w", err)
	}

	if len(values) != 6 {
		return nil, fmt.Errorf("expected 6 values, got %d", len(values))
	}

	token, ok := values[0].(common.Address)
	if !ok {
		return nil, fmt.Errorf("invalid token type")
	}

	permitAmount, ok := values[1].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid permitAmount type")
	}

	permitExpiration, ok := values[2].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid permitExpiration type")
	}

	permitNonce, ok := values[3].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid permitNonce type")
	}

	permitSig, ok := values[4].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid permitSig type")
	}

	permit2Extra, ok := values[5].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid permit2Extra type")
	}

	return &Permit2Payload{
		Token:            token,
		PermitAmount:     new(big.Int).Set(permitAmount),
		PermitExpiration: permitExpiration.Uint64(),
		PermitNonce:      permitNonce.Uint64(),
		PermitSig:        permitSig,
		Permit2Extra:     permit2Extra,
	}, nil
}
