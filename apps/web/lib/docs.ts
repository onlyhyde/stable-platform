/**
 * Documentation content and structure
 */

export interface DocSection {
  title: string
  slug: string
  description: string
  icon: string
  articles: DocArticle[]
}

export interface DocArticle {
  title: string
  slug: string
  description: string
  content: string
}

export const docSections: DocSection[] = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    description: 'Learn the basics of StableNet',
    icon: 'rocket',
    articles: [
      {
        title: 'Introduction',
        slug: 'introduction',
        description: 'What is StableNet and how does it work?',
        content: `
# Introduction to StableNet

StableNet is a next-generation smart account platform built on ERC-4337 (Account Abstraction). It provides a seamless Web3 experience with features like gas sponsorship, session keys, and recurring payments.

## Key Features

- **Smart Accounts**: ERC-4337 compatible accounts with enhanced security
- **Gas Sponsorship**: Pay gas fees for your users with paymasters
- **Session Keys**: Temporary permissions for seamless dApp interactions
- **Recurring Payments**: Automated subscription and payment management
- **Stealth Addresses**: Privacy-preserving transactions

## Architecture

StableNet uses the Kernel smart account implementation, which is modular and upgradeable. This allows for:

1. Custom validation logic
2. Plugin-based functionality
3. Batch transactions
4. Social recovery options
        `,
      },
      {
        title: 'Quick Start',
        slug: 'quick-start',
        description: 'Get up and running in 5 minutes',
        content: `
# Quick Start Guide

Get started with StableNet in just a few steps.

## Prerequisites

- A Web3 wallet (MetaMask, Rabby, etc.)
- Some testnet ETH for gas fees

## Step 1: Connect Your Wallet

Click the "Connect Wallet" button in the top right corner and select your preferred wallet.

## Step 2: Deploy Your Smart Account

Navigate to the Smart Account page and click "Deploy Account". This will create your ERC-4337 smart account.

## Step 3: Fund Your Account

Transfer some ETH to your smart account address to start using the platform.

## Step 4: Explore Features

- Try sending a transaction with gas sponsorship
- Create a session key for a dApp
- Set up a recurring payment

## Next Steps

- Learn about [Smart Accounts](/docs/smart-account/overview)
- Explore [Payment Features](/docs/payment/overview)
- Understand [Security Best Practices](/docs/security/best-practices)
        `,
      },
    ],
  },
  {
    title: 'Smart Account',
    slug: 'smart-account',
    description: 'ERC-4337 smart account features',
    icon: 'shield',
    articles: [
      {
        title: 'Overview',
        slug: 'overview',
        description: 'Understanding smart accounts',
        content: `
# Smart Account Overview

Smart accounts are the foundation of StableNet. They provide enhanced security and functionality compared to traditional EOA (Externally Owned Account) wallets.

## What is a Smart Account?

A smart account is a smart contract that acts as your wallet. Unlike EOAs, smart accounts can:

- Execute multiple transactions atomically (batching)
- Implement custom validation logic
- Support multiple signers and recovery options
- Enable gasless transactions through paymasters

## Kernel v3

StableNet uses Kernel v3, a modular smart account implementation that supports:

- **ECDSA Validation**: Standard signature verification
- **Session Keys**: Temporary permissions with spending limits
- **Social Recovery**: Recover your account using trusted guardians
- **Plugins**: Extend functionality with custom modules

## Account Deployment

Your smart account is deployed on your first transaction. The deployment cost is included in the first transaction's gas fee.

## Security Model

Smart accounts provide better security through:

1. **Modular Validators**: Customizable validation logic
2. **Spending Limits**: Daily/weekly transaction limits
3. **Time Locks**: Delay sensitive operations
4. **Multi-sig Support**: Require multiple approvals
        `,
      },
      {
        title: 'Session Keys',
        slug: 'session-keys',
        description: 'Temporary permissions for dApps',
        content: `
# Session Keys

Session keys enable seamless dApp interactions without constant wallet popups.

## What are Session Keys?

Session keys are temporary signing keys that can perform limited actions on behalf of your account. They're perfect for:

- Gaming applications
- Trading bots
- Automated DeFi strategies
- Any scenario requiring frequent transactions

## Creating a Session Key

1. Go to Settings > Security
2. Enable "Session Keys"
3. Configure permissions:
   - Allowed contracts
   - Maximum value per transaction
   - Expiration time
   - Transaction count limit

## Security Considerations

Session keys are designed with security in mind:

- **Limited Scope**: Keys can only interact with specified contracts
- **Value Limits**: Maximum ETH/token value per transaction
- **Time Bounds**: Keys automatically expire
- **Revocable**: Revoke keys at any time from your dashboard

## Best Practices

1. Use the minimum permissions necessary
2. Set reasonable expiration times
3. Monitor session key activity
4. Revoke unused keys promptly
        `,
      },
    ],
  },
  {
    title: 'Payment',
    slug: 'payment',
    description: 'Send, receive, and manage payments',
    icon: 'credit-card',
    articles: [
      {
        title: 'Overview',
        slug: 'overview',
        description: 'Payment features and capabilities',
        content: `
# Payment Features

StableNet provides comprehensive payment functionality for both individuals and businesses.

## Core Features

### Send & Receive
- Send ETH and ERC-20 tokens
- Batch multiple transfers in one transaction
- Schedule future payments

### Gas Sponsorship
- Pay gas fees for your users
- Integrate with verifying paymasters
- Set sponsorship policies and limits

### Recurring Payments
- Create subscription plans
- Automated payment collection
- Flexible billing cycles

## Supported Tokens

StableNet supports all ERC-20 tokens. Popular options include:

- ETH (native)
- USDC
- USDT
- DAI
- WETH

## Transaction History

View all your transactions in the Activity page, including:

- Transaction status
- Gas costs (and who paid)
- Token transfers
- Smart contract interactions
        `,
      },
      {
        title: 'Subscriptions',
        slug: 'subscriptions',
        description: 'Recurring payment management',
        content: `
# Subscription Management

Create and manage recurring payments with StableNet's subscription system.

## For Merchants

### Creating a Plan
1. Navigate to Subscription > Create Plan
2. Set pricing and billing cycle
3. Configure payment token (ETH, USDC, etc.)
4. Publish your plan

### Managing Subscribers
- View active subscriptions
- Handle failed payments
- Send notifications
- Generate reports

## For Subscribers

### Subscribing to a Plan
1. Connect your wallet
2. Review plan details
3. Approve token spending
4. Confirm subscription

### Managing Subscriptions
- View active subscriptions
- Cancel anytime
- Update payment method
- View payment history

## Smart Contract Integration

The SubscriptionManager contract handles:

- Payment scheduling
- Automatic execution
- Grace periods
- Cancellation logic
        `,
      },
    ],
  },
  {
    title: 'DeFi',
    slug: 'defi',
    description: 'Decentralized finance integrations',
    icon: 'trending-up',
    articles: [
      {
        title: 'Overview',
        slug: 'overview',
        description: 'DeFi features and integrations',
        content: `
# DeFi Overview

Access decentralized finance protocols directly from StableNet.

## Available Features

### Token Swaps
- Swap between any ERC-20 tokens
- Best price routing
- MEV protection
- Slippage control

### Liquidity Provision
- Add liquidity to DEX pools
- Earn trading fees
- Manage positions

### Yield Farming
- Stake tokens in yield farms
- Auto-compound rewards
- Track APY

## Supported Protocols

StableNet integrates with major DeFi protocols:

- Uniswap v3
- Curve Finance
- Aave
- Compound
- And more...

## Risk Management

DeFi involves financial risk. Always:

1. Research protocols before using
2. Start with small amounts
3. Understand impermanent loss
4. Monitor your positions
        `,
      },
    ],
  },
  {
    title: 'Security',
    slug: 'security',
    description: 'Security best practices',
    icon: 'lock',
    articles: [
      {
        title: 'Best Practices',
        slug: 'best-practices',
        description: 'Keep your account secure',
        content: `
# Security Best Practices

Protect your StableNet account with these security measures.

## Account Security

### Private Key Management
- Never share your private key or seed phrase
- Use a hardware wallet for large amounts
- Store backups securely offline

### Session Key Safety
- Use minimal permissions
- Set short expiration times
- Revoke unused session keys
- Monitor activity regularly

### Spending Limits
- Configure daily/weekly limits
- Set per-transaction limits
- Use time locks for large transfers

## Recovery Options

### Social Recovery
Set up trusted guardians who can help recover your account:

1. Add 3-5 trusted contacts
2. Configure threshold (e.g., 3 of 5)
3. Test recovery process

### Email Recovery
Link an email for additional recovery options.

## Red Flags

Watch out for:
- Unsolicited DMs asking for keys
- Fake StableNet websites
- "Too good to be true" offers
- Urgent/pressuring messages

## Reporting Issues

If you suspect a security issue:
1. Revoke all session keys immediately
2. Transfer funds to a new account
3. Contact support
        `,
      },
    ],
  },
  {
    title: 'Developer',
    slug: 'developer',
    description: 'Integration guides and API reference',
    icon: 'code',
    articles: [
      {
        title: 'SDK Integration',
        slug: 'sdk-integration',
        description: 'Integrate StableNet SDK',
        content: `
# SDK Integration Guide

Integrate StableNet into your dApp using our SDK.

## Installation

\`\`\`bash
npm install @stablenet/sdk
\`\`\`

## Quick Start

\`\`\`typescript
import { StableNetClient } from '@stablenet/sdk'

const client = new StableNetClient({
  chainId: 31337,
  bundlerUrl: 'http://localhost:4337',
  paymasterUrl: 'http://localhost:4338',
})

// Create a smart account
const account = await client.createAccount({
  owner: walletAddress,
})

// Send a user operation
const result = await client.sendUserOp({
  account,
  calls: [{
    to: recipientAddress,
    value: parseEther('0.1'),
    data: '0x',
  }],
})
\`\`\`

## Configuration

### Network Settings

\`\`\`typescript
const config = {
  // Devnet
  chainId: 31337,
  rpcUrl: 'http://localhost:8545',
  bundlerUrl: 'http://localhost:4337',

  // Contract addresses
  entryPoint: '0x5FbDB...',
  accountFactory: '0xfaAdd...',
}
\`\`\`

## API Reference

See our full API documentation for detailed method descriptions and examples.
        `,
      },
      {
        title: 'Contract Addresses',
        slug: 'contract-addresses',
        description: 'Deployed contract addresses',
        content: `
# Contract Addresses

Reference for all deployed StableNet contracts.

## Devnet (Chain ID: 31337)

| Contract | Address |
|----------|---------|
| EntryPoint | \`0x5FbDB2315678afecb367f032d93F642f64180aa3\` |
| Account Factory | \`0xfaAddC93baf78e89DCf37bA67943E1bE8F37Bb8c\` |
| Paymaster | \`0x2dd78fd9b8f40659af32ef98555b8b31bc97a351\` |
| Session Key Manager | \`0x4a679253410272dd5232B3Ff7cF5dbB88f295319\` |
| Subscription Manager | \`0x9d4454B023096f34B160D6B654540c56A1F81688\` |

## Testnet (Chain ID: 11155111)

| Contract | Address |
|----------|---------|
| EntryPoint (v0.7) | \`0x0000000071727De22E5E9d8BAf0edAc6f37da032\` |

## Updating Addresses

You can update contract addresses in Settings > Developer without restarting the app.

## Verifying Contracts

All contracts are verified on block explorers. You can view source code and interact directly.
        `,
      },
    ],
  },
]

export function getDocSection(slug: string): DocSection | undefined {
  return docSections.find((section) => section.slug === slug)
}

export function getDocArticle(sectionSlug: string, articleSlug: string): DocArticle | undefined {
  const section = getDocSection(sectionSlug)
  return section?.articles.find((article) => article.slug === articleSlug)
}

export function getAllArticles(): Array<{ section: DocSection; article: DocArticle }> {
  return docSections.flatMap((section) => section.articles.map((article) => ({ section, article })))
}
