package tests

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"

	"github.com/stablenet/sdk-go/core/userop"
	"github.com/stablenet/sdk-go/types"
)

func TestPackUserOperation(t *testing.T) {
	sender := common.HexToAddress("0x1234567890abcdef1234567890abcdef12345678")
	factory := common.HexToAddress("0xabcdef1234567890abcdef1234567890abcdef12")

	userOp := &types.UserOperation{
		Sender:               sender,
		Nonce:                big.NewInt(1),
		Factory:              &factory,
		FactoryData:          types.Hex([]byte{0x01, 0x02, 0x03}),
		CallData:             types.Hex([]byte{0x04, 0x05, 0x06}),
		CallGasLimit:         big.NewInt(100000),
		VerificationGasLimit: big.NewInt(200000),
		PreVerificationGas:   big.NewInt(50000),
		MaxFeePerGas:         big.NewInt(1000000000), // 1 gwei
		MaxPriorityFeePerGas: big.NewInt(100000000),  // 0.1 gwei
		Signature:            types.Hex([]byte{0x07, 0x08, 0x09}),
	}

	packed := userop.Pack(userOp)

	// Verify sender
	if packed.Sender != sender.Hex() {
		t.Errorf("expected sender %s, got %s", sender.Hex(), packed.Sender)
	}

	// Verify nonce
	if packed.Nonce != "0x1" {
		t.Errorf("expected nonce 0x1, got %s", packed.Nonce)
	}

	// Verify initCode includes factory
	if packed.InitCode == "0x" {
		t.Error("expected initCode to include factory")
	}

	// Verify signature
	if packed.Signature == "" {
		t.Error("expected signature to be set")
	}
}

func TestUnpackUserOperation(t *testing.T) {
	packed := map[string]string{
		"sender":             "0x1234567890abcdef1234567890abcdef12345678",
		"nonce":              "0x1",
		"initCode":           "0x",
		"callData":           "0x040506",
		"accountGasLimits":   "0x0000000000000000000000000003093000000000000000000000000000030d40",
		"preVerificationGas": "0xc350",
		"gasFees":            "0x00000000000000000000000005f5e10000000000000000000000000003b9aca00",
		"paymasterAndData":   "0x",
		"signature":          "0x070809",
	}

	userOp, err := userop.Unpack(packed)
	if err != nil {
		t.Fatalf("failed to unpack: %v", err)
	}

	// Verify sender
	expectedSender := common.HexToAddress("0x1234567890abcdef1234567890abcdef12345678")
	if userOp.Sender != expectedSender {
		t.Errorf("expected sender %s, got %s", expectedSender.Hex(), userOp.Sender.Hex())
	}

	// Verify nonce
	if userOp.Nonce.Cmp(big.NewInt(1)) != 0 {
		t.Errorf("expected nonce 1, got %s", userOp.Nonce.String())
	}
}

func TestGetUserOperationHash(t *testing.T) {
	sender := common.HexToAddress("0x1234567890abcdef1234567890abcdef12345678")
	entryPoint := common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	chainID := big.NewInt(1)

	userOp := &types.UserOperation{
		Sender:               sender,
		Nonce:                big.NewInt(0),
		CallData:             types.Hex([]byte{}),
		CallGasLimit:         big.NewInt(100000),
		VerificationGasLimit: big.NewInt(100000),
		PreVerificationGas:   big.NewInt(50000),
		MaxFeePerGas:         big.NewInt(1000000000),
		MaxPriorityFeePerGas: big.NewInt(100000000),
		Signature:            types.Hex([]byte{}),
	}

	hash, err := userop.GetUserOperationHash(userOp, entryPoint, chainID)
	if err != nil {
		t.Fatalf("failed to get hash: %v", err)
	}

	// Just verify we get a non-zero hash
	zeroHash := types.Hash{}
	if hash == zeroHash {
		t.Error("expected non-zero hash")
	}
}
