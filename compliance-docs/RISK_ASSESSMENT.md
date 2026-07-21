# HIPAA Risk Assessment
## NIST SP 800-30 Methodology

**Document Version:** 1.0  
**Last Updated:** 2026-07-21  
**Assessment Period:** 2026 Q3  
**Next Review Date:** 2027-01-21  
**Classification:** CONFIDENTIAL - INTERNAL USE ONLY

---

## Executive Summary

This risk assessment evaluates the security posture of the Embrace Health Grid platform in accordance with HIPAA Security Rule requirements and NIST SP 800-30 Rev. 1 methodology. The assessment identifies threats to Protected Health Information (PHI), evaluates vulnerabilities, and provides risk mitigation strategies to maintain compliance and protect patient data.

**Key Findings:**
- **Total Assets Assessed:** 47
- **Critical Vulnerabilities Identified:** 3
- **High-Risk Scenarios:** 7
- **Medium-Risk Scenarios:** 15
- **Low-Risk Scenarios:** 24
- **Residual Risk Level:** ACCEPTABLE (after mitigation implementation)

---

## 1. Asset Inventory

### 1.1 Data Assets

#### 1.1.1 Protected Health Information (PHI)
| Asset ID | Asset Name | Classification | Storage Location | Custodian | Recovery Time Objective |
|----------|------------|----------------|------------------|-----------|------------------------|
| DA-001 | Patient Demographics | CRITICAL | Convex Database | Engineering Team | 4 hours |
| DA-002 | Medical Records | CRITICAL | Convex Database | Engineering Team | 4 hours |
| DA-003 | Treatment Plans | CRITICAL | Convex Database | Clinical Team | 4 hours |
| DA-004 | Medication Data | CRITICAL | Convex Database | Clinical Team | 4 hours |
| DA-005 | Lab Results | CRITICAL | Convex Database | Clinical Team | 4 hours |
| DA-006 | Appointment Records | HIGH | Convex Database | Operations Team | 8 hours |
| DA-007 | Provider Notes | CRITICAL | Convex Database | Clinical Team | 4 hours |
| DA-008 | Consent Forms | HIGH | Convex Database | Compliance Team | 24 hours |
| DA-009 | Insurance Information | HIGH | Convex Database | Billing Team | 24 hours |
| DA-010 | Payment Records | HIGH | Convex Database | Billing Team | 24 hours |
| DA-011 | Audit Logs | HIGH | Convex Database | Security Team | 24 hours |
| DA-012 | Session Data | MEDIUM | Convex Database | Engineering Team | 48 hours |

#### 1.1.2 Authentication & Credentials
| Asset ID | Asset Name | Classification | Storage Location | Custodian | Encryption Status |
|----------|------------|----------------|------------------|-----------|-------------------|
| DA-013 | User Passwords | CRITICAL | Convex Auth | Engineering Team | Hashed (Argon2) |
| DA-014 | API Keys | CRITICAL | Vercel Env Vars | Engineering Team | Encrypted at Rest |
| DA-015 | JWT Tokens | CRITICAL | Client Storage | Engineering Team | Signed, Short-lived |
| DA-016 | Session Tokens | HIGH | Convex Database | Engineering Team | Encrypted |
| DA-017 | 2FA Secrets | CRITICAL | Convex Database | Engineering Team | Encrypted |
| DA-018 | OAuth Tokens | HIGH | Convex Database | Engineering Team | Encrypted |
| DA-019 | Database Credentials | CRITICAL | Vercel Secrets | Engineering Team | Encrypted |
| DA-020 | Encryption Keys | CRITICAL | Vercel Secrets | Security Team | HSM-protected |

### 1.2 System Assets

#### 1.2.1 Application Infrastructure
| Asset ID | Asset Name | Type | Provider | Classification | Availability SLA |
|----------|------------|------|----------|----------------|-----------------|
| SA-001 | Web Application | Frontend | Vercel | CRITICAL | 99.99% |
| SA-002 | Backend API | API Server | Convex | CRITICAL | 99.99% |
| SA-003 | Database | NoSQL DB | Convex | CRITICAL | 99.99% |
| SA-004 | Admin Portal | Frontend | Vercel | HIGH | 99.9% |
| SA-005 | Authentication Service | Auth Provider | Convex Auth | CRITICAL | 99.99% |
| SA-006 | File Storage | Object Storage | Convex | HIGH | 99.9% |
| SA-007 | CDN | Content Delivery | Vercel Edge | MEDIUM | 99.9% |

#### 1.2.2 Development & Operations
| Asset ID | Asset Name | Type | Classification | Access Control |
|----------|------------|------|----------------|----------------|
| SA-008 | Source Code Repository | Version Control | HIGH | Role-based (GitHub) |
| SA-009 | CI/CD Pipeline | Automation | HIGH | Restricted (Vercel) |
| SA-010 | Development Environment | Testing | MEDIUM | Developer Access Only |
| SA-011 | Staging Environment | Testing | HIGH | QA Team Access |
| SA-012 | Production Environment | Live System | CRITICAL | Limited Access |
| SA-013 | Monitoring Dashboard | Operations | MEDIUM | Operations Team |
| SA-014 | Log Aggregation | Security | HIGH | Security Team |

### 1.3 Network Assets
| Asset ID | Asset Name | Purpose | Classification | Security Controls |
|----------|------------|---------|----------------|-------------------|
| NA-001 | Production Network | Application Hosting | CRITICAL | HTTPS/TLS 1.3, WAF |
| NA-002 | Admin Network | Administrative Access | HIGH | VPN, MFA Required |
| NA-003 | API Gateway | External Integration | HIGH | Rate Limiting, Auth |
| NA-004 | Backup Network | Data Backup | HIGH | Encrypted Channels |

### 1.4 Personnel Assets
| Role Category | Count | Access Level | Training Required | Background Check |
|---------------|-------|--------------|-------------------|------------------|
| System Administrators | 3 | CRITICAL | Annual HIPAA | Required |
| Developers | 8 | HIGH | Annual HIPAA | Required |
| Database Administrators | 2 | CRITICAL | Quarterly HIPAA | Required |
| Security Team | 2 | CRITICAL | Continuous | Required |
| Clinical Staff | 45 | HIGH | Annual HIPAA | Required |
| Support Staff | 12 | MEDIUM | Annual HIPAA | Recommended |

---

## 2. Threat Catalog

### 2.1 External Threats

#### 2.1.1 Cyber Attacks
| Threat ID | Threat Description | Threat Source | Likelihood | Impact | Risk Score |
|-----------|-------------------|---------------|------------|--------|------------|
| T-EXT-001 | Ransomware Attack | Organized Crime | MEDIUM | VERY HIGH | HIGH |
| T-EXT-002 | DDoS Attack | Hacktivists, Competitors | MEDIUM | HIGH | MEDIUM |
| T-EXT-003 | SQL Injection | Opportunistic Hackers | LOW | HIGH | MEDIUM |
| T-EXT-004 | Cross-Site Scripting (XSS) | Script Kiddies | MEDIUM | MEDIUM | MEDIUM |
| T-EXT-005 | Credential Stuffing | Automated Bots | MEDIUM | HIGH | HIGH |
| T-EXT-006 | API Abuse | Malicious Actors | MEDIUM | MEDIUM | MEDIUM |
| T-EXT-007 | Zero-Day Exploits | Advanced Threats | LOW | VERY HIGH | MEDIUM |
| T-EXT-008 | Phishing Attacks | Cybercriminals | HIGH | HIGH | HIGH |
| T-EXT-009 | Man-in-the-Middle | Nation-State, APT | LOW | VERY HIGH | MEDIUM |
| T-EXT-010 | Brute Force Attacks | Automated Tools | MEDIUM | MEDIUM | MEDIUM |

#### 2.1.2 Third-Party Risks
| Threat ID | Threat Description | Threat Source | Likelihood | Impact | Risk Score |
|-----------|-------------------|---------------|------------|--------|------------|
| T-EXT-011 | Vendor Data Breach | Third-Party Services | MEDIUM | HIGH | HIGH |
| T-EXT-012 | Supply Chain Attack | Compromised Dependencies | LOW | VERY HIGH | MEDIUM |
| T-EXT-013 | Service Provider Outage | Convex, Vercel | LOW | HIGH | MEDIUM |
| T-EXT-014 | Cloud Infrastructure Breach | Cloud Provider | LOW | VERY HIGH | MEDIUM |

### 2.2 Insider Threats

| Threat ID | Threat Description | Threat Source | Likelihood | Impact | Risk Score |
|-----------|-------------------|---------------|------------|--------|------------|
| T-INT-001 | Unauthorized PHI Access | Malicious Insider | LOW | VERY HIGH | MEDIUM |
| T-INT-002 | Data Exfiltration | Disgruntled Employee | LOW | VERY HIGH | MEDIUM |
| T-INT-003 | Privilege Abuse | Admin User | LOW | HIGH | MEDIUM |
| T-INT-004 | Accidental Data Disclosure | Negligent Staff | MEDIUM | HIGH | HIGH |
| T-INT-005 | Social Engineering | Manipulated Employee | MEDIUM | HIGH | HIGH |
| T-INT-006 | Weak Password Usage | Careless User | HIGH | MEDIUM | MEDIUM |
| T-INT-007 | Unpatched Systems | Negligent Admin | MEDIUM | HIGH | HIGH |
| T-INT-008 | Shadow IT | Well-Meaning Staff | MEDIUM | MEDIUM | MEDIUM |

### 2.3 Environmental Threats

| Threat ID | Threat Description | Threat Source | Likelihood | Impact | Risk Score |
|-----------|-------------------|---------------|------------|--------|------------|
| T-ENV-001 | Natural Disaster | Hurricane, Earthquake | LOW | HIGH | MEDIUM |
| T-ENV-002 | Power Failure | Infrastructure Issues | MEDIUM | MEDIUM | MEDIUM |
| T-ENV-003 | Internet Service Outage | ISP Failure | MEDIUM | HIGH | MEDIUM |
| T-ENV-004 | Hardware Failure | Equipment Defect | MEDIUM | MEDIUM | MEDIUM |
| T-ENV-005 | Data Center Failure | Multiple Causes | LOW | VERY HIGH | MEDIUM |

### 2.4 Compliance & Legal Threats

| Threat ID | Threat Description | Threat Source | Likelihood | Impact | Risk Score |
|-----------|-------------------|---------------|------------|--------|------------|
| T-LEG-001 | HIPAA Violation | Non-Compliance | MEDIUM | VERY HIGH | HIGH |
| T-LEG-002 | Data Subject Access Request | Patient Rights | HIGH | LOW | LOW |
| T-LEG-003 | Regulatory Audit | HHS OCR | MEDIUM | HIGH | MEDIUM |
| T-LEG-004 | Litigation | Malpractice/Breach | LOW | VERY HIGH | MEDIUM |
| T-LEG-005 | State Privacy Law Violation | Non-Compliance | MEDIUM | HIGH | MEDIUM |

---

## 3. Vulnerability Assessment

### 3.1 Technical Vulnerabilities

#### 3.1.1 Application Layer
| Vuln ID | Vulnerability | Affected Asset | Severity | CVSS Score | Status |
|---------|--------------|----------------|----------|------------|--------|
| V-APP-001 | Insufficient Session Timeout | SA-005 | MEDIUM | 5.3 | MITIGATED |
| V-APP-002 | Missing Rate Limiting on Login | SA-005 | HIGH | 7.5 | MITIGATED |
| V-APP-003 | Weak Password Policy | DA-013 | MEDIUM | 6.1 | MITIGATED |
| V-APP-004 | Insufficient Input Validation | SA-002 | MEDIUM | 5.8 | IN PROGRESS |
| V-APP-005 | Missing CSRF Protection | SA-001 | HIGH | 7.2 | MITIGATED |
| V-APP-006 | Inadequate Error Messages | SA-002 | LOW | 3.1 | ACCEPTED |
| V-APP-007 | Missing Security Headers | SA-001 | MEDIUM | 5.5 | MITIGATED |
| V-APP-008 | Potential XSS in User Input | SA-001 | MEDIUM | 6.3 | MITIGATED |

#### 3.1.2 Infrastructure Layer
| Vuln ID | Vulnerability | Affected Asset | Severity | CVSS Score | Status |
|---------|--------------|----------------|----------|------------|--------|
| V-INF-001 | Outdated TLS Configuration | NA-001 | MEDIUM | 5.9 | MITIGATED |
| V-INF-002 | Weak Cipher Suites | NA-001 | LOW | 4.3 | MITIGATED |
| V-INF-003 | Missing DDoS Protection | NA-003 | MEDIUM | 6.5 | MITIGATED |
| V-INF-004 | Insufficient Backup Frequency | SA-003 | MEDIUM | 5.0 | IN PROGRESS |
| V-INF-005 | No Automated Failover | SA-002 | HIGH | 7.0 | PLANNED |

#### 3.1.3 Data Layer
| Vuln ID | Vulnerability | Affected Asset | Severity | CVSS Score | Status |
|---------|--------------|----------------|----------|------------|--------|
| V-DAT-001 | Encryption Not Enabled for All Fields | DA-001-012 | CRITICAL | 8.5 | IN PROGRESS |
| V-DAT-002 | Insufficient Access Logging | DA-011 | MEDIUM | 5.5 | MITIGATED |
| V-DAT-003 | No Data Masking in Logs | DA-001-012 | HIGH | 7.8 | IN PROGRESS |
| V-DAT-004 | Weak Key Management | DA-020 | CRITICAL | 9.1 | MITIGATED |
| V-DAT-005 | Insufficient Data Retention Controls | DA-001-012 | MEDIUM | 5.2 | PLANNED |

### 3.2 Operational Vulnerabilities

| Vuln ID | Vulnerability | Impact Area | Severity | Status |
|---------|--------------|-------------|----------|--------|
| V-OPS-001 | Incomplete Incident Response Plan | Security Operations | HIGH | IN PROGRESS |
| V-OPS-002 | Insufficient Security Training | All Staff | MEDIUM | IN PROGRESS |
| V-OPS-003 | No Formal Change Management | Operations | MEDIUM | PLANNED |
| V-OPS-004 | Inadequate Vendor Risk Assessment | Third Parties | MEDIUM | IN PROGRESS |
| V-OPS-005 | Missing Business Continuity Plan | Business Operations | HIGH | PLANNED |
| V-OPS-006 | Incomplete Asset Inventory | IT Management | MEDIUM | IN PROGRESS |
| V-OPS-007 | No Regular Penetration Testing | Security | HIGH | PLANNED |
| V-OPS-008 | Insufficient Security Monitoring | Security Operations | MEDIUM | MITIGATED |

### 3.3 Human Vulnerabilities

| Vuln ID | Vulnerability | Affected Group | Severity | Status |
|---------|--------------|----------------|----------|--------|
| V-HUM-001 | Lack of Security Awareness | All Users | HIGH | IN PROGRESS |
| V-HUM-002 | Insufficient Privacy Training | Clinical Staff | MEDIUM | IN PROGRESS |
| V-HUM-003 | No Phishing Simulation Program | All Users | MEDIUM | PLANNED |
| V-HUM-004 | Weak Access Control Enforcement | IT Staff | MEDIUM | IN PROGRESS |
| V-HUM-005 | Inadequate Onboarding Process | New Employees | LOW | IN PROGRESS |

---

## 4. Risk Scoring Matrix

### 4.1 Likelihood Scale

| Rating | Description | Frequency | Probability |
|--------|-------------|-----------|-------------|
| VERY LOW | Rare occurrence | Once every 10+ years | < 10% |
| LOW | Unlikely but possible | Once every 5-10 years | 10-30% |
| MEDIUM | Occasional occurrence | Once every 2-5 years | 30-50% |
| HIGH | Frequent occurrence | Once every 1-2 years | 50-80% |
| VERY HIGH | Almost certain | Multiple times per year | > 80% |

### 4.2 Impact Scale

| Rating | Description | Financial Impact | Operational Impact | Reputational Impact |
|--------|-------------|-----------------|-------------------|---------------------|
| VERY LOW | Minimal impact | < $10,000 | < 1 hour downtime | Negligible |
| LOW | Minor impact | $10,000 - $50,000 | 1-4 hours downtime | Limited local impact |
| MEDIUM | Moderate impact | $50,000 - $250,000 | 4-24 hours downtime | Regional news coverage |
| HIGH | Significant impact | $250,000 - $1M | 1-7 days downtime | National news coverage |
| VERY HIGH | Catastrophic | > $1M | > 7 days downtime | Industry-wide impact |

### 4.3 Risk Level Matrix

|             | VERY LOW | LOW | MEDIUM | HIGH | VERY HIGH |
|-------------|----------|-----|--------|------|-----------|
| **VERY HIGH** | MEDIUM | MEDIUM | HIGH | CRITICAL | CRITICAL |
| **HIGH**      | LOW | MEDIUM | MEDIUM | HIGH | CRITICAL |
| **MEDIUM**    | LOW | LOW | MEDIUM | MEDIUM | HIGH |
| **LOW**       | VERY LOW | LOW | LOW | MEDIUM | MEDIUM |
| **VERY LOW**  | VERY LOW | VERY LOW | LOW | LOW | MEDIUM |

### 4.4 Risk Treatment Priority

| Risk Level | Response Time | Action Required | Approval Level |
|-----------|---------------|-----------------|----------------|
| CRITICAL | Immediate (< 24 hours) | Emergency mitigation | CISO + CEO |
| HIGH | Urgent (< 1 week) | Priority mitigation | CISO |
| MEDIUM | Scheduled (< 1 month) | Planned mitigation | Security Manager |
| LOW | Routine (< 3 months) | Standard controls | Security Team |
| VERY LOW | Monitored (annual review) | Accept or monitor | Security Team |

---

## 5. Risk Register

### 5.1 Critical Risks

#### RISK-001: PHI Data Breach via Database Compromise
- **Threat:** T-EXT-011, T-EXT-014
- **Vulnerability:** V-DAT-001, V-DAT-004
- **Affected Assets:** DA-001 through DA-012
- **Likelihood:** MEDIUM (35%)
- **Impact:** VERY HIGH ($2M+ breach costs, regulatory fines, patient harm)
- **Inherent Risk Score:** **CRITICAL**
- **Current Controls:**
  - TLS 1.3 encryption in transit
  - Database access logging
  - Role-based access control (RBAC)
  - Multi-factor authentication for admins
- **Control Effectiveness:** 70%
- **Residual Risk:** HIGH
- **Treatment Plan:** MITIGATE
  - Implement field-level encryption for all PHI (Q3 2026)
  - Deploy database activity monitoring (Q3 2026)
  - Conduct quarterly penetration testing (Q4 2026)
  - Implement automated data loss prevention (Q4 2026)
- **Residual Risk After Mitigation:** MEDIUM
- **Risk Owner:** Chief Information Security Officer
- **Review Date:** 2026-10-21

#### RISK-002: Ransomware Attack on Production Systems
- **Threat:** T-EXT-001
- **Vulnerability:** V-OPS-005, V-INF-004
- **Affected Assets:** SA-001 through SA-007, DA-001 through DA-012
- **Likelihood:** MEDIUM (40%)
- **Impact:** VERY HIGH ($1.5M+ ransom, 7+ days downtime)
- **Inherent Risk Score:** **CRITICAL**
- **Current Controls:**
  - Daily automated backups
  - Network segmentation
  - Endpoint protection
  - Email security gateway
- **Control Effectiveness:** 65%
- **Residual Risk:** HIGH
- **Treatment Plan:** MITIGATE
  - Implement immutable backup solution (Q3 2026)
  - Deploy advanced threat detection (Q3 2026)
  - Create and test disaster recovery plan (Q3 2026)
  - Conduct tabletop exercises quarterly (Q4 2026)
  - Increase backup frequency to every 6 hours (Q3 2026)
- **Residual Risk After Mitigation:** MEDIUM
- **Risk Owner:** Chief Technology Officer
- **Review Date:** 2026-10-21

#### RISK-003: Weak Encryption Key Management
- **Threat:** T-INT-001, T-EXT-009
- **Vulnerability:** V-DAT-004
- **Affected Assets:** DA-020, All encrypted data assets
- **Likelihood:** LOW (25%)
- **Impact:** VERY HIGH (Complete PHI exposure)
- **Inherent Risk Score:** **HIGH**
- **Current Controls:**
  - Encryption keys stored in Vercel secrets
  - Access restricted to 2 engineers
  - Keys rotated annually
- **Control Effectiveness:** 75%
- **Residual Risk:** MEDIUM
- **Treatment Plan:** MITIGATE
  - Migrate to Hardware Security Module (HSM) or KMS (Q3 2026) ✓ COMPLETED
  - Implement automated key rotation (Q3 2026)
  - Separate key management duties (Q3 2026)
  - Audit key access monthly (Q4 2026)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Chief Information Security Officer
- **Review Date:** 2026-10-21

### 5.2 High Risks

#### RISK-004: Credential Stuffing Attack
- **Threat:** T-EXT-005, T-EXT-008
- **Vulnerability:** V-APP-002, V-HUM-001
- **Affected Assets:** DA-013, SA-005
- **Likelihood:** HIGH (60%)
- **Impact:** HIGH (Unauthorized PHI access)
- **Inherent Risk Score:** HIGH
- **Current Controls:**
  - Password hashing with Argon2
  - Account lockout after 5 failed attempts
  - CAPTCHA on login forms
- **Control Effectiveness:** 80%
- **Residual Risk:** MEDIUM
- **Treatment Plan:** MITIGATE
  - Implement rate limiting (Q3 2026) ✓ COMPLETED
  - Deploy breach password detection (Q3 2026)
  - Mandatory MFA for all users (Q4 2026)
  - Security awareness training (Q3 2026)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Engineering Manager
- **Review Date:** 2026-10-21

#### RISK-005: Insider Data Exfiltration
- **Threat:** T-INT-002, T-INT-001
- **Vulnerability:** V-DAT-002, V-OPS-008
- **Affected Assets:** DA-001 through DA-012
- **Likelihood:** LOW (20%)
- **Impact:** VERY HIGH (Regulatory penalties, litigation)
- **Inherent Risk Score:** HIGH
- **Current Controls:**
  - Access logging enabled
  - Role-based access control
  - Background checks for employees
  - Data access agreements signed
- **Control Effectiveness:** 70%
- **Residual Risk:** MEDIUM
- **Treatment Plan:** MITIGATE
  - Deploy User and Entity Behavior Analytics (UEBA) (Q4 2026)
  - Implement data loss prevention (DLP) (Q4 2026)
  - Enhanced audit logging for bulk access (Q3 2026)
  - Quarterly access reviews (Q3 2026 ongoing)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Chief Information Security Officer
- **Review Date:** 2026-10-21

#### RISK-006: Accidental PHI Disclosure
- **Threat:** T-INT-004
- **Vulnerability:** V-HUM-001, V-HUM-002, V-DAT-003
- **Affected Assets:** DA-001 through DA-012
- **Likelihood:** MEDIUM (45%)
- **Impact:** HIGH (HIPAA violation, patient privacy breach)
- **Inherent Risk Score:** HIGH
- **Current Controls:**
  - Basic staff training
  - Email encryption for external communications
  - Access controls on patient records
- **Control Effectiveness:** 60%
- **Residual Risk:** MEDIUM
- **Treatment Plan:** MITIGATE
  - Comprehensive privacy training program (Q3 2026)
  - Data masking in non-production environments (Q3 2026)
  - Implement data loss prevention (DLP) (Q4 2026)
  - Regular phishing simulations (Q4 2026)
  - Automated data classification (Q4 2026)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Compliance Officer
- **Review Date:** 2026-10-21

#### RISK-007: HIPAA Compliance Violation
- **Threat:** T-LEG-001
- **Vulnerability:** V-DAT-001, V-OPS-001, V-OPS-004
- **Affected Assets:** All PHI assets
- **Likelihood:** MEDIUM (35%)
- **Impact:** VERY HIGH (Regulatory fines up to $1.5M annually)
- **Inherent Risk Score:** HIGH
- **Current Controls:**
  - Basic HIPAA documentation
  - Annual security assessments
  - Business Associate Agreements (BAAs)
- **Control Effectiveness:** 65%
- **Residual Risk:** MEDIUM
- **Treatment Plan:** MITIGATE
  - Complete comprehensive risk assessment (Q3 2026) ✓ IN PROGRESS
  - Document all security policies (Q3 2026)
  - Implement incident response plan (Q3 2026)
  - Conduct HIPAA compliance audit (Q4 2026)
  - Quarterly compliance reviews (Q4 2026 ongoing)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Compliance Officer
- **Review Date:** 2026-10-21

### 5.3 Medium Risks

#### RISK-008: DDoS Attack
- **Threat:** T-EXT-002
- **Vulnerability:** V-INF-003
- **Affected Assets:** SA-001, SA-002, NA-001
- **Likelihood:** MEDIUM (40%)
- **Impact:** MEDIUM (4-8 hours downtime)
- **Inherent Risk Score:** MEDIUM
- **Current Controls:**
  - Vercel Edge Network with DDoS protection
  - CDN distribution
  - Auto-scaling capabilities
- **Control Effectiveness:** 85%
- **Residual Risk:** LOW
- **Treatment Plan:** ACCEPT with monitoring
  - Continue monitoring attack patterns
  - Review protection quarterly
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Infrastructure Manager
- **Review Date:** 2027-01-21

#### RISK-009: Third-Party Service Disruption
- **Threat:** T-EXT-013
- **Vulnerability:** V-INF-005, V-OPS-005
- **Affected Assets:** SA-002 (Convex), SA-001 (Vercel)
- **Likelihood:** MEDIUM (30%)
- **Impact:** HIGH (Service unavailability)
- **Inherent Risk Score:** MEDIUM
- **Current Controls:**
  - SLA agreements with 99.99% uptime
  - Multi-region deployment
  - Status page monitoring
- **Control Effectiveness:** 80%
- **Residual Risk:** LOW
- **Treatment Plan:** MITIGATE
  - Implement automated failover procedures (Q4 2026)
  - Document disaster recovery procedures (Q3 2026)
  - Test failover quarterly (Q4 2026 ongoing)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Chief Technology Officer
- **Review Date:** 2027-01-21

#### RISK-010: Insufficient Security Monitoring
- **Threat:** All threats (detection failure)
- **Vulnerability:** V-OPS-008
- **Affected Assets:** All systems
- **Likelihood:** MEDIUM (40%)
- **Impact:** MEDIUM (Delayed incident detection)
- **Inherent Risk Score:** MEDIUM
- **Current Controls:**
  - Basic application logging
  - Convex dashboard monitoring
  - Manual log review
- **Control Effectiveness:** 50%
- **Residual Risk:** MEDIUM
- **Treatment Plan:** MITIGATE
  - Implement SIEM solution (Q4 2026)
  - Configure automated alerting (Q4 2026)
  - Establish 24/7 monitoring (2027 Q1)
  - Define security metrics and KPIs (Q3 2026)
- **Residual Risk After Mitigation:** LOW
- **Risk Owner:** Security Manager
- **Review Date:** 2027-01-21

---

## 6. Mitigation Strategies

### 6.1 Technical Controls

#### 6.1.1 Preventive Controls
| Control ID | Control Description | Risk(s) Addressed | Implementation Priority | Status |
|-----------|-------------------|------------------|------------------------|--------|
| TC-PRE-001 | Field-level encryption for all PHI | RISK-001, RISK-003 | CRITICAL | IN PROGRESS |
| TC-PRE-002 | Hardware Security Module (HSM) deployment | RISK-003 | CRITICAL | COMPLETED |
| TC-PRE-003 | Web Application Firewall (WAF) | T-EXT-003, T-EXT-004 | HIGH | COMPLETED |
| TC-PRE-004 | API rate limiting | RISK-004, T-EXT-006 | HIGH | COMPLETED |
| TC-PRE-005 | Multi-factor authentication (MFA) | RISK-004, T-INT-001 | HIGH | IN PROGRESS |
| TC-PRE-006 | Input validation framework | V-APP-004 | MEDIUM | IN PROGRESS |
| TC-PRE-007 | CSRF token implementation | V-APP-005 | MEDIUM | COMPLETED |
| TC-PRE-008 | Security headers (CSP, HSTS, etc.) | V-APP-007 | MEDIUM | COMPLETED |
| TC-PRE-009 | Data loss prevention (DLP) | RISK-005, RISK-006 | HIGH | PLANNED Q4 |
| TC-PRE-010 | Network segmentation | RISK-002, T-EXT-001 | MEDIUM | PLANNED |

#### 6.1.2 Detective Controls
| Control ID | Control Description | Risk(s) Addressed | Implementation Priority | Status |
|-----------|-------------------|------------------|------------------------|--------|
| TC-DET-001 | Database activity monitoring | RISK-001, RISK-005 | HIGH | PLANNED Q4 |
| TC-DET-002 | User behavior analytics (UEBA) | RISK-005, T-INT-001 | HIGH | PLANNED Q4 |
| TC-DET-003 | Intrusion detection system (IDS) | T-EXT-001, T-EXT-009 | MEDIUM | PLANNED |
| TC-DET-004 | Enhanced audit logging | RISK-005, RISK-007 | HIGH | IN PROGRESS |
| TC-DET-005 | SIEM solution | RISK-010, All threats | HIGH | PLANNED Q4 |
| TC-DET-006 | Anomaly detection system | T-INT-001, T-EXT-005 | MEDIUM | PLANNED 2027 |
| TC-DET-007 | File integrity monitoring | T-EXT-001, T-EXT-012 | MEDIUM | PLANNED |
| TC-DET-008 | Vulnerability scanning | All V-APP, V-INF | MEDIUM | PLANNED Q4 |

#### 6.1.3 Corrective Controls
| Control ID | Control Description | Risk(s) Addressed | Implementation Priority | Status |
|-----------|-------------------|------------------|------------------------|--------|
| TC-COR-