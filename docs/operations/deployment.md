# StableNet Deployment Guide

> **Version**: 1.0.0
> **Last Updated**: 2026-01-27

## Overview

이 문서는 StableNet 인프라의 배포 및 설정 방법을 설명합니다.

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Storage | 100 GB SSD | 500 GB NVMe |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- Node.js 20.x LTS
- Go 1.21+
- Docker 24.x
- Docker Compose 2.x
- PostgreSQL 15+ (production)
- Redis 7+ (optional, caching)

### Network Requirements

- Ethereum RPC endpoint (Infura, Alchemy, or self-hosted)
- WebSocket support for event monitoring
- Public IP for bundler/paymaster services

---

## Quick Start (Development)

### 1. Clone Repository

```bash
git clone https://github.com/stablenet/stable-platform.git
cd stable-platform
```

### 2. Install Dependencies

```bash
# Install pnpm if not available
npm install -g pnpm

# Install all dependencies
pnpm install
```

### 3. Environment Setup

```bash
# Copy example environment files
cp .env.example .env
cp services/bundler/.env.example services/bundler/.env
cp services/paymaster-proxy/.env.example services/paymaster-proxy/.env

# Edit .env files with your configuration
```

### 4. Start Local Development

```bash
# Start all services
pnpm dev

# Or start specific services
pnpm --filter bundler dev
pnpm --filter paymaster-proxy dev
```

### 5. Run Local Blockchain

```bash
# Start Anvil (local testnet)
anvil --fork-url https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Deploy contracts
cd packages/contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

---

## Production Deployment

### Architecture Overview

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (nginx/ALB)   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ Bundler │        │Paymaster│        │  Web    │
    │ (3000)  │        │ (3001)  │        │  App    │
    └────┬────┘        └────┬────┘        └─────────┘
         │                  │
         └──────────────────┼──────────────────┐
                            │                  │
                    ┌───────▼───────┐   ┌─────▼─────┐
                    │  PostgreSQL   │   │   Redis   │
                    │   (primary)   │   │  (cache)  │
                    └───────────────┘   └───────────┘
```

### Docker Deployment

#### Build Images

```bash
# Build all services
docker compose build

# Or build specific service
docker build -t stablenet/bundler:latest -f services/bundler/Dockerfile .
```

#### Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  bundler:
    image: stablenet/bundler:latest
    environment:
      - NODE_ENV=production
      - RPC_URL=${RPC_URL}
      - ENTRY_POINT=${ENTRY_POINT}
      - PRIVATE_KEY=${BUNDLER_PRIVATE_KEY}
      - PORT=3000
    ports:
      - "3000:3000"
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  paymaster-proxy:
    image: stablenet/paymaster-proxy:latest
    environment:
      - NODE_ENV=production
      - RPC_URL=${RPC_URL}
      - PAYMASTER_ADDRESS=${PAYMASTER_ADDRESS}
      - SIGNER_PRIVATE_KEY=${PAYMASTER_SIGNER_KEY}
      - PORT=3001
    ports:
      - "3001:3001"
    restart: always

  subscription-executor:
    image: stablenet/subscription-executor:latest
    environment:
      - GIN_MODE=release
      - DATABASE_URL=${DATABASE_URL}
      - RPC_URL=${RPC_URL}
      - BUNDLER_URL=http://bundler:3000/rpc
      - PORT=3002
    depends_on:
      - bundler
      - postgres
    restart: always

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=stablenet
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: always

volumes:
  postgres_data:
  redis_data:
```

#### Start Services

```bash
# Production deployment
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose logs -f bundler

# Check status
docker compose ps
```

### Kubernetes Deployment

#### Bundler Deployment

```yaml
# k8s/bundler-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bundler
  labels:
    app: bundler
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bundler
  template:
    metadata:
      labels:
        app: bundler
    spec:
      containers:
      - name: bundler
        image: stablenet/bundler:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: RPC_URL
          valueFrom:
            secretKeyRef:
              name: stablenet-secrets
              key: rpc-url
        - name: PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: stablenet-secrets
              key: bundler-private-key
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: bundler
spec:
  selector:
    app: bundler
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

#### Ingress Configuration

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: stablenet-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - bundler.stablenet.io
    - paymaster.stablenet.io
    secretName: stablenet-tls
  rules:
  - host: bundler.stablenet.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: bundler
            port:
              number: 3000
  - host: paymaster.stablenet.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: paymaster-proxy
            port:
              number: 3001
```

---

## Environment Configuration

### Bundler

```bash
# services/bundler/.env
NODE_ENV=production
PORT=3000

# Blockchain
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=1
ENTRY_POINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Bundler Wallet
PRIVATE_KEY=0x...  # Bundler EOA private key
BENEFICIARY=0x...  # Fee recipient address

# Bundle Settings
MAX_BUNDLE_SIZE=10
BUNDLE_INTERVAL_MS=12000
MIN_BALANCE_WEI=100000000000000000  # 0.1 ETH

# Rate Limiting
RATE_LIMIT_RPS=100
RATE_LIMIT_BURST=200

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Paymaster Proxy

```bash
# services/paymaster-proxy/.env
NODE_ENV=production
PORT=3001

# Blockchain
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=1

# Paymaster
PAYMASTER_ADDRESS=0x...
SIGNER_PRIVATE_KEY=0x...  # Paymaster signer key
VALIDITY_SECONDS=300

# Policy
MAX_GAS_LIMIT=500000
DAILY_LIMIT_USD=10000
ALLOWED_CONTRACTS=0x...,0x...

# Logging
LOG_LEVEL=info
```

### Subscription Executor

```bash
# services/subscription-executor/.env
GIN_MODE=release
PORT=3002

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/stablenet?sslmode=require
USE_IN_MEMORY=false

# Blockchain
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=1
ENTRY_POINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Services
BUNDLER_URL=http://bundler:3000/rpc
PAYMASTER_URL=http://paymaster-proxy:3001

# Execution
POLLING_INTERVAL=60  # seconds

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## Smart Contract Deployment

### Prerequisites

```bash
cd packages/contracts

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Deploy to Testnet

```bash
# Load environment
source .env

# Deploy to Sepolia
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Verify deployment
forge verify-contract $CONTRACT_ADDRESS src/Contract.sol:Contract \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### Deploy to Mainnet

```bash
# Deploy with higher gas price for priority
forge script script/Deploy.s.sol \
  --rpc-url $MAINNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --with-gas-price 30gwei
```

### Update Contract Addresses

배포 후 `packages/contracts/src/addresses.ts` 업데이트:

```typescript
export const ADDRESSES = {
  1: { // mainnet
    entryPoint: '0x...',
    kernelFactory: '0x...',
    ecdsaValidator: '0x...',
    verifyingPaymaster: '0x...',
  },
  11155111: { // sepolia
    // ...
  },
}
```

---

## Database Setup

### PostgreSQL

```sql
-- Create database
CREATE DATABASE stablenet;

-- Create user
CREATE USER stablenet_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE stablenet TO stablenet_user;

-- Run migrations
psql -U stablenet_user -d stablenet -f migrations/001_initial.sql
psql -U stablenet_user -d stablenet -f migrations/002_idempotency.sql
```

### Connection Pooling (PgBouncer)

```ini
# pgbouncer.ini
[databases]
stablenet = host=postgres port=5432 dbname=stablenet

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
```

---

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d bundler.stablenet.io -d paymaster.stablenet.io

# Auto-renewal
certbot renew --dry-run
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/stablenet
upstream bundler {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name bundler.stablenet.io;

    ssl_certificate /etc/letsencrypt/live/bundler.stablenet.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bundler.stablenet.io/privkey.pem;

    location / {
        proxy_pass http://bundler;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Security Checklist

### Pre-deployment

- [ ] Private keys stored in secure vault (HashiCorp Vault, AWS Secrets Manager)
- [ ] Environment variables not committed to repository
- [ ] Database passwords rotated
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS origins restricted

### Post-deployment

- [ ] Health checks passing
- [ ] Monitoring alerts configured
- [ ] Log aggregation working
- [ ] Backup procedures tested
- [ ] Incident response plan documented
- [ ] Security audit completed

---

## Rollback Procedures

### Service Rollback

```bash
# Docker Compose
docker compose pull bundler:previous
docker compose up -d bundler

# Kubernetes
kubectl rollout undo deployment/bundler
kubectl rollout status deployment/bundler
```

### Database Rollback

```bash
# Restore from backup
pg_restore -U postgres -d stablenet backup_20260127.dump

# Or run down migration
psql -U stablenet_user -d stablenet -f migrations/002_idempotency_down.sql
```

---

## Related Documentation

- [Operations Guide](../operations/README.md)
- [Service API Reference](../services/README.md)
- [SDK Documentation](../sdk/api/README.md)
