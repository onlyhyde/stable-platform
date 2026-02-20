// Package logger provides structured logging for the bank-simulator service.
package logger

import (
	"log/slog"

	sharedlogger "github.com/stable-net/shared/logger"
)

// Config is the logger configuration
type Config = sharedlogger.Config

// Logger wraps shared Logger with bank-simulator specific methods
type Logger struct {
	*sharedlogger.Logger
}

// Re-export shared global functions
var (
	Init    = sharedlogger.Init
	Default = sharedlogger.Default
	Debug   = sharedlogger.Debug
	Info    = sharedlogger.Info
	Warn    = sharedlogger.Warn
	Error   = sharedlogger.Error
)

// DefaultConfig returns bank-simulator specific default configuration
func DefaultConfig() Config {
	return sharedlogger.DefaultConfigWithName("bank-simulator")
}

// New creates a new logger (compatible with existing call sites)
func New(cfg Config) *Logger {
	return &Logger{Logger: sharedlogger.New(cfg)}
}

// NewDefault creates a logger with default configuration
func NewDefault() *Logger {
	return New(DefaultConfig())
}

// With creates a child logger with additional attributes
func (l *Logger) With(args ...any) *Logger {
	return &Logger{Logger: l.Logger.With(args...)}
}

// WithAccount adds account context for bank operations (masked for security)
func (l *Logger) WithAccount(accountNo string) *Logger {
	masked := maskAccountNo(accountNo)
	return &Logger{Logger: l.Logger.With(slog.String("accountNo", masked))}
}

// WithTransfer adds transfer context
func (l *Logger) WithTransfer(transferID string) *Logger {
	return &Logger{Logger: l.Logger.With(slog.String("transferID", transferID))}
}

func maskAccountNo(accountNo string) string {
	if len(accountNo) <= 8 {
		return "****"
	}
	return accountNo[:4] + "****" + accountNo[len(accountNo)-4:]
}
