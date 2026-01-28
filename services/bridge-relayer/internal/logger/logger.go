// Package logger provides structured logging utilities for the bridge-relayer service.
package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

// Level represents log levels
type Level = slog.Level

const (
	LevelDebug = slog.LevelDebug
	LevelInfo  = slog.LevelInfo
	LevelWarn  = slog.LevelWarn
	LevelError = slog.LevelError
)

// Logger wraps slog.Logger with additional context
type Logger struct {
	*slog.Logger
	name string
}

// Config holds logger configuration
type Config struct {
	Level  string
	Format string
	Output io.Writer
	Name   string
}

// DefaultConfig returns the default logger configuration
func DefaultConfig() Config {
	return Config{
		Level:  getEnvOrDefault("LOG_LEVEL", "info"),
		Format: getEnvOrDefault("LOG_FORMAT", "json"),
		Output: os.Stdout,
		Name:   "bridge-relayer",
	}
}

// New creates a new structured logger
func New(cfg Config) *Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}
	if cfg.Name == "" {
		cfg.Name = "bridge-relayer"
	}

	level := parseLevel(cfg.Level)

	var handler slog.Handler
	opts := &slog.HandlerOptions{
		Level:     level,
		AddSource: level == LevelDebug,
	}

	if strings.ToLower(cfg.Format) == "text" {
		handler = slog.NewTextHandler(cfg.Output, opts)
	} else {
		handler = slog.NewJSONHandler(cfg.Output, opts)
	}

	return &Logger{
		Logger: slog.New(handler).With(slog.String("service", cfg.Name)),
		name:   cfg.Name,
	}
}

// NewDefault creates a logger with default configuration
func NewDefault() *Logger {
	return New(DefaultConfig())
}

// With creates a child logger with additional attributes
func (l *Logger) With(args ...any) *Logger {
	return &Logger{
		Logger: l.Logger.With(args...),
		name:   l.name,
	}
}

// WithContext creates a child logger with request context
func (l *Logger) WithContext(ctx context.Context) *Logger {
	if reqID, ok := ctx.Value("requestID").(string); ok {
		return l.With(slog.String("requestID", reqID))
	}
	return l
}

// WithError adds an error to the log context
func (l *Logger) WithError(err error) *Logger {
	if err == nil {
		return l
	}
	return l.With(slog.String("error", err.Error()))
}

// WithBridgeTransfer adds bridge transfer context
func (l *Logger) WithBridgeTransfer(transferID string) *Logger {
	return l.With(slog.String("bridgeTransferID", transferID))
}

// WithChains adds source and destination chain context
func (l *Logger) WithChains(sourceChain, destChain uint64) *Logger {
	return l.With(
		slog.Uint64("sourceChain", sourceChain),
		slog.Uint64("destChain", destChain),
	)
}

// WithTxHash adds transaction hash context
func (l *Logger) WithTxHash(txHash string) *Logger {
	return l.With(slog.String("txHash", txHash))
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

var globalLogger *Logger

func Init(cfg Config) {
	globalLogger = New(cfg)
}

func Default() *Logger {
	if globalLogger == nil {
		globalLogger = NewDefault()
	}
	return globalLogger
}

func Debug(msg string, args ...any) { Default().Debug(msg, args...) }
func Info(msg string, args ...any)  { Default().Info(msg, args...) }
func Warn(msg string, args ...any)  { Default().Warn(msg, args...) }
func Error(msg string, args ...any) { Default().Error(msg, args...) }
