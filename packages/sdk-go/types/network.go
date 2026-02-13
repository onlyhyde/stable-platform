package types

// ChainID represents a blockchain network identifier.
type ChainID uint64

// Supported chain IDs
const (
	ChainIDEthereum      ChainID = 1
	ChainIDGoerli        ChainID = 5
	ChainIDSepolia       ChainID = 11155111
	ChainIDPolygon       ChainID = 137
	ChainIDPolygonMumbai ChainID = 80001
	ChainIDPolygonAmoy   ChainID = 80002
	ChainIDArbitrum      ChainID = 42161
	ChainIDArbitrumGoerli ChainID = 421613
	ChainIDOptimism      ChainID = 10
	ChainIDOptimismGoerli ChainID = 420
	ChainIDBase          ChainID = 8453
	ChainIDBaseGoerli    ChainID = 84531
	ChainIDBSC           ChainID = 56
	ChainIDBSCTestnet    ChainID = 97
	ChainIDAvalanche     ChainID = 43114
	ChainIDAvalancheFuji ChainID = 43113
	ChainIDLocal         ChainID = 31337
	ChainIDAnvil         ChainID = 31337
	ChainIDStableNet     ChainID = 8283
)

// String returns the string representation of the chain ID.
func (c ChainID) String() string {
	switch c {
	case ChainIDEthereum:
		return "ethereum"
	case ChainIDGoerli:
		return "goerli"
	case ChainIDSepolia:
		return "sepolia"
	case ChainIDPolygon:
		return "polygon"
	case ChainIDPolygonMumbai:
		return "polygon-mumbai"
	case ChainIDPolygonAmoy:
		return "polygon-amoy"
	case ChainIDArbitrum:
		return "arbitrum"
	case ChainIDArbitrumGoerli:
		return "arbitrum-goerli"
	case ChainIDOptimism:
		return "optimism"
	case ChainIDOptimismGoerli:
		return "optimism-goerli"
	case ChainIDBase:
		return "base"
	case ChainIDBaseGoerli:
		return "base-goerli"
	case ChainIDBSC:
		return "bsc"
	case ChainIDBSCTestnet:
		return "bsc-testnet"
	case ChainIDAvalanche:
		return "avalanche"
	case ChainIDAvalancheFuji:
		return "avalanche-fuji"
	case ChainIDLocal:
		return "localhost"
	case ChainIDStableNet:
		return "stablenet"
	default:
		return "unknown"
	}
}

// IsTestnet returns true if this is a testnet chain.
func (c ChainID) IsTestnet() bool {
	switch c {
	case ChainIDGoerli, ChainIDSepolia, ChainIDPolygonMumbai, ChainIDPolygonAmoy,
		ChainIDArbitrumGoerli, ChainIDOptimismGoerli, ChainIDBaseGoerli,
		ChainIDBSCTestnet, ChainIDAvalancheFuji, ChainIDLocal, ChainIDStableNet:
		return true
	default:
		return false
	}
}

// NetworkCurrency represents the native currency of a network.
type NetworkCurrency struct {
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals uint8  `json:"decimals"`
}

// Network represents a blockchain network configuration.
type Network struct {
	ChainID        ChainID         `json:"chainId"`
	Name           string          `json:"name"`
	NativeCurrency NetworkCurrency `json:"nativeCurrency"`
	RpcUrls        []string        `json:"rpcUrls"`
	BlockExplorers []string        `json:"blockExplorers,omitempty"`
	IsTestnet      bool            `json:"testnet"`
}

// NetworkState represents the current state of a network connection.
type NetworkState struct {
	ChainID     ChainID `json:"chainId"`
	BlockNumber uint64  `json:"blockNumber"`
	IsConnected bool    `json:"isConnected"`
	IsSyncing   bool    `json:"isSyncing"`
	GasPrice    *BigInt `json:"gasPrice,omitempty"`
}

// DefaultCurrencies maps chain IDs to their native currencies.
var DefaultCurrencies = map[ChainID]NetworkCurrency{
	ChainIDEthereum:       {Name: "Ether", Symbol: "ETH", Decimals: 18},
	ChainIDGoerli:         {Name: "Goerli Ether", Symbol: "ETH", Decimals: 18},
	ChainIDSepolia:        {Name: "Sepolia Ether", Symbol: "ETH", Decimals: 18},
	ChainIDPolygon:        {Name: "MATIC", Symbol: "MATIC", Decimals: 18},
	ChainIDPolygonMumbai:  {Name: "Mumbai MATIC", Symbol: "MATIC", Decimals: 18},
	ChainIDPolygonAmoy:    {Name: "Amoy MATIC", Symbol: "MATIC", Decimals: 18},
	ChainIDArbitrum:       {Name: "Arbitrum Ether", Symbol: "ETH", Decimals: 18},
	ChainIDArbitrumGoerli: {Name: "Arbitrum Goerli Ether", Symbol: "ETH", Decimals: 18},
	ChainIDOptimism:       {Name: "Optimism Ether", Symbol: "ETH", Decimals: 18},
	ChainIDOptimismGoerli: {Name: "Optimism Goerli Ether", Symbol: "ETH", Decimals: 18},
	ChainIDBase:           {Name: "Base Ether", Symbol: "ETH", Decimals: 18},
	ChainIDBaseGoerli:     {Name: "Base Goerli Ether", Symbol: "ETH", Decimals: 18},
	ChainIDBSC:            {Name: "BNB", Symbol: "BNB", Decimals: 18},
	ChainIDBSCTestnet:     {Name: "Testnet BNB", Symbol: "tBNB", Decimals: 18},
	ChainIDAvalanche:      {Name: "Avalanche", Symbol: "AVAX", Decimals: 18},
	ChainIDAvalancheFuji:  {Name: "Fuji AVAX", Symbol: "AVAX", Decimals: 18},
	ChainIDLocal:          {Name: "Local Ether", Symbol: "ETH", Decimals: 18},
	ChainIDStableNet:      {Name: "WKRC", Symbol: "WKRC", Decimals: 18},
}

// GetDefaultCurrency returns the default native currency for a chain.
func GetDefaultCurrency(chainID ChainID) (NetworkCurrency, bool) {
	currency, ok := DefaultCurrencies[chainID]
	return currency, ok
}
