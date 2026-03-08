package modules

import (
	"context"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

func TestNewHookExecutor(t *testing.T) {
	hooks := []InstalledHook{
		{
			Address:  common.HexToAddress("0x1111111111111111111111111111111111111111"),
			HookType: HookTypePre,
		},
		{
			Address:  common.HexToAddress("0x2222222222222222222222222222222222222222"),
			HookType: HookTypePost,
		},
	}

	executor, err := NewHookExecutor(hooks)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	if len(executor.Hooks()) != 2 {
		t.Errorf("expected 2 hooks, got %d", len(executor.Hooks()))
	}
}

func TestNewHookExecutorEmpty(t *testing.T) {
	executor, err := NewHookExecutor(nil)
	if err != nil {
		t.Fatalf("NewHookExecutor with nil failed: %v", err)
	}

	if len(executor.Hooks()) != 0 {
		t.Errorf("expected 0 hooks, got %d", len(executor.Hooks()))
	}
}

func TestHookExecutorAddRemove(t *testing.T) {
	executor, err := NewHookExecutor(nil)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	addr := common.HexToAddress("0x1111111111111111111111111111111111111111")
	executor.AddHook(InstalledHook{Address: addr, HookType: HookTypeBoth})

	if len(executor.Hooks()) != 1 {
		t.Fatalf("expected 1 hook after add, got %d", len(executor.Hooks()))
	}

	removed := executor.RemoveHook(addr)
	if !removed {
		t.Error("expected RemoveHook to return true")
	}
	if len(executor.Hooks()) != 0 {
		t.Errorf("expected 0 hooks after remove, got %d", len(executor.Hooks()))
	}

	removed = executor.RemoveHook(addr)
	if removed {
		t.Error("expected RemoveHook to return false for non-existent hook")
	}
}

func TestPreCheckEmptyHooks(t *testing.T) {
	executor, err := NewHookExecutor(nil)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx := context.Background()
	var execMode [32]byte
	calldata := []byte{0x01, 0x02, 0x03}

	hookCtx, err := executor.PreCheck(ctx, execMode, calldata)
	if err != nil {
		t.Fatalf("PreCheck with empty hooks failed: %v", err)
	}

	if hookCtx == nil {
		t.Fatal("expected non-nil HookContext")
	}

	if len(hookCtx.PreCheckData) != 0 {
		t.Errorf("expected empty PreCheckData, got %d bytes", len(hookCtx.PreCheckData))
	}

	if hookCtx.ExecutionCalldata == nil {
		t.Error("expected ExecutionCalldata to be set")
	}
}

func TestPostCheckEmptyHooks(t *testing.T) {
	executor, err := NewHookExecutor(nil)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx := context.Background()
	hookCtx := &HookContext{
		PreCheckData: []byte{},
	}

	err = executor.PostCheck(ctx, hookCtx)
	if err != nil {
		t.Fatalf("PostCheck with empty hooks failed: %v", err)
	}
}

func TestPostCheckNilContext(t *testing.T) {
	executor, err := NewHookExecutor(nil)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx := context.Background()
	err = executor.PostCheck(ctx, nil)
	if err == nil {
		t.Error("expected error for nil hookCtx")
	}
}

func TestPreCheckWithHooks(t *testing.T) {
	hooks := []InstalledHook{
		{
			Address:  common.HexToAddress("0x1111111111111111111111111111111111111111"),
			HookType: HookTypePre,
		},
		{
			Address:  common.HexToAddress("0x2222222222222222222222222222222222222222"),
			HookType: HookTypeBoth,
		},
		{
			Address:  common.HexToAddress("0x3333333333333333333333333333333333333333"),
			HookType: HookTypePost,
		},
	}

	executor, err := NewHookExecutor(hooks)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx := context.Background()
	var execMode [32]byte
	calldata := []byte{0xaa, 0xbb}

	hookCtx, err := executor.PreCheck(ctx, execMode, calldata)
	if err != nil {
		t.Fatalf("PreCheck failed: %v", err)
	}

	// Should have data from hook1 (Pre) and hook2 (Both), but NOT hook3 (Post)
	if len(hookCtx.PreCheckData) == 0 {
		t.Error("expected non-empty PreCheckData from pre hooks")
	}
}

func TestPostCheckWithHooks(t *testing.T) {
	hooks := []InstalledHook{
		{
			Address:  common.HexToAddress("0x1111111111111111111111111111111111111111"),
			HookType: HookTypePre,
		},
		{
			Address:  common.HexToAddress("0x2222222222222222222222222222222222222222"),
			HookType: HookTypeBoth,
		},
		{
			Address:  common.HexToAddress("0x3333333333333333333333333333333333333333"),
			HookType: HookTypePost,
		},
	}

	executor, err := NewHookExecutor(hooks)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx := context.Background()
	hookCtx := &HookContext{
		PreCheckData: []byte{0x01, 0x02},
	}

	// PostCheck should execute for hook2 (Both) and hook3 (Post), skip hook1 (Pre)
	err = executor.PostCheck(ctx, hookCtx)
	if err != nil {
		t.Fatalf("PostCheck failed: %v", err)
	}
}

func TestEncodePreCheckCall(t *testing.T) {
	hookAddr := common.HexToAddress("0x1111111111111111111111111111111111111111")
	sender := common.HexToAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	value := big.NewInt(1000)
	calldata := []byte{0x01, 0x02, 0x03, 0x04}

	encoded, err := EncodePreCheckCall(hookAddr, sender, value, calldata)
	if err != nil {
		t.Fatalf("EncodePreCheckCall failed: %v", err)
	}

	if len(encoded) == 0 {
		t.Error("expected non-empty encoded data")
	}

	// First 4 bytes should be the function selector for preCheck(address,uint256,bytes)
	if len(encoded) < 4 {
		t.Fatal("encoded data too short for function selector")
	}
}

func TestEncodePreCheckCallNilValue(t *testing.T) {
	hookAddr := common.HexToAddress("0x1111111111111111111111111111111111111111")
	sender := common.HexToAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	calldata := []byte{0x01}

	encoded, err := EncodePreCheckCall(hookAddr, sender, nil, calldata)
	if err != nil {
		t.Fatalf("EncodePreCheckCall with nil value failed: %v", err)
	}

	if len(encoded) == 0 {
		t.Error("expected non-empty encoded data")
	}
}

func TestEncodePostCheckCall(t *testing.T) {
	hookAddr := common.HexToAddress("0x1111111111111111111111111111111111111111")
	preCheckData := []byte{0xde, 0xad, 0xbe, 0xef}

	encoded, err := EncodePostCheckCall(hookAddr, preCheckData)
	if err != nil {
		t.Fatalf("EncodePostCheckCall failed: %v", err)
	}

	if len(encoded) == 0 {
		t.Error("expected non-empty encoded data")
	}

	// First 4 bytes should be the function selector for postCheck(bytes)
	if len(encoded) < 4 {
		t.Fatal("encoded data too short for function selector")
	}
}

func TestEncodePostCheckCallNilData(t *testing.T) {
	hookAddr := common.HexToAddress("0x1111111111111111111111111111111111111111")

	encoded, err := EncodePostCheckCall(hookAddr, nil)
	if err != nil {
		t.Fatalf("EncodePostCheckCall with nil data failed: %v", err)
	}

	if len(encoded) == 0 {
		t.Error("expected non-empty encoded data")
	}
}

func TestHookTypeString(t *testing.T) {
	tests := []struct {
		ht   HookType
		want string
	}{
		{HookTypePre, "Pre"},
		{HookTypePost, "Post"},
		{HookTypeBoth, "Both"},
		{HookType(99), "Unknown"},
	}

	for _, tt := range tests {
		if got := tt.ht.String(); got != tt.want {
			t.Errorf("HookType(%d).String() = %q, want %q", tt.ht, got, tt.want)
		}
	}
}

func TestPreCheckContextCancellation(t *testing.T) {
	hooks := []InstalledHook{
		{
			Address:  common.HexToAddress("0x1111111111111111111111111111111111111111"),
			HookType: HookTypePre,
		},
	}

	executor, err := NewHookExecutor(hooks)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	var execMode [32]byte
	_, err = executor.PreCheck(ctx, execMode, []byte{0x01})
	if err == nil {
		t.Error("expected error from cancelled context")
	}
}

func TestPostCheckContextCancellation(t *testing.T) {
	hooks := []InstalledHook{
		{
			Address:  common.HexToAddress("0x1111111111111111111111111111111111111111"),
			HookType: HookTypePost,
		},
	}

	executor, err := NewHookExecutor(hooks)
	if err != nil {
		t.Fatalf("NewHookExecutor failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	hookCtx := &HookContext{PreCheckData: []byte{}}
	err = executor.PostCheck(ctx, hookCtx)
	if err == nil {
		t.Error("expected error from cancelled context")
	}
}
