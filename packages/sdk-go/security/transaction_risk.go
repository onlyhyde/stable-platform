package security

import (
	"math/big"
	"strings"

	"github.com/stablenet/sdk-go/types"
)

// ============================================================================
// Risk Level
// ============================================================================

// RiskLevel represents the risk level of a transaction.
type RiskLevel string

// Risk level constants.
const (
	RiskLevelSafe     RiskLevel = "safe"
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// RiskScores maps risk levels to numeric scores.
var RiskScores = map[RiskLevel]int{
	RiskLevelSafe:     0,
	RiskLevelLow:      20,
	RiskLevelMedium:   50,
	RiskLevelHigh:     75,
	RiskLevelCritical: 95,
}

// ============================================================================
// Risk Type
// ============================================================================

// RiskType represents the type of risk detected.
type RiskType string

// Risk type constants.
const (
	RiskTypeHighValue          RiskType = "high_value"
	RiskTypeTokenApproval      RiskType = "token_approval"
	RiskTypeUnlimitedApproval  RiskType = "unlimited_approval"
	RiskTypeNFTApprovalAll     RiskType = "nft_approval_all"
	RiskTypeTokenTransfer      RiskType = "token_transfer"
	RiskTypeContractInteraction RiskType = "contract_interaction"
	RiskTypeZeroAddress        RiskType = "zero_address"
	RiskTypeSelfTransfer       RiskType = "self_transfer"
	RiskTypeHighGasPrice       RiskType = "high_gas_price"
	RiskTypeSuspiciousData     RiskType = "suspicious_data"
	RiskTypeUnknownContract    RiskType = "unknown_contract"
	RiskTypeEmptyDataWithValue RiskType = "empty_data_with_value"
	RiskTypePossiblePhishing   RiskType = "possible_phishing"
)

// ============================================================================
// Transaction Risk Result
// ============================================================================

// TransactionRiskResult contains the result of transaction risk analysis.
type TransactionRiskResult struct {
	// RiskLevel is the overall risk level.
	RiskLevel RiskLevel `json:"riskLevel"`

	// RiskScore is the numeric risk score (0-100).
	RiskScore int `json:"riskScore"`

	// RiskTypes contains detected risk types.
	RiskTypes []RiskType `json:"riskTypes"`

	// Warnings contains warning messages.
	Warnings []string `json:"warnings"`

	// Summary is a human-readable summary.
	Summary string `json:"summary"`

	// DecodedMethod contains decoded method info if applicable.
	DecodedMethod *DecodedMethod `json:"decodedMethod,omitempty"`
}

// DecodedMethod contains decoded method information.
type DecodedMethod struct {
	// Selector is the 4-byte function selector.
	Selector string `json:"selector"`

	// Name is the function name.
	Name string `json:"name"`

	// Params contains decoded parameters.
	Params map[string]any `json:"params,omitempty"`
}

// ============================================================================
// Transaction Risk Parameters
// ============================================================================

// TransactionRiskParams contains transaction parameters for risk analysis.
type TransactionRiskParams struct {
	// From is the sender address.
	From types.Address

	// To is the recipient address (nil for contract deployment).
	To *types.Address

	// Value is the transaction value in wei.
	Value *big.Int

	// Data is the transaction calldata.
	Data types.Hex

	// GasPrice is the gas price (for legacy transactions).
	GasPrice *big.Int

	// MaxFeePerGas is the max fee per gas (for EIP-1559 transactions).
	MaxFeePerGas *big.Int

	// MaxPriorityFeePerGas is the max priority fee per gas.
	MaxPriorityFeePerGas *big.Int
}

// ============================================================================
// Constants
// ============================================================================

// ERC-20 method selectors.
var erc20Selectors = map[string]string{
	"transfer":          "0xa9059cbb",
	"approve":           "0x095ea7b3",
	"transferFrom":      "0x23b872dd",
	"increaseAllowance": "0x39509351",
	"decreaseAllowance": "0xa457c2d7",
}

// NFT method selectors.
var nftSelectors = map[string]string{
	"setApprovalForAll":           "0xa22cb465",
	"safeTransferFrom721":         "0x42842e0e",
	"safeTransferFrom721Data":     "0xb88d4fde",
	"safeTransferFrom1155":        "0xf242432a",
	"safeBatchTransferFrom1155":   "0x2eb2c2d6",
}

// Dangerous selectors.
var dangerousSelectors = map[string]string{
	"multicall":    "0xac9650d8",
	"execute":      "0xb61d27f6",
	"delegate":     "0x5c19a95c",
	"selfdestruct": "0xff",
}

// Max uint256 value (unlimited approval).
const maxUint256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

// Zero address.
var zeroAddress = types.Address{}

// Value thresholds (in wei).
var valueThresholds = struct {
	Medium   *big.Int // 1 ETH
	High     *big.Int // 10 ETH
	Critical *big.Int // 100 ETH
}{
	Medium:   new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil),
	High:     new(big.Int).Mul(big.NewInt(10), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)),
	Critical: new(big.Int).Mul(big.NewInt(100), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)),
}

// Gas price thresholds (in wei).
var gasPriceThresholds = struct {
	High     *big.Int // 100 gwei
	VeryHigh *big.Int // 500 gwei
}{
	High:     new(big.Int).Mul(big.NewInt(100), big.NewInt(1e9)),
	VeryHigh: new(big.Int).Mul(big.NewInt(500), big.NewInt(1e9)),
}

// ============================================================================
// Transaction Risk Analyzer
// ============================================================================

// TransactionRiskAnalyzer provides transaction risk analysis.
type TransactionRiskAnalyzer struct{}

// NewTransactionRiskAnalyzer creates a new TransactionRiskAnalyzer.
func NewTransactionRiskAnalyzer() *TransactionRiskAnalyzer {
	return &TransactionRiskAnalyzer{}
}

// AnalyzeTransaction analyzes a transaction for risks.
func (a *TransactionRiskAnalyzer) AnalyzeTransaction(params *TransactionRiskParams) *TransactionRiskResult {
	warnings := []string{}
	riskTypes := []RiskType{}
	maxRiskLevel := RiskLevelSafe

	// Helper to upgrade risk level
	upgradeRisk := func(level RiskLevel) {
		levels := []RiskLevel{RiskLevelSafe, RiskLevelLow, RiskLevelMedium, RiskLevelHigh, RiskLevelCritical}
		currentIdx := indexOf(levels, maxRiskLevel)
		newIdx := indexOf(levels, level)
		if newIdx > currentIdx {
			maxRiskLevel = level
		}
	}

	// 1. Check for null/zero address recipient
	if params.To == nil || *params.To == zeroAddress {
		riskTypes = append(riskTypes, RiskTypeZeroAddress)
		if params.To == nil {
			warnings = append(warnings, "Contract deployment transaction")
			upgradeRisk(RiskLevelMedium)
		} else {
			warnings = append(warnings, "Sending to zero address - funds will be lost!")
			upgradeRisk(RiskLevelCritical)
		}
	}

	// 2. Check for self-transfer
	if params.To != nil && params.From == *params.To {
		riskTypes = append(riskTypes, RiskTypeSelfTransfer)
		warnings = append(warnings, "Sending to your own address")
		upgradeRisk(RiskLevelLow)
	}

	// 3. Check transaction value
	if params.Value != nil && params.Value.Sign() > 0 {
		if params.Value.Cmp(valueThresholds.Critical) >= 0 {
			riskTypes = append(riskTypes, RiskTypeHighValue)
			warnings = append(warnings, "Very high value transaction (≥100 ETH equivalent)")
			upgradeRisk(RiskLevelCritical)
		} else if params.Value.Cmp(valueThresholds.High) >= 0 {
			riskTypes = append(riskTypes, RiskTypeHighValue)
			warnings = append(warnings, "High value transaction (≥10 ETH equivalent)")
			upgradeRisk(RiskLevelHigh)
		} else if params.Value.Cmp(valueThresholds.Medium) >= 0 {
			riskTypes = append(riskTypes, RiskTypeHighValue)
			warnings = append(warnings, "Moderate value transaction (≥1 ETH equivalent)")
			upgradeRisk(RiskLevelMedium)
		}
	}

	// 4. Check gas price
	effectiveGasPrice := params.MaxFeePerGas
	if effectiveGasPrice == nil {
		effectiveGasPrice = params.GasPrice
	}
	if effectiveGasPrice != nil {
		if effectiveGasPrice.Cmp(gasPriceThresholds.VeryHigh) >= 0 {
			riskTypes = append(riskTypes, RiskTypeHighGasPrice)
			warnings = append(warnings, "Extremely high gas price (≥500 gwei)")
			upgradeRisk(RiskLevelHigh)
		} else if effectiveGasPrice.Cmp(gasPriceThresholds.High) >= 0 {
			riskTypes = append(riskTypes, RiskTypeHighGasPrice)
			warnings = append(warnings, "High gas price (≥100 gwei)")
			upgradeRisk(RiskLevelMedium)
		}
	}

	// 5. Analyze contract interaction data
	if len(params.Data) > 2 {
		dataAnalysis := a.analyzeData(params.Data)
		riskTypes = append(riskTypes, dataAnalysis.riskTypes...)
		warnings = append(warnings, dataAnalysis.warnings...)
		upgradeRisk(dataAnalysis.riskLevel)
	} else if params.Value != nil && params.Value.Sign() == 0 && params.To != nil {
		// No data and no value - suspicious
		riskTypes = append(riskTypes, RiskTypeSuspiciousData)
		warnings = append(warnings, "Transaction has no value and no data")
		upgradeRisk(RiskLevelLow)
	}

	return &TransactionRiskResult{
		RiskLevel:     maxRiskLevel,
		RiskScore:     RiskScores[maxRiskLevel],
		RiskTypes:     riskTypes,
		Warnings:      warnings,
		Summary:       a.generateSummary(maxRiskLevel, riskTypes),
		DecodedMethod: a.decodeMethod(params.Data),
	}
}

// analyzeData analyzes transaction data for contract interaction risks.
func (a *TransactionRiskAnalyzer) analyzeData(data types.Hex) struct {
	riskLevel RiskLevel
	riskTypes []RiskType
	warnings  []string
} {
	warnings := []string{}
	riskTypes := []RiskType{}
	riskLevel := RiskLevelLow

	// Get function selector (first 4 bytes)
	selector := ""
	if len(data) >= 4 {
		selector = strings.ToLower("0x" + data[:4].String()[2:10])
	}

	// Mark as contract interaction
	riskTypes = append(riskTypes, RiskTypeContractInteraction)
	warnings = append(warnings, "Transaction interacts with a smart contract")

	// Check for ERC-20 approve
	if selector == erc20Selectors["approve"] {
		riskTypes = append(riskTypes, RiskTypeTokenApproval)
		warnings = append(warnings, "Token approval requested")
		riskLevel = RiskLevelMedium

		// Check for unlimited approval
		if a.isUnlimitedApproval(data) {
			riskTypes = append(riskTypes, RiskTypeUnlimitedApproval)
			warnings = append(warnings, "UNLIMITED token approval - spender can take all tokens!")
			riskLevel = RiskLevelHigh
		}
	}

	// Check for ERC-20 transfer
	if selector == erc20Selectors["transfer"] || selector == erc20Selectors["transferFrom"] {
		riskTypes = append(riskTypes, RiskTypeTokenTransfer)
		warnings = append(warnings, "Token transfer requested")
		riskLevel = RiskLevelMedium
	}

	// Check for NFT setApprovalForAll
	if selector == nftSelectors["setApprovalForAll"] {
		riskTypes = append(riskTypes, RiskTypeNFTApprovalAll)
		warnings = append(warnings, "NFT approval for ALL tokens in collection!")
		riskLevel = RiskLevelHigh

		// Check if enabling (true) or disabling (false)
		if a.isApprovalEnabled(data) {
			warnings = append(warnings, "This grants full access to all your NFTs in this collection")
			riskLevel = RiskLevelCritical
		}
	}

	// Check for NFT transfers
	if selector == nftSelectors["safeTransferFrom721"] ||
		selector == nftSelectors["safeTransferFrom721Data"] ||
		selector == nftSelectors["safeTransferFrom1155"] ||
		selector == nftSelectors["safeBatchTransferFrom1155"] {
		riskTypes = append(riskTypes, RiskTypeTokenTransfer)
		warnings = append(warnings, "NFT transfer requested")
		riskLevel = RiskLevelMedium
	}

	// Check for dangerous selectors
	if selector == dangerousSelectors["multicall"] {
		warnings = append(warnings, "Multicall transaction - multiple actions in one")
		riskLevel = RiskLevelHigh
	}

	if selector == dangerousSelectors["execute"] {
		warnings = append(warnings, "Execute function - may perform arbitrary actions")
		riskLevel = RiskLevelHigh
	}

	return struct {
		riskLevel RiskLevel
		riskTypes []RiskType
		warnings  []string
	}{riskLevel, riskTypes, warnings}
}

// isUnlimitedApproval checks if approval amount is unlimited (max uint256).
func (a *TransactionRiskAnalyzer) isUnlimitedApproval(data types.Hex) bool {
	// approve(address,uint256) - amount is last 32 bytes
	// selector (4 bytes) + address (32 bytes) + amount (32 bytes) = 68 bytes
	if len(data) < 68 {
		return false
	}

	amountHex := "0x" + data.String()[74:138]
	return strings.ToLower(amountHex) == strings.ToLower(maxUint256)
}

// isApprovalEnabled checks if setApprovalForAll is enabling (true) approval.
func (a *TransactionRiskAnalyzer) isApprovalEnabled(data types.Hex) bool {
	// setApprovalForAll(address,bool) - bool is last 32 bytes
	if len(data) < 68 {
		return true // Assume true if can't parse
	}

	boolHex := data.String()[138:202]
	// Last byte indicates true/false
	return strings.HasSuffix(boolHex, "1")
}

// decodeMethod decodes method selector to human-readable name.
func (a *TransactionRiskAnalyzer) decodeMethod(data types.Hex) *DecodedMethod {
	if len(data) < 4 {
		return nil
	}

	selector := strings.ToLower("0x" + data.String()[2:10])

	knownMethods := map[string]string{
		erc20Selectors["transfer"]:             "transfer",
		erc20Selectors["approve"]:              "approve",
		erc20Selectors["transferFrom"]:         "transferFrom",
		erc20Selectors["increaseAllowance"]:    "increaseAllowance",
		erc20Selectors["decreaseAllowance"]:    "decreaseAllowance",
		nftSelectors["setApprovalForAll"]:      "setApprovalForAll",
		nftSelectors["safeTransferFrom721"]:    "safeTransferFrom",
		nftSelectors["safeTransferFrom721Data"]: "safeTransferFrom",
		nftSelectors["safeTransferFrom1155"]:   "safeTransferFrom",
		nftSelectors["safeBatchTransferFrom1155"]: "safeBatchTransferFrom",
		dangerousSelectors["multicall"]:        "multicall",
		dangerousSelectors["execute"]:          "execute",
	}

	name := "unknown"
	if n, ok := knownMethods[selector]; ok {
		name = n
	}

	return &DecodedMethod{
		Selector: selector,
		Name:     name,
	}
}

// generateSummary generates a human-readable summary.
func (a *TransactionRiskAnalyzer) generateSummary(riskLevel RiskLevel, riskTypes []RiskType) string {
	riskText := map[RiskLevel]string{
		RiskLevelSafe:     "Safe",
		RiskLevelLow:      "Low risk",
		RiskLevelMedium:   "Medium risk",
		RiskLevelHigh:     "High risk",
		RiskLevelCritical: "CRITICAL RISK",
	}

	if len(riskTypes) == 0 {
		return riskText[riskLevel] + ": Simple value transfer"
	}

	typeDescriptions := map[RiskType]string{
		RiskTypeHighValue:          "high value",
		RiskTypeTokenApproval:      "token approval",
		RiskTypeUnlimitedApproval:  "unlimited approval",
		RiskTypeNFTApprovalAll:     "NFT collection approval",
		RiskTypeTokenTransfer:      "token transfer",
		RiskTypeContractInteraction: "contract interaction",
		RiskTypeZeroAddress:        "zero address",
		RiskTypeSelfTransfer:       "self transfer",
		RiskTypeHighGasPrice:       "high gas",
		RiskTypeSuspiciousData:     "suspicious",
		RiskTypeUnknownContract:    "unknown contract",
		RiskTypeEmptyDataWithValue: "unusual",
		RiskTypePossiblePhishing:   "possible phishing",
	}

	descriptions := []string{}
	for _, t := range riskTypes {
		if desc, ok := typeDescriptions[t]; ok {
			descriptions = append(descriptions, desc)
			if len(descriptions) >= 3 {
				break
			}
		}
	}

	return riskText[riskLevel] + ": " + strings.Join(descriptions, ", ")
}

// indexOf returns the index of an element in a slice.
func indexOf[T comparable](slice []T, item T) int {
	for i, v := range slice {
		if v == item {
			return i
		}
	}
	return -1
}
