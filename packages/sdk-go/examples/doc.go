// Package examples provides usage examples for the StableNet Go SDK.
//
// This package contains runnable examples demonstrating:
//   - Smart account creation and management
//   - Sending UserOperations
//   - Module installation (ERC-7579)
//   - Paymaster integration for gas sponsorship
//   - Security features
//
// Example: Creating a Smart Account
//
//	// Connect to the network
//	client, _ := ethclient.Dial("https://sepolia.base.org")
//
//	// Create an ECDSA validator
//	validator := kernel.NewECDSAValidator(ownerPrivateKey)
//
//	// Create the Kernel smart account
//	account, _ := kernel.NewAccount(ctx, kernel.AccountConfig{
//		Client:    client,
//		Validator: validator,
//	})
//
//	fmt.Printf("Account: %s\n", account.Address().Hex())
//
// Example: Sending a Transaction with Gas Sponsorship
//
//	// Create a smart account client
//	saClient, _ := clients.NewSmartAccountClient(clients.SmartAccountClientConfig{
//		Account:      account,
//		ChainId:      84532, // Base Sepolia
//		BundlerUrl:   "https://bundler.example.com",
//		PaymasterUrl: "https://paymaster.example.com",
//	})
//
//	// Configure sponsored gas payment
//	gasPayment := &paymaster.GasPaymentConfig{
//		Type: paymaster.GasPaymentSponsor,
//	}
//
//	// Send the transaction
//	hash, _ := saClient.SendUserOperation(ctx, clients.SendUserOperationArgs{
//		Calls: []clients.Call{
//			{To: recipient, Value: big.NewInt(1e15)},
//		},
//		GasPayment: gasPayment,
//	})
//
// Example: Installing a Module
//
//	// Create module operation client
//	opClient, _ := client.NewOperationClient()
//
//	// Encode module installation
//	calldata, _ := opClient.EncodeInstallModule(types.ModuleInstallRequest{
//		Type:     types.ModuleTypeValidator,
//		Address:  validatorModuleAddress,
//		InitData: initData,
//	})
//
//	// Execute via UserOperation
//	saClient.SendUserOperation(ctx, clients.SendUserOperationArgs{
//		Calls: []clients.Call{{To: account.Address(), Data: calldata}},
//	})
//
// Example: Detecting Account Type
//
//	detector := accounts.NewAccountDetector(client)
//	state, _ := detector.GetAccountState(ctx, address)
//
//	fmt.Printf("Type: %s\n", state.Type)
//	fmt.Printf("Deployed: %v\n", state.IsDeployed)
//	fmt.Printf("Capabilities: %v\n", state.Capabilities.All())
//
// Example: Gas Estimation
//
//	estimator := gas.NewEstimator(gas.EstimatorConfig{
//		RpcUrl:   "https://sepolia.base.org",
//		ChainId:  84532,
//	})
//
//	estimate, _ := estimator.Estimate(ctx, &types.MultiModeTransactionRequest{
//		Mode: types.TransactionModeSmartAccount,
//		To:   recipient,
//		Data: calldata,
//	})
//
//	fmt.Printf("Gas Limit: %s\n", estimate.GasLimit.String())
//	fmt.Printf("Estimated Cost: %s wei\n", estimate.EstimatedCost.String())
//
// Example: Security Validation
//
//	validator := security.NewInputValidator()
//
//	// Validate an address
//	result := validator.ValidateAddress("0x1234...")
//	if !result.IsValid {
//		fmt.Printf("Errors: %v\n", result.Errors)
//	}
//
//	// Analyze transaction risk
//	analyzer := security.NewTransactionRiskAnalyzer()
//	risk := analyzer.AnalyzeTransaction(&security.TransactionRiskParams{
//		To:    recipient,
//		Value: value,
//		Data:  calldata,
//	})
//
//	fmt.Printf("Risk Level: %s\n", risk.Level)
//
// Example: Phishing Detection
//
//	detector := security.NewPhishingDetector()
//	result := detector.CheckURL("https://suspicious-site.xyz/claim")
//
//	if result.IsSuspicious {
//		fmt.Printf("Warning: %v\n", result.Reasons)
//	}
//
// Example: Rate Limiting
//
//	limiter := security.NewRateLimiter()
//
//	result := limiter.Check("eth_sendTransaction")
//	if !result.Allowed {
//		fmt.Printf("Rate limited. Retry after: %v\n", result.RetryAfter)
//	}
//
// For more detailed examples, see the individual example files in this package.
package examples
