# Social Recovery Guardian Management -- UI/UX Design Specification

Version: 1.0
Date: 2026-02-14
Target: `apps/web` (Next.js + Tailwind CSS + custom component library)
Contract: `WeightedECDSAValidator` at `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0`

---

## Table of Contents

1. [Information Architecture](#1-information-architecture)
2. [User Flows](#2-user-flows)
3. [Component Tree](#3-component-tree)
4. [Component Specifications](#4-component-specifications)
5. [State Management](#5-state-management)
6. [Data and API Integration](#6-data-and-api-integration)
7. [Wire-frame Descriptions](#7-wire-frame-descriptions)
8. [Security UX](#8-security-ux)
9. [Accessibility](#9-accessibility)
10. [Edge Cases and Error Handling](#10-edge-cases-and-error-handling)

---

## 1. Information Architecture

### 1.1 Navigation Integration

The social recovery feature integrates into the existing navigation at two levels:

**Settings Page (existing)**
The `SecuritySettingsCard` already has a "Social Recovery: Not configured" row with a "Setup" button. This button becomes the primary entry point. When the module is installed, the status text changes to "Configured (N guardians)" and the button text changes to "Manage".

**New Dedicated Route: `/settings/recovery`**
After the module is installed, the "Manage" button navigates to this route. This is a sub-route of settings, not a top-level sidebar item, because recovery management is a security concern under the settings domain. It keeps the sidebar uncluttered.

**Guardian Dashboard Route: `/recovery/guardian`**
A separate top-level page for users acting as guardians for other accounts. This is accessed from a link in the header dropdown or from a banner on the settings/recovery page. It is intentionally separate because the guardian role is a different mental model (helping someone else, not managing your own account).

```
Navigation Hierarchy:

Sidebar (existing, no changes)
  |-- Settings
  |     |-- Security tab (existing)
  |     |     |-- Recovery Options section
  |     |           |-- "Social Recovery" row
  |     |                 |-- Status: "Not configured" / "Configured (3 guardians)"
  |     |                 |-- Button: "Setup" / "Manage"
  |     |
  |     |-- [/settings/recovery] (new, reachable from Manage button)
  |
  |-- [/recovery/guardian] (new, separate guardian dashboard)

Marketplace (existing)
  |-- "Social Recovery" module card
  |     |-- Install -> opens InstallModuleModal with SocialRecoveryForm
```

### 1.2 Page Hierarchy

```
/settings
  /settings/recovery          -- Owner: guardian management + recovery status
/recovery
  /recovery/guardian           -- Guardian: list of accounts you protect
  /recovery/guardian/[account] -- Guardian: propose/vote on specific account
```

### 1.3 Data Flow Between Components

```
                     +--------------------------+
                     |  useRecoveryModule hook   |
                     |  (single source of truth) |
                     +---+---+---+---+---+------+
                         |   |   |   |   |
         +---------------+   |   |   |   +------------------+
         |                   |   |   |                       |
+--------v-------+  +-------v-+ | +-v-----------+  +--------v----------+
| SecuritySettings|  |Guardian | | |RecoveryStatus|  |RecoveryProposal   |
| Card (settings) |  |List     | | |Banner        |  |View (guardian)     |
+----------------+  +---------+ | +-------------+  +-------------------+
                                 |
                         +-------v--------+
                         | SocialRecovery |
                         | Form (modal)   |
                         +----------------+
```

---

## 2. User Flows

### 2.1 Setup Flow: First-time Guardian Configuration

This flow occurs when the user installs the Social Recovery module from the marketplace or clicks "Setup" from the security settings.

```
ENTRY A: Marketplace -> "Social Recovery" card -> "Install"
ENTRY B: Settings -> Security -> Recovery Options -> Social Recovery -> "Setup"

Step 1: EDUCATION
  User sees explanation of social recovery:
  - What guardians are and why they matter
  - How weighted voting works
  - Timelock protection explanation
  [Continue]

Step 2: ADD GUARDIANS (multi-step within modal)
  +-------------------------------------------+
  | Add Guardian                              |
  | [Address input: 0x...]                    |
  | [Label input: "Alice (sister)"]           |
  | [Weight input: 1-100]                     |
  | [+ Add Guardian]                          |
  |                                           |
  | Added Guardians:                          |
  | +---------------------------------------+ |
  | | Alice (0xabc...def)    Weight: 30     | |
  | |                        [Remove]       | |
  | +---------------------------------------+ |
  | | Bob (0x123...789)      Weight: 30     | |
  | |                        [Remove]       | |
  | +---------------------------------------+ |
  |                                           |
  | Minimum 1 guardian required.              |
  +-------------------------------------------+
  [Back] [Next]

Step 3: SET THRESHOLD & DELAY
  +-------------------------------------------+
  | Recovery Threshold                        |
  | Total guardian weight: 90                 |
  | Required weight for recovery: [___60___] |
  |                                           |
  | Visual: progress bar showing 60/90        |
  |                                           |
  | Timelock Delay                            |
  | [Preset buttons: 1 day | 3 days | 7 days]|
  | [Custom: ___ seconds]                     |
  |                                           |
  | Explanation: After guardians approve,     |
  | there is a waiting period before the      |
  | recovery executes. This gives you time    |
  | to cancel if the recovery was malicious.  |
  +-------------------------------------------+
  [Back] [Next]

Step 4: REVIEW & CONFIRM
  +-------------------------------------------+
  | Review Configuration                      |
  |                                           |
  | Guardians: 3                              |
  |   Alice (0xabc...def) - Weight 30         |
  |   Bob   (0x123...789) - Weight 30         |
  |   Carol (0x456...012) - Weight 30         |
  |                                           |
  | Threshold: 60 / 90 total weight           |
  | Timelock:  3 days                         |
  |                                           |
  | [!] Warning: Guardians have the power     |
  | to change ownership of your account.      |
  | Only add addresses you fully trust.       |
  +-------------------------------------------+
  [Back] [Install Module]

Step 5: TRANSACTION
  Loading state -> Transaction submitted -> Success
  +-------------------------------------------+
  | Social Recovery Configured!               |
  | [checkmark icon]                          |
  |                                           |
  | TX: 0x1234...5678                         |
  |                                           |
  | [Go to Recovery Settings] [Done]          |
  +-------------------------------------------+
```

### 2.2 Management Flow: Ongoing Guardian Management

After the module is installed, the owner manages guardians from `/settings/recovery`.

```
ENTRY: Settings -> Security -> Social Recovery -> "Manage"
       -> navigates to /settings/recovery

+--------------------------------------------------------+
| Recovery Settings            [breadcrumb: Settings > Recovery]
| Manage your social recovery guardians and settings
|
| +-- Recovery Status Card --+  +-- Quick Stats --------+
| | Status: Active           |  | Guardians: 3          |
| | No pending proposals     |  | Threshold: 60/90      |
| |                          |  | Timelock: 3 days      |
| +--------------------------+  +-----------------------+
|
| Guardians (3)                          [+ Add Guardian]
| +----------------------------------------------------+
| | Alice          0xabc...def    Weight: 30   [Edit] [Remove] |
| | Bob            0x123...789    Weight: 30   [Edit] [Remove] |
| | Carol          0x456...012    Weight: 30   [Edit] [Remove] |
| +----------------------------------------------------+
|
| Configuration
| +----------------------------------------------------+
| | Threshold    60 of 90 total weight    [Change]     |
| | Timelock     3 days (259200 seconds)  [Change]     |
| +----------------------------------------------------+
|
| [!] Warning: Are you a guardian for other accounts?
|     View your guardian duties ->
|
| Danger Zone
| +----------------------------------------------------+
| | Uninstall Social Recovery Module                   |
| | This will remove all guardians and disable         |
| | recovery. This action requires a transaction.      |
| |                                     [Uninstall]    |
| +----------------------------------------------------+
+--------------------------------------------------------+

ACTION: Add Guardian
  Opens modal with address, label, weight inputs.
  Submits on-chain transaction (addGuardian).

ACTION: Remove Guardian
  Opens ConfirmModal (danger variant).
  "Are you sure you want to remove Alice as a guardian?
   This will reduce your total guardian weight from 90 to 60."
  Submits on-chain transaction (removeGuardian).

ACTION: Edit Guardian (weight only; address is immutable)
  Opens inline edit or modal.
  Submits on-chain transaction if weight changed.

ACTION: Change Threshold
  Opens modal with new threshold input and visual weight bar.
  Validates: threshold <= total weight, threshold > 0.

ACTION: Change Timelock
  Opens modal with preset + custom options.
  Warns about security implications of short timelocks.
```

### 2.3 Recovery Flow (Guardian Perspective)

A guardian uses `/recovery/guardian` to see accounts they protect and participate in recovery.

```
ENTRY: /recovery/guardian (linked from header menu or settings)

+--------------------------------------------------------+
| Guardian Dashboard
| Accounts you help protect
|
| [Connect wallet prompt if not connected]
|
| Protected Accounts (2)
| +----------------------------------------------------+
| | Account: 0xOwner1...abc                            |
| | Label: "My brother's wallet"                       |
| | Your weight: 30 / Threshold: 60                    |
| | Status: No active proposals                        |
| |                               [View] [Propose Recovery] |
| +----------------------------------------------------+
| | Account: 0xOwner2...def                            |
| | Label: "Company treasury"                          |
| | Your weight: 20 / Threshold: 50                    |
| | Status: Recovery proposed (2/3 approvals)          |
| |                               [View] [Vote]        |
| +----------------------------------------------------+
|
| [info] If you do not see an account here, the owner
| may not have added your address as a guardian yet.
+--------------------------------------------------------+

ACTION: Propose Recovery
  Step 1: Enter new owner address
    [New owner address: 0x...]
    [!] Warning: This will transfer ownership of the account.
    Only propose recovery if you have confirmed the legitimate
    owner has lost access.
  Step 2: Confirm and sign
    Signs the recovery proposal transaction (proposeRecovery).

ACTION: Vote on existing proposal
  Displays proposal details:
    - Proposed new owner: 0xNewOwner...
    - Proposed by: 0xGuardianA...
    - Current approvals: 40 / 60 required
    - Your weight: 20
  [Approve] [Reject]
  Approve signs a co-signature to add weight.
```

### 2.4 Recovery Flow (Owner Perspective)

The account owner sees active proposals and can cancel them.

```
ENTRY: /settings/recovery (red alert banner appears at top when proposals exist)
ENTRY: Global notification banner on all pages when recovery is in progress

+--------------------------------------------------------+
| [!!! RED BANNER - appears on ALL pages !!!]            |
| RECOVERY IN PROGRESS                                   |
| A recovery proposal is pending for your account.       |
| If you did not initiate this, cancel it immediately.   |
| [View Details] [Cancel Recovery]                       |
+--------------------------------------------------------+

On /settings/recovery page:

| Active Recovery Proposals
| +----------------------------------------------------+
| | Proposal #1                           STATUS: PENDING
| |                                                    |
| | New Owner: 0xNewOwner...abc                        |
| | Proposed by: Alice (0xGuardian1...def)             |
| | Approved weight: 40 / 60 required                  |
| |                                                    |
| | Approvals:                                         |
| |   Alice   (weight 30) - Approved                   |
| |   Bob     (weight 10) - Approved                   |
| |   Carol   (weight 30) - Not yet voted              |
| |                                                    |
| | Timelock: Executes in 2d 14h 30m                   |
| | [===========>-----------] 52% elapsed              |
| |                                                    |
| |                           [Cancel Recovery]         |
| +----------------------------------------------------+

ACTION: Cancel Recovery
  Opens ConfirmModal:
  "Cancel this recovery proposal? The guardians will
   need to start a new proposal if recovery is still needed."
  Submits cancelRecovery transaction.
```

### 2.5 Emergency Flow: Recovery Executing

```
When timelock expires and recovery is about to execute:

+--------------------------------------------------------+
| [!!!  CRITICAL RED BANNER - ALL PAGES  !!!]            |
| ACCOUNT OWNERSHIP TRANSFER IMMINENT                    |
| Recovery proposal will execute in < 1 hour.            |
| Your account ownership will transfer to 0xNew...abc.   |
| If this is unauthorized, CANCEL IMMEDIATELY.           |
| [CANCEL NOW]                                           |
+--------------------------------------------------------+

After recovery executes:
+--------------------------------------------------------+
| [INFO BANNER]                                          |
| Account ownership has been transferred.                |
| New owner: 0xNewOwner...abc                            |
| This wallet is no longer the owner of this account.    |
+--------------------------------------------------------+
```

---

## 3. Component Tree

```
apps/web/
  components/
    recovery/                          -- NEW directory
      index.ts                         -- barrel exports
      SocialRecoveryForm.tsx           -- setup form for InstallModuleModal
      RecoveryManagementPage.tsx       -- main /settings/recovery view
      GuardianList.tsx                 -- list of guardians with CRUD
      GuardianCard.tsx                 -- single guardian row/card
      GuardianFormModal.tsx            -- add/edit guardian modal
      ThresholdConfigModal.tsx         -- change threshold modal
      TimelockConfigModal.tsx          -- change timelock modal
      RecoveryStatusBanner.tsx         -- global alert banner for active proposals
      RecoveryProposalCard.tsx         -- single proposal with status + actions
      RecoveryProposalList.tsx         -- list of proposals (owner view)
      GuardianDashboard.tsx            -- guardian perspective main view
      GuardianAccountCard.tsx          -- single protected account card
      ProposeRecoveryModal.tsx         -- guardian: propose new recovery
      VoteRecoveryModal.tsx            -- guardian: approve/reject a proposal
      WeightBar.tsx                    -- visual weight/threshold progress bar
      TimelockCountdown.tsx            -- countdown timer for active timelock
      RecoveryConfirmUninstall.tsx     -- uninstall confirmation
      EmptyGuardianState.tsx           -- empty state for no guardians

  app/
    settings/
      recovery/
        page.tsx                       -- NEW: /settings/recovery route
    recovery/
      guardian/
        page.tsx                       -- NEW: /recovery/guardian route
        [account]/
          page.tsx                     -- NEW: /recovery/guardian/[account]

  hooks/
    useRecoveryModule.ts               -- NEW: hook for all recovery contract interactions
```

---

## 4. Component Specifications

### 4.1 SocialRecoveryForm

**Purpose**: Configuration form shown inside `InstallModuleModal` when installing the social-recovery module. Replaces the `DefaultInitDataForm` currently used.

**File**: `/apps/web/components/recovery/SocialRecoveryForm.tsx`

**Props**:
```typescript
interface SocialRecoveryFormProps {
  onInitDataChange: (data: Hex) => void
  walletAddress?: Address
}
```

**State**:
```typescript
interface FormState {
  step: 'education' | 'guardians' | 'threshold' | 'review'
  guardians: Array<{ address: string; label: string; weight: number }>
  threshold: number
  delay: number // seconds
  errors: Record<string, string>
}
```

**Visual Layout**:
- Step indicator at top (4 circles connected by lines, matching `CreateSessionKeyModal` pattern)
- Each step is a vertical stack of form fields
- Step 1 (education): Informational card with shield icon, explanation text, "I understand" checkbox
- Step 2 (guardians): Repeatable group with address Input, label Input, weight number Input, Add/Remove buttons, list of added guardians below
- Step 3 (threshold): WeightBar visualization, threshold number Input, delay preset buttons (grid of 4) + custom input
- Step 4 (review): Summary card with all configuration, warning InfoBanner
- Navigation: Back / Next buttons at bottom, "Install Module" on final step

**Interaction Patterns**:
- Address field validates on blur using `isAddress` from viem
- Duplicate guardian addresses show error immediately
- Weight field enforces min=1, max=100 via input constraints
- Threshold cannot exceed total weight (validated on change)
- Step transitions validate current step before proceeding
- "Install Module" button encodes all data into `initData` hex

**Error States**:
- Invalid address format: red border + error message below Input
- Duplicate guardian: "This address is already a guardian"
- Threshold exceeds total: "Threshold cannot exceed total guardian weight (N)"
- No guardians added: "Add at least one guardian to continue"
- Zero threshold: "Threshold must be at least 1"

**Loading States**:
- None specific to this form (loading handled by parent `InstallModuleModal`)

**Empty States**:
- Guardian list shows dashed-border empty state with icon: "No guardians added yet"

**Mobile**:
- Step indicator collapses to text "Step 2 of 4" on small screens
- Guardian list stacks vertically (full width cards)
- Preset buttons wrap to 2 columns on mobile

**Init Data Encoding**:
```typescript
// Encode guardians, weights, threshold, delay into single bytes
// Layout: [threshold:uint256][delay:uint256][guardianCount:uint256][...guardians:address[]][...weights:uint256[]]
function encodeInitData(
  guardians: Address[],
  weights: number[],
  threshold: number,
  delay: number
): Hex
```

---

### 4.2 RecoveryManagementPage

**Purpose**: Full page view at `/settings/recovery` for managing installed social recovery configuration.

**File**: `/apps/web/components/recovery/RecoveryManagementPage.tsx`

**Props**:
```typescript
interface RecoveryManagementPageProps {
  // No props - uses hooks internally
}
```

**State**: Delegates to `useRecoveryModule` hook.

**Visual Layout**:
```
+-- PageHeader ---------------------------------------------------+
| Title: "Recovery Settings"                                       |
| Description: "Manage your social recovery guardians and settings"|
| Breadcrumb: Settings > Security > Recovery                       |
| Actions: [Refresh button]                                        |
+------------------------------------------------------------------+

+-- RecoveryStatusBanner (conditional) ----------------------------+
| [Only shown when proposals are active - see 4.9]                 |
+------------------------------------------------------------------+

+-- Stats Row (2 columns on desktop, stacked on mobile) -----------+
| +-- StatCard --------+  +-- StatCard --------+                   |
| | Guardians: 3       |  | Threshold: 60/90   |                   |
| +--------------------+  +--------------------+                   |
| +-- StatCard --------+  +-- StatCard --------+                   |
| | Timelock: 3 days   |  | Proposals: 0       |                   |
| +--------------------+  +--------------------+                   |
+------------------------------------------------------------------+

+-- GuardianList --------------------------------------------------+
| (see 4.3)                                                        |
+------------------------------------------------------------------+

+-- Configuration Card --------------------------------------------+
| Threshold row with [Change] button                               |
| Timelock row with [Change] button                                |
+------------------------------------------------------------------+

+-- Active Proposals (conditional) --------------------------------+
| RecoveryProposalList (see 4.10)                                  |
+------------------------------------------------------------------+

+-- Guardian Link Banner ------------------------------------------+
| InfoBanner: "Are you a guardian for other accounts?"             |
| Link to /recovery/guardian                                        |
+------------------------------------------------------------------+

+-- Danger Zone Card ----------------------------------------------+
| Uninstall module with danger button                              |
+------------------------------------------------------------------+
```

**Loading State**: Skeleton cards for stats, skeleton rows for guardian list.

**Empty State**: If module is not installed, redirect to settings or show "Module not installed" with link to marketplace.

**Mobile**: Stats become single-column stack. Guardian cards become full-width.

---

### 4.3 GuardianList

**Purpose**: Displays all configured guardians with add/remove/edit actions.

**File**: `/apps/web/components/recovery/GuardianList.tsx`

**Props**:
```typescript
interface GuardianListProps {
  guardians: GuardianInfo[]
  totalWeight: number
  threshold: number
  isLoading: boolean
  onAddGuardian: () => void
  onRemoveGuardian: (address: Address) => void
  onEditGuardian: (address: Address) => void
  isModifying: boolean
}

interface GuardianInfo {
  address: Address
  label?: string       // locally stored, not on-chain
  weight: number
}
```

**Visual Layout**:
```
+-- Header Row ---------------------------------------------------+
| "Guardians (3)"                          [+ Add Guardian]       |
+------------------------------------------------------------------+

+-- Guardian Cards (list) -----------------------------------------+
| GuardianCard (repeated)                                          |
+------------------------------------------------------------------+

OR if empty:

+-- Empty State ---------------------------------------------------+
| [Shield icon]                                                    |
| "No guardians configured"                                        |
| "Add trusted contacts who can help recover your account."        |
| [+ Add Guardian]                                                 |
+------------------------------------------------------------------+
```

**Mobile**: Full-width single-column card list. "Add Guardian" button moves to a floating action position or stays full-width below header.

---

### 4.4 GuardianCard

**Purpose**: Single guardian row showing address, label, weight, and action buttons.

**File**: `/apps/web/components/recovery/GuardianCard.tsx`

**Props**:
```typescript
interface GuardianCardProps {
  guardian: GuardianInfo
  totalWeight: number
  onEdit: () => void
  onRemove: () => void
  isModifying: boolean
}
```

**Visual Layout**:
```
+--------------------------------------------------------------+
| [Avatar circle    ]  Alice                                    |
| [with initials/   ]  0xabc1...def2                           |
| [jazzicon         ]                                           |
|                      Weight: 30 (33% of total)               |
|                                                               |
|                                       [Edit] [Remove]        |
+--------------------------------------------------------------+
```

- Avatar: Colored circle with first character of label or address-derived color
- Address: Monospace font, truncated with ellipsis (first 6 + last 4 characters)
- Weight: Displayed as absolute number and percentage of total weight
- Edit button: secondary variant, small size
- Remove button: ghost variant with destructive hover color, small size

**Interaction**: Edit opens `GuardianFormModal` in edit mode. Remove opens `ConfirmModal` (danger variant).

**Mobile**: Same layout, buttons may stack vertically on very narrow screens.

---

### 4.5 GuardianFormModal

**Purpose**: Modal for adding a new guardian or editing an existing guardian's weight.

**File**: `/apps/web/components/recovery/GuardianFormModal.tsx`

**Props**:
```typescript
interface GuardianFormModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  existingGuardian?: GuardianInfo
  existingAddresses: Address[]  // for duplicate detection
  onSubmit: (guardian: { address: Address; label: string; weight: number }) => Promise<void>
  isSubmitting: boolean
}
```

**State**:
```typescript
{
  address: string        // disabled in edit mode
  label: string
  weight: string
  errors: { address?: string; label?: string; weight?: string }
}
```

**Visual Layout**:
```
+-- Modal (size="md") -------------------------------------------+
| Title: "Add Guardian" / "Edit Guardian"                        |
|                                                                 |
| Address                                                         |
| [0x... input]              (disabled in edit mode)             |
| "Enter the Ethereum address of your trusted guardian"          |
|                                                                 |
| Label (optional)                                                |
| [e.g., "Alice (sister)" input]                                 |
| "A friendly name to help you identify this guardian"           |
|                                                                 |
| Weight                                                          |
| [number input: 1-100]                                          |
| "Higher weight = more voting power for recovery"               |
|                                                                 |
| +-- InfoBanner (warning) ------------------------------------+ |
| | Only add addresses controlled by people you trust           | |
| | completely. Guardians can initiate account recovery.        | |
| +------------------------------------------------------------+ |
|                                                                 |
|                              [Cancel] [Add Guardian / Save]    |
+-----------------------------------------------------------------+
```

**Validation**:
- Address: Required, must be valid Ethereum address, must not be own address, must not be duplicate
- Label: Optional, max 50 characters
- Weight: Required, integer, 1-100

**Error States**: Inline under each field using the existing Input error pattern.

**Mobile**: Full-width modal, inputs stack naturally.

---

### 4.6 ThresholdConfigModal

**Purpose**: Modal for changing the recovery threshold.

**File**: `/apps/web/components/recovery/ThresholdConfigModal.tsx`

**Props**:
```typescript
interface ThresholdConfigModalProps {
  isOpen: boolean
  onClose: () => void
  currentThreshold: number
  totalWeight: number
  onSubmit: (newThreshold: number) => Promise<void>
  isSubmitting: boolean
}
```

**Visual Layout**:
```
+-- Modal (size="sm") -------------------------------------------+
| Title: "Change Recovery Threshold"                             |
|                                                                 |
| WeightBar: [=========>---------] 60 / 90                       |
|                                                                 |
| New Threshold                                                   |
| [number input]                                                  |
| "Minimum weight needed: 1 | Maximum: 90 (total weight)"       |
|                                                                 |
| Quick set: [50%] [66%] [75%] [100%]                            |
|                                                                 |
| +-- InfoBanner (info) ----------------------------------------+|
| | A higher threshold requires more guardians to agree,         ||
| | increasing security but reducing recovery convenience.       ||
| +------------------------------------------------------------+|
|                                                                 |
|                                     [Cancel] [Update]          |
+-----------------------------------------------------------------+
```

---

### 4.7 TimelockConfigModal

**Purpose**: Modal for changing the timelock delay.

**File**: `/apps/web/components/recovery/TimelockConfigModal.tsx`

**Props**:
```typescript
interface TimelockConfigModalProps {
  isOpen: boolean
  onClose: () => void
  currentDelay: number  // seconds
  onSubmit: (newDelay: number) => Promise<void>
  isSubmitting: boolean
}
```

**Visual Layout**:
```
+-- Modal (size="sm") -------------------------------------------+
| Title: "Change Timelock Delay"                                 |
|                                                                 |
| Current delay: 3 days                                          |
|                                                                 |
| Presets:                                                        |
| [1 day] [3 days] [7 days] [14 days]                           |
|                                                                 |
| Custom (seconds):                                               |
| [input: number]                                                 |
| "= X days Y hours"  (live conversion display)                 |
|                                                                 |
| +-- InfoBanner (warning) ------------------------------------+|
| | Short timelocks give you less time to react to             ||
| | unauthorized recovery attempts. 3+ days recommended.       ||
| +------------------------------------------------------------+|
|                                                                 |
|                                     [Cancel] [Update]          |
+-----------------------------------------------------------------+
```

---

### 4.8 WeightBar

**Purpose**: Visual progress bar showing current weight vs threshold.

**File**: `/apps/web/components/recovery/WeightBar.tsx`

**Props**:
```typescript
interface WeightBarProps {
  currentWeight: number    // approved weight (for proposals) or threshold
  totalWeight: number      // total guardian weight
  threshold?: number       // threshold marker on the bar
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}
```

**Visual Layout**:
```
sm:  [======>--------] 60/90
md:  [============>-----------] 60 of 90 weight
lg:  [====================>------------------]
     Approved: 60          Threshold: 60     Total: 90
     |--- threshold marker triangle ---|
```

- Filled portion uses `--primary` color by default
- When `currentWeight >= threshold`, filled portion uses `--success` color
- Threshold marker shown as a small triangle or line on the bar
- Labels below bar on lg size

**Styling**: Uses CSS variable-based inline styles matching the project convention. Background is `rgb(var(--secondary))`, fill is gradient from `rgb(var(--primary))` to `rgb(var(--accent))`.

**Accessibility**: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax={totalWeight}`, `aria-label` describes the weight status in text.

---

### 4.9 RecoveryStatusBanner

**Purpose**: Global alert banner shown when a recovery proposal is active. Appears at the top of every page, or at minimum on the recovery settings page and dashboard.

**File**: `/apps/web/components/recovery/RecoveryStatusBanner.tsx`

**Props**:
```typescript
interface RecoveryStatusBannerProps {
  proposal: RecoveryProposal
  onCancel: () => void
  onViewDetails: () => void
  isCancelling: boolean
}

interface RecoveryProposal {
  id: string | number
  proposedOwner: Address
  proposedBy: Address
  approvedWeight: number
  requiredWeight: number
  createdAt: number         // unix timestamp
  executesAt: number        // unix timestamp (createdAt + delay)
  status: 'pending' | 'approved' | 'executing' | 'executed' | 'cancelled'
}
```

**Visual Layout** (3 severity levels):

**Pending (not yet threshold met)**:
```
+-- warning variant -----------------------------------------------+
| [!] Recovery Proposal Active                                      |
| Guardian 0xabc...def proposed new owner 0x123...789.              |
| Approved: 40/60 weight. Not yet threshold.                        |
|                                    [View Details]                 |
+-------------------------------------------------------------------+
```

**Approved (threshold met, timelock counting)**:
```
+-- error variant -------------------------------------------------+
| [!!!] Recovery Will Execute in 2d 14h 30m                         |
| New owner: 0x123...789  |  Approved weight: 70/60                 |
| If unauthorized, cancel immediately.                              |
|                          [View Details] [Cancel Recovery]         |
+-------------------------------------------------------------------+
```

**Imminent (< 1 hour remaining)**:
```
+-- critical (pulsing) -------------------------------------------+
| ACCOUNT OWNERSHIP TRANSFER IN 47 MINUTES                         |
| New owner: 0x123...789                                            |
| [CANCEL NOW]                                                      |
+-------------------------------------------------------------------+
```

- Uses the existing `InfoBanner` patterns for consistent styling
- When imminent, adds a pulsing animation via `animate-pulse` class
- Background colors: warning -> `rgb(var(--warning) / 0.1)`, error -> `rgb(var(--destructive) / 0.1)`

**Accessibility**: Uses `role="alert"` and `aria-live="assertive"` for the imminent variant.

---

### 4.10 RecoveryProposalCard

**Purpose**: Detailed view of a single recovery proposal with approval progress and actions.

**File**: `/apps/web/components/recovery/RecoveryProposalCard.tsx`

**Props**:
```typescript
interface RecoveryProposalCardProps {
  proposal: RecoveryProposal
  guardians: GuardianInfo[]
  approvals: Array<{ guardian: Address; weight: number; approved: boolean }>
  isOwner: boolean
  onCancel?: () => void
  onExecute?: () => void
  isCancelling?: boolean
  isExecuting?: boolean
}
```

**Visual Layout**:
```
+-- Card ----------------------------------------------------------+
| Proposal #1                                    Status: APPROVED   |
|                                                                    |
| +-- Info Grid --------------------------------------------------+ |
| | New Owner:    0xNewOwner123...abc                              | |
| | Proposed by:  Alice (0xGuardian1...def)                       | |
| | Created:      Feb 14, 2026 at 3:45 PM                        | |
| +--------------------------------------------------------------+ |
|                                                                    |
| Approval Progress                                                  |
| WeightBar: [============>------] 40 / 60 required                 |
|                                                                    |
| Guardian Votes                                                     |
| +--------------------------------------------------------------+ |
| | [check] Alice    weight 30    Approved                        | |
| | [check] Bob      weight 10    Approved                        | |
| | [clock] Carol    weight 30    Not yet voted                   | |
| +--------------------------------------------------------------+ |
|                                                                    |
| Timelock                                                           |
| TimelockCountdown: Executes in 2d 14h 30m 15s                    |
| [progress bar: =====>-----------]                                 |
|                                                                    |
| +-- Actions ---------------------------------------------------+ |
| | [Cancel Recovery] (owner only, danger variant)                | |
| | [Execute Recovery] (if timelock expired, primary variant)     | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

### 4.11 TimelockCountdown

**Purpose**: Live countdown timer showing time remaining before recovery executes.

**File**: `/apps/web/components/recovery/TimelockCountdown.tsx`

**Props**:
```typescript
interface TimelockCountdownProps {
  executesAt: number  // unix timestamp
  onExpired?: () => void
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  createdAt?: number  // for progress bar calculation
}
```

**State**: Uses `useEffect` with `setInterval` (1 second) to update remaining time.

**Visual Layout**:
```
sm: "2d 14h 30m"
md: "Executes in 2 days, 14 hours, 30 minutes"
lg: +-- Countdown Grid --+
    | 2     14     30    15  |
    | days  hrs    min   sec |
    +------------------------+
    [progress bar below]
```

**Behavior**:
- Updates every second when remaining time < 1 hour
- Updates every minute when remaining time > 1 hour
- Fires `onExpired` callback when countdown reaches zero
- Changes color from `--muted-foreground` to `--warning` at < 24 hours, to `--destructive` at < 1 hour

**Accessibility**: `aria-live="polite"`, changes to `aria-live="assertive"` when < 1 hour. `role="timer"`.

---

### 4.12 GuardianDashboard

**Purpose**: Main view for `/recovery/guardian` showing accounts the connected wallet is a guardian for.

**File**: `/apps/web/components/recovery/GuardianDashboard.tsx`

**Props**:
```typescript
interface GuardianDashboardProps {
  // Uses hooks internally
}
```

**State**: Uses `useRecoveryModule` to query which accounts have the connected address as a guardian.

**Visual Layout**:
```
+-- PageHeader ---------------------------------------------------+
| Title: "Guardian Dashboard"                                      |
| Description: "Accounts you help protect"                        |
+------------------------------------------------------------------+

+-- InfoBanner (info) --------------------------------------------+
| As a guardian, you can help account owners recover access        |
| if they lose their keys. Only approve recovery for people       |
| you have personally verified need help.                         |
+------------------------------------------------------------------+

+-- GuardianAccountCard list (or empty state) --------------------+
| (see 4.13)                                                      |
+------------------------------------------------------------------+
```

**Empty State**:
```
+-- Empty State ---------------------------------------------------+
| [Shield with people icon]                                        |
| "No accounts to protect"                                         |
| "When someone adds you as a guardian, their account              |
|  will appear here."                                              |
+------------------------------------------------------------------+
```

**Not Connected State**: Uses the `ConnectWalletCard` component.

---

### 4.13 GuardianAccountCard

**Purpose**: Card showing a single account the guardian protects.

**File**: `/apps/web/components/recovery/GuardianAccountCard.tsx`

**Props**:
```typescript
interface GuardianAccountCardProps {
  account: Address
  label?: string
  yourWeight: number
  threshold: number
  totalWeight: number
  activeProposal?: RecoveryProposal
  onView: () => void
  onProposeRecovery: () => void
  onVote?: () => void
}
```

**Visual Layout**:
```
+-- Card (hover) -------------------------------------------------+
| Account: 0xOwner1234...abcd                                      |
| [optional label: "Alice's wallet"]                               |
|                                                                    |
| Your weight: 30 / Threshold: 60 / Total: 90                      |
| WeightBar (sm): [=====>--------]                                  |
|                                                                    |
| Status: [green badge: "No active proposals"]                      |
|    OR   [yellow badge: "Recovery proposed"]                        |
|    OR   [red badge: "Recovery executing"]                          |
|                                                                    |
|                        [Propose Recovery] or [Vote]               |
+------------------------------------------------------------------+
```

---

### 4.14 ProposeRecoveryModal

**Purpose**: Modal for a guardian to propose recovery (new owner) for an account.

**File**: `/apps/web/components/recovery/ProposeRecoveryModal.tsx`

**Props**:
```typescript
interface ProposeRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  accountAddress: Address
  onSubmit: (newOwner: Address) => Promise<void>
  isSubmitting: boolean
}
```

**Visual Layout**:
```
+-- Modal (size="md") -------------------------------------------+
| Title: "Propose Account Recovery"                              |
|                                                                 |
| +-- InfoBanner (warning) ------------------------------------+|
| | This action proposes transferring ownership of account       ||
| | 0xOwner...abc. Only proceed if you have confirmed the       ||
| | legitimate owner has lost access to their keys.             ||
| +------------------------------------------------------------+|
|                                                                 |
| Account to recover:                                             |
| 0xOwner1234...abcdef (monospace, full display)                 |
|                                                                 |
| New Owner Address                                               |
| [0x... input]                                                   |
| "The address that will become the new owner"                   |
|                                                                 |
| +-- InfoBanner (error) --------------------------------------+|
| | WARNING: Proposing recovery for an account whose owner has  ||
| | not actually lost access is a serious breach of trust and   ||
| | may have legal consequences.                                ||
| +------------------------------------------------------------+|
|                                                                 |
| [x] I confirm the legitimate owner has lost access             |
|     and has asked me to initiate recovery.                     |
|                                                                 |
|                           [Cancel] [Propose Recovery]          |
+-----------------------------------------------------------------+
```

**Validation**:
- New owner address: Required, valid Ethereum address
- Confirmation checkbox must be checked to enable submit button

---

### 4.15 VoteRecoveryModal

**Purpose**: Modal for a guardian to approve or reject an existing recovery proposal.

**File**: `/apps/web/components/recovery/VoteRecoveryModal.tsx`

**Props**:
```typescript
interface VoteRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  proposal: RecoveryProposal
  yourWeight: number
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  isSubmitting: boolean
}
```

**Visual Layout**:
```
+-- Modal (size="md") -------------------------------------------+
| Title: "Vote on Recovery Proposal"                             |
|                                                                 |
| Proposal Details:                                               |
| Account:    0xOwner...abc                                       |
| New Owner:  0xNewOwner...def                                    |
| Proposed by: 0xGuardian...ghi                                   |
|                                                                 |
| Current Progress:                                               |
| WeightBar: [======>--------] 40 / 60 required                  |
|                                                                 |
| Your vote: Weight 30                                            |
| If you approve, progress becomes: 70 / 60 (threshold met)      |
|                                                                 |
|                           [Reject] [Approve]                   |
+-----------------------------------------------------------------+
```

---

### 4.16 EmptyGuardianState

**Purpose**: Reusable empty state for when no guardians are configured.

**File**: `/apps/web/components/recovery/EmptyGuardianState.tsx`

**Props**:
```typescript
interface EmptyGuardianStateProps {
  onAddGuardian: () => void
  variant?: 'setup' | 'management'  // different copy for first-time vs managing
}
```

**Visual Layout**: Follows the exact pattern from `SessionKeyList` empty state -- dashed border box, centered icon, heading, description, CTA button.

---

## 5. State Management

### 5.1 Hook: useRecoveryModule

**File**: `/apps/web/hooks/useRecoveryModule.ts`

This is the single source of truth for all recovery module state. It follows the pattern established by `useSessionKey` and `useModule`.

```typescript
interface UseRecoveryModuleReturn {
  // Module status
  isInstalled: boolean
  isLoading: boolean
  error: string | null
  clearError: () => void

  // Guardian data
  guardians: GuardianInfo[]
  totalWeight: number
  threshold: number
  delay: number  // seconds

  // Proposals
  proposals: RecoveryProposal[]
  activeProposal: RecoveryProposal | null

  // Guardian role (for connected wallet as guardian of other accounts)
  protectedAccounts: ProtectedAccount[]

  // Owner actions
  addGuardian: (address: Address, weight: number) => Promise<Hash>
  removeGuardian: (address: Address) => Promise<Hash>
  changeThreshold: (newThreshold: number) => Promise<Hash>
  changeDelay: (newDelay: number) => Promise<Hash>
  cancelRecovery: (proposalId: string) => Promise<Hash>

  // Guardian actions
  proposeRecovery: (account: Address, newOwner: Address) => Promise<Hash>
  approveRecovery: (account: Address, proposalId: string) => Promise<Hash>
  executeRecovery: (account: Address, proposalId: string) => Promise<Hash>

  // Init data encoding (for installation)
  encodeInitData: (config: {
    guardians: Address[]
    weights: number[]
    threshold: number
    delay: number
  }) => Hex

  // Loading states for individual actions
  isAddingGuardian: boolean
  isRemovingGuardian: boolean
  isChangingThreshold: boolean
  isChangingDelay: boolean
  isCancellingRecovery: boolean
  isProposingRecovery: boolean
  isApprovingRecovery: boolean
  isExecutingRecovery: boolean

  // Refresh
  refresh: () => Promise<void>
}
```

### 5.2 Local Storage for Guardian Labels

Guardian labels (friendly names) are not stored on-chain. They are stored in localStorage.

```typescript
// Key: `stablenet_guardian_labels_${accountAddress}`
// Value: Record<Address, string>

interface GuardianLabelStore {
  getLabel: (accountAddress: Address, guardianAddress: Address) => string | undefined
  setLabel: (accountAddress: Address, guardianAddress: Address, label: string) => void
  removeLabel: (accountAddress: Address, guardianAddress: Address) => void
}
```

### 5.3 Global Recovery Alert State

The `RecoveryStatusBanner` needs to be visible across pages. This is achieved via the `useRecoveryModule` hook checking for active proposals on mount, and a context provider that makes the active proposal available globally.

```typescript
// In providers/RecoveryAlertProvider.tsx
interface RecoveryAlertContext {
  activeProposal: RecoveryProposal | null
  isChecking: boolean
  dismiss: () => void  // temporary dismiss until next page load
}
```

This provider wraps the app layout and polls for active proposals periodically (every 30 seconds when on recovery pages, every 5 minutes on other pages).

---

## 6. Data and API Integration

### 6.1 Contract Read Calls

| Function | When Called | Caching |
|----------|-----------|---------|
| `getGuardians()` | Page mount, after mutations | Invalidate on mutation |
| `getThreshold()` | Page mount, after threshold change | Invalidate on mutation |
| `getDelay()` | Page mount, after delay change | Invalidate on mutation |
| `getProposals()` | Page mount, periodic poll (30s) | Short TTL |
| `getProposal(id)` | Viewing proposal detail | Invalidate on vote/cancel |

### 6.2 Contract Write Calls

| Action | Contract Function | Confirmation Flow |
|--------|------------------|-------------------|
| Install module | `installModule(1, addr, initData)` | Modal step indicator |
| Add guardian | `addGuardian(guardian, weight)` via self-call | Toast loading -> success |
| Remove guardian | `removeGuardian(guardian)` via self-call | ConfirmModal -> Toast |
| Change threshold | `changeThreshold(newThreshold)` via self-call | Modal -> Toast |
| Change delay | `changeDelay(newDelay)` via self-call | Modal -> Toast |
| Propose recovery | `proposeRecovery(newOwner, signatures)` | Modal with confirmation |
| Cancel recovery | `cancelRecovery(proposalId)` via self-call | ConfirmModal -> Toast |
| Execute recovery | `executeRecovery(proposalId)` | ConfirmModal -> Toast |

All write calls follow the existing pattern:
1. Encode function data using viem `encodeFunctionData`
2. Build self-call (to: smartAccountAddress, data: encoded, value: 0n)
3. Send via the StableNet bundler/paymaster infrastructure
4. Show loading toast -> update to success/error toast

### 6.3 Transaction Feedback Pattern

Follows existing toast pattern from `useToast`:
```typescript
const toastId = addToast({ type: 'loading', title: 'Adding Guardian', persistent: true })
try {
  const hash = await addGuardian(address, weight)
  updateToast(toastId, { type: 'success', title: 'Guardian Added', txHash: hash, persistent: false })
} catch (err) {
  updateToast(toastId, { type: 'error', title: 'Failed to Add Guardian', message: err.message, persistent: false })
}
```

---

## 7. Wire-frame Descriptions

### 7.1 Social Recovery Setup Form (inside InstallModuleModal)

```
+-- InstallModuleModal (existing shell) -------------------------+
| Install Social Recovery                                [X]     |
| +---------------------------------------------------------+    |
| | [Validator] v1.0.0 by StableNet                         |    |
| | Recover account access using trusted guardians...       |    |
| | Contract: 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0   |    |
| +---------------------------------------------------------+    |
|                                                                 |
| Configuration                                                   |
| +---------------------------------------------------------+    |
| | Step: (1)----(2)----(3)----(4)                          |    |
| |       edu    guard  thresh review                       |    |
| |                                                         |    |
| | [Current step content rendered here]                    |    |
| |                                                         |    |
| +---------------------------------------------------------+    |
|                                                                 |
|                              [Cancel] [Back] [Next/Install]    |
+-----------------------------------------------------------------+
```

### 7.2 Recovery Management Page (/settings/recovery)

Desktop layout (> 768px):
```
+-- Content Area (within existing layout shell) ------------------+
|                                                                  |
| < Settings > Security > Recovery    [breadcrumb]                 |
| Recovery Settings                                                |
| Manage your social recovery guardians and settings              |
|                                                                  |
| [RecoveryStatusBanner - only if active proposal]                 |
|                                                                  |
| +-- Stats (2x2 grid) ----------------------------------------+  |
| | +--Guardians--+ +--Threshold--+ +--Timelock--+ +--Proposals+ |
| | |     3       | |   60/90     | |   3 days   | |     0     | |
| | +-------------+ +-------------+ +------------+ +-----------+ |
| +-------------------------------------------------------------+  |
|                                                                  |
| Guardians (3)                              [+ Add Guardian]     |
| +-------------------------------------------------------------+  |
| | [Avatar] Alice  0xabc...def  Wt:30  33%    [Edit] [Remove] | |
| | [Avatar] Bob    0x123...789  Wt:30  33%    [Edit] [Remove] | |
| | [Avatar] Carol  0x456...012  Wt:30  33%    [Edit] [Remove] | |
| +-------------------------------------------------------------+  |
|                                                                  |
| Configuration                                                    |
| +-------------------------------------------------------------+  |
| | Threshold    60 of 90 total weight            [Change]      | |
| | Timelock     3 days (259,200 seconds)         [Change]      | |
| +-------------------------------------------------------------+  |
|                                                                  |
| [info] Are you a guardian for other accounts?                   |
|        View your guardian duties ->                              |
|                                                                  |
| Danger Zone                                                      |
| +-------------------------------------------------------------+  |
| | Uninstall Social Recovery Module                             | |
| | Removes all guardians and disables recovery.                 | |
| |                                          [Uninstall Module]  | |
| +-------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

Mobile layout (< 768px):
- Stats become single column (4 rows)
- Guardian cards become full-width stacked cards
- Action buttons become full-width below each card
- Breadcrumb collapses to back arrow + "Recovery"

### 7.3 Guardian Dashboard (/recovery/guardian)

```
+-- Content Area -------------------------------------------------+
|                                                                  |
| Guardian Dashboard                                               |
| Accounts you help protect                                       |
|                                                                  |
| +-- InfoBanner (info) ----------------------------------------+  |
| | As a guardian, you can help account owners recover access    | |
| | if they lose their keys. Verify identity before approving.  | |
| +-------------------------------------------------------------+  |
|                                                                  |
| Protected Accounts (2)                                           |
| +-------------------------------------------------------------+  |
| | Account: 0xOwner1...abc                                      | |
| | Your weight: 30 / Threshold: 60                              | |
| | [==========>--------] 30/90                                  | |
| | Status: [green] No active proposals                          | |
| |                               [Propose Recovery]             | |
| +-------------------------------------------------------------+  |
| | Account: 0xOwner2...def                                      | |
| | Your weight: 20 / Threshold: 50                              | |
| | [=====>-----------] 20/80                                    | |
| | Status: [yellow] Recovery proposed (40/50)                   | |
| |                               [Vote]                         | |
| +-------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## 8. Security UX

### 8.1 Dangerous Action Confirmations

All dangerous actions use the existing `ConfirmModal` component with appropriate variants:

| Action | Variant | Confirm Text | Description |
|--------|---------|-------------|-------------|
| Remove guardian | danger | "Remove Guardian" | "Removing {name} reduces your total weight from {X} to {Y}. If this puts total weight below your threshold, recovery becomes impossible." |
| Cancel recovery | warning | "Cancel Recovery" | "Cancel this recovery proposal? Guardians will need to start a new proposal." |
| Propose recovery | danger | "Propose Recovery" | "You are proposing to transfer ownership. Only proceed if you have verified the owner has lost access." |
| Uninstall module | danger | "Uninstall Module" | "This permanently removes social recovery protection. All guardians will be removed." |
| Execute recovery | danger | "Execute Recovery" | "This will permanently transfer account ownership to {address}. This cannot be undone." |

### 8.2 Guardian Trust Warnings

Displayed in multiple locations:

**During Setup (Step 1: Education)**:
```
InfoBanner variant="warning":
"Guardians have the power to change ownership of your account.
Only add addresses belonging to people you trust completely --
family members, close friends, or professional custodians.
Never add addresses you do not control or cannot verify."
```

**When Adding a Guardian**:
```
InfoBanner variant="warning":
"Only add addresses controlled by people you trust completely.
Guardians can initiate account recovery, which transfers
ownership of your account."
```

**When Proposing Recovery (Guardian Side)**:
```
InfoBanner variant="error":
"WARNING: Proposing recovery for an account whose owner has
not actually lost access is a serious breach of trust.
Only proceed after personally verifying the owner needs help."
```

### 8.3 Timelock Countdown Display

The timelock is the owner's last line of defense. Display it prominently:

- When a proposal is approved and in timelock, show `TimelockCountdown` in:
  1. `RecoveryStatusBanner` (global, all pages)
  2. `RecoveryProposalCard` (on recovery settings page)
  3. `GuardianAccountCard` (on guardian dashboard)

- Color progression:
  - `> 24 hours`: `rgb(var(--muted-foreground))` -- calm, informational
  - `1-24 hours`: `rgb(var(--warning))` -- attention needed
  - `< 1 hour`: `rgb(var(--destructive))` + `animate-pulse` -- urgent

### 8.4 Recovery Status Indicators

Status badges used throughout the interface:

| Status | Badge Color | Text |
|--------|------------|------|
| No proposals | `--success` bg | "Protected" |
| Proposal pending (below threshold) | `--warning` bg | "Recovery Proposed" |
| Proposal approved (timelock running) | `--destructive` bg | "Recovery Approved" |
| Proposal executing (timelock expired) | `--destructive` bg, pulsing | "Executing" |
| Proposal cancelled | `--muted-foreground` bg | "Cancelled" |
| Recovery executed | `--info` bg | "Ownership Transferred" |

### 8.5 Anti-Phishing Measures

- When proposing recovery, display the full account address (not truncated) in the confirmation
- When executing recovery, display the full new owner address (not truncated)
- When adding a guardian, show a checksum-formatted address for verification
- Never auto-fill the "new owner" address field from URL parameters or external sources

---

## 9. Accessibility

### 9.1 Keyboard Navigation

| Component | Keys | Behavior |
|-----------|------|----------|
| GuardianList | Tab | Moves focus through guardian cards and action buttons |
| GuardianCard | Enter/Space on Edit | Opens edit modal |
| GuardianCard | Enter/Space on Remove | Opens confirm modal |
| WeightBar | (read-only) | Announced via aria attributes |
| Step Indicator | Tab | Moves between steps, Enter activates completed steps |
| Modal forms | Tab | Sequential field navigation, Enter submits, Escape closes |
| TimelockCountdown | (live region) | Automatically announced at intervals |
| RecoveryStatusBanner | Tab to buttons | Enter/Space activates View Details or Cancel |
| Preset buttons (delay, threshold) | Tab + Enter/Space | Selects preset, provides visual + aria feedback |

All modals trap focus within them (already implemented in `Modal.tsx`). Escape key closes modal (already implemented).

### 9.2 Screen Reader Support

**ARIA Roles and Labels**:
- `WeightBar`: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label="Recovery weight: 60 out of 90 total, threshold is 60"`
- `TimelockCountdown`: `role="timer"`, `aria-live="polite"` (switches to `"assertive"` at < 1 hour), `aria-label="Recovery executes in 2 days, 14 hours, 30 minutes"`
- `RecoveryStatusBanner`: `role="alert"`, `aria-live="assertive"` for imminent variant
- `GuardianCard`: `role="article"`, `aria-label="Guardian Alice, address 0xabc...def, weight 30 out of 90 total"`
- Step indicator: `role="navigation"`, `aria-label="Setup progress"`, each step has `aria-current="step"` when active
- Guardian vote status icons: Hidden from screen readers (`aria-hidden="true"`), with text alternatives in adjacent spans

**Live Regions**:
- `TimelockCountdown` updates announced every minute (every second when < 1 minute)
- `RecoveryStatusBanner` appearance announced as alert
- Toast notifications already use live regions (existing implementation)

**Form Labeling**:
- All inputs use the existing `Input` component which connects `label` to `htmlFor`/`id`
- Error messages are connected via `aria-describedby` (need to add to existing `Input` component)
- Hint text is connected via `aria-describedby`

### 9.3 Color Contrast

All color combinations follow the existing design system which targets WCAG 2.1 AA:

| Element | Foreground | Background | Approximate Ratio |
|---------|-----------|------------|-------------------|
| Body text | `--foreground` (#FFF) | `--background` (#0E0E12) | >15:1 |
| Muted text | `--muted-foreground` (#71717A) | `--background` (#0E0E12) | ~4.8:1 |
| Muted text | `--muted-foreground` (#71717A) | `--card` (#18181C) | ~4.5:1 |
| Error text | `--destructive` (#F87171) | `--background` | >5:1 |
| Success text | `--success` (#34D399) | `--background` | >7:1 |
| Warning text | `--warning` (#FBBF24) | `--background` | >10:1 |
| Primary button | `--primary-foreground` (white) | `--primary` (#7C5CFC) | ~4.6:1 |

The muted text on card background is close to the 4.5:1 minimum. For critical information (guardian addresses, weights, status), always use `--foreground` color, not `--muted-foreground`.

### 9.4 Focus Indicators

All interactive elements use the existing `focus:ring-2 focus:ring-offset-2` pattern from the Button component. Custom interactive elements (preset buttons, guardian cards) must also include visible focus indicators:

```css
focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))] focus:ring-offset-2
```

---

## 10. Edge Cases and Error Handling

### 10.1 Module State Edge Cases

| Scenario | Handling |
|----------|---------|
| Module not installed | `/settings/recovery` shows "Module not installed" card with link to marketplace. SecuritySettingsCard shows "Setup" button. |
| Module installed but no guardians | Show EmptyGuardianState with "Add your first guardian" CTA. |
| Module installed, 0 threshold | Should not happen (validation prevents it), but if encountered, show error banner: "Invalid configuration: threshold is 0." |
| Threshold > total weight | Show warning: "Your threshold ({X}) exceeds total guardian weight ({Y}). Recovery is currently impossible. Add more guardians or lower threshold." |
| Only 1 guardian | Show info banner: "You have only one guardian. Consider adding more for better security." |
| Guardian removes themselves (via contract directly) | Refresh detects the change, guardian disappears from list, toast notification. |

### 10.2 Transaction Edge Cases

| Scenario | Handling |
|----------|---------|
| Transaction rejected by user | Toast: "Transaction cancelled." Reset modal loading state. |
| Transaction reverted on-chain | Toast (error): "Transaction failed: {revert reason}." Keep modal open for retry. |
| Network error during submission | Toast (error): "Network error. Check your connection and try again." Keep modal open. |
| Gas estimation fails | Toast (error): "Unable to estimate gas. The transaction may fail." Allow retry. |
| Insufficient funds for gas | Toast (error): "Insufficient funds for gas. Please add ETH to your account." |
| Module already installed | Marketplace "Install" button should be disabled. If somehow reached, show error: "Module already installed." |
| Adding guardian that already exists | Form validation catches this before submission: "This address is already a guardian." |
| Removing last guardian | ConfirmModal with extra warning: "This will leave you with no guardians. Recovery will be impossible until you add new ones." |
| Changing threshold while proposal active | Warning: "There is an active recovery proposal. Changing the threshold may affect it." |

### 10.3 Timing Edge Cases

| Scenario | Handling |
|----------|---------|
| Timelock expires while user is on page | TimelockCountdown fires `onExpired`, UI updates to show "Ready to execute" state. |
| User views proposal that was just cancelled | Polling detects status change, card updates to "Cancelled" state. |
| Guardian votes after threshold already met | Transaction succeeds (extra weight), UI shows "Already approved" status. |
| Recovery executed between page loads | On refresh, detect new owner. Show "Ownership transferred" banner. |
| Clock skew between client and chain | Use block timestamp from last fetched data, not client Date.now(), for timelock calculations. |

### 10.4 Data Loading Edge Cases

| Scenario | Handling |
|----------|---------|
| Slow RPC response | Show skeleton loading states for all data-dependent components. |
| RPC endpoint unreachable | Show error banner: "Unable to connect to the network. Some data may be outdated." Fall back to cached data if available. |
| Guardian label missing from localStorage | Show truncated address only, no label. |
| localStorage full | Silently fail to save labels, no error shown (labels are optional convenience). |
| Multiple browser tabs | Each tab polls independently. Actions in one tab reflect in others on next poll cycle. |

### 10.5 Guardian Role Edge Cases

| Scenario | Handling |
|----------|---------|
| Connected wallet is both owner and guardian of same account | Show both perspectives. Management page for owner role, guardian dashboard shows the account but with note "You are the owner of this account." |
| Guardian for an account that uninstalls module | Account disappears from guardian dashboard on next refresh. |
| Guardian address is a smart contract (not EOA) | Allowed. The contract must be able to sign transactions. Show info: "This guardian is a smart contract." |
| Guardian proposes recovery for wrong account | Each proposal is account-specific. The modal confirms which account is being recovered. |

---

## Appendix A: File Listing Summary

New files to create:

```
apps/web/
  components/recovery/
    index.ts
    SocialRecoveryForm.tsx
    RecoveryManagementPage.tsx
    GuardianList.tsx
    GuardianCard.tsx
    GuardianFormModal.tsx
    ThresholdConfigModal.tsx
    TimelockConfigModal.tsx
    WeightBar.tsx
    RecoveryStatusBanner.tsx
    RecoveryProposalCard.tsx
    RecoveryProposalList.tsx
    GuardianDashboard.tsx
    GuardianAccountCard.tsx
    ProposeRecoveryModal.tsx
    VoteRecoveryModal.tsx
    TimelockCountdown.tsx
    RecoveryConfirmUninstall.tsx
    EmptyGuardianState.tsx

  app/
    settings/recovery/page.tsx
    recovery/guardian/page.tsx
    recovery/guardian/[account]/page.tsx

  hooks/
    useRecoveryModule.ts

  providers/
    RecoveryAlertProvider.tsx
```

Files to modify:

```
  components/marketplace/InstallModuleModal.tsx
    -- Add SocialRecoveryForm to the switch statement (replace DefaultInitDataForm)

  components/settings/cards/SecuritySettingsCard.tsx
    -- Update Social Recovery row: dynamic status, navigate to /settings/recovery

  components/layout/Sidebar.tsx
    -- (No changes needed; recovery is under settings, not a top-level nav item)

  providers/index.tsx
    -- Add RecoveryAlertProvider to the provider tree

  hooks/index.ts
    -- Export useRecoveryModule
```

## Appendix B: Component Dependency Graph

```
RecoveryManagementPage
  +-- PageHeader (existing)
  +-- RecoveryStatusBanner
  |     +-- TimelockCountdown
  |     +-- Button (existing)
  +-- StatCard (existing, x4)
  +-- GuardianList
  |     +-- GuardianCard (xN)
  |     |     +-- Button (existing)
  |     +-- GuardianFormModal
  |     |     +-- Modal (existing)
  |     |     +-- Input (existing)
  |     |     +-- InfoBanner (existing)
  |     |     +-- Button (existing)
  |     +-- ConfirmModal (existing, for remove)
  |     +-- EmptyGuardianState
  +-- Card (existing, for config section)
  +-- ThresholdConfigModal
  |     +-- Modal (existing)
  |     +-- WeightBar
  |     +-- Input (existing)
  |     +-- InfoBanner (existing)
  +-- TimelockConfigModal
  |     +-- Modal (existing)
  |     +-- Input (existing)
  |     +-- InfoBanner (existing)
  +-- RecoveryProposalList
  |     +-- RecoveryProposalCard (xN)
  |           +-- WeightBar
  |           +-- TimelockCountdown
  |           +-- Button (existing)
  +-- InfoBanner (existing, guardian link)
  +-- RecoveryConfirmUninstall
        +-- ConfirmModal (existing)

GuardianDashboard
  +-- PageHeader (existing)
  +-- InfoBanner (existing)
  +-- GuardianAccountCard (xN)
  |     +-- WeightBar
  |     +-- Button (existing)
  +-- ProposeRecoveryModal
  |     +-- Modal (existing)
  |     +-- Input (existing)
  |     +-- InfoBanner (existing)
  +-- VoteRecoveryModal
  |     +-- Modal (existing)
  |     +-- WeightBar
  |     +-- Button (existing)
  +-- ConnectWalletCard (existing, for not-connected state)
  +-- EmptyGuardianState

SocialRecoveryForm (in InstallModuleModal)
  +-- Input (existing)
  +-- InfoBanner (existing)
  +-- WeightBar
  +-- EmptyGuardianState (inline variant)
  +-- Button (existing)

RecoveryAlertProvider (wraps app)
  +-- RecoveryStatusBanner (rendered conditionally via portal)
```

## Appendix C: Design Token Usage Reference

All new components use the existing CSS variable system. No new tokens are needed.

| Purpose | Token | Example Value (Dark) |
|---------|-------|---------------------|
| Card background | `--card` | #18181C |
| Elevated surface | `--card-hover` | #202126 |
| Primary actions | `--primary` | #7C5CFC |
| Danger states | `--destructive` | #F87171 |
| Success states | `--success` | #34D399 |
| Warning states | `--warning` | #FBBF24 |
| Info states | `--info` | #60A5FA |
| Borders | `--border` | #202126 |
| Body text | `--foreground` | #FFFFFF |
| Secondary text | `--muted-foreground` | #71717A |
| Background | `--background` | #0E0E12 |
| Secondary bg | `--secondary` | #202126 |

All colors are applied via inline `style` using `rgb(var(--token))` syntax, matching the existing codebase convention. Tailwind utility classes are used for spacing, layout, and typography. This dual approach is consistent with every existing component in the project.
