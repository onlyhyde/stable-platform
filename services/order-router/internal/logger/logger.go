// Package logger provides structured logging utilities for the order-router service.
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
}

// DefaultConfig returns the default logger configuration
func DefaultConfig() Config {
	return Config{
		Level:  getEnvOrDefault("LOG_LEVEL", "info"),
		Format: getEnvOrDefault("LOG_FORMAT", "json"),
		Output: os.Stdout,
		Name:   "order-router",
	}
}

// New creates a new structured logger with the given configuration
func New(cfg Config) *Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}
	if cfg.Name == "" {
		cfg.Name = "order-router"
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
	// Extract request ID from context if available
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

// parseLevel converts a string level to slog.Level
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

// getEnvOrDefault returns the environment variable value or the default
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
