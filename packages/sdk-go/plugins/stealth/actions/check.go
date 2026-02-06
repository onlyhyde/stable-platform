package actions

import (
	"github.com/stablenet/sdk-go/plugins/stealth"
	"github.com/stablenet/sdk-go/plugins/stealth/crypto"
	"github.com/stablenet/sdk-go/types"
)

// CheckAnnouncementResult contains the result of checking an announcement.
type CheckAnnouncementResult struct {
	// IsForRecipient indicates whether the announcement is for the recipient.
	IsForRecipient bool
	// ViewTagMatches indicates whether the view tag matches.
	ViewTagMatches bool
	// AddressMatches indicates whether the computed address matches.
	AddressMatches bool
}

// CheckAnnouncement checks if an announcement is for a specific recipient.
//
// This is a quick check using the view tag, without computing the full stealth key.
// It's useful for efficient scanning of announcements.
//
// Example:
//
//	result := CheckAnnouncement(CheckAnnouncementParams{
//	    Announcement:      announcement,
//	    ViewingPrivateKey: viewingPrivKey,
//	    SpendingPubKey:    spendingPubKey,
//	})
//	if result.IsForRecipient {
//	    // This announcement is for us
//	}
func CheckAnnouncement(params stealth.CheckAnnouncementParams) *CheckAnnouncementResult {
	result := &CheckAnnouncementResult{}

	// Validate inputs
	if params.Announcement == nil ||
		len(params.Announcement.EphemeralPubKey) == 0 ||
		len(params.Announcement.Metadata) == 0 {
		return result
	}

	if len(params.ViewingPrivateKey) == 0 || len(params.SpendingPubKey) == 0 {
		return result
	}

	// Check view tag
	announcementViewTag, err := crypto.ExtractViewTag(params.Announcement.Metadata)
	if err != nil {
		return result
	}

	viewTagMatches, err := crypto.CheckViewTag(
		params.Announcement.EphemeralPubKey,
		params.ViewingPrivateKey,
		announcementViewTag,
	)
	if err != nil {
		return result
	}

	result.ViewTagMatches = viewTagMatches

	if !viewTagMatches {
		return result
	}

	// View tag matches - this is a potential match
	// To fully verify, the caller needs to use ComputeStealthKey with the spending private key
	// We can't verify the address match here without the spending private key
	result.IsForRecipient = true // Potential match based on view tag

	return result
}

// CheckAnnouncementFull checks an announcement and verifies the address match.
// This requires both the viewing and spending private keys.
func CheckAnnouncementFull(
	announcement *stealth.StealthAnnouncement,
	viewingPrivateKey types.Hex,
	spendingPrivateKey types.Hex,
) *CheckAnnouncementResult {
	result := &CheckAnnouncementResult{}

	if announcement == nil || len(announcement.Metadata) == 0 {
		return result
	}

	// Check view tag first
	viewTag, err := crypto.ExtractViewTag(announcement.Metadata)
	if err != nil {
		return result
	}

	viewTagMatches, err := crypto.CheckViewTag(
		announcement.EphemeralPubKey,
		viewingPrivateKey,
		viewTag,
	)
	if err != nil {
		return result
	}

	result.ViewTagMatches = viewTagMatches

	if !viewTagMatches {
		return result
	}

	// Compute the full stealth key and verify address
	computed, err := crypto.ComputeStealthPrivateKey(
		announcement.EphemeralPubKey,
		spendingPrivateKey,
		viewingPrivateKey,
	)
	if err != nil {
		return result
	}

	addressMatches := computed.StealthAddress.Hex() == announcement.StealthAddress.Hex()
	result.AddressMatches = addressMatches
	result.IsForRecipient = addressMatches

	return result
}

// CheckAnnouncementSimple is a simplified check that only verifies the view tag.
// This is the fastest way to filter announcements.
func CheckAnnouncementSimple(
	announcement *stealth.StealthAnnouncement,
	viewingPrivateKey types.Hex,
) bool {
	if announcement == nil || len(announcement.Metadata) == 0 {
		return false
	}

	viewTag, err := crypto.ExtractViewTag(announcement.Metadata)
	if err != nil {
		return false
	}

	matches, err := crypto.CheckViewTag(
		announcement.EphemeralPubKey,
		viewingPrivateKey,
		viewTag,
	)
	if err != nil {
		return false
	}

	return matches
}
