package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stablenet/stable-platform/services/subscription-executor/internal/model"
)

// PostgresRepository implements SubscriptionRepository using PostgreSQL
type PostgresRepository struct {
	pool *pgxpool.Pool
}

// PostgresConfig holds database configuration
type PostgresConfig struct {
	DatabaseURL         string
	MaxConns            int32
	MinConns            int32
	MaxConnLifetime     time.Duration
	MaxConnIdleTime     time.Duration
	HealthCheckPeriod   time.Duration
	ConnectTimeout      time.Duration
	StatementTimeout    time.Duration
}

// DefaultPostgresConfig returns sensible defaults for PostgreSQL connection
func DefaultPostgresConfig(databaseURL string) *PostgresConfig {
	return &PostgresConfig{
		DatabaseURL:         databaseURL,
		MaxConns:            10,
		MinConns:            2,
		MaxConnLifetime:     30 * time.Minute,
		MaxConnIdleTime:     10 * time.Minute,
		HealthCheckPeriod:   1 * time.Minute,
		ConnectTimeout:      30 * time.Second,
		StatementTimeout:    30 * time.Second,
	}
}

// NewPostgresRepository creates a new PostgreSQL repository with connection pooling
//
// Best Practices Applied:
// - Connection pooling with pgxpool
// - Configurable connection limits and timeouts
// - Statement timeout to prevent runaway queries
// - Health check for connection monitoring
func NewPostgresRepository(ctx context.Context, cfg *PostgresConfig) (*PostgresRepository, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Connection pool settings
	poolConfig.MaxConns = cfg.MaxConns
	poolConfig.MinConns = cfg.MinConns
	poolConfig.MaxConnLifetime = cfg.MaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.MaxConnIdleTime
	poolConfig.HealthCheckPeriod = cfg.HealthCheckPeriod

	// Connection timeout
	poolConfig.ConnConfig.ConnectTimeout = cfg.ConnectTimeout

	// Set statement timeout on each connection
	// This prevents runaway queries from holding connections
	statementTimeout := cfg.StatementTimeout
	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, fmt.Sprintf("SET statement_timeout = '%dms'", statementTimeout.Milliseconds()))
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Connected to PostgreSQL with pool (max=%d, min=%d)", cfg.MaxConns, cfg.MinConns)
	return &PostgresRepository{pool: pool}, nil
}

// Close closes the connection pool
func (r *PostgresRepository) Close() {
	r.pool.Close()
}

// Ping checks database connectivity
func (r *PostgresRepository) Ping(ctx context.Context) error {
	return r.pool.Ping(ctx)
}

// Create inserts a new subscription
//
// Best Practice: Uses UPSERT pattern to handle potential duplicates gracefully
func (r *PostgresRepository) Create(ctx context.Context, sub *model.Subscription) error {
	query := `
		INSERT INTO subscriptions (
			id, smart_account, recipient, token, amount, interval_seconds,
			next_execution, last_execution, execution_count, max_executions,
			status, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (id) DO NOTHING
	`

	_, err := r.pool.Exec(ctx, query,
		sub.ID,
		sub.SmartAccount,
		sub.Recipient,
		sub.Token,
		sub.Amount.String(),
		sub.Interval,
		sub.NextExecution,
		sub.LastExecution,
		sub.ExecutionCount,
		sub.MaxExecutions,
		string(sub.Status),
		sub.CreatedAt,
		sub.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create subscription: %w", err)
	}
	return nil
}

// GetByID retrieves a subscription by ID
func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*model.Subscription, error) {
	query := `
		SELECT id, smart_account, recipient, token, amount, interval_seconds,
			   next_execution, last_execution, execution_count, max_executions,
			   status, created_at, updated_at
		FROM subscriptions
		WHERE id = $1
	`

	row := r.pool.QueryRow(ctx, query, id)
	sub, err := scanSubscription(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	return sub, nil
}

// GetByAccount retrieves all subscriptions for an account
//
// Best Practice: Uses index on smart_account column
func (r *PostgresRepository) GetByAccount(ctx context.Context, account string) ([]*model.Subscription, error) {
	query := `
		SELECT id, smart_account, recipient, token, amount, interval_seconds,
			   next_execution, last_execution, execution_count, max_executions,
			   status, created_at, updated_at
		FROM subscriptions
		WHERE smart_account = $1
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, account)
	if err != nil {
		return nil, fmt.Errorf("failed to query subscriptions: %w", err)
	}
	defer rows.Close()

	return scanSubscriptions(rows)
}

// Update updates a subscription
func (r *PostgresRepository) Update(ctx context.Context, sub *model.Subscription) error {
	query := `
		UPDATE subscriptions
		SET smart_account = $2,
			recipient = $3,
			token = $4,
			amount = $5,
			interval_seconds = $6,
			next_execution = $7,
			last_execution = $8,
			execution_count = $9,
			max_executions = $10,
			status = $11
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query,
		sub.ID,
		sub.SmartAccount,
		sub.Recipient,
		sub.Token,
		sub.Amount.String(),
		sub.Interval,
		sub.NextExecution,
		sub.LastExecution,
		sub.ExecutionCount,
		sub.MaxExecutions,
		string(sub.Status),
	)

	if err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found: %s", sub.ID)
	}
	return nil
}

// UpdateStatus updates only the status of a subscription
func (r *PostgresRepository) UpdateStatus(ctx context.Context, id string, status model.SubscriptionStatus) error {
	query := `
		UPDATE subscriptions
		SET status = $2
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, id, string(status))
	if err != nil {
		return fmt.Errorf("failed to update subscription status: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found: %s", id)
	}
	return nil
}

// GetDueSubscriptions retrieves subscriptions that are due for execution
//
// Best Practice: Uses composite partial index (status, next_execution) WHERE status = 'active'
func (r *PostgresRepository) GetDueSubscriptions(ctx context.Context, limit int) ([]*model.Subscription, error) {
	query := `
		SELECT id, smart_account, recipient, token, amount, interval_seconds,
			   next_execution, last_execution, execution_count, max_executions,
			   status, created_at, updated_at
		FROM subscriptions
		WHERE status = 'active'
		  AND next_execution <= NOW()
		  AND (max_executions = 0 OR execution_count < max_executions)
		ORDER BY next_execution ASC
		LIMIT $1
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query due subscriptions: %w", err)
	}
	defer rows.Close()

	return scanSubscriptions(rows)
}

// GetDueSubscriptionsWithLock retrieves and locks due subscriptions for processing
//
// Best Practice: Uses FOR UPDATE SKIP LOCKED for non-blocking queue processing
// This allows multiple workers to process different subscriptions concurrently
// without blocking each other.
func (r *PostgresRepository) GetDueSubscriptionsWithLock(ctx context.Context, limit int) ([]*model.Subscription, error) {
	query := `
		SELECT id, smart_account, recipient, token, amount, interval_seconds,
			   next_execution, last_execution, execution_count, max_executions,
			   status, created_at, updated_at
		FROM subscriptions
		WHERE status = 'active'
		  AND next_execution <= NOW()
		  AND (max_executions = 0 OR execution_count < max_executions)
		ORDER BY next_execution ASC
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query due subscriptions with lock: %w", err)
	}
	defer rows.Close()

	return scanSubscriptions(rows)
}

// CreateExecutionRecord creates a new execution record
func (r *PostgresRepository) CreateExecutionRecord(ctx context.Context, record *model.ExecutionRecord) error {
	query := `
		INSERT INTO execution_records (subscription_id, user_op_hash, tx_hash, status, error, gas_used, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	var gasUsed *string
	if record.GasUsed != nil {
		s := record.GasUsed.String()
		gasUsed = &s
	}

	var id int64
	err := r.pool.QueryRow(ctx, query,
		record.SubscriptionID,
		nullString(record.UserOpHash),
		nullString(record.TxHash),
		record.Status,
		nullString(record.Error),
		gasUsed,
		record.CreatedAt,
	).Scan(&id)

	if err != nil {
		return fmt.Errorf("failed to create execution record: %w", err)
	}

	record.ID = fmt.Sprintf("%d", id)
	return nil
}

// UpdateExecutionRecord updates an execution record
func (r *PostgresRepository) UpdateExecutionRecord(ctx context.Context, id int64, status, txHash, errMsg string, gasUsed string) error {
	query := `
		UPDATE execution_records
		SET status = $2, tx_hash = $3, error = $4, gas_used = $5
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, id, status, nullString(txHash), nullString(errMsg), nullString(gasUsed))
	if err != nil {
		return fmt.Errorf("failed to update execution record: %w", err)
	}
	return nil
}

// GetExecutionRecords retrieves execution records for a subscription
//
// Best Practice: Uses index on (subscription_id, created_at DESC)
func (r *PostgresRepository) GetExecutionRecords(ctx context.Context, subscriptionID string, limit int) ([]*model.ExecutionRecord, error) {
	query := `
		SELECT id, subscription_id, user_op_hash, tx_hash, status, error, gas_used, created_at
		FROM execution_records
		WHERE subscription_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := r.pool.Query(ctx, query, subscriptionID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query execution records: %w", err)
	}
	defer rows.Close()

	var records []*model.ExecutionRecord
	for rows.Next() {
		var (
			id             int64
			subscriptionID string
			userOpHash     *string
			txHash         *string
			status         string
			errMsg         *string
			gasUsed        *string
			createdAt      time.Time
		)

		if err := rows.Scan(&id, &subscriptionID, &userOpHash, &txHash, &status, &errMsg, &gasUsed, &createdAt); err != nil {
			return nil, fmt.Errorf("failed to scan execution record: %w", err)
		}

		record := &model.ExecutionRecord{
			ID:             fmt.Sprintf("%d", id),
			SubscriptionID: subscriptionID,
			UserOpHash:     derefString(userOpHash),
			TxHash:         derefString(txHash),
			Status:         status,
			Error:          derefString(errMsg),
			CreatedAt:      createdAt,
		}

		if gasUsed != nil {
			if g, ok := new(big.Int).SetString(*gasUsed, 10); ok {
				record.GasUsed = g
			}
		}

		records = append(records, record)
	}

	return records, rows.Err()
}

// GetIdempotencyRecord retrieves a cached idempotency record that has not expired
func (r *PostgresRepository) GetIdempotencyRecord(ctx context.Context, key, method, path string) (*model.IdempotencyRecord, error) {
	query := `
		SELECT key, method, path, status_code, response_body, response_headers, created_at, expires_at
		FROM idempotency_keys
		WHERE key = $1 AND method = $2 AND path = $3 AND expires_at > NOW()
	`

	var (
		rec     model.IdempotencyRecord
		headers []byte
	)
	err := r.pool.QueryRow(ctx, query, key, method, path).Scan(
		&rec.Key, &rec.Method, &rec.Path, &rec.StatusCode,
		&rec.ResponseBody, &headers, &rec.CreatedAt, &rec.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get idempotency record: %w", err)
	}

	if headers != nil {
		_ = json.Unmarshal(headers, &rec.ResponseHeaders)
	}

	return &rec, nil
}

// SaveIdempotencyRecord saves a new idempotency record, ignoring conflicts (first-writer-wins)
func (r *PostgresRepository) SaveIdempotencyRecord(ctx context.Context, record *model.IdempotencyRecord) error {
	query := `
		INSERT INTO idempotency_keys (key, method, path, status_code, response_body, response_headers, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (key, method, path) DO NOTHING
	`

	_, err := r.pool.Exec(ctx, query,
		record.Key, record.Method, record.Path, record.StatusCode,
		record.ResponseBody, record.ResponseHeaders,
		record.CreatedAt, record.ExpiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save idempotency record: %w", err)
	}
	return nil
}

// DeleteExpiredIdempotencyRecords removes expired idempotency records
func (r *PostgresRepository) DeleteExpiredIdempotencyRecords(ctx context.Context) (int64, error) {
	result, err := r.pool.Exec(ctx, `DELETE FROM idempotency_keys WHERE expires_at < NOW()`)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired idempotency records: %w", err)
	}
	return result.RowsAffected(), nil
}

// scanSubscription scans a single subscription row
func scanSubscription(row pgx.Row) (*model.Subscription, error) {
	var (
		id             string
		smartAccount   string
		recipient      string
		token          string
		amountStr      string
		interval       int64
		nextExecution  time.Time
		lastExecution  *time.Time
		executionCount int64
		maxExecutions  int64
		status         string
		createdAt      time.Time
		updatedAt      time.Time
	)

	err := row.Scan(
		&id, &smartAccount, &recipient, &token, &amountStr, &interval,
		&nextExecution, &lastExecution, &executionCount, &maxExecutions,
		&status, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	amount, ok := new(big.Int).SetString(amountStr, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", amountStr)
	}

	return &model.Subscription{
		ID:             id,
		SmartAccount:   smartAccount,
		Recipient:      recipient,
		Token:          token,
		Amount:         amount,
		Interval:       interval,
		NextExecution:  nextExecution,
		LastExecution:  lastExecution,
		ExecutionCount: executionCount,
		MaxExecutions:  maxExecutions,
		Status:         model.SubscriptionStatus(status),
		CreatedAt:      createdAt,
		UpdatedAt:      updatedAt,
	}, nil
}

// scanSubscriptions scans multiple subscription rows
func scanSubscriptions(rows pgx.Rows) ([]*model.Subscription, error) {
	var subs []*model.Subscription
	for rows.Next() {
		var (
			id             string
			smartAccount   string
			recipient      string
			token          string
			amountStr      string
			interval       int64
			nextExecution  time.Time
			lastExecution  *time.Time
			executionCount int64
			maxExecutions  int64
			status         string
			createdAt      time.Time
			updatedAt      time.Time
		)

		err := rows.Scan(
			&id, &smartAccount, &recipient, &token, &amountStr, &interval,
			&nextExecution, &lastExecution, &executionCount, &maxExecutions,
			&status, &createdAt, &updatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}

		amount, ok := new(big.Int).SetString(amountStr, 10)
		if !ok {
			return nil, fmt.Errorf("invalid amount: %s", amountStr)
		}

		subs = append(subs, &model.Subscription{
			ID:             id,
			SmartAccount:   smartAccount,
			Recipient:      recipient,
			Token:          token,
			Amount:         amount,
			Interval:       interval,
			NextExecution:  nextExecution,
			LastExecution:  lastExecution,
			ExecutionCount: executionCount,
			MaxExecutions:  maxExecutions,
			Status:         model.SubscriptionStatus(status),
			CreatedAt:      createdAt,
			UpdatedAt:      updatedAt,
		})
	}

	return subs, rows.Err()
}

// nullString returns nil for empty strings
func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// derefString safely dereferences a string pointer
func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
