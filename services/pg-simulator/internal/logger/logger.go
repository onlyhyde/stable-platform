// Package logger provides structured logging utilities for the pg-simulator service.
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
		Name:   "pg-simulator",
	}
}

// New creates a new structured logger
func New(cfg Config) *Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}
	if cfg.Name == "" {
		cfg.Name = "pg-simulator"
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

// WithPayment adds payment context (masked for PCI compliance)
func (l *Logger) WithPayment(paymentID string) *Logger {
	return l.With(slog.String("paymentID", paymentID))
}

// WithCard adds masked card info for logging
func (l *Logger) WithCard(lastFour string) *Logger {
	return l.With(slog.String("cardLastFour", "****"+lastFour))
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
