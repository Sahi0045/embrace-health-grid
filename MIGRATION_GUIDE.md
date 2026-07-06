# 🚀 Migration Guide - Post Hyperledger Removal

**For Developers & DevOps Teams**

---

## ⚡ Quick Start

If you're setting up the project fresh after the Hyperledger removal:

```bash
# 1. Clone the repository
git clone <repository-url>
cd embrace-health-grid

# 2. Install dependencies
npm install
cd backend && npm install && cd ..
cd admin-portal && npm install && cd ..

# 3. Create environment file
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL=http://localhost:3001

# 4. Start the backend
cd backend
node server.js
# Or with auto-reload: node --watch server.js

# 5. In another terminal, start the frontend
cd embrace-health-grid
npm run dev

# 6. In another terminal, start admin portal
cd admin-portal
npm run dev
```

---

## 🔄 Migration from Old Version

### For Existing Deployments

#### 1. **Environment Variables - CRITICAL** ⚠️

**Old variables (DELETE these):**
```bash
VITE_FABRIC_API_URL=http://localhost:3001
VITE_FABRIC_BASE=http://localhost:3001
```

**New variables (ADD these):**
```bash
VITE_API_BASE_URL=http://localhost:3001
```

**Platform-Specific Instructions:**

**Vercel:**
```bash
# Remove old variables
vercel env rm VITE_FABRIC_API_URL
vercel env rm VITE_FABRIC_BASE

# Add new variable
vercel env add VITE_API_BASE_URL
# Enter: http://your-backend-url:3001
```

**Netlify:**
1. Go to Site Settings → Environment Variables
2. Delete: `VITE_FABRIC_API_URL`, `VITE_FABRIC_BASE`
3. Add: `VITE_API_BASE_URL` = `http://your-backend-url:3001`

**Docker Compose:**
```yaml
# docker-compose.yml
services:
  frontend:
    environment:
      - VITE_API_BASE_URL=http://backend:3001  # Changed from VITE_FABRIC_BASE
```

**GitHub Actions / CI:**
```yaml
# .github/workflows/deploy.yml
env:
  VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}  # Changed from VITE_FABRIC_BASE
```

---

#### 2. **User Session Clearing** ⚠️

**The localStorage key for authentication tokens has changed:**
- Old: `fabricAuthToken`
- New: `authToken`

**Impact:** All users will be logged out automatically.

**For production:**
1. Communicate to users about the forced logout
2. Consider a migration script (optional):

```javascript
// migrations/migrate-auth-token.js
if (typeof window !== 'undefined') {
  const oldToken = localStorage.getItem('fabricAuthToken');
  if (oldToken) {
    localStorage.setItem('authToken', oldToken);
    localStorage.removeItem('fabricAuthToken');
    console.log('✅ Auth token migrated successfully');
  }
}
```

**Or just accept the logout** - recommended for security reasons.

---

#### 3. **Backend Folder Rename**

**The backend folder has been renamed:**
- Old: `fabric-backend/`
- New: `backend/`

**Update any scripts that reference the old path:**

**package.json scripts:**
```json
{
  "scripts": {
    "backend": "cd backend && node server.js",
    "backend:dev": "cd backend && node --watch server.js"
  }
}
```

**Docker:**
```dockerfile
# Dockerfile
WORKDIR /app/backend  # Changed from /app/fabric-backend
COPY backend/ ./backend/
```

**Systemd Service:**
```ini
# /etc/systemd/system/embrace-backend.service
[Service]
WorkingDirectory=/var/www/embrace-health-grid/backend  # Changed from fabric-backend
ExecStart=/usr/bin/node /var/www/embrace-health-grid/backend/server.js
```

---

#### 4. **Import Path Updates (Auto-Completed)**

These have already been updated in the code, but if you have custom scripts:

**Old imports:**
```typescript
import { fabricLogin, fabricGetDIDs } from "@/lib/fabric-api";
import { useFabricStats, useFabricDIDs } from "@/hooks/use-fabric";
```

**New imports:**
```typescript
import { login, getAllDIDs } from "@/lib/api";
import { useStats, useDIDs } from "@/hooks/use-api";
```

---

## 🔍 API Reference Changes

### Function Name Mapping

For any external integrations or custom code:

| Old Function | New Function |
|-------------|-------------|
| `fabricLogin(email, password)` | `login(email, password)` |
| `fabricSignup(data)` | `signup(data)` |
| `fabricGetAllDIDs()` | `getAllDIDs()` |
| `fabricCreateDID(data)` | `createDID(data)` |
| `fabricIssueCredential(data)` | `issueCredential(data)` |
| `fabricGetConsents(did)` | `getConsents(did)` |
| `fabricSignPrescription(data)` | `signPrescription(data)` |
| `fabricBookAppointment(data)` | `bookAppointment(data)` |
| `isFabricOnline()` | `isBackendOnline()` |

**Full list:** See `src/lib/api.ts` for all 59 renamed functions.

---

### Hook Name Mapping

| Old Hook | New Hook |
|---------|---------|
| `useFabricStats()` | `useStats()` |
| `useFabricDIDs()` | `useDIDs()` |
| `useFabricCredentials()` | `useCredentials()` |
| `useFabricConsents()` | `useConsents()` |
| `useFabricAudit()` | `useAudit()` |
| `useFabricAppointments()` | `useAppointments()` |
| `useFabricBeds()` | `useBeds()` |
| `useFabricConnection()` | `useConnection()` |

**Full list:** See `src/hooks/use-api.ts` for all 14 renamed hooks.

---

## 🛠️ Backend API Changes

### Endpoint Changes

| Old Endpoint | New Endpoint | Breaking? |
|-------------|-------------|-----------|
| `/api/chaincode/invoke` | `/api/invoke` | ⚠️ Yes |
| All other endpoints | No change | ✅ No |

**Impact:** If you have external services calling `/api/chaincode/invoke`, update them to `/api/invoke`.

---

### Response Data Structure Changes

**Audit Events:**
```json
// Old response
{
  "chaincode": "audit-chaincode",
  "channel": "embrace-health-channel"
}

// New response
{
  "module": "audit",
  "network": "embrace-health-network"
}
```

**Health Endpoint:**
```json
// Old response
{
  "peers": 3
}

// New response
{
  "nodes": 3
}
```

**DID Registry:**
```json
// Old response (in zkproof context)
{
  "chaincode": "did-registry",
  "channel": "embrace-health-channel"
}

// New response
{
  "module": "did-registry",
  "network": "embrace-health-network"
}
```

---

## 🧪 Testing Checklist

After migration, test these critical flows:

### Backend Health
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","blockHeight":1,"nodes":3}
```

### Authentication
```bash
# Signup (requires existing admin)
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -H "x-client-key: apollo-consortium-client-secret-2026" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User","role":"patient"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-client-key: apollo-consortium-client-secret-2026" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### DID Operations
```bash
# Get all DIDs (requires auth token)
curl http://localhost:3001/api/did \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-client-key: apollo-consortium-client-secret-2026"
```

### Frontend Tests
- [ ] Login page loads
- [ ] Can login successfully
- [ ] Patient dashboard shows data
- [ ] Staff dashboard shows data
- [ ] Admin portal loads
- [ ] Real-time updates work (WebSocket)
- [ ] DID creation works
- [ ] Credential issuance works
- [ ] Consent management works

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to backend"

**Symptoms:** Frontend shows offline status, API calls fail

**Solutions:**
1. Check backend is running: `curl http://localhost:3001/health`
2. Verify `VITE_API_BASE_URL` is set correctly in `.env`
3. Check CORS settings in `backend/server.js`
4. Check firewall/network settings

---

### Issue: "Invalid token" after migration

**Symptoms:** Getting 401 errors on protected routes

**Solutions:**
1. Clear browser localStorage: `localStorage.clear()`
2. Re-login with your credentials
3. Check JWT_SECRET is set in backend environment
4. Verify token format in browser DevTools → Application → Local Storage

---

### Issue: WebSocket not connecting

**Symptoms:** No real-time updates, console shows WebSocket errors

**Solutions:**
1. Verify backend WebSocket server is running (same port as REST API)
2. Check `API_BASE_URL` in `src/hooks/use-notifications.ts`
3. Check browser console for WebSocket connection errors
4. Verify firewall allows WebSocket connections

---

### Issue: Old function names causing errors

**Symptoms:** TypeScript errors like `fabricLogin is not exported`

**Solutions:**
1. Clear TypeScript cache: `rm -rf node_modules/.cache`
2. Restart TypeScript server in your IDE
3. Rebuild: `npm run build`
4. Check you're importing from `@/lib/api` not `@/lib/fabric-api`

---

## 📦 Deployment Platforms

### Vercel

```bash
# 1. Update environment variables
vercel env add VITE_API_BASE_URL production
# Enter your production backend URL

# 2. Redeploy
vercel --prod
```

### Netlify

```bash
# 1. netlify.toml
[build.environment]
  VITE_API_BASE_URL = "https://api.yourdomain.com"

# 2. Deploy
netlify deploy --prod
```

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY admin-portal/package*.json ./admin-portal/

# Install dependencies
RUN npm install
RUN cd backend && npm install
RUN cd admin-portal && npm install

# Copy source
COPY . .

# Build
RUN npm run build
RUN cd admin-portal && npm run build

# Expose ports
EXPOSE 3001 5173 3002

# Start script
CMD ["sh", "-c", "cd backend && node server.js & npm run dev & cd admin-portal && npm run dev"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - CLIENT_KEY=apollo-consortium-client-secret-2026
      - CORS_ORIGIN=http://frontend:5173
    
  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://backend:3001
    depends_on:
      - backend
    
  admin:
    build: ./admin-portal
    ports:
      - "3002:3002"
    environment:
      - VITE_API_BASE_URL=http://backend:3001
    depends_on:
      - backend
```

---

## 🔐 Security Notes

### Client Key Security

**⚠️ Important:** The client key `apollo-consortium-client-secret-2026` is currently hardcoded in the source.

**For production:**
1. Generate a new random key: `openssl rand -hex 32`
2. Set it as an environment variable:
   ```bash
   # Backend
   export CLIENT_KEY="your-new-secret-key"
   
   # Frontend
   export VITE_CLIENT_KEY="your-new-secret-key"
   ```
3. Remove the hardcoded fallback in `src/lib/api.ts`

---

### JWT Secret

**Never use the dev JWT secret in production!**

```bash
# Generate a secure JWT secret
openssl rand -base64 64

# Set in production environment
export JWT_SECRET="your-generated-secret"
```

---

## 📊 Performance Considerations

### Build Size Impact

The renaming has **no impact** on build size - the number of functions and hooks remains the same.

### Runtime Performance

- ✅ No performance degradation
- ✅ Same API call patterns
- ✅ Same WebSocket behavior
- ✅ Same caching strategies

---

## 📝 Rollback Plan

If you need to rollback:

1. **Git revert:**
   ```bash
   git log --oneline  # Find the commit before migration
   git revert <commit-hash>
   ```

2. **Restore old environment variables:**
   ```bash
   VITE_FABRIC_BASE=http://localhost:3001
   ```

3. **Restore old localStorage key:**
   ```javascript
   const token = localStorage.getItem('authToken');
   if (token) {
     localStorage.setItem('fabricAuthToken', token);
   }
   ```

---

## ✅ Post-Migration Checklist

- [ ] Updated `.env` file with `VITE_API_BASE_URL`
- [ ] Updated CI/CD environment variables
- [ ] Updated deployment platform variables (Vercel/Netlify/etc)
- [ ] Updated Docker configs if applicable
- [ ] Tested login flow
- [ ] Tested API calls
- [ ] Tested real-time WebSocket updates
- [ ] Tested admin portal
- [ ] Notified users about session clearing
- [ ] Updated documentation
- [ ] Monitored error logs post-deployment

---

## 📞 Support

If you encounter issues:

1. Check `HYPERLEDGER_REMOVAL_REPORT.md` for detailed change list
2. Review `FOLDER_STRUCTURE.md` for updated file locations
3. Check `PROJECT_REPORT.md` for architecture overview
4. Search for error messages in browser console
5. Check backend logs

---

**Last Updated:** 2026-06-26  
**Migration Version:** 1.0.0  
**Status:** Production Ready ✅
