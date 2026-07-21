# 🔒 HIPAA Production Deployment Security Checklist

**Critical:** Complete ALL items before deploying to production with real patient data.

---

## 🔐 1. Encryption Configuration

### Data at Rest
- [ ] Set `ENCRYPTION_MASTER_KEY` environment variable (32-byte hex string)
- [ ] Generate key: `openssl rand -hex 32`
- [ ] Store master key in secure key management service (AWS KMS / Azure Key Vault / HashiCorp Vault)
- [ ] Verify encryption is working: Run encryption test
- [ ] Enable database encryption (if using managed database)
- [ ] Encrypt backup storage

### Data in Transit
- [ ] Obtain SSL/TLS certificate (Let's Encrypt or commercial CA)
- [ ] Configure HTTPS on all endpoints
- [ ] Set minimum TLS version to 1.2
- [ ] Enable HSTS (HTTP Strict Transport Security)
- [ ] Configure WSS (WebSocket Secure)
- [ ] Disable HTTP (redirect to HTTPS)

**Commands:**
```bash
# Generate encryption key
openssl rand -hex 32

# Test TLS configuration
openssl s_client -connect yourdomain.com:443 -tls1_2
```

---

## 🛡️ 2. Authentication & Access Control

- [ ] Set unique `JWT_SECRET` (minimum 32 characters)
- [ ] Generate: `openssl rand -base64 32`
- [ ] Set unique `CLIENT_KEY` for API authentication
- [ ] Remove all hardcoded secrets from source code
- [ ] Enable session timeout (15 minutes configured)
- [ ] Configure password complexity requirements
- [ ] Implement MFA (recommended)
- [ ] Test emergency access procedures

**Environment Variables:**
```bash
JWT_SECRET=<generate-with-openssl>
CLIENT_KEY=<generate-unique-key>
IDENTITY_SECRET=<generate-unique-key>
```

---

## 📝 3. Audit Logging

- [ ] Verify audit logging is enabled
- [ ] Test audit log writes
- [ ] Configure log retention (6 years minimum)
- [ ] Set up log backup and archival
- [ ] Configure log monitoring and alerts
- [ ] Test log integrity verification
- [ ] Implement log access controls
- [ ] Schedule regular log reviews

**Test Audit Logging:**
```bash
# Login and check audit log
curl -X POST http://localhost:3001/api/auth/login ...
# Check: backend/audit-logs/current-audit.n