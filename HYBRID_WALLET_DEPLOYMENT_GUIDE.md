# Hybrid Wallet System - Deployment Guide

Complete guide for deploying the hybrid wallet system to production, staging, and test environments.

## Pre-Deployment Checklist

### Infrastructure
- [ ] Solana RPC endpoint accessible and responsive
- [ ] Health Grid Solana program deployed (devnet/testnet/mainnet as applicable)
- [ ] Backend wallet created and funded with sufficient SOL for gas fees
- [ ] Database migrations tested in staging
- [ ] TLS certificates valid and up-to-date
- [ ] CDN/caching configured for static assets

### Team & Knowledge
- [ ] Deployment team trained on wallet system architecture
- [ ] Security review completed
- [ ] Rollback procedures documented and tested
- [ ] On-call rotation established for first 7 days post-deploy
- [ ] User support team briefed on new features

### User Preparation
- [ ] Pharmacy staff trained on wallet preference settings
- [ ] Admins trained on compliance report generation
- [ ] Documentation published on internal wiki
- [ ] Support ticket templates created
- [ ] User onboarding email drafted

## Environment Setup

### 1. Development Environment

```bash
# Clone and setup
git clone <repo>
cd embrace-health-grid
npm install

# Create .env.local
cat > .env.local << 'EOF'
REACT_APP_SOLANA_NETWORK=devnet
REACT_APP_SOLANA_RPC_URL=https://api.devnet.solana.com
REACT_APP_HEALTH_GRID_PROGRAM_ID=<devnet-program-id>
REACT_APP_SOLANA_COMMITMENT=confirmed
REACT_APP_BLOCKCHAIN_TX_TIMEOUT_MS=60000
REACT_APP_BLOCKCHAIN_MAX_RETRIES=5
REACT_APP_BLOCKCHAIN_CONFIRMATION_COUNT=32

SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF

# Install Solana CLI (if needed)
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Request airdrop for backend wallet (devnet only)
solana airdrop 10 <backend-wallet-address> --url devnet
```

### 2. Staging Environment

```bash
# Same as dev but pointing to testnet
REACT_APP_SOLANA_NETWORK=testnet
REACT_APP_SOLANA_RPC_URL=https://api.testnet.solana.com
REACT_APP_HEALTH_GRID_PROGRAM_ID=<testnet-program-id>

# Generate backend wallet for staging
solana-keygen new --outfile ~/staging-backend-wallet.json
solana config set --keypair ~/staging-backend-wallet.json

# Fund wallet (request from faucet)
solana balance <backend-wallet-address>
```

### 3. Production Environment

```bash
# Point to mainnet
REACT_APP_SOLANA_NETWORK=mainnet
REACT_APP_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
REACT_APP_HEALTH_GRID_PROGRAM_ID=<mainnet-program-id>

# Backend wallet already funded and registered
# DO NOT share private key - keep in secure key vault
MASTER_ENCRYPTION_KEY=<from-vault>
BACKEND_WALLET_SECRET=<from-vault>
```

## Database Setup

### 1. Run Migrations

```bash
# Connect to Supabase
supabase link --project-ref <project-ref>

# Apply migrations
supabase db push < supabase/migrations/20260819_hybrid_wallet_preferences.sql
supabase db push < supabase/migrations/20260819_signing_events.sql

# Verify tables created
supabase db list-tables
```

### 2. Configure RLS Policies

```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rls_enabled
FROM pg_tables
WHERE tablename IN ('user_wallet_preferences', 'signing_events', 'audit_events');

-- Should return: t (true) for all rows
```

### 3. Create Database Indexes

```sql
-- Optimize common queries
CREATE INDEX idx_signing_events_hospital_created
ON signing_events(hospital_id, created_at DESC);

CREATE INDEX idx_signing_events_user_created
ON signing_events(user_id, created_at DESC);

CREATE INDEX idx_signing_events_confirmed
ON signing_events(hospital_id, confirmed) WHERE confirmed = false;
```

## Backend Wallet Setup

### 1. Generate Backend Keypair

```bash
# Generate new keypair
solana-keygen new --outfile ./backend-wallet.json

# Extract public key
solana-keygen pubkey ./backend-wallet.json
# Output: your-backend-public-key

# Store in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
aws secretsmanager create-secret \
  --name health-grid/backend-wallet \
  --secret-string file://backend-wallet.json
```

### 2. Fund Backend Wallet

```bash
# Check balance
solana balance <backend-wallet-public-key> --url <network>

# For production, calculate:
# - Expected monthly transaction volume
# - Average gas per transaction (0.00025 SOL)
# - Buffer (3-6 months of transactions)

# Example: 10,000 transactions/month
# 10,000 * 0.00025 * 6 = 15 SOL minimum
```

### 3. Verify Backend Wallet Access

```typescript
// src/lib/__tests__/backend-wallet.test.ts

import { Keypair } from '@solana/web3.js';
import { getBackendWallet } from '@/lib/backend-wallet.server';

describe('Backend Wallet', () => {
  it('loads backend wallet from environment', async () => {
    const wallet = await getBackendWallet();
    expect(wallet).toBeDefined();
    expect(wallet.publicKey).toBeDefined();
  });

  it('has sufficient balance', async () => {
    const wallet = await getBackendWallet();
    const balance = await connection.getBalance(wallet.publicKey);
    expect(balance).toBeGreaterThan(10_000_000); // > 0.01 SOL
  });
});
```

## Application Deployment

### 1. Build for Production

```bash
# Lint and type check
npm run lint
npm run type-check

# Run tests
npm run test:unit
npm run test:integration

# Build
npm run build

# Verify bundle size
npm run build:analyze
```

### 2. Deploy to Vercel (Recommended)

```bash
# Connect to Vercel
vercel link

# Set environment variables
vercel env add REACT_APP_SOLANA_NETWORK production
vercel env add REACT_APP_SOLANA_RPC_URL production
vercel env add REACT_APP_HEALTH_GRID_PROGRAM_ID production
vercel env add MASTER_ENCRYPTION_KEY production
vercel env add SOLANA_NETWORK production
vercel env add SOLANA_RPC_URL production

# Deploy
vercel deploy --prod
```

### 3. Deploy to Self-Hosted

```bash
# Build
npm run build

# Copy to server
scp -r dist/* user@prod-server:/var/www/health-grid/

# Restart application
ssh user@prod-server "sudo systemctl restart health-grid"

# Verify deployment
curl https://health-grid.example.com/api/transaction-router/stats
```

## Verification Steps

### 1. Environment Variables

```bash
# Test environment loading
curl https://your-domain/api/transaction-router/preflight

# Should return:
{
  "success": true,
  "diagnostics": {
    "timestamp": "2026-01-15T10:30:00Z",
    "user": { "authenticated": true },
    "checks": {
      "phantomCheck": "enabled",
      "networkCheck": "enabled"
    }
  }
}
```

### 2. Database Connectivity

```typescript
// src/__tests__/integration/db-connectivity.test.ts

test('can connect to signing_events table', async () => {
  const { data, error } = await supabase
    .from('signing_events')
    .select('count()')
    .single();

  expect(error).toBeNull();
  expect(data).toBeDefined();
});

test('RLS policies enforced', async () => {
  // Create test user without proper hospital_id
  const result = await supabase
    .from('signing_events')
    .select('*')
    .eq('hospital_id', 'unauthorized-hospital');

  // Should return no rows due to RLS
  expect(result.data?.length || 0).toBe(0);
});
```

### 3. Wallet Signing

```bash
# Test Phantom connection (in browser console)
if (window.solana?.isPhantom) {
  console.log('✓ Phantom detected');
  const address = await window.solana.connect();
  console.log('✓ Phantom connected:', address.publicKey.toString());
}

# Test embedded backend signing
curl -X POST https://your-domain/api/sign-and-anchor \
  -H "Content-Type: application/json" \
  -d '{
    "recordHash": "test-hash",
    "recordType": "TEST_RECORD",
    "patientDid": "test-patient-did"
  }'

# Should return transaction ID
```

### 4. End-to-End Transaction

```typescript
// Test complete flow: Dispense → Sign → Confirm

test('complete dispensing flow with blockchain', async () => {
  const result = await dispensePrescriptionMedicationsWithBlockchain({
    prescriptionId: 'test-rx-123',
    patientDid: 'test-patient-did',
    medications: [{
      itemId: 'med-1',
      batchId: 'batch-1',
      quantityToDispense: 30,
    }],
    signWithBlockchain: true,
    userPreferredWallet: 'embedded', // Use embedded for testing
  });

  expect(result.ok).toBe(true);
  expect(result.dispensedCount).toBe(1);
  expect(result.signingResult).toBeDefined();
  expect(result.signingResult.confirmed).toBe(true);

  // Verify audit trail
  const audit = await getDispensingAuditTrailWithBlockchain({
    prescriptionId: result.prescriptionId,
    hospitalId: 'test-hospital',
  });

  expect(audit.blockchainProof).toBeDefined();
  expect(audit.blockchainProof.confirmed).toBe(true);
});
```

## Monitoring & Observability

### 1. Set Up Logging

```typescript
// src/lib/logger.ts

import { createLogger } from '@sanity/client/stega';

export const logger = createLogger('hybrid-wallet', {
  level: process.env.LOG_LEVEL || 'info',
});

// Log signing events
logger.info('Wallet signing initiated', {
  walletMode: 'phantom',
  txId,
  timestamp: new Date().toISOString(),
});

// Log errors
logger.error('Signing failed', {
  error: error.message,
  walletMode,
  attempt,
  recovery,
});
```

### 2. Database Monitoring

```sql
-- Monitor signing activity
SELECT
  DATE(created_at) as date,
  signer_type,
  COUNT(*) as count,
  SUM(CASE WHEN confirmed THEN 1 ELSE 0 END) as confirmed,
  SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors
FROM signing_events
GROUP BY DATE(created_at), signer_type
ORDER BY DATE(created_at) DESC
LIMIT 30;

-- Alert if error rate exceeds threshold
SELECT
  COUNT(*) as total_signings,
  SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate
FROM signing_events
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Expected: error_rate < 2%
```

### 3. Set Up Alerts

```yaml
# Prometheus rules
groups:
  - name: hybrid_wallet
    rules:
      - alert: HighSigningErrorRate
        expr: health_grid_signing_errors_total / health_grid_signing_attempts_total > 0.05
        for: 10m
        annotations:
          summary: "Signing error rate exceeds 5%"

      - alert: BackendWalletLowBalance
        expr: solana_wallet_balance_lamports < 1_000_000
        annotations:
          summary: "Backend wallet balance below 0.001 SOL"

      - alert: RPCEndpointUnresponsive
        expr: up{job="solana-rpc"} == 0
        for: 5m
        annotations:
          summary: "Solana RPC endpoint unreachable"
```

## Rollback Procedure

### If Issues Detected Post-Deployment

```bash
# 1. Immediate: Disable blockchain signing (fallback to inventory only)
# In environment: BLOCKCHAIN_SIGNING_ENABLED=false

# 2. Revert to previous version
git revert <latest-commit>
npm run build
vercel deploy --prod

# 3. Notify users
# Send message: "Blockchain features temporarily disabled for maintenance"

# 4. Investigate and fix
# - Check logs
# - Review recent changes
# - Test in staging

# 5. Redeploy with fix
git merge --no-ff fix-branch
npm run build
vercel deploy --prod

# 6. Restore blockchain signing
# BLOCKCHAIN_SIGNING_ENABLED=true
```

## Performance Tuning

### 1. Optimize RPC Calls

```typescript
// Cache transaction status checks
const transactionCache = new Map<string, CachedTx>();

export async function getCachedTransactionStatus(txId: string) {
  const cached = transactionCache.get(txId);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.status;
  }

  const status = await connection.getSignatureStatus(txId);
  transactionCache.set(txId, {
    status,
    timestamp: Date.now(),
  });

  return status;
}
```

### 2. Batch Operations

```typescript
// Batch signing records instead of individual records
export async function batchRecordSigningEvents(events: SigningEvent[]) {
  const { error } = await supabase
    .from('signing_events')
    .insert(events);

  if (error) throw error;
}
```

### 3. Database Query Optimization

```sql
-- Use EXPLAIN to analyze query plans
EXPLAIN ANALYZE
SELECT * FROM signing_events
WHERE hospital_id = 'hospital-123'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Should use index, not sequential scan
```

## Security Hardening

### 1. Backend Wallet Protection

```typescript
// Encrypt backend wallet in transit
import { encrypt, decrypt } from '@/lib/crypto';

export async function getBackendWallet() {
  const encrypted = process.env.BACKEND_WALLET_SECRET;
  const decrypted = await decrypt(encrypted);
  return Keypair.fromSecretKey(Buffer.from(decrypted, 'base64'));
}
```

### 2. Rate Limiting

```typescript
// Rate limit signing requests
import { rateLimit } from '@/lib/rate-limiter';

export const routeTransaction = createServerFn({
  method: 'POST',
})
  .middleware(async (data) => {
    await rateLimit('transaction-router', 100, 60); // 100 requests/min
  })
  .handler(async (data) => {
    // ... signing logic
  });
```

### 3. Input Validation

```typescript
// Strict validation on all inputs
import { z } from 'zod';

const transactionRouterSchema = z.object({
  patientDid: z.string().min(1).max(100),
  recordType: z.enum(['PRESCRIPTION_DISPENSED', 'LAB_RESULT', 'VITAL_SIGN']),
  recordHash: z.string().regex(/^[A-Za-z0-9+/=]{40,}$/),
  hospitalId: z.string().uuid(),
  maxRetries: z.number().min(1).max(5),
});

export const routeTransaction = createServerFn({
  method: 'POST',
})
  .inputValidator((data) => transactionRouterSchema.parse(data))
  .handler(async (data) => {
    // ... guaranteed valid data
  });
```

## Post-Deployment

### 1. Monitor First 24 Hours

- Check error logs every hour
- Verify signing success rate > 98%
- Monitor wallet balance
- Watch Solana network status

### 2. Gather Metrics

```sql
-- Generate post-deployment report
SELECT
  'Signing Statistics' as metric,
  COUNT(*) as total_signings,
  SUM(CASE WHEN confirmed THEN 1 ELSE 0 END) as confirmed,
  ROUND(100.0 * SUM(CASE WHEN confirmed THEN 1 ELSE 0 END) / COUNT(*), 2) as confirm_rate,
  AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))) as avg_confirmation_time_sec
FROM signing_events
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 3. User Feedback

- Send survey to pharmacy staff
- Collect issues and suggestions
- Update documentation based on feedback
- Schedule follow-up training if needed

## Ongoing Maintenance

### Daily
- Monitor error logs
- Check wallet balance
- Verify RPC endpoint responsiveness

### Weekly
- Review signing statistics
- Check audit trail integrity
- Update runbooks based on learnings

### Monthly
- Generate compliance reports
- Audit signing events for anomalies
- Review and update security policies
- Plan capacity for next month

### Quarterly
- Security audit
- Performance benchmarking
- Update dependencies
- Review disaster recovery procedures

## Support & Troubleshooting

See `HYBRID_WALLET_INTEGRATION_GUIDE.md` for detailed troubleshooting.

Quick links:
- [Troubleshooting Guide](./HYBRID_WALLET_INTEGRATION_GUIDE.md#troubleshooting)
- [API Documentation](./HYBRID_WALLET_INTEGRATION_GUIDE.md#api-endpoints)
- [Architecture Overview](./HYBRID_WALLET_INTEGRATION_GUIDE.md#architecture-overview)
