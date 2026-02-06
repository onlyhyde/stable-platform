package crypto

import (
	"fmt"

	"github.com/ethereum/go-ethereum/crypto"

	"github.com/stablenet/sdk-go/plugins/stealth/constants"
	"github.com/stablenet/sdk-go/types"
)

// ComputeViewTag computes a view tag from a shared secret.
//
// The view tag is the first byte of keccak256(sharedSecret).
// This enables efficient filtering of announcements - recipients can
// quickly discard ~99.6% of announcements that don't match their view tag.
func ComputeViewTag(sharedSecret []byte) types.Hex {
	if len(sharedSecret) == 0 {
		return nil
	}

	// Hash the shared secret
	hash := crypto.Keccak256(sharedSecret)

	// Take the first byte as the view tag
	return types.Hex(hash[:constants.ViewTagSize])
}

// ExtractViewTag extracts the view tag from metadata.
//
// In EIP-5564, metadata typically starts with the view tag byte,
// followed by any additional application-specific data.
func ExtractViewTag(metadata types.Hex) (types.Hex, error) {
	if len(metadata) == 0 {
		return nil, fmt.Errorf("metadata cannot be empty")
	}

	if len(metadata) < constants.ViewTagSize {
		return nil, fmt.Errorf("metadata too short: expected at least %d byte, got %d",
			constants.ViewTagSize, len(metadata))
	}

	return types.Hex(metadata[:constants.ViewTagSize]), nil
}

// ValidateMetadata validates metadata format and size.
func ValidateMetadata(metadata types.Hex) error {
	if len(metadata) == 0 {
		return fmt.Errorf("metadata cannot be empty")
	}

	if len(metadata) < constants.ViewTagSize {
		return fmt.Errorf("metadata too short: expected at least %d byte for view tag",
			constants.ViewTagSize)
	}

	if len(metadata) > constants.MaxMetadataSize {
		return fmt.Errorf("metadata too large: maximum %d bytes allowed, got %d",
			constants.MaxMetadataSize, len(metadata))
	}

	return nil
}

// CreateMetadata creates metadata with a view tag.
func CreateMetadata(viewTag types.Hex, extraData types.Hex) (types.Hex, error) {
	if len(viewTag) == 0 {
		return nil, fmt.Errorf("view tag cannot be empty")
	}

	if len(viewTag) != constants.ViewTagSize {
		return nil, fmt.Errorf("view tag must be exactly %d byte, got %d",
			constants.ViewTagSize, len(viewTag))
	}

	if len(extraData) == 0 {
		return viewTag, nil
	}

	// Check total size
	totalSize := constants.ViewTagSize + len(extraData)
	if totalSize > constants.MaxMetadataSize {
		return nil, fmt.Errorf("combined metadata too large: maximum %d bytes allowed, got %d",
			constants.MaxMetadataSize, totalSize)
	}

	combined := make([]byte, totalSize)
	copy(combined[:constants.ViewTagSize], viewTag)
	copy(combined[constants.ViewTagSize:], extraData)

	return types.Hex(combined), nil
}

// ViewTagsMatch compares two view tags for equality (case-insensitive).
func ViewTagsMatch(viewTag1, viewTag2 types.Hex) bool {
	if len(viewTag1) != constants.ViewTagSize || len(viewTag2) != constants.ViewTagSize {
		return false
	}
	return viewTag1[0] == viewTag2[0]
}
