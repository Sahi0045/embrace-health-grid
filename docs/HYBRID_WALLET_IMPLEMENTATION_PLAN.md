# Hybrid Wallet Integration Plan for Health Grid
## Phantom Wallets + Embedded Wallets — Smart User Detection & Fallback

---

## 📋 Executive Summary

This plan implements a **smart hybrid wallet system** that automatically detects user blockchain knowledge and chooses the right wallet:

**User has Phantom wallet installed?** → Use it (direct Solana signing)  
**User has no Phantom?** → Use embedded wallet (transparent backend signing)  
**User wants to switch?** → Settings page to toggle anytime

### Key Features
- ✅ Auto-detect Phantom wallet availability
- ✅ Zero friction for non-technical users
- ✅ Native Solana integration for crypto-savvy users
- ✅ Seamless switching between wallet types
- ✅ Same audit trail for both methods
- ✅ Security best practices for each mode

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Health Grid UI                         │
│  (Admin Portal, Staff Portal, Patient App)          │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
         ┌──────────────────┐
         │ Wallet Selector  │ ← AUTO-DETECT OR MANUAL
         │ (useHybridWallet)│
         └────┬─────────────┘
              │
        ┌─────┴──────────────┬──────────────────┐
        │                    │                  │
        ▼                    ▼                  ▼
    ┌────────────┐   ┌──────────────────┐  ┌─────────────┐
    │ Phantom    │   │  Embedded        │  │  Settings   │
    │ Detected   │   │  Wallet          │  │  (Override) │
    │ + Active   │   │  Fallback        │  │             │
    └─────┬──────┘   └────────┬─────────┘  └──────┬──────┘
          │                   │                   │
          ▼                   ▼                   ▼
    ┌──────────────────────────────────────────────────┐
    │     Transaction Processor                        │
    │  - Route to Phantom OR Embedded                  │
    │  - Unified error handling                        │
    │  - Same audit trail                             │
    └────────────────┬─────────────────────────────────┘
                     │
          ┌──────────┴──────────────┐
          │                         │
          ▼                         ▼
    ┌──────────────┐         ┌──────────────────┐
    │ Phantom      │         │ Embedded Wallet  │
    │ RPC Signing  │         │ Server Signing   │
    │ (Client)     │         │ (Backend)        │
    └──────────────┘         └──────────────────┘
          │                         │
          └──────────┬──────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │  Solana Blockchain       │
          │  (All records anchored)  │
          └──────────────────────────┘
```

---

## 🔑 Core Concepts

### 1. Phantom Wallet Mode
**When**: User has Phantom browser extension installed & active  
**How**: User approves transactions directly in Phantom UI  
**Signing**: Client-side (user's browser)  
**Private Key**: Never touches our servers (always on user's device)  
**Cost**: User pays gas fees  
**Best For**: Tech-savvy users, healthcare providers, researchers

### 2. Embedded Wallet Mode
**When**: User has no Phantom OR chooses embedded in settings  
**How**: User sees "Sign & Anchor" button, blockchain happens transparently  
**Signing**: Server-side (backend uses hospital wallet)  
**Private Key**: Hospital wallet encrypted in backend  
**Cost**: Hospital pays gas fees  
**Best For**: Regular users, patients, non-technical staff

### 3. Hybrid Detection Logic
```
1. Page loads
   ↓
2. Check: Is Phantom installed?
   ├─ YES → Offer Phantom as primary
   └─ NO → Use Embedded as fallback
   ↓
3. Check: User has setting preference?
   ├─ YES → Use their preference (override auto-detect)
   └─ NO → Use auto-detected choice
   ↓
4. Show appropriate UI for selected wallet type
```

---

## 📱 User Experience Flows

### Flow 1: Crypto-Savvy User with Phantom

```
1. User lands on Health Grid
   └─ Page detects Phantom installed
   
2. Prompt appears:
   ┌──────────────────────────────┐
   │ 🔗 Phantom Wallet Detected    │
   │ Sign transactions using your  │
   │ personal Phantom wallet?      │
   │ [Use Phantom]  [Use Embedded] │
   └──────────────────────────────┘

3. User clicks [Use Phantom]
   └─ App connects to Phantom via window.solana

4. User dispenses medication
   ├─ TX created in Health Grid
   ├─ User sees: "Approve in Phantom →"
   └─ Phantom popup appears (user authorizes)

5. User approves in Phantom
   ├─ TX signed with user's private key
   ├─ TX sent to Solana blockchain
   └─ Record anchored under user's wallet

6. Success: "✓ Anchored to blockchain"
   └─ Explorer link shows user's transaction
```

### Flow 2: Non-Technical User (No Phantom)

```
1. User lands on Health Grid
   └─ Page detects Phantom NOT installed
   
2. No popup shown (seamless experience)
   └─ Embedded wallet used automatically

3. User dispenses medication
   ├─ TX created in Health Grid
   ├─ User sees: "Dispensing... (verifying on blockchain)"
   └─ No prompts, no wallet terminology

4. Backend processes automatically
   ├─ Gets hospital wallet (encrypted)
   ├─ Signs TX with hospital keypair
   ├─ Sends to Solana
   └─ Record anchored under hospital wallet

5. Success: "✓ Verified on blockchain"
   └─ "View Proof" link (user can verify if curious)
```

### Flow 3: User Switches Settings

```
1. User in Admin Portal
   ├─ Has Phantom installed
   ├─ Currently using Phantom mode
   
2. Clicks: Settings → Blockchain
   └─ Shows options:
      ├─ ☑ Auto-detect wallet (currently selected)
      ├─ ○ Always use Phantom
      └─ ○ Always use Embedded

3. User selects "Always use Embedded"
   ├─ Setting saved to user_preferences table
   └─ Page refreshes
   
4. Next transaction uses embedded wallet
   └─ No Phantom prompts anymore
```

---

## 🛠️ Implementation Architecture

### Layer 1: Wallet Detection Hook (`useHybridWallet`)

```typescript
// Client-side hook
export function useHybridWallet() {
  const [walletMode, setWalletMode] = useState<'phantom' | 'embedded'>('embedded');
  const [isPhantomConnected, setIsPhantomConnected] = useState(false);
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check user preference
    const userPreference = await getUserWalletPreference();
    
    if (userPreference === 'manual') {
      // User manually chose a wallet
      setWalletMode(userPreference.chosenWallet);
      return;
    }

    // 2. Auto-detect Phantom
    if (window.solana?.isPhantom) {
      try {
        // Try to connect to Phantom
        const { publicKey } = await window.solana.connect({ onlyIfTrusted: true });
        setIsPhantomConnected(true);
        setPhantomPublicKey(publicKey?.toBase58() || null);
        setWalletMode('phantom');
      } catch (error) {
        // Phantom detected but not connected - use embedded
        setWalletMode('embedded');
      }
    } else {
      // No Phantom - use embedded
      setWalletMode('embedded');
    }

    setLoading(false);
  }, []);

  return { walletMode, isPhantomConnected, phantomPublicKey, loading };
}
```

### Layer 2: Transaction Router

```typescript
// Routes transactions to appropriate signer
export async function signAndAnchorTransaction(
  transactionData: TransactionPayload
): Promise<{ txId: string; walletUsed: 'phantom' | 'embedded' }> {
  const { walletMode } = useHybridWallet();

  if (walletMode === 'phantom' && window.solana) {
    // Route to Phantom
    return await signWithPhantom(transactionData);
  } else {
    // Route to embedded wallet (backend)
    return await signWithEmbedded(transactionData);
  }
}
```

### Layer 3: Phantom Integration (`src/lib/phantom-wallet.client.ts`)

```typescript
/**
 * Sign transaction using Phantom wallet
 * - Sends TX to user's Phantom extension
 * - User approves/denies in Phantom UI
 * - Returns signed TX and TX ID
 */
export async function signWithPhantom(
  transactionData: TransactionPayload
): Promise<{ txId: string; signature: string }> {
  if (!window.solana?.isPhantom) {
    throw new Error('Phantom wallet not detected');
  }

  try {
    // 1. Connect to Phantom (if not already connected)
    const { publicKey } = await window.solana.connect();

    // 2. Build transaction
    const connection = new Connection(SOLANA_RPC_URL);
    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: publicKey,
    });

    // Add instruction for anchoring record
    transaction.add({
      programId: HEALTH_GRID_PROGRAM_ID,
      keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(transactionData),
    });

    // 3. Send to Phantom for signing
    // This triggers the Phantom popup where user approves/denies
    const signedTx = await window.solana.signTransaction(transaction);

    // 4. Send signed TX to Solana
    const txId = await connection.sendRawTransaction(signedTx.serialize());

    // 5. Wait for confirmation
    await connection.confirmTransaction(txId);

    console.log(`✅ TX signed with Phantom: ${txId}`);

    // 6. Save to our audit trail (backend)
    await savePhantomTransaction({
      txId,
      userWallet: publicKey.toBase58(),
      recordHash: transactionData.recordHash,
    });

    return { txId, signature: txId };
  } catch (error) {
    console.error('Phantom signing failed:', error);
    throw new Error(`Phantom wallet error: ${error.message}`);
  }
}
```

### Layer 4: Embedded Wallet Integration (`src/lib/embedded-wallet-client.ts`)

```typescript
/**
 * Sign transaction using embedded wallet (backend)
 * - Send request to backend
 * - Backend uses hospital wallet to sign
 * - User never sees private keys
 */
export async function signWithEmbedded(
  transactionData: TransactionPayload
): Promise<{ txId: string; walletUsed: 'embedded' }> {
  try {
    // 1. Send to backend (no signing on client)
    const response = await fetch('/api/anchor-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientDid: transactionData.patientDid,
        recordType: transactionData.recordType,
        recordHash: transactionData.recordHash,
        hospitalId: transactionData.hospitalId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const { txId } = await response.json();

    console.log(`✅ TX signed with embedded wallet: ${txId}`);

    return { txId, walletUsed: 'embedded' };
  } catch (error) {
    console.error('Embedded wallet signing failed:', error);
    throw error;
  }
}
```

### Layer 5: Backend Router (`src/lib/hybrid-signer.server.ts`)

```typescript
/**
 * Unified transaction signer
 * - Receives TX data from client
 * - Uses embedded wallet to sign & anchor
 * - Records which signer was used
 */
export async function signAndAnchorViaEmbedded(params: {
  patientDid: string;
  recordType: string;
  recordHash: string;
  hospitalId: string;
  userWallet?: string; // If Phantom was used (for audit)
}): Promise<{ txId: string; walletUsed: 'embedded'; signature: string }> {
  try {
    // 1. Get hospital embedded wallet
    const hospitalKeypair = await hospitalWalletService.getHospitalKeypair(
      params.hospitalId
    );

    // 2. Build & sign TX
    const txId = await solanaBlockchainService.anchorMedicalRecord({
      patientDid: params.patientDid,
      recordType: params.recordType,
      recordHash: params.recordHash,
      hospitalId: params.hospitalId,
      metadata: {
        signerType: 'embedded',
        userWallet: params.userWallet || null, // Track if user provided wallet
      },
    });

    // 3. Record in audit trail
    await recordSigningEvent({
      signerType: 'embedded',
      txId,
      hospitalId: params.hospitalId,
      userWallet: params.userWallet,
    });

    return {
      txId,
      walletUsed: 'embedded',
      signature: txId,
    };
  } catch (error) {
    console.error('Embedded signing failed:', error);
    throw error;
  }
}
```

---

## 📊 Database Schema

### Table 1: User Wallet Preferences

```sql
CREATE TABLE public.user_wallet_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Wallet mode selection
  wallet_mode TEXT NOT NULL CHECK (wallet_mode IN ('auto', 'phantom', 'embedded')),
  
  -- Detected Phantom wallet info
  phantom_public_key TEXT,
  phantom_connected_at TIMESTAMPTZ,
  phantom_disconnected_at TIMESTAMPTZ,
  
  -- Embedded wallet info
  embedded_wallet_id UUID REFERENCES public.embedded_wallets(wallet_id),
  
  -- Settings
  prefer_user_signing BOOLEAN DEFAULT TRUE, -- User wants to sign vs hospital signing
  require_confirmation BOOLEAN DEFAULT TRUE, -- Show confirmation before anchoring
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_wallet UNIQUE (hospital_id, user_id)
);

CREATE INDEX wallet_prefs_user_idx ON public.user_wallet_preferences (user_id);
CREATE INDEX wallet_prefs_mode_idx ON public.user_wallet_preferences (wallet_mode);
```

### Table 2: Signing Events Audit Trail

```sql
CREATE TABLE public.signing_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(hospital_id),
  user_id UUID REFERENCES auth.users(id),
  
  -- What was signed
  transaction_id TEXT NOT NULL,
  record_type TEXT, -- 'prescription', 'diagnosis', etc.
  record_hash TEXT,
  
  -- How it was signed
  signer_type TEXT NOT NULL CHECK (signer_type IN ('phantom', 'embedded')),
  signer_wallet TEXT, -- Phantom: user's wallet, Embedded: hospital wallet
  user_wallet TEXT, -- If Phantom, user's public key
  
  -- Status
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  
  -- Confirmation
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmation_slot INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX signing_events_user_idx ON public.signing_events (user_id);
CREATE INDEX signing_events_signer_idx ON public.signing_events (signer_type);
CREATE INDEX signing_events_tx_idx ON public.signing_events (transaction_id);
```

---

## 🔐 Security Model

### For Phantom Users (User Signing)

```
┌─────────────────────────────────────────┐
│     User's Phantom Wallet                │
│  (Private key on user's machine)         │
└────────────────┬────────────────────────┘
                 │
                 ▼ (User approves tx)
┌──────────────────────────────────────┐
│  Phantom Browser Extension             │
│  - Signs TX with user's private key   │
│  - Never exposes private key          │
│  - User sees what they're signing     │
└──────────────┬───────────────────────┘
               │
               ▼ (Signed TX)
┌──────────────────────────────────────┐
│  Health Grid Backend                   │
│  - Receives SIGNED transaction        │
│  - Sends to Solana (doesn't sign)     │
│  - Records in audit trail             │
└──────────────┬───────────────────────┘
               │
               ▼
        Solana Blockchain
        (TX on-chain)
```

**Security Benefits**:
- ✅ User's private key never leaves their device
- ✅ User sees exactly what they're signing (Phantom UI)
- ✅ User controls when transactions happen
- ✅ Transparent: Everyone knows user signed it

**Risks**:
- User must have Phantom installed
- User must understand blockchain (for validation)
- User pays gas fees

---

### For Embedded Users (Backend Signing)

```
┌──────────────────────────────────────┐
│  Supabase Database                     │
│  (Encrypted hospital wallet)           │
└────────────────┬─────────────────────┘
                 │
                 ▼ (Decrypted in-memory)
┌──────────────────────────────────────┐
│  Health Grid Backend                   │
│  - Decrypt hospital private key       │
│  - Sign TX with hospital keypair      │
│  - Private key NEVER written to disk  │
│  - Immediately discard from memory    │
└────────────────┬─────────────────────┘
                 │
                 ▼ (Signed TX)
          Solana Blockchain
          (TX on-chain)
```

**Security Benefits**:
- ✅ Users don't need blockchain knowledge
- ✅ Seamless experience (no prompts)
- ✅ Hospital controls gas fees (transparent cost)
- ✅ Same immutable audit trail

**Risks**:
- Hospital wallet private key must be protected
- Backend signing requires trust in hospital
- Users must trust hospital is doing the right thing

---

## 🎛️ Settings UI Component

```typescript
// src/components/WalletSettings.tsx
export function WalletSettings() {
  const [walletMode, setWalletMode] = useState<'auto' | 'phantom' | 'embedded'>('auto');
  const [isPhantomDetected, setIsPhantomDetected] = useState(false);

  useEffect(() => {
    // Load user preference
    const preference = await getUserWalletPreference();
    setWalletMode(preference.wallet_mode);

    // Check if Phantom available
    setIsPhantomDetected(!!window.solana?.isPhantom);
  }, []);

  const handleModeChange = async (newMode: string) => {
    await saveUserWalletPreference({
      wallet_mode: newMode,
      hospital_id: currentHospitalId,
    });
    setWalletMode(newMode);
  };

  return (
    <div className="space-y-6 p-6">
      <h2>Blockchain Wallet Settings</h2>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3>Current Wallet</h3>
        {walletMode === 'auto' ? (
          <>
            {isPhantomDetected ? (
              <p className="text-green-600">
                ✓ Phantom wallet detected. Using Phantom for signing.
              </p>
            ) : (
              <p className="text-blue-600">
                Using embedded wallet (Phantom not detected).
              </p>
            )}
          </>
        ) : walletMode === 'phantom' ? (
          <p className="text-green-600">✓ Using Phantom wallet (forced)</p>
        ) : (
          <p className="text-blue-600">✓ Using embedded wallet (forced)</p>
        )}
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-4 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="wallet-mode"
            value="auto"
            checked={walletMode === 'auto'}
            onChange={() => handleModeChange('auto')}
            className="mt-1"
          />
          <div>
            <h4>Auto-Detect (Recommended)</h4>
            <p className="text-sm text-gray-600">
              {isPhantomDetected
                ? 'Phantom detected. Will use Phantom for signing.'
                : 'Phantom not detected. Will use embedded wallet.'}
            </p>
          </div>
        </label>

        {isPhantomDetected && (
          <label className="flex items-start gap-3 p-4 border rounded cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="wallet-mode"
              value="phantom"
              checked={walletMode === 'phantom'}
              onChange={() => handleModeChange('phantom')}
              className="mt-1"
            />
            <div>
              <h4>Always Use Phantom</h4>
              <p className="text-sm text-gray-600">
                Always sign transactions with your Phantom wallet.
              </p>
            </div>
          </label>
        )}

        <label className="flex items-start gap-3 p-4 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="wallet-mode"
            value="embedded"
            checked={walletMode === 'embedded'}
            onChange={() => handleModeChange('embedded')}
            className="mt-1"
          />
          <div>
            <h4>Always Use Embedded Wallet</h4>
            <p className="text-sm text-gray-600">
              Transactions signed automatically by hospital. No prompts.
            </p>
          </div>
        </label>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg text-sm">
        <h4 className="font-semibold mb-2">💡 How It Works</h4>
        <ul className="space-y-1 text-gray-700">
          <li>
            <strong>Phantom:</strong> You control & sign transactions. You see
            what you're signing.
          </li>
          <li>
            <strong>Embedded:</strong> Hospital backend signs. Seamless but
            requires trust.
          </li>
        </ul>
      </div>
    </div>
  );
}
```

---

## 🔄 Implementation Phases

### Phase 1: Wallet Detection & UI (Week 1-2)
- [ ] Create `useHybridWallet` hook
- [ ] Implement Phantom detection logic
- [ ] Build wallet settings UI component
- [ ] Store user wallet preference in DB
- [ ] Add Phantom badge to header

### Phase 2: Phantom Integration (Week 3-4)
- [ ] Install Phantom SDK
- [ ] Build `signWithPhantom()` function
- [ ] Test with Phantom browser extension
- [ ] Handle Phantom connection errors
- [ ] Add wallet connection modal

### Phase 3: Transaction Routing (Week 5-6)
- [ ] Create transaction router
- [ ] Route to Phantom OR Embedded based on setting
- [ ] Unified error handling
- [ ] Progress indicators for both modes
- [ ] Handle network failures gracefully

### Phase 4: Audit Trail (Week 7-8)
- [ ] Create `signing_events` table
- [ ] Log all signing operations
- [ ] Track signer type (phantom vs embedded)
- [ ] Record user wallet (if Phantom)
- [ ] Create signing audit dashboard

### Phase 5: UI/UX Polish (Week 9-10)
- [ ] Add wallet status indicator
- [ ] Create confirmation dialogs
- [ ] Show gas fee estimates (Phantom mode)
- [ ] Add wallet connection troubleshooting
- [ ] Create help documentation

### Phase 6: Testing & Hardening (Week 11-12)
- [ ] Integration tests with Phantom
- [ ] Mock Phantom for unit tests
- [ ] Error handling edge cases
- [ ] Security review
- [ ] Load testing

---

## 📁 Files to Create/Modify

### Create

```typescript
// Client-side wallet hooks
src/lib/useHybridWallet.ts                (100 lines)
src/lib/phantom-wallet.client.ts          (200 lines)
src/lib/embedded-wallet-client.ts         (100 lines)

// Server-side signing
src/lib/hybrid-signer.server.ts           (150 lines)

// UI Components
src/components/WalletSelector.tsx         (200 lines)
src/components/WalletSettings.tsx         (300 lines)
src/components/WalletStatus.tsx           (100 lines)
src/components/SigningProgress.tsx        (150 lines)

// Database
supabase/migrations/20260819_hybrid_wallets.sql (200 lines)

// API endpoints
src/routes/api.anchor-record.ts           (100 lines)
```

### Modify

```typescript
src/lib/audit.server.ts                   (Add hybrid signing)
src/lib/pharmacy.server.ts                (Route through hybrid signer)
src/routes/admin.index.tsx                (Add wallet settings)
src/components/AppSidebar.tsx             (Add wallet status)
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// Test wallet detection
it('should detect Phantom wallet when installed', () => {
  window.solana = { isPhantom: true };
  const { walletMode } = useHybridWallet();
  expect(walletMode).toBe('phantom');
});

// Test fallback
it('should fallback to embedded when Phantom not installed', () => {
  window.solana = undefined;
  const { walletMode } = useHybridWallet();
  expect(walletMode).toBe('embedded');
});

// Test preference override
it('should use user preference over auto-detect', () => {
  mockGetUserPreference.mockResolvedValue({ wallet_mode: 'embedded' });
  const { walletMode } = useHybridWallet();
  expect(walletMode).toBe('embedded');
});
```

### Integration Tests

```typescript
// Test with Phantom mock
it('should sign with Phantom when available', async () => {
  mockPhantom.signTransaction.mockResolvedValue(signedTx);
  const result = await signWithPhantom(txData);
  expect(result.txId).toBeDefined();
  expect(mockPhantom.signTransaction).toHaveBeenCalled();
});

// Test with embedded fallback
it('should fallback to embedded when Phantom fails', async () => {
  mockPhantom.signTransaction.mockRejectedValue(new Error('Connection failed'));
  const result = await signAndAnchorTransaction(txData);
  expect(result.walletUsed).toBe('embedded');
});
```

---

## 🚀 Deployment Strategy

### Devnet Phase
1. Deploy wallet detection UI
2. Test with Phantom on Devnet
3. Verify embedded wallet works as fallback
4. Test switching between modes

### Testnet Phase
1. Deploy with settings UI
2. Test user preference storage
3. Verify audit trail recording
4. Load test with multiple users

### Mainnet Phase
1. Enable for hospitals opted-in
2. Monitor Phantom connection issues
3. Track wallet mode usage
4. Handle edge cases from production

---

## 📊 Success Metrics

**Phase 1-2**: 
- ✅ Phantom detected in 100% of installations
- ✅ Auto-fallback works in 100% of cases

**Phase 3-4**:
- ✅ Phantom signing works 99%+ of time
- ✅ Embedded fallback <100ms latency
- ✅ Both signers produce valid on-chain records

**Phase 5-6**:
- ✅ Settings UI usable by all user types
- ✅ 0 security issues in hybrid signing
- ✅ Audit trail 100% complete

---

## 🔧 Configuration

### Environment Variables

```bash
# Phantom settings
PHANTOM_NETWORK=devnet
PHANTOM_AUTO_CONNECT=true
PHANTOM_FORCE_MODE=        # Leave empty for auto-detect

# Fallback settings
EMBEDDED_WALLET_FALLBACK=true
EMBEDDED_WALLET_TIMEOUT=5000

# Gas fee settings (for Phantom users)
SHOW_GAS_ESTIMATES=true
MAX_GAS_FEE=0.01 # SOL
```

---

## 📞 Troubleshooting

### Phantom Not Detected
- Check: User has Phantom extension installed
- Check: User hasn't blocked extension
- Fallback: Use embedded wallet automatically

### Phantom Signing Fails
- Check: Phantom is connected to correct network
- Check: User has enough SOL for gas
- Fallback: Use embedded wallet as backup

### Embedded Wallet Fails
- Check: Hospital wallet has enough SOL
- Check: Hospital wallet isn't locked
- Retry: Exponential backoff + retry logic

---

## 📚 User Documentation

### For Tech-Savvy Users

"If you have Phantom wallet installed, you can sign transactions directly! You'll see a Phantom popup asking to approve. Your private key never leaves your device."

### For Regular Users

"Don't worry about wallets. Everything happens in the background. Just click buttons like normal!"

### For Admins

"You can choose how your hospital handles blockchain signing. Some staff might prefer using their personal Phantom wallet. Others prefer the seamless embedded experience."

