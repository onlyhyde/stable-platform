package actions

import (
	"errors"
	"strings"

	"github.com/stablenet/sdk-go/plugins/stealth"
	"github.com/stablenet/sdk-go/plugins/stealth/crypto"
)

var (
	// ErrMissingAnnouncementFields indicates missing required fields in announcement.
	ErrMissingAnnouncementFields = errors.New("missing required announcement fields")
	// ErrMissingPrivateKeys indicates missing private keys.
	ErrMissingPrivateKeys = errors.New("missing private keys")
)

// ComputeStealthKey computes the stealth private key from an announcement.
//
// This action is used by the recipient to derive the private key
// for a stealth address that was created for them.
//
// Returns nil if the announcement is not for the recipient.
//
// Example:
//
//	result := ComputeStealthKey(ComputeStealthKeyParams{
//	    Announcement:       announcement,
//	    SpendingPrivateKey: spendingPrivKey,
//	    ViewingPrivateKey:  viewingPrivKey,
//	})
//	if result != nil {
//	    // result.StealthPrivateKey can be used to spend from result.StealthAddress
//	}
func ComputeStealthKey(params stealth.ComputeStealthKeyParams) *crypto.ComputedStealthKey {
	// Validate inputs
	if params.Announcement == nil ||
		len(params.Announcement.EphemeralPubKey) == 0 ||
		len(params.Announcement.Metadata) == 0 {
		return nil
	}

	if len(params.SpendingPrivateKey) == 0 || len(params.ViewingPrivateKey) == 0 {
		return nil
	}

	// First, check the view tag for quick filtering
	announcementViewTag, err := crypto.ExtractViewTag(params.Announcement.Metadata)
	if err == nil {
		viewTagMatches, err := crypto.CheckViewTag(
			params.Announcement.EphemeralPubKey,
			params.ViewingPrivateKey,
			announcementViewTag,
		)
		if err == nil && !viewTagMatches {
			// View tag doesn't match - this announcement is not for us
			return nil
		}
	}

	// Compute the full stealth private key
	result, err := crypto.ComputeStealthPrivateKey(
		params.Announcement.EphemeralPubKey,
		params.SpendingPrivateKey,
		params.ViewingPrivateKey,
	)
	if err != nil {
		return nil
	}

	// Verify the computed address matches the announcement
	if !strings.EqualFold(result.StealthAddress.Hex(), params.Announcement.StealthAddress.Hex()) {
		// Address doesn't match - this announcement is not for us
		return nil
	}

	return result
}

// ComputeStealthKeyWithResult computes the stealth key with detailed result information.
//
// Unlike ComputeStealthKey which returns nil for any failure,
// this function provides detailed information about why the
// computation failed.
func ComputeStealthKeyWithResult(params stealth.ComputeStealthKeyParams) *stealth.ComputeStealthKeyResult {
	// Validate inputs
	if params.Announcement == nil ||
		len(params.Announcement.EphemeralPubKey) == 0 ||
		len(params.Announcement.Metadata) == 0 {
		return &stealth.ComputeStealthKeyResult{
			Success: false,
			Reason:  stealth.ReasonInvalidInput,
			Error:   ErrMissingAnnouncementFields,
		}
	}

	if len(params.SpendingPrivateKey) == 0 || len(params.ViewingPrivateKey) == 0 {
		return &stealth.ComputeStealthKeyResult{
			Success: false,
			Reason:  stealth.ReasonInvalidInput,
			Error:   ErrMissingPrivateKeys,
		}
	}

	// Check view tag
	announcementViewTag, err := crypto.ExtractViewTag(params.Announcement.Metadata)
	if err == nil {
		viewTagMatches, err := crypto.CheckViewTag(
			params.Announcement.EphemeralPubKey,
			params.ViewingPrivateKey,
			announcementViewTag,
		)
		if err == nil && !viewTagMatches {
			return &stealth.ComputeStealthKeyResult{
				Success: false,
				Reason:  stealth.ReasonViewTagMismatch,
			}
		}
	}

	// Compute stealth key
	result, err := crypto.ComputeStealthPrivateKey(
		params.Announcement.EphemeralPubKey,
		params.SpendingPrivateKey,
		params.ViewingPrivateKey,
	)
	if err != nil {
		return &stealth.ComputeStealthKeyResult{
			Success: false,
			Reason:  stealth.ReasonComputationError,
			Error:   err,
		}
	}

	// Verify address matches
	if !strings.EqualFold(result.StealthAddress.Hex(), params.Announcement.StealthAddress.Hex()) {
		return &stealth.ComputeStealthKeyResult{
			Success: false,
			Reason:  stealth.ReasonAddressMismatch,
		}
	}

	return &stealth.ComputeStealthKeyResult{
		Success: true,
		Key:     result,
	}
}
