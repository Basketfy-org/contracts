# 🚀 Basketfy Complete Implementation & Deployment Guide

A-Z guide for implementing all Hedera services, smart contracts, and business logic.

---

## 📋 Table of Contents

1. [Smart Contract Deployment](#smart-contract-deployment)
2. [Go Backend Setup](#go-backend-setup)
3. [HTS Token Creation](#hts-token-creation)
4. [HCS Audit Logging](#hcs-audit-logging)
5. [DID Feeder Verification](#did-feeder-verification)
6. [Vault & Liquidity Management](#vault--liquidity-management)
7. [API Endpoints](#api-endpoints)
8. [End-to-End Workflows](#end-to-end-workflows)
9. [Testing & Debugging](#testing--debugging)

---

## Smart Contract Deployment

### Step 1: Install Foundry/Hardhat

```bash
cd smart-contracts


# Or using Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Step 2: Deploy to Hedera Testnet

```bash
forge script script/BasketFactory.s.sol:BasketFactoryScript --rpc-url testnet --broadcast
forge script script/FeedersVault.s.sol:FeedersVaultScript --rpc-url testnet --broadcast

forge script script/MockUSDC.s.sol:MockUSDCScript --rpc-url testnet --broadcast
```

**Expected Output:**

```
Deploying Basketfy contracts...
BasketFactory deployed to: 0x... (Contract ID: 0.0.XXXXX)
FeederVault deployed to: 0x... (Contract ID: 0.0.ZZZZZ)
```
### Step 3 : Verify

```bash
forge verify-contract $CONTRACT_ADDRESS src/BasketFactory.sol:BasketFactory \
    --chain-id 296 \
    --verifier sourcify \
    --verifier-url "https://server-verify.hashscan.io/" \
```
---

