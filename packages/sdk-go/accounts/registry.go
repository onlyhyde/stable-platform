// Package accounts provides smart account abstractions for ERC-4337.
package accounts

import (
	"context"
	"fmt"
	"math/big"
	"sync"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Account Capabilities
// ============================================================================

// Capability represents an account capability.
type Capability string

const (
	// CapabilitySign indicates the account can sign transactions.
	CapabilitySign Capability = "sign"

	// CapabilityUserOp indicates the account can send UserOperations.
	CapabilityUserOp Capability = "userOp"

	// CapabilityBatchCall indicates the account can batch multiple calls.
	CapabilityBatchCall Capability = "batchCall"

	// CapabilityModules indicates the account supports ERC-7579 modules.
	CapabilityModules Capability = "modules"

	// CapabilityDelegation indicates the account supports EIP-7702 delegation.
	CapabilityDelegation Capability = "delegation"

	// CapabilitySponsoredGas indicates the account can use sponsored gas.
	CapabilitySponsoredGas Capability = "sponsoredGas"

	// CapabilityERC20Gas indicates the account can pay gas with ERC20 tokens.
	CapabilityERC20Gas Capability = "erc20Gas"

	// CapabilitySessionKeys indicates the account supports session keys.
	CapabilitySessionKeys Capability = "sessionKeys"

	// CapabilityRecovery indicates the account supports social recovery.
	CapabilityRecovery Capability = "recovery"
)

// CapabilitySet represents a set of account capabilities.
type CapabilitySet map[Capability]bool

// Has checks if the capability set has a specific capability.
func (cs CapabilitySet) Has(cap Capability) bool {
	return cs[cap]
}

// Add adds a capability to the set.
func (cs CapabilitySet) Add(cap Capability) {
	cs[cap] = true
}

// Remove removes a capability from the set.
func (cs CapabilitySet) Remove(cap Capability) {
	delete(cs, cap)
}

// All returns all capabilities in the set.
func (cs CapabilitySet) All() []Capability {
	caps := make([]Capability, 0, len(cs))
	for cap := range cs {
		caps = append(caps, cap)
	}
	return caps
}

// GetCapabilitiesForType returns the capabilities for an account type.
func GetCapabilitiesForType(accountType AccountType) CapabilitySet {
	caps := make(CapabilitySet)

	switch accountType {
	case AccountTypeEOA:
		caps.Add(CapabilitySign)

	case AccountTypeSmart:
		caps.Add(CapabilitySign)
		caps.Add(CapabilityUserOp)
		caps.Add(CapabilityBatchCall)
		caps.Add(CapabilityModules)
		caps.Add(CapabilitySponsoredGas)
		caps.Add(CapabilityERC20Gas)
		caps.Add(CapabilitySessionKeys)

	case AccountTypeDelegated:
		caps.Add(CapabilitySign)
		caps.Add(CapabilityUserOp)
		caps.Add(CapabilityBatchCall)
		caps.Add(CapabilityModules)
		caps.Add(CapabilityDelegation)
		caps.Add(CapabilitySponsoredGas)
		caps.Add(CapabilityERC20Gas)
		caps.Add(CapabilitySessionKeys)
	}

	return caps
}

// ============================================================================
// Account State
// ============================================================================

// AccountState represents the on-chain state of an account.
type AccountState struct {
	// Address is the account address.
	Address types.Address `json:"address"`

	// Type is the detected account type.
	Type AccountType `json:"type"`

	// Balance is the native currency balance.
	Balance *big.Int `json:"balance"`

	// Nonce is the current transaction nonce.
	Nonce uint64 `json:"nonce"`

	// IsDeployed indicates if the account has code deployed.
	IsDeployed bool `json:"isDeployed"`

	// Code is the account code (empty for EOA).
	Code types.Hex `json:"code,omitempty"`

	// DelegateAddress is the EIP-7702 delegate address (if delegated).
	DelegateAddress *types.Address `json:"delegateAddress,omitempty"`

	// Capabilities are the account's capabilities.
	Capabilities CapabilitySet `json:"capabilities"`
}

// ============================================================================
// Account Detector
// ============================================================================

// AccountDetector detects and classifies Ethereum accounts.
type AccountDetector struct {
	client *ethclient.Client
	mu     sync.RWMutex
	cache  map[types.Address]*AccountState
}

// NewAccountDetector creates a new account detector.
func NewAccountDetector(client *ethclient.Client) *AccountDetector {
	return &AccountDetector{
		client: client,
		cache:  make(map[types.Address]*AccountState),
	}
}

// DetectAccountType detects the type of an account.
func (d *AccountDetector) DetectAccountType(ctx context.Context, address types.Address) (AccountType, error) {
	state, err := d.GetAccountState(ctx, address)
	if err != nil {
		return "", err
	}
	return state.Type, nil
}

// GetAccountState returns the full state of an account.
func (d *AccountDetector) GetAccountState(ctx context.Context, address types.Address) (*AccountState, error) {
	// Check cache first
	d.mu.RLock()
	if state, ok := d.cache[address]; ok {
		d.mu.RUnlock()
		return state, nil
	}
	d.mu.RUnlock()

	// Fetch account data in parallel
	type result struct {
		balance *big.Int
		nonce   uint64
		code    []byte
		err     error
	}

	ch := make(chan result, 3)

	// Get balance
	go func() {
		balance, err := d.client.BalanceAt(ctx, address, nil)
		ch <- result{balance: balance, err: err}
	}()

	// Get nonce
	go func() {
		nonce, err := d.client.NonceAt(ctx, address, nil)
		ch <- result{nonce: nonce, err: err}
	}()

	// Get code
	go func() {
		code, err := d.client.CodeAt(ctx, address, nil)
		ch <- result{code: code, err: err}
	}()

	// Collect results
	var balance *big.Int
	var nonce uint64
	var code []byte

	for i := 0; i < 3; i++ {
		r := <-ch
		if r.err != nil {
			return nil, fmt.Errorf("failed to fetch account data: %w", r.err)
		}
		if r.balance != nil {
			balance = r.balance
		}
		if r.nonce > 0 {
			nonce = r.nonce
		}
		if r.code != nil {
			code = r.code
		}
	}

	// Determine account type
	var accountType AccountType
	var delegateAddress *types.Address

	if len(code) == 0 {
		accountType = AccountTypeEOA
	} else {
		// Check if it's an EIP-7702 delegated account
		delegateAddr := detectDelegation(code)
		if delegateAddr != nil {
			accountType = AccountTypeDelegated
			delegateAddress = delegateAddr
		} else {
			accountType = AccountTypeSmart
		}
	}

	state := &AccountState{
		Address:         address,
		Type:            accountType,
		Balance:         balance,
		Nonce:           nonce,
		IsDeployed:      len(code) > 0,
		Code:            types.Hex(code),
		DelegateAddress: delegateAddress,
		Capabilities:    GetCapabilitiesForType(accountType),
	}

	// Cache the result
	d.mu.Lock()
	d.cache[address] = state
	d.mu.Unlock()

	return state, nil
}

// ClearCache clears the account state cache.
func (d *AccountDetector) ClearCache() {
	d.mu.Lock()
	d.cache = make(map[types.Address]*AccountState)
	d.mu.Unlock()
}

// ClearCacheFor clears the cache for a specific address.
func (d *AccountDetector) ClearCacheFor(address types.Address) {
	d.mu.Lock()
	delete(d.cache, address)
	d.mu.Unlock()
}

// detectDelegation checks if the code is an EIP-7702 delegation.
func detectDelegation(code []byte) *types.Address {
	// EIP-7702 delegation prefix: 0xef0100
	if len(code) >= 23 && code[0] == 0xef && code[1] == 0x01 && code[2] == 0x00 {
		var addr types.Address
		copy(addr[:], code[3:23])
		return &addr
	}
	return nil
}

// ============================================================================
// Account Registry
// ============================================================================

// AccountRegistry manages multiple accounts.
type AccountRegistry struct {
	mu       sync.RWMutex
	accounts map[types.Address]*Account
	detector *AccountDetector
}

// NewAccountRegistry creates a new account registry.
func NewAccountRegistry(client *ethclient.Client) *AccountRegistry {
	return &AccountRegistry{
		accounts: make(map[types.Address]*Account),
		detector: NewAccountDetector(client),
	}
}

// Register registers an account.
func (r *AccountRegistry) Register(account *Account) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.accounts[account.Address] = account
}

// Unregister removes an account from the registry.
func (r *AccountRegistry) Unregister(address types.Address) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.accounts, address)
}

// Get returns an account by address.
func (r *AccountRegistry) Get(address types.Address) (*Account, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	account, ok := r.accounts[address]
	return account, ok
}

// GetAll returns all registered accounts.
func (r *AccountRegistry) GetAll() []*Account {
	r.mu.RLock()
	defer r.mu.RUnlock()

	accounts := make([]*Account, 0, len(r.accounts))
	for _, account := range r.accounts {
		accounts = append(accounts, account)
	}
	return accounts
}

// GetByType returns all accounts of a specific type.
func (r *AccountRegistry) GetByType(accountType AccountType) []*Account {
	r.mu.RLock()
	defer r.mu.RUnlock()

	accounts := make([]*Account, 0)
	for _, account := range r.accounts {
		if account.Type == accountType {
			accounts = append(accounts, account)
		}
	}
	return accounts
}

// GetSmartAccounts returns all smart accounts.
func (r *AccountRegistry) GetSmartAccounts() []*Account {
	smart := r.GetByType(AccountTypeSmart)
	delegated := r.GetByType(AccountTypeDelegated)
	return append(smart, delegated...)
}

// Count returns the number of registered accounts.
func (r *AccountRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.accounts)
}

// RefreshState refreshes the state of an account.
func (r *AccountRegistry) RefreshState(ctx context.Context, address types.Address) (*Account, error) {
	r.mu.Lock()
	account, exists := r.accounts[address]
	r.mu.Unlock()

	if !exists {
		return nil, fmt.Errorf("account not registered: %s", address.Hex())
	}

	// Clear cache and re-detect
	r.detector.ClearCacheFor(address)
	state, err := r.detector.GetAccountState(ctx, address)
	if err != nil {
		return nil, err
	}

	// Update account
	r.mu.Lock()
	account.Type = state.Type
	account.IsDeployed = state.IsDeployed
	account.DelegateAddress = state.DelegateAddress
	r.accounts[address] = account
	r.mu.Unlock()

	return account, nil
}

// ============================================================================
// Account Builder
// ============================================================================

// AccountBuilder helps build account configurations.
type AccountBuilder struct {
	account *Account
}

// NewAccountBuilder creates a new account builder.
func NewAccountBuilder() *AccountBuilder {
	return &AccountBuilder{
		account: &Account{
			Type:      AccountTypeEOA,
			CreatedAt: 0,
		},
	}
}

// WithAddress sets the account address.
func (b *AccountBuilder) WithAddress(address types.Address) *AccountBuilder {
	b.account.Address = address
	return b
}

// WithName sets the account name.
func (b *AccountBuilder) WithName(name string) *AccountBuilder {
	b.account.Name = name
	return b
}

// WithType sets the account type.
func (b *AccountBuilder) WithType(accountType AccountType) *AccountBuilder {
	b.account.Type = accountType
	return b
}

// WithDelegateAddress sets the delegate address for delegated accounts.
func (b *AccountBuilder) WithDelegateAddress(address types.Address) *AccountBuilder {
	b.account.Type = AccountTypeDelegated
	b.account.DelegateAddress = &address
	return b
}

// WithModules sets the installed modules.
func (b *AccountBuilder) WithModules(modules []types.InstalledModule) *AccountBuilder {
	b.account.InstalledModules = modules
	return b
}

// Build returns the constructed account.
func (b *AccountBuilder) Build() *Account {
	return b.account
}

// ============================================================================
// Utility Functions
// ============================================================================

// IsSmartAccountType returns whether the account type is a smart account type.
func IsSmartAccountType(accountType AccountType) bool {
	return accountType == AccountTypeSmart || accountType == AccountTypeDelegated
}

// CanSendUserOp returns whether the account can send UserOperations.
func CanSendUserOp(accountType AccountType) bool {
	caps := GetCapabilitiesForType(accountType)
	return caps.Has(CapabilityUserOp)
}

// CanBatchCalls returns whether the account can batch calls.
func CanBatchCalls(accountType AccountType) bool {
	caps := GetCapabilitiesForType(accountType)
	return caps.Has(CapabilityBatchCall)
}

// CanInstallModules returns whether the account can install modules.
func CanInstallModules(accountType AccountType) bool {
	caps := GetCapabilitiesForType(accountType)
	return caps.Has(CapabilityModules)
}

// GetBalance returns the balance of an account.
func GetBalance(ctx context.Context, client *ethclient.Client, address types.Address) (*big.Int, error) {
	return client.BalanceAt(ctx, common.Address(address), nil)
}

// GetNonce returns the nonce of an account.
func GetNonce(ctx context.Context, client *ethclient.Client, address types.Address) (uint64, error) {
	return client.NonceAt(ctx, common.Address(address), nil)
}

// HasCode returns whether an account has code deployed.
func HasCode(ctx context.Context, client *ethclient.Client, address types.Address) (bool, error) {
	code, err := client.CodeAt(ctx, common.Address(address), nil)
	if err != nil {
		return false, err
	}
	return len(code) > 0, nil
}

// ============================================================================
// Module Management
// ============================================================================

// ModuleType represents the type of ERC-7579 module.
type ModuleType uint8

const (
	// ModuleTypeValidator is a validator module.
	ModuleTypeValidator ModuleType = 1

	// ModuleTypeExecutor is an executor module.
	ModuleTypeExecutor ModuleType = 2

	// ModuleTypeFallback is a fallback handler module.
	ModuleTypeFallback ModuleType = 3

	// ModuleTypeHook is a hook module.
	ModuleTypeHook ModuleType = 4
)

// ModuleInfo contains information about an installed module.
type ModuleInfo struct {
	// Address is the module address.
	Address types.Address `json:"address"`

	// Type is the module type.
	Type ModuleType `json:"type"`

	// Name is the module name.
	Name string `json:"name,omitempty"`

	// Version is the module version.
	Version string `json:"version,omitempty"`

	// IsEnabled indicates if the module is enabled.
	IsEnabled bool `json:"isEnabled"`

	// Data is additional module-specific data.
	Data types.Hex `json:"data,omitempty"`
}

// ModuleConfig contains configuration for installing a module.
type ModuleConfig struct {
	// Address is the module address.
	Address types.Address `json:"address"`

	// Type is the module type.
	Type ModuleType `json:"type"`

	// InitData is the initialization data.
	InitData types.Hex `json:"initData"`
}

// UninstallModuleConfig contains configuration for uninstalling a module.
type UninstallModuleConfig struct {
	// Address is the module address.
	Address types.Address `json:"address"`

	// Type is the module type.
	Type ModuleType `json:"type"`

	// DeInitData is the de-initialization data.
	DeInitData types.Hex `json:"deInitData"`
}
