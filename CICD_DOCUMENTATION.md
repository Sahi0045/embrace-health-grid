# CI/CD Pipeline Documentation — Embrace Health Grid

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Workflow Files](#workflow-files)
4. [CI Pipeline (ci.yml)](#ci-pipeline)
5. [CD Staging Pipeline (cd-staging.yml)](#cd-staging-pipeline)
6. [CD Production Pipeline (cd-production.yml)](#cd-production-pipeline)
7. [Security & Compliance (security.yml)](#security--compliance)
8. [Required Secrets](#required-secrets)
9. [Environment Configuration](#environment-configuration)
10. [Docker Images](#docker-images)
11. [Deployment Workflow](#deployment-workflow)
12. [Manual Triggers](#manual-triggers)
13. [Rollback Procedure](#rollback-procedure)
14. [Local Development Setup](#local-development-setup)
15. [Adding New Tests](#adding-new-tests)

---

## Overview

Every code push and pull request runs a full validation suite. Only commits that pass all required checks are eligible to be deployed. Production deployments are fully automated on merge to `main`.

```
Developer pushes code
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                    CI Pipeline                      │
│  lint → typecheck → test-unit → test-api → build   │
│  (all must pass before merge is allowed)            │
└─────────────────────────────────────────────────────┘
        │                           │
     PR merge                   push to develop
        │                           │
        ▼                           ▼
┌──────────────┐          ┌──────────────────┐
│   CD Prod    │          │   CD Staging     │
│  (main only) │          │ (develop only)   │
└──────────────┘          └──────────────────┘
```

---

## Pipeline Architecture

| Branch    | CI | CD Staging | CD Production | Security Scan |
|-----------|----|------------|---------------|---------------|
| `main`    | ✅  | ❌          | ✅ (auto)      | ✅ (weekly)    |
| `develop` | ✅  | ✅ (auto)   | ❌             | ✅ (on push)   |
| PRs → main| ✅  | ❌          | ❌             | ✅             |
| PRs → develop | ✅ | ❌       | ❌             | ❌             |

---

## Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Continuous Integration — lint, build, test, Docker |
| `.github/workflows/cd-staging.yml` | Continuous Deployment to staging (develop branch) |
| `.github/workflows/cd-production.yml` | Continuous Deployment to production (main branch) |
| `.github/workflows/security.yml` | Security scans — audit, CodeQL, Trivy, license check |

---

## CI Pipeline

**File:** `.github/workflows/ci.yml`  
**Triggers:** Push to `main`/`develop`, PRs to `main`/`develop`, manual

### Jobs

| Job | Depends on | Description |
|-----|-----------|-------------|
| `lint-frontend` | — | ESLint (zero warnings), Prettier format check, TypeScript type-check |
| `lint-admin-portal` | — | Admin portal ESLint, typecheck, Vite build |
| `build-frontend` | lint-frontend | Vite production build, artifact upload |
| `test-unit` | — | 28 Merkle Tree unit tests (node:test runner) |
| `test-backend-api` | — | Backend starts live, HTTP smoke tests against all endpoints |
| `build-anchor` | — | Rust fmt check, clippy, cargo build (on push only) |
| `docker` | build-frontend, test-unit, test-backend-api | Build & push backend + frontend images to GHCR |
| `ci-gate` | all required jobs | Summary gate — branch protection should require this job |

### Branch Protection Settings

Configure these in **Settings → Branches → Branch protection rules** for `main`:

- ✅ Require status checks to pass before merging
- ✅ Require branch to be up to date before merging
- Required checks: `CI Gate (all checks passed)`
- ✅ Require pull request reviews before merging (minimum 1)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Do not allow bypassing the above settings

---

## CD Staging Pipeline

**File:** `.github/workflows/cd-staging.yml`  
**Triggers:** Push to `develop`, manual

### Flow

```
push to develop
      │
      ▼
check-ci (verifies CI Gate passed on this commit)
      │
   ┌──┴──────────────────┐
   │                     │
   ▼                     ▼
deploy-frontend-staging  deploy-backend-staging
(Vercel preview)         (SSH → docker compose up)
   │                     │
   └──────────┬──────────┘
              │
              ▼
     smoke-test-staging
     (HTTP probes against staging URLs)
```

### Staging URLs

| Service | URL |
|---------|-----|
| Frontend | Vercel preview URL (output in job logs) |
| Backend API | `$STAGING_API_URL` secret |

---

## CD Production Pipeline

**File:** `.github/workflows/cd-production.yml`  
**Triggers:** Push to `main`, manual (with required reason input)

### Flow

```
push to main (after CI Gate passes)
      │
      ▼
check-ci (blocks if CI Gate not passed)
      │
      ▼
migrate (PHI encryption migration dry-run)
      │
   ┌──┴──────────────────┐
   │                     │
   ▼                     ▼
deploy-backend-prod     deploy-frontend-prod
(SSH rolling restart)   (Vercel --prod)
   │                     │
   └──────────┬──────────┘
              │
              ▼
     smoke-test-prod
     (liveness + readiness + frontend probes)
              │
              ▼ (on failure only)
     notify-failure (Slack alert)
```

### Production Safety Guarantees

1. **CI Gate required** — production deploy is blocked if CI hasn't passed on that exact commit SHA
2. **Rolling restart** — `docker compose up -d --no-deps` restarts backend with zero downtime
3. **Health check rollback** — if backend fails to become ready within 60s, rollback is triggered
4. **Single concurrency** — `cancel-in-progress: false` ensures no two production deploys run simultaneously
5. **Failure alerting** — Slack notification on any production deploy failure

---

## Security & Compliance

**File:** `.github/workflows/security.yml`  
**Triggers:** Push to `main`/`develop`, PRs to `main`, weekly (Monday 08:00 UTC), manual

### Jobs

| Job | Tool | What it checks |
|-----|------|----------------|
| `dependency-audit` | `npm audit` | Known CVEs in frontend, backend, admin-portal packages |
| `secret-scan` | gitleaks | Hardcoded secrets, tokens, keys in git history |
| `sast` | CodeQL | SQL injection, XSS, path traversal, insecure crypto (TS/JS) |
| `container-scan` | Trivy | CVEs in Docker base images (blocks on CRITICAL) |
| `license-check` | license-checker | GPL/unknown licenses in npm dependencies |
| `cargo-audit` | cargo-audit | Known CVEs in Rust/Anchor program dependencies |

### Viewing Security Results

- **SARIF results** (CodeQL + Trivy): **GitHub → Security → Code scanning alerts**
- **npm audit reports**: Download from GitHub Actions artifacts
- **License reports**: Download from GitHub Actions artifacts (retained 90 days)

---

## Required Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions**.

### Repository Secrets (all environments)

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_TOKEN` | Auto | Provided by GitHub — used for GHCR push and package writes |

### Environment: `staging`

| Secret | Required | Description |
|--------|----------|-------------|
| `VITE_API_BASE_URL` | ✅ | Staging backend URL e.g. `https://api-staging.embrace-health.com` |
| `VITE_CLIENT_KEY` | ✅ | Client authentication key |
| `VITE_CONVEX_URL` | Optional | Convex deployment URL |
| `VERCEL_TOKEN` | Optional | Vercel deploy token (skip Vercel if not set) |
| `VERCEL_ORG_ID` | Optional | Vercel organisation ID |
| `VERCEL_PROJECT_ID` | Optional | Vercel project ID |
| `STAGING_API_URL` | Optional | Full staging API URL for smoke tests |
| `STAGING_SSH_HOST` | Optional | Staging server hostname/IP |
| `STAGING_SSH_USER` | Optional | SSH username on staging server |
| `STAGING_SSH_KEY` | Optional | SSH private key (PEM, no passphrase) |
| `STAGING_SSH_PORT` | Optional | SSH port (default: 22) |

### Environment: `production`

| Secret | Required | Description |
|--------|----------|-------------|
| `VITE_API_BASE_URL` | ✅ | Production backend URL |
| `VITE_CLIENT_KEY` | ✅ | Client authentication key |
| `VITE_CONVEX_URL` | Optional | Convex deployment URL |
| `VERCEL_TOKEN` | ✅ | Vercel deploy token |
| `VERCEL_ORG_ID` | ✅ | Vercel organisation ID |
| `VERCEL_PROJECT_ID` | ✅ | Vercel project ID |
| `PROD_API_URL` | ✅ | Full production API URL for smoke tests |
| `PROD_SSH_HOST` | ✅ | Production server hostname/IP |
| `PROD_SSH_USER` | ✅ | SSH username |
| `PROD_SSH_KEY` | ✅ | SSH private key |
| `PROD_SSH_PORT` | Optional | SSH port (default: 22) |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `CLIENT_KEY` | ✅ | Client authentication key |
| `DATA_ENCRYPTION_KEY` | ✅ | 64-hex AES-256 key for PHI encryption |
| `AUDIT_HMAC_KEY` | ✅ | HMAC key for audit log signing |
| `SLACK_WEBHOOK_URL` | Optional | Slack incoming webhook for failure alerts |

### Generating Secure Keys

```bash
# JWT secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# DATA_ENCRYPTION_KEY (exactly 64 hex chars = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# AUDIT_HMAC_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment Configuration

### Staging server setup

```bash
# On the staging server
mkdir -p /opt/embrace-health-staging
cd /opt/embrace-health-staging

# Copy docker-compose files
scp docker-compose.yml docker-compose.staging.yml user@staging-server:/opt/embrace-health-staging/

# Create environment file
cat > .env << 'EOF'
JWT_SECRET=<generate with crypto.randomBytes>
CLIENT_KEY=<random secret>
DATA_ENCRYPTION_KEY=<64 hex chars>
AUDIT_HMAC_KEY=<64 hex chars>
CORS_ORIGIN=https://staging.embrace-health.com
NODE_ENV=staging
LOG_LEVEL=info
SOLANA_RPC_URL=https://api.devnet.solana.com
EOF

# Start
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Production server setup

```bash
mkdir -p /opt/embrace-health-prod
cd /opt/embrace-health-prod

# Copy base docker-compose only
scp docker-compose.yml user@prod-server:/opt/embrace-health-prod/

# Create environment file (use production secrets)
cat > .env << 'EOF'
NODE_ENV=production
JWT_SECRET=<production-secret>
...
EOF

docker compose up -d
```

---

## Docker Images

Images are published to GitHub Container Registry (GHCR) on every push to `main` or `develop`.

| Image | Tag | Built from |
|-------|-----|-----------|
| `ghcr.io/<owner>/embrace-health-grid-backend` | `latest` | `main` branch |
| `ghcr.io/<owner>/embrace-health-grid-backend` | `staging` | `develop` branch |
| `ghcr.io/<owner>/embrace-health-grid-backend` | `sha-<short-sha>` | Every push |
| `ghcr.io/<owner>/embrace-health-grid-frontend` | `latest` | `main` branch |
| `ghcr.io/<owner>/embrace-health-grid-frontend` | `staging` | `develop` branch |

### Pulling images locally

```bash
# Authenticate
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull latest backend
docker pull ghcr.io/sahi0045/embrace-health-grid-backend:latest
```

---

## Deployment Workflow

### Standard flow (recommended)

```
feature branch → PR to develop → CI passes → merge → auto-deploy to staging
                                                             │
                                                    manual QA on staging
                                                             │
develop → PR to main → CI passes → code review → merge → auto-deploy to production
```

### Hotfix flow

```
hotfix branch → PR to main → CI passes → code review → merge → auto-deploy to production
```

---

## Manual Triggers

All workflows support manual triggers from **GitHub → Actions → [Workflow] → Run workflow**.

### Manually deploy to staging

1. Go to **Actions → CD — Staging**
2. Click **Run workflow**
3. Select branch `develop`
4. Optionally enter a reason
5. Click **Run workflow**

### Manually deploy to production

1. Go to **Actions → CD — Production**
2. Click **Run workflow**
3. Select branch `main`
4. Enter a mandatory reason (e.g. "Hotfix: fix auth bug after #123")
5. Set `skip_ci_check` to `true` only for emergency deploys
6. Click **Run workflow**

### Manually run security scans

1. Go to **Actions → Security & Compliance Scans**
2. Click **Run workflow** on any branch

---

## Rollback Procedure

### Frontend (Vercel)

```bash
# List recent deployments
vercel list --token=$VERCEL_TOKEN

# Rollback to previous deployment
vercel rollback <deployment-url> --token=$VERCEL_TOKEN
```

### Backend (Docker)

```bash
# SSH into production server
ssh user@prod-server
cd /opt/embrace-health-prod

# Pull the previous image by SHA tag
docker pull ghcr.io/sahi0045/embrace-health-grid-backend:sha-<previous-sha>

# Update .env to point to old image
export BACKEND_IMAGE=ghcr.io/sahi0045/embrace-health-grid-backend:sha-<previous-sha>

# Restart backend
docker compose up -d --no-deps backend

# Verify health
curl http://localhost:3001/health/ready
```

### Via GitHub Actions (re-deploy previous commit)

1. Find the previous successful production deploy in **Actions → CD — Production**
2. Click **Re-run jobs** on that workflow run

---

## Local Development Setup

```bash
# Clone and install
git clone https://github.com/Sahi0045/embrace-health-grid.git
cd embrace-health-grid
npm ci
cd backend && npm ci && cd ..
cd admin-portal && npm ci && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your local values

# Run all services
npm run dev
# → Backend:      http://localhost:3001
# → Frontend:     http://localhost:8080
# → Admin Portal: http://localhost:3002
```

### Running tests locally

```bash
# Backend unit tests (Merkle Tree)
npm run test:backend

# Backend API tests (requires running server)
# Terminal 1:
npm run dev --prefix backend
# Terminal 2:
npm run test:backend:api

# All backend tests (unit only, no live server needed)
cd backend && npm test

# Frontend type-check
npm run typecheck

# Frontend lint
npm run lint

# Format check
npm run format:check
```

---

## Adding New Tests

### Backend unit tests

Add test files to `backend/test/*.test.js`. The CI pipeline automatically picks up all files matching `backend/test/**/*.test.js`.

```js
// backend/test/my-feature.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { myFunction } from '../lib/my-module.js';

describe('myFunction', () => {
  it('does the right thing', () => {
    assert.equal(myFunction('input'), 'expected');
  });
});
```

Run locally:

```bash
cd backend
node --test test/my-feature.test.js
# or run all tests:
node --test test/
```

### Backend API smoke tests

Add new HTTP assertions to `backend/test/api.test.js` in the appropriate `describe` block.

### Frontend tests

To add frontend tests, install Vitest:

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

Then add a `test` script to the root `package.json`:

```json
"test:frontend": "vitest --run"
```

And add a `test-frontend` job to `.github/workflows/ci.yml` following the same pattern as `test-unit`.
