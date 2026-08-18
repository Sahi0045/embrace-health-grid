# Hybrid Wallet Integration Guide
## Step-by-Step Implementation for Health Grid

---

## 🎯 Integration Overview

This guide shows how to integrate Phantom + Embedded wallets into Health Grid's existing transaction flows.

**Total Integration Points**: 3 main areas
- ✅ Audit system (`audit.server.ts`)
- ✅ Pharmacy system (`pharmacy.server.ts`)
- ✅ User settings UI

---

## 📋 Step 1: Database Setup

### Create User Wallet Preferences Table

```sql
-- File: supabase/migrations/20260819_user_wallet_preferences.sql

CREATE TABLE public.user_wallet_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wallet mode selection
  wallet_mode TEXT NOT NULL DEFAULT 'auto' 
    CHECK (wallet_mode IN ('auto', 'phantom', 'embedded')),
  
  -- Phantom info
  phantom_public_key TEXT,
  phantom_connected_at TIMESTAMPTZ,
  
  -- Settings
  prefer_user_signing BOOLEAN DEFAULT TRUE,
  require_confirmation BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_wallet UNIQUE (hospital_id, user_id)
);

CREATE INDEX wallet_prefs_hospital_idx ON public.user_wallet_preferences (hospital_id);
CREATE INDEX wallet_prefs_user_idx ON public.user_wallet_preferences (user_id);
CREATE INDEX wallet_prefs_mode_idx ON public.user_wallet_preferences (wallet_mode);

-- RLS Policy
ALTER TABLE public.user_wallet_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_wallet_prefs_isolation ON public.user_wallet_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR 
    hospital_id IN (SELECT hospital_id FROM hospital_staff WHERE user_id = auth.uid() AND role = 'admin'));
```

### Create Signing Events Audit Table

```sql
-- File: supabase/migrations/20260819_signing_events.sql

CREATE TABLE public.signing_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- What was signed
  transaction_id TEXT NOT NULL,
  record_type TEXT,
  record_hash TEXT,
  
  -- How it was signed
  signer_type TEXT NOT NULL CHECK (signer_type IN ('phantom', 'embedded')),
  signer_wallet TEXT,      -- Who actually signed (user or hospital wallet)
  user_wallet TEXT,        -- If Phantom: user's public key
  
  -- Status
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  
  -- Confirmation
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmation_slot INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX signing_events_hospital_idx ON public.signing_events (hospital_id);
CREATE INDEX signing_events_user_idx ON public.signing_events (user_id);
CREATE INDEX signing_events_signer_idx ON public.signing_events (signer_type);
CREATE INDEX signing_events_tx_idx ON public.signing_events (transaction_id);

-- RLS Policy
ALTER TABLE public.signing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY signing_events_isolation ON public.signing_events
  FOR SELECT TO authenticated
  USING (hospital_id IN (
    SELECT hospital_id FROM hospital_staff WHERE user_id = auth.uid()
  ));
```

---

## 📁 Step 2: Add API Endpoints

### Create Wallet Preference API

```typescript
// File: src/routes/api.wallet-preference.tsx

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';

/**
 * GET /api/wallet-preference
 * Fetch user's wallet preference
 */
export const getUserWalletPreference = createServerFn()
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async ({ data: { user } }) => {
    const db = getSupabaseServerClient();

    const { data, error } = await db
      .from('user_wallet_preferences')
      .select('wallet_mode, phantom_public_key, phantom_connected_at')
      .eq('user_id', user.id)
      .single();

    if (!data) {
      return {
        walletMode: 'auto',
        phantomConnected: false,
      };
    }

    return {
      walletMode: data.wallet_mode,
      phantomConnected: !!data.phantom_connected_at,
      phantomPublicKey: data.phantom_public_key,
    };
  });

/**
 * POST /api/wallet-preference
 * Save user's wallet preference
 */
export const saveUserWalletPreference = createServerFn()
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async ({ data: { user, walletMode, phantomPublicKey } }) => {
    const db = getSupabaseServerClient();

    const { error } = await db.from('user_wallet_preferences').upsert({
      hospital_id: user.hospital_id,
      user_id: user.id,
      wallet_mode: walletMode,
      phantom_public_key: phantomPublicKey || null,
      phantom_connected_at: phantomPublicKey ? new Date() : null,
      updated_at: new Date(),
    });

    if (error) throw error;

    return { success: true };
  });
```

### Create Signing Event Logging API

```typescript
// File: src/routes/api.signing-events.tsx

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';

/**
 * POST /api/signing-events
 * Log a signing operation for audit trail
 */
export const recordSigningEvent = createServerFn()
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(
    async ({
      data: { signerType, txId, userWallet, recordHash, recordType, hospitalId },
    }) => {
      const db = getSupabaseServerClient();

      const { error } = await db.from('signing_events').insert({
        hospital_id: hospitalId,
        user_id: user?.id,
        transaction_id: txId,
        record_type: recordType,
        record_hash: recordHash,
        signer_type: signerType,
        signer_wallet: signerType === 'phantom' ? userWallet : null,
        user_wallet: userWallet,
        status: 'success',
        confirmed: true,
        confirmed_at: new Date(),
      });

      if (error) {
        console.warn('Failed to record signing event:', error);
        // Don't throw - transaction already sent
      }

      return { success: true };
    }
  );
```

---

## 🔌 Step 3: Create Backend Signing Endpoint

### Create Sign & Anchor Endpoint

```typescript
// File: src/routes/api.sign-and-anchor.tsx

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';
import { solanaBlockchainService } from '@/lib/solana-blockchain.server';
import { recordSigningEvent } from './api.signing-events';

/**
 * POST /api/sign-and-anchor
 * Sign transaction with embedded wallet (backend) and anchor to blockchain
 */
export const signAndAnchorWithEmbedded = createServerFn()
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(
    async ({
      data: { patientDid, recordType, recordHash, hospitalId, userWallet },
    }) => {
      try {
        // Step 1: Sign with embedded wallet (backend)
        const txId = await solanaBlockchainService.anchorMedicalRecord({
          patientDid,
          recordType,
          recordHash,
          hospitalId,
          metadata: {
            signerType: 'embedded',
            userWallet: userWallet || null,
          },
        });

        console.log(`✅ Anchored with embedded wallet: ${txId}`);

        // Step 2: Record in audit trail
        await recordSigningEvent({
          signerType: 'embedded',
          txId,
          userWallet: userWallet || null,
          recordHash,
          recordType,
          hospitalId,
        });

        return {
          success: true,
          txId,
          signature: txId,
        };
      } catch (error) {
        console.error('Embedded signing failed:', error);

        // Record failure
        await recordSigningEvent({
          signerType: 'embedded',
          txId: 'failed',
          userWallet: userWallet || null,
          recordHash,
          recordType,
          hospitalId,
        }).catch((e) => console.error('Failed to record error:', e));

        throw error;
      }
    }
  );
```

---

## 🔄 Step 4: Modify Existing Pharmacy APIs

### Update: `dispensePrescriptionMedications`

```typescript
// File: src/lib/pharmacy.server.ts

// BEFORE:
export async function dispensePrescriptionMedications(
  prescriptionId: string,
  hospitalId: string
) {
  // Create stock movements
  // Anchor with hospital wallet only
}

// AFTER:
export async function dispensePrescriptionMedications(
  prescriptionId: string,
  hospitalId: string,
  options?: { userWallet?: string } // New: for Phantom mode
) {
  // 1. Create stock movements (same as before)
  const movement = await createStockMovement({
    prescriptionId,
    hospitalId,
  });

  // 2. NEW: Determine signer
  const signerType = options?.userWallet ? 'phantom' : 'embedded';

  // 3. NEW: If Phantom mode, just record that user will sign
  if (signerType === 'phantom') {
    // Don't sign here - client will use Phantom to sign
    await recordSigningEvent({
      signerType: 'phantom',
      txId: 'pending',
      userWallet: options.userWallet,
      recordHash: movement.hash,
      recordType: 'prescription_dispensed',
      hospitalId,
    });
    return { movement, signerType: 'phantom' };
  }

  // 4. If embedded mode, anchor with hospital wallet
  const txId = await SolanaBlockchainService.anchorMedicalRecord({
    patientDid: movement.patientDid,
    recordType: 'prescription_dispensed',
    recordHash: movement.hash,
    hospitalId,
    metadata: { signerType: 'embedded' },
  });

  return {
    movement,
    signerType: 'embedded',
    txId,
  };
}
```

---

## 🎨 Step 5: Add Settings Page

### Create Settings Route

```typescript
// File: src/routes/settings.blockchain.tsx

'use client';

import { HybridWalletSettings } from '@/components/HybridWalletSettings';

export default function BlockchainSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto">
        <HybridWalletSettings />
      </div>
    </div>
  );
}
```

### Add Link to Sidebar

```typescript
// File: src/components/AppSidebar.tsx

// In the settings section, add:
{
  to: '/settings/blockchain',
  label: 'Blockchain Wallets',
  icon: Wallet,
}
```

---

## 🔗 Step 6: Integrate in Transaction Flows

### Update Pharmacy Staff Portal

```typescript
// File: src/routes/staff.pharmacy-inventory.tsx

import { useHybridWallet, useWalletSigning } from '@/lib/useHybridWallet';

export function DispenseCard() {
  const wallet = useHybridWallet();
  const { isSigning, signingProgress, signTransaction } = useWalletSigning();

  const handleDispense = async () => {
    try {
      // Step 1: Dispense medication (creates movement)
      const { movement } = await dispensePrescriptionMedications(
        prescriptionId,
        hospitalId
      );

      // Step 2: Sign and anchor with appropriate wallet
      const result = await signTransaction({
        patientDid: movement.patientDid,
        recordType: 'prescription_dispensed',
        recordHash: movement.hash,
        hospitalId,
      });

      console.log(`✅ Dispensed & anchored: ${result.txId}`);
      console.log(`   Wallet: ${result.walletUsed}`);
    } catch (error) {
      console.error('Dispensing failed:', error);
      // Show error to user
    }
  };

  return (
    <div>
      <button onClick={handleDispense} disabled={isSigning || !wallet.isSigningReady}>
        {isSigning ? (
          <>
            <Loader className="w-4 h-4 animate-spin mr-2" />
            {signingProgress?.message}
          </>
        ) : (
          'Dispense Medication'
        )}
      </button>

      {wallet.error && <div className="text-red-600">{wallet.error}</div>}
    </div>
  );
}
```

---

## 🧪 Step 7: Testing

### Test Phantom Signing

```typescript
// File: src/lib/__tests__/hybrid-wallet.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Hybrid Wallet - Phantom Integration', () => {
  let originalSolana: any;

  beforeEach(() => {
    // Mock Phantom
    originalSolana = window.solana;
    window.solana = {
      isPhantom: true,
      connect: vi.fn().mockResolvedValue({
        publicKey: { toBase58: () => 'MockPhantomAddress123' },
      }),
      signTransaction: vi.fn().mockResolvedValue({
        serialize: () => Buffer.from([]),
      }),
    };
  });

  afterEach(() => {
    window.solana = originalSolana;
  });

  it('should detect Phantom wallet', () => {
    const { isPhantomInstalled } = require('@/lib/hybrid-wallet.client');
    expect(isPhantomInstalled()).toBe(true);
  });

  it('should connect to Phantom', async () => {
    const { connectPhantom } = require('@/lib/hybrid-wallet.client');
    const result = await connectPhantom();
    expect(result.publicKey).toBe('MockPhantomAddress123');
  });

  it('should sign with Phantom', async () => {
    const { signWithPhantom } = require('@/lib/hybrid-wallet.client');
    const result = await signWithPhantom({
      patientDid: 'did:solana:test',
      recordType: 'prescription',
      recordHash: 'abc123',
      hospitalId: 'hosp-1',
    });
    expect(result.walletUsed).toBe('phantom');
    expect(window.solana.signTransaction).toHaveBeenCalled();
  });

  it('should fallback to embedded on Phantom error', async () => {
    window.solana.signTransaction = vi.fn().mockRejectedValue(new Error('Connection failed'));
    const { signAndAnchorTransaction } = require('@/lib/hybrid-wallet.client');
    
    // Mock embedded signing
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ txId: 'embedded-tx-id', signature: 'sig' }),
    });

    const result = await signAndAnchorTransaction({
      patientDid: 'did:solana:test',
      recordType: 'prescription',
      recordHash: 'abc123',
      hospitalId: 'hosp-1',
    });

    expect(result.walletUsed).toBe('embedded');
  });
});
```

### Test Embedded Signing

```typescript
it('should sign with embedded wallet', async () => {
  const { signWithEmbedded } = require('@/lib/hybrid-wallet.client');
  
  // Mock backend response
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ txId: 'embedded-tx-id', signature: 'sig' }),
  });

  const result = await signWithEmbedded({
    patientDid: 'did:solana:test',
    recordType: 'prescription',
    recordHash: 'abc123',
    hospitalId: 'hosp-1',
  });

  expect(result.walletUsed).toBe('embedded');
  expect(result.txId).toBe('embedded-tx-id');
});
```

---

## 🚀 Deployment Checklist

### Before Devnet
- [ ] Database migrations applied
- [ ] API endpoints created
- [ ] Settings UI component added
- [ ] Hybrid wallet hooks tested
- [ ] Pharmacy flows updated

### Before Testnet
- [ ] Phantom integration tested with actual Phantom extension
- [ ] Embedded signing tested
- [ ] Settings persistence working
- [ ] Audit trail complete
- [ ] Error handling covers edge cases

### Before Mainnet
- [ ] Security audit completed
- [ ] Performance tested (1000 TXs/day)
- [ ] All edge cases handled
- [ ] Documentation complete
- [ ] Runbook for operators

---

## 📊 Verification Commands

### Check Wallet Preference Saved

```sql
SELECT * FROM user_wallet_preferences 
WHERE user_id = '<user-id>';
```

### Check Signing Events

```sql
SELECT * FROM signing_events 
WHERE hospital_id = '<hospital-id>' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Verify Phantom Transactions

```sql
SELECT * FROM signing_events 
WHERE signer_type = 'phantom' 
AND confirmed = true;
```

### Verify Embedded Transactions

```sql
SELECT * FROM signing_events 
WHERE signer_type = 'embedded' 
AND confirmed = true;
```

---

## 🎓 User Training

### For Staff Using Phantom

1. Install Phantom wallet from phantom.app
2. Create or import wallet
3. On Health Grid, go to Settings → Blockchain
4. Select "Use Phantom Wallet"
5. When dispensing medication, approve in Phantom popup
6. Transaction appears on Solana blockchain

### For Regular Staff

1. No setup needed
2. Use Health Grid normally
3. Transactions automatically verified on blockchain
4. No wallet knowledge required

### For Admins

1. Monitor wallet preferences in admin dashboard
2. Check signing events for audit trail
3. Alert if Phantom connection issues occur
4. Ensure hospital wallet has sufficient SOL

---

## 🔧 Troubleshooting

### Phantom Not Detected
```
Check:
- User has Phantom extension installed
- Phantom is enabled (not disabled)
- User refreshed page after installing
- Browser is supported (Chrome, Firefox, Edge)

Fix:
- Install Phantom from https://phantom.app
- Enable extension in browser
- Refresh Health Grid
```

### Embedded Signing Fails
```
Check:
- Hospital wallet has SOL balance
- Hospital wallet exists in database
- Backend can decrypt wallet key

Fix:
- Request SOL airdrop (Devnet)
- Check MASTER_ENCRYPTION_KEY env var
- Verify wallet in embedded_wallets table
```

### Settings Not Saving
```
Check:
- User authenticated
- user_wallet_preferences table exists
- RLS policies allow writes

Fix:
- Login/logout again
- Run migrations
- Check RLS policies
```

---

## 📈 Monitoring

### Metrics to Track

1. **Wallet Mode Distribution**
   ```sql
   SELECT wallet_mode, COUNT(*) FROM user_wallet_preferences GROUP BY wallet_mode;
   ```

2. **Signing Success Rate**
   ```sql
   SELECT signer_type, COUNT(*) FROM signing_events 
   WHERE status = 'success' GROUP BY signer_type;
   ```

3. **Phantom Connection Rate**
   ```sql
   SELECT COUNT(DISTINCT user_id) FROM signing_events 
   WHERE signer_type = 'phantom';
   ```

---

**This integration guide covers everything needed to add hybrid wallet support to Health Grid. Start with database setup, then add APIs, then update the UI.** 🚀

