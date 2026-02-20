// Package logger provides structured logging utilities for StableNet services.
// It uses Go's standard library slog package for JSON-structured logging.
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

// Log level constants
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
	// Level is the minimum log level (debug, info, warn, error)
	Level string
	// Format is the output format (json or text)
	Format string
	// Output is the writer for log output (defaults to os.Stdout)
	Output io.Writer
	// Name is the service name to include in all logs
	Name string
	// Version is the service version to include in all logs
	Version string
}

// DefaultConfig returns the default logger configuration
func DefaultConfig() Config {
	return Config{
		Level:   getEnvOrDefault("LOG_LEVEL", "info"),
		Format:  getEnvOrDefault("LOG_FORMAT", "json"),
		Output:  os.Stdout,
		Name:    "service",
		Version: "1.0.0",
	}
}

// DefaultConfigWithName returns a default config with the given service name
func DefaultConfigWithName(name string) Config {
	cfg := DefaultConfig()
	cfg.Name = name
	return cfg
}

// New creates a new structured logger with the given configuration
func New(cfg Config) *Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}
	if cfg.Name == "" {
		cfg.Name = "service"
	}

	level := ParseLevel(cfg.Level)

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

	attrs := []any{slog.String("service", cfg.Name)}
	if cfg.Version != "" {
		attrs = append(attrs, slog.String("version", cfg.Version))
	}

	return &Logger{
		Logger: slog.New(handler).With(attrs...),
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

// WithFields adds multiple fields to the log context
func (l *Logger) WithFields(fields map[string]any) *Logger {
	args := make([]any, 0, len(fields)*2)
	for k, v := range fields {
		args = append(args, k, v)
	}
	return l.With(args...)
}

// ParseLevel converts a string level to slog.Level
func ParseLevel(level string) slog.Level {
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

// GetEnvOrDefault returns the environment variable value or the default
func GetEnvOrDefault(key, defaultValue string) string {
	return getEnvOrDefault(key, defaultValue)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Global logger instance
var globalLogger *Logger

// Init initializes the global logger with the given configuration
func Init(cfg Config) {
	globalLogger = New(cfg)
}

// Default returns the global logger, initializing if necessary
func Default() *Logger {
	if globalLogger == nil {
		globalLogger = NewDefault()
	}
	return globalLogger
}

// Convenience methods using the global logger

// Debug logs a debug message
func Debug(msg string, args ...any) {
	Default().Debug(msg, args...)
}

// Info logs an info message
func Info(msg string, args ...any) {
	Default().Info(msg, args...)
}

// Warn logs a warning message
func Warn(msg string, args ...any) {
	Default().Warn(msg, args...)
}

// Error logs an error message
func Error(msg string, args ...any) {
	Default().Error(msg, args...)
}
