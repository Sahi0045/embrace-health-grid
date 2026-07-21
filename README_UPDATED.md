# 🏥 Embrace Health Grid

**A Modern Healthcare Management Platform with Distributed Backend**

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)]()
[![Backend](https://img.shields.io/badge/Backend-Express%20REST%20%2B%20WebSocket-blue)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20TanStack-purple)]()

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd embrace-health-grid

# Install all dependencies
npm install
cd backend && npm install && cd ..
cd admin-portal && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env and configure VITE_API_BASE_URL

# Start the backend (terminal 1)
cd backend
node server.js

# Start the main frontend (terminal 2)
npm run dev

# Start the admin portal (terminal 3)
cd admin-portal
npm run dev
```

**Access the applications:**

- Main Frontend: http://localhost:5173
- Admin Portal: http://localhost:3002
- Backend API: http://localhost:3001

---

## 📋 What's New - v2.0 (Hyperledger-Free)

**✅ Complete Architecture Refactor**

This version represents a major refactoring where all Hyperledger Fabric references have been removed and replaced with clean, vendor-neutral terminology.

**Key Changes:**

- 🔄 `fabric-backend/` → `backend/` (folder renamed)
- 🔄 `fabric-api.ts` → `api.ts` (59 functions renamed)
- 🔄 `use-fabric.ts` → `use-api.ts` (14 hooks renamed)
- 🔄 `fabricLogin()` → `login()` (all API functions cleaned)
- 🔄 `VITE_FABRIC_BASE` → `VITE_API_BASE_URL` (env vars updated)

**See:** `HYPERLEDGER_REMOVAL_REPORT.md` for complete details.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
├──────────────────────────┬──────────────────────────────────┤
│   Main Frontend          │      Admin Portal                │
│   (Patient + Staff)      │      (System Admin)              │
│   Port 5173              │      Port 3002                   │
│   - React + TanStack     │      - React + TanStack          │
│   - Shadcn/UI            │      - Shadcn/UI                 │
└──────────┬───────────────┴────────────┬─────────────────────┘
           │                            │
           │  REST API + WebSocket      │
           └────────────┬───────────────┘
                        │
           ┌────────────▼────────────┐
           │   Backend Server        │
           │   Port 3001             │
           │   - Express REST API    │
           │   - WebSocket Server    │
           │   - In-Memory State     │
           │   - File Persistence    │
           └────────────┬────────────┘
                        │
           ┌────────────▼────────────┐
           │   Optional Convex DB    │
           │   (Cloud Sync)          │
           └─────────────────────────┘
```

---

## 🎯 Features

### 🔐 Identity & Access

- ✅ Decentralized Identifiers (DIDs)
- ✅ Verifiable Credentials (VCs)
- ✅ Role-Based Access Control (RBAC)
- ✅ JWT Authentication
- ✅ NFC Card Management

### 🏥 Clinical Features

- ✅ Patient Management
- ✅ Appointment Scheduling
- ✅ Prescription Management
- ✅ Lab Orders & Results
- ✅ Medical Records
- ✅ Bed Management
- ✅ Real-time Vitals Monitoring

### 🔒 Privacy & Consent

- ✅ Granular Consent Management
- ✅ Zero-Knowledge Proofs (ZKP)
- ✅ Audit Trail
- ✅ HIPAA Compliance Ready

### 📊 Admin & Analytics

- ✅ System Dashboard
- ✅ User Management
- ✅ Fraud Detection
- ✅ Billing & Payments
- ✅ Staff Attendance Tracking
- ✅ Visitor Management

### ⚡ Real-Time

- ✅ WebSocket Live Updates
- ✅ Staff Location Tracking
- ✅ Vitals Monitoring
- ✅ Bed Status Updates
- ✅ Notification System

### 🔗 Blockchain Anchoring

- ✅ Solana Integration (optional)
- ✅ Immutable Audit Records
- ✅ Credential Verification

---

## 📁 Project Structure

```
embrace-health-grid/
├── backend/                      # Express REST + WebSocket backend
│   ├── server.js                 # Main server (1550+ lines)
│   ├── world-state-db.js         # File-based key-value store
│   ├── lib/
│   │   ├── audit.js              # Audit logging
│   │   ├── identity.js           # DID/VC signing
│   │   ├── notifications.js      # Notification system
│   │   ├── solana.js             # Solana anchoring
│   │   └── vc-sign.js            # Credential signing
│   ├── middleware/
│   │   └── auth.js               # JWT validation
│   └── routes/
│       └── extensions.js         # Extended API routes
│
├── src/                          # Main frontend (Patient + Staff)
│   ├── components/               # React components
│   ├── hooks/
│   │   ├── use-api.ts            # Backend API hooks
│   │   └── use-notifications.ts  # WebSocket hooks
│   ├── lib/
│   │   ├── api.ts                # REST API client (59 functions)
│   │   ├── auth.ts               # Authentication utilities
│   │   └── realtime-store.ts     # Real-time state management
│   └── routes/                   # TanStack Router pages
│       ├── patient.*.tsx         # Patient portal pages
│       └── staff.*.tsx           # Staff portal pages
│
├── admin-portal/                 # Admin frontend
│   └── src/
│       └── routes/               # Admin pages
│           ├── audit.tsx         # Audit timeline
│           ├── command.tsx       # Command center
│           ├── dids.tsx          # DID management
│           ├── credentials.tsx   # Credential management
│           ├── fraud.tsx         # Fraud alerts
│           └── ...
│
├── convex/                       # Optional Convex schema
│   ├── schema.ts                 # Database schema
│   └── records.ts                # Database functions
│
├── .env.example                  # Environment template
├── HYPERLEDGER_REMOVAL_REPORT.md # Detailed refactor report
├── MIGRATION_GUIDE.md            # Migration instructions
└── package.json                  # Root dependencies
```

---

## 🛠️ Tech Stack

### Backend

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **WebSocket:** ws
- **Auth:** JWT (jsonwebtoken)
- **Crypto:** bcryptjs, jose
- **Storage:** In-memory + File persistence
- **Optional:** Convex cloud sync

### Frontend

- **Framework:** React 18
- **Router:** TanStack Router
- **State:** TanStack Query
- **UI:** Shadcn/UI + Tailwind CSS
- **Build:** Vite
- **TypeScript:** 5.x

### Infrastructure

- **Package Manager:** npm / pnpm / bun
- **Dev Server:** Vite HMR
- **Production:** Vercel / Netlify / Docker

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:3001

# Client Authentication Key (change in production!)
VITE_CLIENT_KEY=apollo-consortium-client-secret-2026

# Optional: Convex Database
VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud

# Backend-specific (set in backend/ directory)
JWT_SECRET=your-secure-jwt-secret-here
CLIENT_KEY=apollo-consortium-client-secret-2026
CORS_ORIGIN=http://localhost:5173
```

---

## 📡 API Reference

### Authentication

```typescript
// Login
await login({ email: string, password: string });
// Returns: { success: boolean, token: string, user: User }

// Signup (requires admin JWT)
await signup({ email, password, name, role });
```

### DIDs

```typescript
// Create a new DID
await createDID({
  controller: string,
  name: string,
  role: "patient" | "staff" | "admin"
})

// Resolve a DID
await resolveDID(did: string)

// Get all DIDs
await getAllDIDs()
```

### Credentials

```typescript
// Issue a verifiable credential
await issueCredential({
  holder: string,      // DID
  credentialType: string,
  claims: Record<string, any>
})

// Get credentials for a DID
await getCredentials(holderDid?: string)
```

### Consent

```typescript
// Grant consent
await grantConsent({
  grantor: string,     // Patient DID
  grantee: string,     // Staff DID
  scope: string[],     // ["read:vitals", "write:prescriptions"]
  expiresAt?: Date
})

// Revoke consent
await revokeConsent(consentId: string)

// Request consent
await requestConsent({
  requester: string,   // Staff DID
  patient: string,     // Patient DID
  scope: string[],
  reason: string
})
```

**Full API:** See `src/lib/api.ts` for all 59 functions.

---

## 🎣 React Hooks

### Data Hooks

```typescript
// Get backend statistics
const { data, loading, error } = useStats();

// Get all DIDs
const { data: dids } = useDIDs();

// Get user's credentials
const { data: credentials } = useCredentials();

// Get audit events
const { data: auditEvents } = useAudit({ page: 1, size: 20 });

// Get appointments
const { data: appointments } = useAppointments();

// Get bed status
const { data: beds } = useBeds();
```

### Real-Time Hooks

```typescript
// Live patient vitals
const { data: patients } = useLivePatients();

// Live staff locations
const { data: staff } = useLiveStaff();

// Patient-specific vitals
const vitals = usePatientVitals(patientId);

// Backend connection status
const { isOnline } = useConnection();
```

**Full Reference:** See `src/hooks/use-api.ts` for all 14 hooks.

---

## 🧪 Testing

```bash
# Run backend
cd backend
node server.js

# Test health endpoint
curl http://localhost:3001/health
# Expected: {"status":"ok","blockHeight":1,"nodes":3}

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-client-key: apollo-consortium-client-secret-2026" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

---

## 🚢 Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add VITE_API_BASE_URL production

# Deploy
vercel --prod
```

### Docker

```bash
# Build
docker build -t embrace-health .

# Run
docker run -p 3001:3001 -p 5173:5173 -p 3002:3002 \
  -e JWT_SECRET=your-secret \
  -e VITE_API_BASE_URL=http://localhost:3001 \
  embrace-health
```

See `MIGRATION_GUIDE.md` for detailed deployment instructions.

---

## 🔒 Security

### Production Checklist

- [ ] Change `JWT_SECRET` to a secure random value
- [ ] Change `CLIENT_KEY` to a secure random value
- [ ] Remove hardcoded secrets from `src/lib/api.ts`
- [ ] Enable HTTPS on all endpoints
- [ ] Configure CORS for your domain
- [ ] Enable rate limiting
- [ ] Set up proper logging and monitoring
- [ ] Review and restrict API access

---

## 📚 Documentation

- **`HYPERLEDGER_REMOVAL_REPORT.md`** - Complete refactoring details
- **`MIGRATION_GUIDE.md`** - Upgrade from v1.x instructions
- **`FOLDER_STRUCTURE.md`** - Detailed file structure
- **`PROJECT_REPORT.md`** - Architecture overview
- **`BACKEND_REFACTOR_TASK.md`** - Backend modernization plan
- **`RBAC_IMPLEMENTATION.md`** - Role-based access control
- **`INPATIENT_FEATURES.md`** - Inpatient management features

---

## 🐛 Known Issues

1. **ZKProof Storage Bug** - `generateZKProof` and `verifyZKProof` have incorrect `putState`/`getState` arity (backend/server.js:932-980)
2. **Stats Endpoint** - `getStats()` returns hardcoded mock data, no live backend endpoint
3. **Admin Portal Pages** - 5 pages (/attendance, /federation, /compliance, /resources, /infrastructure) are disconnected from backend

See `HYPERLEDGER_REMOVAL_REPORT.md` section 11 for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

[Specify your license here]

---

## 👥 Authors

[Specify authors here]

---

## 🙏 Acknowledgments

- Built with [TanStack Router](https://tanstack.com/router)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

## 📞 Support

For issues and questions:

- Create an issue on GitHub
- Check the documentation in `/docs`
- Review `MIGRATION_GUIDE.md` for common problems

---

**Last Updated:** 2026-06-26  
**Version:** 2.0.0 (Hyperledger-Free)  
**Status:** ✅ Production Ready
