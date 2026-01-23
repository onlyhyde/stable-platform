# StableNet PoC Platform - Makefile
# ===================================

.PHONY: help install build test clean docker-up docker-down docker-logs anvil deploy-contracts

# Default target
help:
	@echo "StableNet PoC Platform - Available Commands"
	@echo "============================================"
	@echo ""
	@echo "Development:"
	@echo "  make install        - Install all dependencies"
	@echo "  make build          - Build all packages and services"
	@echo "  make test           - Run all tests"
	@echo "  make test-e2e       - Run E2E tests (requires local network)"
	@echo "  make lint           - Run linting"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up      - Start all services with Docker Compose"
	@echo "  make docker-dev     - Start services in development mode (with Anvil)"
	@echo "  make docker-down    - Stop all services"
	@echo "  make docker-logs    - View service logs"
	@echo "  make docker-clean   - Remove all containers and volumes"
	@echo ""
	@echo "Local Development:"
	@echo "  make anvil          - Start local Anvil node (Prague hardfork)"
	@echo "  make deploy         - Deploy essential contracts to local Anvil"
	@echo "  make deploy-full    - Deploy all contracts to local Anvil"
	@echo "  make fund-paymaster - Fund paymaster with ETH"
	@echo "  make gen-addresses  - Generate TypeScript addresses from deployment"
	@echo "  make dev-setup      - Full dev setup (anvil + deploy + generate)"
	@echo "  make bundler        - Start bundler service"
	@echo "  make paymaster      - Start paymaster proxy service"
	@echo ""
	@echo "Testing:"
	@echo "  make test-unit      - Run unit tests"
	@echo "  make test-int       - Run integration tests"
	@echo "  make test-contracts - Run contract tests"
	@echo ""

# ===================================
# Development Commands
# ===================================

install:
	pnpm install

build:
	pnpm turbo build

test:
	pnpm turbo test

test-unit:
	pnpm vitest run tests/unit

test-int:
	pnpm vitest run tests/integration

test-e2e:
	pnpm vitest run tests/e2e

test-all:
	pnpm vitest run

lint:
	pnpm turbo lint

typecheck:
	pnpm turbo typecheck

clean:
	pnpm turbo clean
	rm -rf node_modules
	rm -rf .turbo

# ===================================
# Docker Commands
# ===================================

docker-up:
	docker compose up -d

docker-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-logs-bundler:
	docker compose logs -f bundler

docker-logs-paymaster:
	docker compose logs -f paymaster-proxy

docker-clean:
	docker compose down -v --remove-orphans
	docker system prune -f

docker-build:
	docker compose build --no-cache

docker-ps:
	docker compose ps

# ===================================
# Local Development Commands
# ===================================

anvil:
	anvil --chain-id 31337 --block-time 1 --accounts 10 --balance 10000 --hardfork prague

# Essential contracts deployment (fast, for development)
deploy: deploy-contracts gen-addresses

deploy-contracts:
	@echo "Deploying essential contracts to local Anvil..."
	cd ../poc-contract && forge script script/deploy/DeployDevnet.s.sol:DeployDevnetScript \
		--rpc-url http://127.0.0.1:8545 \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast
	@echo "Essential contracts deployed."

# Full contracts deployment (all contracts, slower)
deploy-full:
	@echo "Deploying all contracts to local Anvil..."
	cd ../poc-contract && forge script script/DeployOrchestrator.s.sol:DeployOrchestratorScript \
		--rpc-url http://127.0.0.1:8545 \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast
	@$(MAKE) gen-addresses
	@echo "All contracts deployed and addresses generated."

# Fund paymaster for gas sponsorship
fund-paymaster:
	@echo "Funding paymaster..."
	cd ../poc-contract && forge script script/deploy/DeployDevnet.s.sol:FundPaymasterScript \
		--rpc-url http://127.0.0.1:8545 \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast

# Generate TypeScript addresses from deployment output
gen-addresses:
	@echo "Generating TypeScript addresses..."
	@if [ -f ../poc-contract/deployments/31337/addresses.json ]; then \
		pnpm --filter @stablenet/contracts generate --input ../poc-contract/deployments; \
		echo "Addresses generated successfully."; \
	else \
		echo "No deployment file found. Run 'make deploy' first."; \
	fi

# One-command dev setup: deploy contracts and generate addresses
dev-setup: deploy fund-paymaster
	@echo ""
	@echo "=== Dev Setup Complete ==="
	@echo "Contracts deployed and addresses generated."
	@echo "Paymaster funded with 10 ETH."
	@echo ""
	@echo "Start services with: make docker-dev"

bundler:
	cd services/bundler && pnpm dev

paymaster:
	cd services/paymaster-proxy && pnpm dev

# ===================================
# Contract Testing
# ===================================

test-contracts:
	cd ../poc-contract && forge test -vvv

test-contracts-gas:
	cd ../poc-contract && forge test -vvv --gas-report

# ===================================
# Setup Commands
# ===================================

setup: install build
	@echo "Setup complete. Run 'make anvil' in one terminal and 'make deploy' in another."

setup-env:
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env created from .env.example"; else echo ".env already exists"; fi

# ===================================
# Utility Commands
# ===================================

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost:4337/health || echo "Bundler: DOWN"
	@curl -s http://localhost:4338/health || echo "Paymaster: DOWN"
	@curl -s http://localhost:4339/health || echo "Stealth Server: DOWN"
	@curl -s http://localhost:4340/health || echo "Order Router: DOWN"
	@curl -s http://localhost:4341/health || echo "Subscription Executor: DOWN"

# Fund test accounts with ETH
fund-accounts:
	@echo "Funding test accounts..."
	cast send --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --value 100ether
	cast send --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC --value 100ether
	@echo "Accounts funded."
