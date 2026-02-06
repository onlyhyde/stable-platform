package actions

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	gethTypes "github.com/ethereum/go-ethereum/core/types"

	"github.com/stablenet/sdk-go/plugins/stealth"
	"github.com/stablenet/sdk-go/plugins/stealth/client"
	"github.com/stablenet/sdk-go/plugins/stealth/constants"
	"github.com/stablenet/sdk-go/types"
)

// FetchAnnouncementsResult contains the result of fetching announcements.
type FetchAnnouncementsResult struct {
	// Announcements is the list of announcements found.
	Announcements []*stealth.StealthAnnouncement
	// FromBlock is the starting block number.
	FromBlock *big.Int
	// ToBlock is the ending block number.
	ToBlock *big.Int
}

// FetchAnnouncements fetches stealth announcements from the chain.
//
// This action retrieves all announcements matching the filter criteria
// from the EIP-5564 Announcer contract.
//
// Example:
//
//	result, err := FetchAnnouncements(ctx, client, AnnouncementFilterOptions{
//	    FromBlock: big.NewInt(1000000),
//	    ToBlock:   nil, // latest
//	    SchemeID:  &schemeID,
//	})
func FetchAnnouncements(ctx context.Context, c *client.Client, options stealth.AnnouncementFilterOptions) (*FetchAnnouncementsResult, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}

	// Build the filter query
	announcerAddr := common.Address(c.AnnouncerAddress)

	// Announcement event topics
	// Topic 0: event signature
	// Topic 1: schemeId (indexed)
	// Topic 2: stealthAddress (indexed)
	// Topic 3: caller (indexed)
	topics := [][]common.Hash{
		{common.HexToHash(constants.AnnouncementEventSig)},
	}

	// Add schemeId filter if provided
	if options.SchemeID != nil {
		schemeIdHash := common.BigToHash(big.NewInt(int64(*options.SchemeID)))
		topics = append(topics, []common.Hash{schemeIdHash})
	} else {
		topics = append(topics, nil) // Match any schemeId
	}

	// Add stealth address filter (none by default)
	topics = append(topics, nil)

	// Add caller filter if provided
	if options.Caller != nil {
		callerHash := common.BytesToHash(options.Caller[:])
		topics = append(topics, []common.Hash{callerHash})
	}

	// Determine block range
	fromBlock := options.FromBlock
	if fromBlock == nil {
		fromBlock = big.NewInt(0)
	}

	toBlock := options.ToBlock
	// nil means "latest" in go-ethereum

	query := ethereum.FilterQuery{
		FromBlock: fromBlock,
		ToBlock:   toBlock,
		Addresses: []common.Address{announcerAddr},
		Topics:    topics,
	}

	// Fetch logs
	logs, err := c.EthClient.FilterLogs(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to filter logs: %w", err)
	}

	// Parse announcements
	announcements := make([]*stealth.StealthAnnouncement, 0, len(logs))
	for _, log := range logs {
		announcement, err := parseAnnouncementLog(&log)
		if err != nil {
			continue // Skip malformed logs
		}
		announcements = append(announcements, announcement)
	}

	// Determine actual toBlock if it was nil
	actualToBlock := toBlock
	if actualToBlock == nil && len(logs) > 0 {
		actualToBlock = big.NewInt(int64(logs[len(logs)-1].BlockNumber))
	}

	return &FetchAnnouncementsResult{
		Announcements: announcements,
		FromBlock:     fromBlock,
		ToBlock:       actualToBlock,
	}, nil
}

// FetchAnnouncementsForRecipient fetches and filters announcements for a specific recipient.
// It uses the view tag to efficiently filter announcements.
func FetchAnnouncementsForRecipient(
	ctx context.Context,
	c *client.Client,
	options stealth.AnnouncementFilterOptions,
	viewingPrivateKey types.Hex,
	spendingPrivateKey types.Hex,
) ([]*stealth.ComputedStealthKey, error) {
	// Fetch all announcements
	result, err := FetchAnnouncements(ctx, c, options)
	if err != nil {
		return nil, err
	}

	// Filter and compute keys for matching announcements
	var keys []*stealth.ComputedStealthKey
	for _, announcement := range result.Announcements {
		key := ComputeStealthKey(stealth.ComputeStealthKeyParams{
			Announcement:       announcement,
			SpendingPrivateKey: spendingPrivateKey,
			ViewingPrivateKey:  viewingPrivateKey,
		})
		if key != nil {
			keys = append(keys, key)
		}
	}

	return keys, nil
}

// parseAnnouncementLog parses an Announcement event log.
func parseAnnouncementLog(log *gethTypes.Log) (*stealth.StealthAnnouncement, error) {
	if len(log.Topics) < 4 {
		return nil, fmt.Errorf("insufficient topics")
	}

	// Parse indexed parameters from topics
	schemeId := stealth.SchemeID(new(big.Int).SetBytes(log.Topics[1][:]).Uint64())
	stealthAddress := common.BytesToAddress(log.Topics[2][:])
	caller := common.BytesToAddress(log.Topics[3][:])

	// Parse non-indexed parameters from data
	// Data contains: ephemeralPubKey (bytes) + metadata (bytes)
	unpackedData, err := constants.ERC5564AnnouncerABI.Unpack("Announcement", log.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack announcement data: %w", err)
	}

	if len(unpackedData) < 2 {
		return nil, fmt.Errorf("insufficient unpacked data")
	}

	ephemeralPubKey, ok := unpackedData[0].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid ephemeral public key type")
	}

	metadata, ok := unpackedData[1].([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid metadata type")
	}

	return &stealth.StealthAnnouncement{
		SchemeID:        schemeId,
		StealthAddress:  types.Address(stealthAddress),
		Caller:          types.Address(caller),
		EphemeralPubKey: types.Hex(ephemeralPubKey),
		Metadata:        types.Hex(metadata),
		BlockNumber:     big.NewInt(int64(log.BlockNumber)),
		TxHash:          types.Hash(log.TxHash),
		LogIndex:        log.Index,
	}, nil
}

// GetAnnouncementByTxHash fetches a specific announcement by transaction hash.
func GetAnnouncementByTxHash(ctx context.Context, c *client.Client, txHash types.Hash) (*stealth.StealthAnnouncement, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}

	// Get transaction receipt
	receipt, err := c.EthClient.TransactionReceipt(ctx, common.Hash(txHash))
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction receipt: %w", err)
	}

	// Find the announcement log
	announcerAddr := common.Address(c.AnnouncerAddress)
	for _, log := range receipt.Logs {
		if log.Address != announcerAddr {
			continue
		}
		if len(log.Topics) > 0 && log.Topics[0].Hex() == constants.AnnouncementEventSig {
			return parseAnnouncementLog(log)
		}
	}

	return nil, fmt.Errorf("announcement not found in transaction")
}
