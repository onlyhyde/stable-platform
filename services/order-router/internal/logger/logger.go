// Package logger provides structured logging for the order-router service.
package logger

import (
	sharedlogger "github.com/stable-net/shared/logger"
)

// Re-export shared types
type Logger = sharedlogger.Logger
type Config = sharedlogger.Config

// Re-export shared functions
var (
	New        = sharedlogger.New
	NewDefault = sharedlogger.NewDefault
	Init       = sharedlogger.Init
	Default    = sharedlogger.Default
	Debug      = sharedlogger.Debug
	Info       = sharedlogger.Info
	Warn       = sharedlogger.Warn
	Error      = sharedlogger.Error
)

// DefaultConfig returns order-router specific default configuration
func DefaultConfig() Config {
	return sharedlogger.DefaultConfigWithName("order-router")
}
