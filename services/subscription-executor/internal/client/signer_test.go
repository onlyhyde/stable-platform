package client

import (
	"encoding/hex"
	"strings"
	"testing"
)

// Well-known test private key (Hardhat account #0)
const testPrivateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

func TestNewUserOpSigner(t *testing.T) {
	signer, err := NewUserOpSigner(testPrivateKey, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	expectedAddr := "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
	if !strings.EqualFold(signer.GetAddress(), expectedAddr) {
		t.Errorf("address mismatch: got %s, want %s", signer.GetAddress(), expectedAddr)
	}
}

func TestNewUserOpSignerWith0xPrefix(t *testing.T) {
	signer, err := NewUserOpSigner("0x"+testPrivateKey, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	if err != nil {
		t.Fatalf("failed to create signer with 0x prefix: %v", err)
	}

	expectedAddr := "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
	if !strings.EqualFold(signer.GetAddress(), expectedAddr) {
		t.Errorf("address mismatch: got %s, want %s", signer.GetAddress(), expectedAddr)
	}
}

func TestNewUserOpSignerInvalidKey(t *testing.T) {
	tests := []struct {
		name string
		key  string
	}{
		{"too short", "abcdef"},
		{"not hex", strings.Repeat("zz", 32)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewUserOpSigner(tt.key, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
			if err == nil {
				t.Error("expected error for invalid key, got nil")
			}
		})
	}
}

func TestSignUserOp(t *testing.T) {
	signer, err := NewUserOpSigner(testPrivateKey, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	userOp := &PackedUserOperation{
		Sender:             "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
		Nonce:              "0x0",
		InitCode:           "0x",
		CallData:           "0x51945447" + strings.Repeat("0", 64),
		AccountGasLimits:   "0x" + strings.Repeat("0", 32) + "00000000000000000000000000100000",
		PreVerificationGas: "0x5208",
		GasFees:            "0x" + strings.Repeat("0", 32) + "000000000000000000000003b9aca00",
		PaymasterAndData:   "0x",
		Signature:          "0x",
	}

	sig, err := signer.SignUserOp(userOp)
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	if !strings.HasPrefix(sig, "0x") {
		t.Error("signature should start with 0x")
	}

	sigBytes, err := hex.DecodeString(strings.TrimPrefix(sig, "0x"))
	if err != nil {
		t.Fatalf("failed to decode signature hex: %v", err)
	}

	if len(sigBytes) != 65 {
		t.Errorf("signature should be 65 bytes, got %d", len(sigBytes))
	}

	v := sigBytes[64]
	if v != 27 && v != 28 {
		t.Errorf("V should be 27 or 28, got %d", v)
	}
}

func TestSignUserOpDeterministicHash(t *testing.T) {
	signer, err := NewUserOpSigner(testPrivateKey, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	userOp := &PackedUserOperation{
		Sender:             "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
		Nonce:              "0x1",
		InitCode:           "0x",
		CallData:           "0xa9059cbb" + strings.Repeat("0", 128),
		AccountGasLimits:   "0x" + strings.Repeat("0", 64),
		PreVerificationGas: "0x0",
		GasFees:            "0x" + strings.Repeat("0", 64),
		PaymasterAndData:   "0x",
		Signature:          "0x",
	}

	hash1, err := signer.computeUserOpHash(userOp)
	if err != nil {
		t.Fatalf("failed to compute hash 1: %v", err)
	}

	hash2, err := signer.computeUserOpHash(userOp)
	if err != nil {
		t.Fatalf("failed to compute hash 2: %v", err)
	}

	if hex.EncodeToString(hash1) != hex.EncodeToString(hash2) {
		t.Error("hash computation should be deterministic")
	}
}

func TestKeccak256(t *testing.T) {
	emptyHash := keccak256([]byte{})
	expected := "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
	if hex.EncodeToString(emptyHash) != expected {
		t.Errorf("keccak256 empty: got %s, want %s", hex.EncodeToString(emptyHash), expected)
	}
}

func TestHexToBytes32(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantLen int
		wantErr bool
	}{
		{"address", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 32, false},
		{"short", "0x01", 32, false},
		{"invalid", "0xzzzz", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := hexToBytes32(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("hexToBytes32() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err == nil && len(result) != tt.wantLen {
				t.Errorf("hexToBytes32() len = %d, want %d", len(result), tt.wantLen)
			}
		})
	}
}

func TestPubKeyToAddress(t *testing.T) {
	signer, err := NewUserOpSigner(testPrivateKey, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	addr := signer.GetAddress()
	if !strings.HasPrefix(addr, "0x") {
		t.Error("address should start with 0x")
	}
	if len(addr) != 42 {
		t.Errorf("address should be 42 chars (with 0x), got %d", len(addr))
	}
}

func TestSignatureRecovery(t *testing.T) {
	signer, err := NewUserOpSigner(testPrivateKey, 31337, "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	userOp := &PackedUserOperation{
		Sender:             "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
		Nonce:              "0x5",
		InitCode:           "0x",
		CallData:           "0xa9059cbb" + strings.Repeat("0", 128),
		AccountGasLimits:   "0x" + strings.Repeat("0", 64),
		PreVerificationGas: "0x5208",
		GasFees:            "0x" + strings.Repeat("0", 64),
		PaymasterAndData:   "0x",
		Signature:          "0x",
	}

	// Sign multiple times - signatures may differ (ECDSA uses random k) but must all be valid
	for i := 0; i < 5; i++ {
		sig, err := signer.SignUserOp(userOp)
		if err != nil {
			t.Fatalf("attempt %d: failed to sign: %v", i, err)
		}

		sigBytes, _ := hex.DecodeString(strings.TrimPrefix(sig, "0x"))
		if len(sigBytes) != 65 {
			t.Errorf("attempt %d: signature should be 65 bytes", i)
		}

		v := sigBytes[64]
		if v != 27 && v != 28 {
			t.Errorf("attempt %d: V should be 27 or 28, got %d", i, v)
		}
	}
}
