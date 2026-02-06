package actions

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/stablenet/sdk-go/plugins/stealth"
	"github.com/stablenet/sdk-go/plugins/stealth/client"
	"github.com/stablenet/sdk-go/types"
)

const (
	// DefaultPollingInterval is the default polling interval in milliseconds.
	DefaultPollingInterval = 5000 // 5 seconds
	// MinPollingInterval is the minimum polling interval.
	MinPollingInterval = 1000 // 1 second
)

// Watcher watches for stealth announcements.
type Watcher struct {
	client            *client.Client
	options           stealth.WatchAnnouncementsOptions
	onAnnouncement    stealth.AnnouncementCallback
	onError           stealth.ErrorCallback
	spendingPrivKey   types.Hex
	lastProcessedBlock *big.Int
	stopCh            chan struct{}
	stoppedCh         chan struct{}
	mu                sync.Mutex
	running           bool
}

// NewWatcher creates a new announcement watcher.
func NewWatcher(
	c *client.Client,
	options stealth.WatchAnnouncementsOptions,
	spendingPrivateKey types.Hex,
	onAnnouncement stealth.AnnouncementCallback,
	onError stealth.ErrorCallback,
) (*Watcher, error) {
	if c == nil {
		return nil, fmt.Errorf("client is required")
	}
	if len(options.ViewingPrivateKey) == 0 {
		return nil, fmt.Errorf("viewing private key is required")
	}
	if len(spendingPrivateKey) == 0 {
		return nil, fmt.Errorf("spending private key is required")
	}
	if onAnnouncement == nil {
		return nil, fmt.Errorf("announcement callback is required")
	}

	pollingInterval := options.PollingIntervalMs
	if pollingInterval == 0 {
		pollingInterval = DefaultPollingInterval
	}
	if pollingInterval < MinPollingInterval {
		pollingInterval = MinPollingInterval
	}
	options.PollingIntervalMs = pollingInterval

	return &Watcher{
		client:          c,
		options:         options,
		onAnnouncement:  onAnnouncement,
		onError:         onError,
		spendingPrivKey: spendingPrivateKey,
		stopCh:          make(chan struct{}),
		stoppedCh:       make(chan struct{}),
	}, nil
}

// Start starts watching for announcements.
func (w *Watcher) Start(ctx context.Context) error {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return fmt.Errorf("watcher already running")
	}
	w.running = true
	w.mu.Unlock()

	// Determine starting block
	startBlock := w.options.FromBlock
	if startBlock == nil {
		blockNum, err := w.client.GetBlockNumber(ctx)
		if err != nil {
			w.mu.Lock()
			w.running = false
			w.mu.Unlock()
			return fmt.Errorf("failed to get current block: %w", err)
		}
		startBlock = big.NewInt(int64(blockNum))
	}
	w.lastProcessedBlock = new(big.Int).Sub(startBlock, big.NewInt(1))

	go w.pollLoop(ctx)

	return nil
}

// Stop stops watching for announcements.
func (w *Watcher) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.mu.Unlock()

	close(w.stopCh)
	<-w.stoppedCh

	w.mu.Lock()
	w.running = false
	w.mu.Unlock()
}

// IsRunning returns true if the watcher is running.
func (w *Watcher) IsRunning() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.running
}

// pollLoop is the main polling loop.
func (w *Watcher) pollLoop(ctx context.Context) {
	defer close(w.stoppedCh)

	ticker := time.NewTicker(time.Duration(w.options.PollingIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	// Process initial block range
	w.processBlocks(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.processBlocks(ctx)
		}
	}
}

// processBlocks processes new blocks for announcements.
func (w *Watcher) processBlocks(ctx context.Context) {
	// Get current block
	currentBlock, err := w.client.GetBlockNumber(ctx)
	if err != nil {
		if w.onError != nil {
			w.onError(fmt.Errorf("failed to get current block: %w", err))
		}
		return
	}

	fromBlock := new(big.Int).Add(w.lastProcessedBlock, big.NewInt(1))
	toBlock := big.NewInt(int64(currentBlock))

	// Skip if no new blocks
	if fromBlock.Cmp(toBlock) > 0 {
		return
	}

	// Fetch announcements
	filterOpts := stealth.AnnouncementFilterOptions{
		FromBlock: fromBlock,
		ToBlock:   toBlock,
		SchemeID:  w.options.SchemeID,
	}

	result, err := FetchAnnouncements(ctx, w.client, filterOpts)
	if err != nil {
		if w.onError != nil {
			w.onError(fmt.Errorf("failed to fetch announcements: %w", err))
		}
		return
	}

	// Process each announcement
	for _, announcement := range result.Announcements {
		key := ComputeStealthKey(stealth.ComputeStealthKeyParams{
			Announcement:       announcement,
			SpendingPrivateKey: w.spendingPrivKey,
			ViewingPrivateKey:  w.options.ViewingPrivateKey,
		})

		if key != nil {
			if err := w.onAnnouncement(announcement, key); err != nil {
				if w.onError != nil {
					w.onError(fmt.Errorf("announcement callback error: %w", err))
				}
			}
		}
	}

	// Update last processed block
	w.lastProcessedBlock = toBlock
}

// WatchAnnouncements is a convenience function to start watching announcements.
// It returns a stop function that can be called to stop watching.
func WatchAnnouncements(
	ctx context.Context,
	c *client.Client,
	options stealth.WatchAnnouncementsOptions,
	spendingPrivateKey types.Hex,
	onAnnouncement stealth.AnnouncementCallback,
	onError stealth.ErrorCallback,
) (stopFunc func(), err error) {
	watcher, err := NewWatcher(c, options, spendingPrivateKey, onAnnouncement, onError)
	if err != nil {
		return nil, err
	}

	if err := watcher.Start(ctx); err != nil {
		return nil, err
	}

	return watcher.Stop, nil
}
