# Convex Quick Start - Realtime Store

Quick reference for working with the updated realtime store.

## 🚀 Setup (One-Time)

```bash
# 1. Install Convex (if not already installed)
npm install convex

# 2. Start Convex development server
npx convex dev

# 3. Copy the deployment URL and add to .env.local
# NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

## 📖 Basic Usage

### Import the Store

```typescript
import {
  initializeStore,
  getLivePatients,
  getLiveStaff,
  getPatientByDID,
  getStaffFromConvex,
  refreshFromConvex,
} from "@/lib/realtime-store";
```

### Initialize (Call once at app startup)

```typescript
// In your root layout or _app.tsx
await initializeStore();
```

### Get Live Data (Fast, cached)

```typescript
const patients = getLivePatients(); // Returns cached data
const staff = getLiveStaff(); // Returns cached data

const patient = getPatientByDID("did:healthlink:patient:123");
const patientByMRN = getPatientByMRN("MRN-200001");
```

### Fetch Fresh from Convex (Slower, direct query)

```typescript
// Refresh all data from Convex
await refreshFromConvex();

// Fetch single patient from Convex
const patient = await getPatientFromConvex("did:healthlink:patient:123");

// Fetch single staff member from Convex
const staff = await getStaffFromConvex("did:healthlink:staff:456");
```

## 📡 Real-Time Updates

### Listen to Events

```typescript
import { storeEvents } from "@/lib/realtime-store";

// Store ready
storeEvents.addEventListener("store:ready", () => {
  console.log("Store initialized");
});

// Data refreshed from Convex
storeEvents.addEventListener("store:refreshed", () => {
  console.log("Data refreshed");
});

// Vitals updated
storeEvents.addEventListener("vitals:update", () => {
  console.log("Patient vitals updated");
});

// Staff location updated
storeEvents.addEventListener("staff:location:update", (e) => {
  console.log("Staff moved:", e.detail);
});

// WebSocket status
storeEvents.addEventListener("ws:status", (e) => {
  console.log("WebSocket", e.detail ? "connected" : "disconnected");
});
```

## 🔧 Common Patterns

### React Component with Polling

```typescript
"use client";

import { useEffect, useState } from "react";
import { getLivePatients, storeEvents } from "@/lib/realtime-store";

export function PatientList() {
  const [patients, setPatients] = useState(getLivePatients());

  useEffect(() => {
    // Update when vitals change
    const handler = () => setPatients(getLivePatients());
    storeEvents.addEventListener("vitals:update", handler);
    storeEvents.addEventListener("store:refreshed", handler);

    return () => {
      storeEvents.removeEventListener("vitals:update", handler);
      storeEvents.removeEventListener("store:refreshed", handler);
    };
  }, []);

  return (
    <div>
      {patients.map((p) => (
        <div key={p.id}>{p.name} - HR: {p.vitals.heartRate}</div>
      ))}
    </div>
  );
}
```

### Periodic Refresh from Convex

```typescript
useEffect(() => {
  // Refresh from Convex every 5 minutes
  const interval = setInterval(
    async () => {
      await refreshFromConvex();
    },
    5 * 60 * 1000,
  );

  return () => clearInterval(interval);
}, []);
```

### Manual Refresh Button

```typescript
const [loading, setLoading] = useState(false);

const handleRefresh = async () => {
  setLoading(true);
  try {
    await refreshFromConvex();
    toast.success("Data refreshed");
  } catch (error) {
    toast.error("Failed to refresh");
  } finally {
    setLoading(false);
  }
};

return <button onClick={handleRefresh} disabled={loading}>Refresh</button>;
```

### Fetch Patient Details on Demand

```typescript
const [patient, setPatient] = useState(null);

const loadPatient = async (did: string) => {
  // First try cache
  let patient = getPatientByDID(did);

  // If not in cache, fetch from Convex
  if (!patient) {
    patient = await getPatientFromConvex(did);
  }

  setPatient(patient);
};
```

## 🎯 Key Differences from localStorage Version

| Feature            | Before (localStorage) | After (Convex)    |
| ------------------ | --------------------- | ----------------- |
| **Data Source**    | `localStorage`        | Convex database   |
| **Persistence**    | Browser only          | Cloud storage     |
| **Sync**           | None                  | Real-time         |
| **Initialization** | Synchronous           | Async (awaitable) |
| **Queries**        | Manual filtering      | Database indexes  |
| **Type Safety**    | Manual                | Auto-generated    |

## 🐛 Troubleshooting

### Error: Cannot find module '../../convex/\_generated/api'

**Solution**: Run `npx convex dev` to generate API types.

### Error: ConvexHttpClient not found

**Solution**: Install Convex: `npm install convex`

### Error: NEXT_PUBLIC_CONVEX_URL not set

**Solution**: Add to `.env.local`:

```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

### Data not loading

**Check**:

1. Convex is running: `npx convex dev`
2. Environment variable is set
3. Database has data (check Convex dashboard)
4. Console for error messages

### WebSocket not connecting

**Check**:

1. WebSocket server is running on `ws://localhost:3001`
2. Check browser console for connection errors
3. Firewall/proxy settings

## 📚 API Reference

### Functions

| Function                    | Return Type                    | Description                           |
| --------------------------- | ------------------------------ | ------------------------------------- |
| `initializeStore()`         | `Promise<void>`                | Initialize store and load from Convex |
| `getLivePatients()`         | `LivePatient[]`                | Get cached patients (fast)            |
| `getLiveStaff()`            | `LiveStaff[]`                  | Get cached staff (fast)               |
| `getLiveAppointments()`     | `LiveAppointment[]`            | Get appointments                      |
| `getLiveTransactions()`     | `LiveTransaction[]`            | Get transactions                      |
| `getPatientByDID(did)`      | `LivePatient \| null`          | Find patient by DID (cached)          |
| `getPatientByMRN(mrn)`      | `LivePatient \| null`          | Find patient by MRN (cached)          |
| `refreshFromConvex()`       | `Promise<void>`                | Refresh all data from Convex          |
| `getPatientFromConvex(did)` | `Promise<LivePatient \| null>` | Fetch patient from Convex (slow)      |
| `getStaffFromConvex(did)`   | `Promise<LiveStaff \| null>`   | Fetch staff from Convex (slow)        |
| `getWorkerConnected()`      | `boolean`                      | Check if WebSocket is connected       |

### Events

| Event                   | Detail                           | Description                     |
| ----------------------- | -------------------------------- | ------------------------------- |
| `store:ready`           | `undefined`                      | Store initialized               |
| `store:refreshed`       | `undefined`                      | Data refreshed from Convex      |
| `vitals:update`         | `undefined`                      | Patient vitals updated          |
| `vitals:updated`        | `{ patientDid, vitals }`         | Specific patient vitals updated |
| `staff:location:update` | `{ memberId, location, status }` | Staff location changed          |
| `ws:status`             | `boolean`                        | WebSocket connection status     |
| `ws:message`            | `any`                            | Raw WebSocket message           |

## 💡 Best Practices

1. **Cache First**: Use `getLivePatients()` for fast reads
2. **Refresh Strategically**: Only call `refreshFromConvex()` when needed
3. **Listen to Events**: Subscribe to store events for reactivity
4. **Handle Errors**: Wrap Convex calls in try-catch
5. **Show Loading States**: Async operations need UI feedback
6. **Don't Poll Excessively**: WebSocket provides real-time updates

## 🔗 Links

- [Full Migration Guide](./CONVEX_MIGRATION.md)
- [Convex Documentation](https://docs.convex.dev)
- [Schema Definition](./convex/schema.ts)
- [Convex Queries/Mutations](./convex/records.ts)

---

**Quick Tip**: The store works the same as before for most use cases. Just make sure to `await initializeStore()` at startup!
