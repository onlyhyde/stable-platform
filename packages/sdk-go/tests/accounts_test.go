package tests

import (
	"bytes"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/accounts"
	"github.com/stablenet/sdk-go/accounts/kernel"
)

func TestEncodeExecutionMode(t *testing.T) {
	// Test single call mode
	mode := kernel.EncodeExecutionMode(kernel.CallTypeSingle, kernel.ExecModeDefault)
	if mode[0] != 0x00 {
		t.Errorf("expected call type 0x00, got 0x%02x", mode[0])
	}
	if mode[1] != 0x00 {
		t.Errorf("expected exec mode 0x00, got 0x%02x", mode[1])
	}

	// Test batch call mode
	mode = kernel.EncodeExecutionMode(kernel.CallTypeBatch, kernel.ExecModeDefault)
	if mode[0] != 0x01 {
		t.Errorf("expected call type 0x01, got 0x%02x", mode[0])
	}

	// Test delegate call mode
	mode = kernel.EncodeExecutionMode(kernel.CallTypeDelegate, kernel.ExecModeDelegate)
	if mode[0] != 0xff {
		t.Errorf("expected call type 0xff, got 0x%02x", mode[0])
	}
	if mode[1] != 0xff {
		t.Errorf("expected exec mode 0xff, got 0x%02x", mode[1])
	}
}

func TestEncodeSingleCall(t *testing.T) {
	call := accounts.Call{
		To:   common.HexToAddress("0x1234567890abcdef1234567890abcdef12345678"),
		Data: []byte{0x01, 0x02, 0x03, 0x04},
	}

	encoded, err := kernel.EncodeSingleCall(call)
	if err != nil {
		t.Fatalf("failed to encode single call: %v", err)
	}

	// ERC-7579 packed encoding: address (20) + uint256 value (32) + raw calldata (4) = 56 bytes
	expectedLen := 20 + 32 + len(call.Data)
	if len(encoded) != expectedLen {
		t.Errorf("expected encoded length %d, got %d bytes", expectedLen, len(encoded))
	}

	// Verify address bytes
	if common.BytesToAddress(encoded[:20]) != call.To {
		t.Errorf("encoded address mismatch")
	}

	// Verify calldata at the end
	tailStart := 20 + 32
	if !bytes.Equal(encoded[tailStart:], call.Data) {
		t.Errorf("encoded calldata mismatch")
	}
}

func TestEncodeKernelExecuteCallData(t *testing.T) {
	calls := []accounts.Call{
		{
			To:   common.HexToAddress("0x1234567890abcdef1234567890abcdef12345678"),
			Data: []byte{0x01, 0x02, 0x03, 0x04},
		},
	}

	encoded, err := kernel.EncodeKernelExecuteCallData(calls)
	if err != nil {
		t.Fatalf("failed to encode execute call data: %v", err)
	}

	// Should start with function selector (4 bytes)
	if len(encoded) < 4 {
		t.Error("encoded data too short")
	}
}

func TestCalculateSalt(t *testing.T) {
	salt0 := kernel.CalculateSalt(0)
	salt1 := kernel.CalculateSalt(1)

	// Salt 0 should be all zeros
	allZeros := true
	for _, b := range salt0 {
		if b != 0 {
			allZeros = false
			break
		}
	}
	if !allZeros {
		t.Error("expected salt 0 to be all zeros")
	}

	// Salt 1 should have last byte as 1
	if salt1[31] != 1 {
		t.Errorf("expected salt[31] to be 1, got %d", salt1[31])
	}
}

func TestECDSAValidator(t *testing.T) {
	// Generate a test private key
	privateKey, err := ethcrypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	validator, err := kernel.NewECDSAValidator(kernel.ECDSAValidatorConfig{
		PrivateKey: privateKey,
	})
	if err != nil {
		t.Fatalf("failed to create validator: %v", err)
	}

	// Test GetSignerAddress
	expectedAddress := ethcrypto.PubkeyToAddress(privateKey.PublicKey)
	if validator.GetSignerAddress() != expectedAddress {
		t.Errorf("expected signer address %s, got %s",
			expectedAddress.Hex(), validator.GetSignerAddress().Hex())
	}
}

func TestAccountType(t *testing.T) {
	// Test EOA account
	eoa := accounts.Account{
		Type: accounts.AccountTypeEOA,
	}
	if eoa.SupportsSmartAccount() {
		t.Error("EOA should not support smart account")
	}
	if eoa.CanInstallModules() {
		t.Error("EOA should not be able to install modules")
	}

	// Test Smart account (deployed)
	smart := accounts.Account{
		Type:       accounts.AccountTypeSmart,
		IsDeployed: true,
	}
	if !smart.SupportsSmartAccount() {
		t.Error("Smart account should support smart account")
	}
	if !smart.CanInstallModules() {
		t.Error("Deployed smart account should be able to install modules")
	}

	// Test Smart account (not deployed)
	notDeployed := accounts.Account{
		Type:       accounts.AccountTypeSmart,
		IsDeployed: false,
	}
	if !notDeployed.SupportsSmartAccount() {
		t.Error("Smart account should support smart account")
	}
	if notDeployed.CanInstallModules() {
		t.Error("Not deployed smart account should not be able to install modules")
	}

	// Test Delegated account
	delegated := accounts.Account{
		Type:       accounts.AccountTypeDelegated,
		IsDeployed: true,
	}
	if !delegated.SupportsSmartAccount() {
		t.Error("Delegated account should support smart account")
	}
}
