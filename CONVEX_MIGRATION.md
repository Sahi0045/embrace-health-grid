# Convex Migration Guide - Realtime Store

This document explains the migration of `realtime-store.ts` from localStorage to Convex database.

## Overview

The realtime store has been updated to use **Convex** as the primary data source instead of localStorage. This provides:

- ✅ **Centralized data storage** across all clients
- ✅ **Real-time synchronization** via Convex subscriptions
- ✅ **Persistent storage** that survives browser refreshes
- ✅ **Type-safe queries and mutations**
- ✅ **Automatic conflict resolution**

## Architecture

### Data Flow

```
┌─────────────┐
│   Convex    │
│  Database   │ ← Single source of truth
└──────┬──────┘
       │
       ├─→ Initial Load (on store init)
       │
       ├─→ Query Patient/Staff Data
       │
       └─→ Persist WebSocket Updates (TODO)

┌──────────────┐
│  WebSocket   │ ← Real-time events
│    Server    │
└──────┬───────┘
       │
       └─→ Vitals/Location Updates

┌──────────────┐
│ Local Cache  │ ← Fast reads
│ (_liveData)  │
└──────────────┘
```

### Key Components

1. **ConvexHttpClient**: Used for queries (non-React context)
2. **Local Cache**: In-memory storage for fast access
3. **WebSocket**: Real-time updates from backend
4. **Vitals Tracker**: Local simulation when offline

## Changes Made

### 1. Removed Functions

- ❌ `getDIDRegistry()` - Used localStorage

### 2. New Functions

- ✅ `fetchDIDsFromConvex()` - Fetch DIDs from Convex
- ✅ `rebuildLiveListsFromConvex()` - Load patient/staff from Convex
- ✅ `refreshFromConvex()` - Manually refresh all data
- ✅ `getPatientFromConvex(did)` - Fetch single patient
- ✅ `getStaffFromConvex(did)` - Fetch single staff member

### 3. Updated Functions

| Function                        | Before                      | After                                |
| ------------------------------- | --------------------------- | ------------------------------------ |
| `initializeStore()`             | Used localStorage           | Calls `rebuildLiveListsFromConvex()` |
| `getLivePatients()`             | Merged localStorage + cache | Returns cache (synced with Convex)   |
| `getLiveStaff()`                | Merged localStorage + cache | Returns cache (synced with Convex)   |
| `handleStoreWebSocketMessage()` | Updated localStorage        | TODO: Sync to Convex                 |
| `setupWebSocket()`              | Synced to localStorage      | TODO: Sync to Convex                 |

## Setup Instructions

### Step 1: Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

Get this URL from your Convex dashboard after running `npx convex dev`.

### Step 2: Generate Convex API

Run Convex in development mode:

```bash
npx convex dev
```

This generates `convex/_generated/api.ts` with type-safe function references.

### Step 3: Seed Initial Data (Optional)

If you have existing localStorage data, you can migrate it:

```typescript
// Migration script (one-time)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Get localStorage data
const registry = JSON.parse(localStorage.getItem("hl:didregistry") || "{}");

// Upload to Convex
for (const [did, doc] of Object.entries(registry)) {
  await client.mutation(api.records.createDID, {
    did: doc.did,
    owner: doc.owner,
    ownerType: doc.ownerType,
    controller: doc.controller,
    publicKey: doc.publicKey,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    serviceEndpoint: doc.serviceEndpoint,
  });
}
```

### Step 4: Enable WebSocket Sync (TODO)

The store is currently set up to read from Convex but has TODOs for writing back. To enable:

1. **Uncomment sync code** in `handleStoreWebSocketMessage()`:
   - Vitals updates → `updatePatientVitals`
   - Location updates → `updateStaffLocation`
   - DID updates → rebuild from Convex

2. **Test thoroughly** - ensure no duplicate writes

3. **Monitor performance** - batch updates if needed

## Usage Examples

### Basic Usage (No Changes)

```typescript
import { getLivePatients, getLiveStaff } from "@/lib/realtime-store";

// Works the same as before
const patients = getLivePatients();
const staff = getLiveStaff();
```

### Fetch Fresh Data from Convex

```typescript
import { refreshFromConvex } from "@/lib/realtime-store";

// Force refresh from Convex
await refreshFromConvex();
```

### Get Single Record from Convex

```typescript
import { getPatientFromConvex, getStaffFromConvex } from "@/lib/realtime-store";

// Bypass cache, fetch directly from Convex
const patient = await getPatientFromConvex("did:healthlink:patient:123");
const staff = await getStaffFromConvex("did:healthlink:staff:456");
```

### Listen to Events

```typescript
import { storeEvents } from "@/lib/realtime-store";

// Listen for Convex refresh
storeEvents.addEventListener("store:refreshed", () => {
  console.log("Data refreshed from Convex");
});
```

## TODOs

### High Priority

- [ ] Set `NEXT_PUBLIC_CONVEX_URL` environment variable
- [ ] Run `npx convex dev` to generate API types
- [ ] Test data loading from Convex
- [ ] Remove `@ts-ignore` from API import

### Medium Priority

- [ ] Uncomment WebSocket → Convex sync code
- [ ] Add error handling for Convex failures
- [ ] Implement retry logic for failed queries
- [ ] Add loading states for async operations

### Low Priority

- [ ] Add periodic background refresh from Convex
- [ ] Implement optimistic updates
- [ ] Add offline queue for mutations
- [ ] Set up Convex real-time subscriptions (replace WebSocket polling)

## Benefits

### Before (localStorage)

- ❌ Data lost on browser clear
- ❌ No sync between tabs/devices
- ❌ Manual serialization/deserialization
- ❌ No schema validation
- ❌ Limited query capabilities

### After (Convex)

- ✅ Persistent data storage
- ✅ Real-time sync across clients
- ✅ Automatic type safety
- ✅ Schema validation
- ✅ Powerful queries and indexes
- ✅ Built-in security rules
- ✅ Automatic backups

## Migration Checklist

- [x] Update imports (ConvexHttpClient, api)
- [x] Replace `getDIDRegistry()` with `fetchDIDsFromConvex()`
- [x] Replace `rebuildLiveListsFromRegistry()` with `rebuildLiveListsFromConvex()`
- [x] Update `initializeStore()` to use Convex
- [x] Update `getLivePatients()` to remove localStorage dependency
- [x] Update `getLiveStaff()` to remove localStorage dependency
- [x] Add `refreshFromConvex()` helper
- [x] Add `getPatientFromConvex()` helper
- [x] Add `getStaffFromConvex()` helper
- [x] Add TODO comments for WebSocket sync
- [x] Update documentation
- [ ] Test with real Convex instance
- [ ] Enable WebSocket → Convex sync
- [ ] Remove localStorage fallback code

## Testing

### Test Initial Load

```typescript
import { initializeStore, getLivePatients } from "@/lib/realtime-store";

await initializeStore();
const patients = getLivePatients();
console.log(`Loaded ${patients.length} patients from Convex`);
```

### Test Refresh

```typescript
import { refreshFromConvex, getLivePatients } from "@/lib/realtime-store";

console.log("Before:", getLivePatients().length);
await refreshFromConvex();
console.log("After:", getLivePatients().length);
```

### Test Direct Queries

```typescript
import { getPatientFromConvex } from "@/lib/realtime-store";

const patient = await getPatientFromConvex("did:healthlink:patient:123");
if (patient) {
  console.log(`Found: ${patient.name} (${patient.mrn})`);
}
```

## Rollback Plan

If issues arise, you can temporarily revert:

1. Restore old `getDIDRegistry()` function
2. Restore old `rebuildLiveListsFromRegistry()` function
3. Update `initializeStore()` to use old functions
4. Comment out Convex imports

Keep the old code in version control for easy rollback.

## Support

- **Convex Docs**: https://docs.convex.dev
- **Convex Discord**: https://convex.dev/community
- **TypeScript Docs**: https://www.typescriptlang.org/docs

## Notes

- **WebSocket still active**: Real-time updates still work via WebSocket
- **Vitals tracking preserved**: Local simulation continues to work
- **Location tracking preserved**: Staff location updates still work
- **No breaking changes**: All public APIs remain the same
- **Gradual migration**: Can enable Convex sync incrementally

---

**Last Updated**: 2026-07-03  
**Status**: Ready for testing (requires Convex setup)
