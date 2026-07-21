# NFC Device Constraints & Integration Reference

> **Project**: Embrace Health Grid  
> **Last Updated**: 2026-07-16  
> **Status**: Active — Pilot Deployment Reference

---

## 1. NFC Payload Contract

### 1.1 NFC Card Schema (Backend World-State)

```json
{
  "cardId": "NFC-A1B2C3D4",
  "patientDid": "did:solana:devnet:patient:<pubkey>",
  "patientName": "Anika Sharma",
  "mrn": "MRN-60914",
  "cardType": "patient",
  "status": "active | revoked",
  "issuedAt": "2026-07-01T09:30:00.000Z",
  "issuedBy": "admin@embracehealth.in",
  "revokedAt": "2026-07-15T14:00:00.000Z"
}
```

### 1.2 Signed QR/NFC Payload (Identity Verification)

```json
{
  "did": "did:solana:devnet:patient:<pubkey>",
  "mrn": "MRN-60914",
  "name": "Anika Sharma",
  "exp": 1751600000000,
  "channel": "embrace-health-channel",
  "network": "embrace-health-network"
}
```

### 1.3 NDEF Record Format (Physical NFC Tag)

When writing to a physical NFC tag (NTAG215/216), the NDEF record contains:

- **Type**: `application/json`
- **Payload**: JSON-serialized signed identity payload (see 1.2)
- **Signature**: HMAC-SHA256 with hospital identity secret

---

## 2. UI Event Model

### 2.1 NFC State Machine

```
┌──────┐    tap detected    ┌─────────┐    payload parsed    ┌───────────┐
│ idle │ ──────────────────→ │ reading │ ──────────────────→  │ verifying │
└──────┘                     └─────────┘                      └───────────┘
   ↑                              │                                │
   │         15s timeout          │                                ├── verified ──→ [success]
   │ ◄────────────────────────────┘                                │
   │                                                               └── failed ────→ [error]
   │                                                                                   │
   └──────────────────────── reset ────────────────────────────────────────────────────┘
```

### 2.2 Error Codes

| Code                | HTTP | Description                    | UI Action                      |
| ------------------- | ---- | ------------------------------ | ------------------------------ |
| `CARD_REVOKED`      | 403  | Card has been revoked by admin | Show warning + auto-suggest QR |
| `CARD_NOT_FOUND`    | 404  | Card ID not in registry        | Guide manual MRN input         |
| `SIGNATURE_INVALID` | 400  | Payload signature mismatch     | "Contact IT support" message   |
| `DID_EXPIRED`       | 400  | Patient DID document expired   | "Request credential renewal"   |

### 2.3 WebSocket Events

| Event                | Trigger                | Data              |
| -------------------- | ---------------------- | ----------------- |
| `nfc:updated`        | Card issued or revoked | Card object       |
| `attendance:clocked` | Staff clock in/out     | Attendance record |

---

## 3. Browser Support Matrix

| Browser          | Platform                    | Web NFC | QR Camera | Manual MRN |
| ---------------- | --------------------------- | ------- | --------- | ---------- |
| Chrome 89+       | Android                     | ✅      | ✅        | ✅         |
| Chrome           | Desktop (Windows/Mac/Linux) | ❌      | ✅        | ✅         |
| Safari           | iOS                         | ❌      | ✅        | ✅         |
| Safari           | macOS                       | ❌      | ✅        | ✅         |
| Firefox          | Any                         | ❌      | ✅        | ✅         |
| Edge             | Android                     | ❌      | ✅        | ✅         |
| Edge             | Desktop                     | ❌      | ✅        | ✅         |
| Samsung Internet | Android                     | ❌      | ✅        | ✅         |

> **Note**: Web NFC API (`NDEFReader`) is exclusively available in Chrome on Android.
> iOS CoreNFC is only accessible via native apps, not web browsers.

### 3.1 Hardware Requirements (For Real NFC)

- Android device with NFC hardware
- Chrome browser version 89 or later
- NFC enabled in device settings
- NTAG215/NTAG216 compatible NFC tags (for physical cards)

---

## 4. Fallback Path Matrix

Every NFC-required action has guaranteed fallback paths:

| Action                            | Primary            | Fallback 1            | Fallback 2                   | Notes                                            |
| --------------------------------- | ------------------ | --------------------- | ---------------------------- | ------------------------------------------------ |
| **Patient identity verification** | NFC card tap       | QR code scan (camera) | Manual MRN + override reason | Override logged as `MANUAL_OVERRIDE` audit event |
| **Staff attendance clock-in**     | NFC card tap       | Button clock-in (UI)  | —                            | Both methods log `ATTENDANCE_CLOCK_IN`           |
| **Visitor check-in**              | Staff button       | Staff button          | —                            | Audit logged as `VISITOR_CHECKIN`                |
| **Patient QR display**            | QR auto-generation | Manual refresh        | —                            | QR rotates every 60 seconds                      |

### 4.1 Automatic Fallback Triggers

- **15-second NFC timeout**: If no NFC card detected within 15 seconds, system auto-displays error and suggests switching to QR tab
- **3x consecutive NFC failures**: After 3 failed NFC attempts, UI forces QR/manual fallback suggestion
- **Camera permission denied**: QR scanner shows "Simulate Scan" button as alternative

---

## 5. Operational Guide for Hospital IT Staff

### 5.1 NFC Kiosk Setup

1. Use Android tablet with NFC capability (recommended: Samsung Galaxy Tab Active)
2. Install Chrome and navigate to Embrace Health Grid URL
3. Login as `staff` role
4. Navigate to Verify Patient → NFC Card tab
5. NFC capability badge should show "NFC Available" (green)

### 5.2 When NFC is Not Available

- Desktop workstations: Use QR scan (webcam) or Manual MRN input
- iOS devices: Use QR scan only — NFC is not supported in browser
- If NFC badge shows yellow warning: Use simulation mode for demo

### 5.3 NFC Card Lifecycle

1. **Issue**: Admin portal → Patients → Select patient → Issue NFC Card
2. **Verify**: Staff portal → Verify Patient → NFC tab → Tap card
3. **Revoke**: Admin portal → Patients → Select patient → Revoke Card (irreversible)
4. **Re-issue**: After revocation, admin can issue a new card with new ID

### 5.4 Troubleshooting

| Issue                           | Solution                                            |
| ------------------------------- | --------------------------------------------------- |
| NFC badge shows "Not Supported" | Ensure using Chrome on Android with NFC enabled     |
| NFC scan times out              | Hold card steady for 2-3 seconds, ensure NFC is on  |
| "Card revoked" error            | Contact admin to issue new card                     |
| QR code expired                 | Patient can refresh QR (auto-refreshes every 60s)   |
| Manual override needed          | Enter patient MRN and provide reason (audit logged) |
