/**
 * Extension routes for Demo MVP — medical records, NFC, visitors, attendance, Solana, identity.
 */
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import { computeRecordHash, splitRecord } from "../lib/hash.js";
import { signIdentityPayload, verifyIdentityPayload } from "../lib/identity.js";
import { signCredential } from "../lib/vc-sign.js";
import * as solana from "../lib/solana.js";
import * as notifications from "../lib/notifications.js";
import { consentMiddleware } from "../middleware/auth.js";

export function registerExtensionRoutes(app, deps) {
  const {
    putState,
    getState,
    getAllState,
    queryState,
    commitBlock,
    broadcast,
    NETWORK,
    logAudit,
    requireRole,
    IDENTITY_SECRET,
  } = deps;

  const consentGate = consentMiddleware(getAllState);

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  // ─── Medical Records CRUD ───────────────────────────────────────────────────
  app.get("/api/medical-records/:patientDid", consentGate, (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden: own records only" });
    }
    const all = queryState("medical-records", (v) => v.patientDid === req.params.patientDid);
    res.json({ records: all.map((e) => e.value), total: all.length });
  });

  app.post(
    "/api/medical-records/:patientDid",
    requireRole("staff", "admin"),
    consentGate,
    (req, res) => {
      const { title, type, content, doctorDid, doctorName } = req.body;
      if (!title || !type) return res.status(400).json({ error: "title and type required" });

      const recordId = `MR-${Date.now().toString(36).toUpperCase()}`;
      const txId = randomUUID();
      const record = {
        recordId,
        patientDid: req.params.patientDid,
        title,
        type,
        content,
        doctorDid: doctorDid || req.user.did,
        doctorName: doctorName || req.user.name,
        createdAt: new Date().toISOString(),
        status: "active",
      };
      const { anchor, offChain } = splitRecord(record, "medical-record");
      putState("medical-records", recordId, offChain, txId);
      putState("medical-records-anchor", recordId, anchor, txId);
      logAudit(req, { resource: recordId, action: "MEDICAL_RECORD_CREATE" });
      solana.scheduleAnchor({ computeRecordHash }, offChain, "medical-record", req.user.did);
      res.json({ record: offChain, anchor });
    },
  );

  app.patch("/api/medical-records/:recordId", requireRole("staff", "admin"), (req, res) => {
    const entry = getState("medical-records", req.params.recordId);
    if (!entry) return res.status(404).json({ error: "Record not found" });
    Object.assign(entry.value, req.body, { updatedAt: new Date().toISOString() });
    putState("medical-records", req.params.recordId, entry.value, randomUUID());
    logAudit(req, { resource: req.params.recordId, action: "MEDICAL_RECORD_UPDATE" });
    res.json({ record: entry.value });
  });

  // ─── Prescriptions list all ─────────────────────────────────────────────────
  app.get("/api/prescriptions", requireRole("staff", "admin"), (req, res) => {
    const all = getAllState("prescriptions");
    res.json({ prescriptions: all.map((e) => e.value), total: all.length });
  });

  // ─── Consent request deny ───────────────────────────────────────────────────
  app.patch("/api/consent/requests/:id/deny", requireRole("patient", "admin"), (req, res) => {
    const entry = getState("consent-requests", req.params.id);
    if (!entry) return res.status(404).json({ error: "Request not found" });
    if (req.user.role === "patient" && entry.value.patientDid !== req.user.did) {
      return res.status(403).json({ error: "Forbidden" });
    }
    entry.value.status = "denied";
    entry.value.deniedAt = new Date().toISOString();
    putState("consent-requests", req.params.id, entry.value, randomUUID());
    broadcast({ event: "consent:denied", data: { id: req.params.id } });
    res.json({ success: true });
  });

  // ─── NFC Card Registry ──────────────────────────────────────────────────────
  app.post("/api/nfc/issue", requireRole("admin"), (req, res) => {
    const { patientDid, patientName, mrn, cardType = "patient" } = req.body;
    if (!patientDid) return res.status(400).json({ error: "patientDid required" });

    const cardId = `NFC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const txId = randomUUID();
    const card = {
      cardId,
      patientDid,
      patientName,
      mrn,
      cardType,
      status: "active",
      issuedAt: new Date().toISOString(),
      issuedBy: req.user.email,
    };
    putState("nfc-cards", cardId, card, txId);
    logAudit(req, { resource: cardId, action: "NFC_CARD_ISSUE" });
    solana.scheduleAnchor(
      { computeRecordHash },
      card,
      "nfc-issue",
      req.user.did || null,
    );
    broadcast({ event: "nfc:updated", data: card });
    res.json({ card });
  });

  app.get("/api/nfc/:cardId", requireRole("staff", "admin"), (req, res) => {
    const entry = getState("nfc-cards", req.params.cardId);
    if (!entry) return res.status(404).json({ error: "Card not found" });
    res.json(entry.value);
  });

  app.patch("/api/nfc/:cardId/revoke", requireRole("admin"), (req, res) => {
    const entry = getState("nfc-cards", req.params.cardId);
    if (!entry) return res.status(404).json({ error: "Card not found" });
    entry.value.status = "revoked";
    entry.value.revokedAt = new Date().toISOString();
    putState("nfc-cards", req.params.cardId, entry.value, randomUUID());
    logAudit(req, { resource: req.params.cardId, action: "NFC_CARD_REVOKE" });
    solana.scheduleAnchor(
      { computeRecordHash },
      { id: req.params.cardId, action: "revoke" },
      "nfc-revoke",
      req.user.did,
    );
    broadcast({ event: "nfc:updated", data: entry.value });
    res.json({ success: true, cardId: req.params.cardId });
  });

  app.post("/api/nfc/verify", requireRole("staff", "admin"), (req, res) => {
    const { cardId, payload } = req.body;
    let card = null;

    if (cardId) {
      const entry = getState("nfc-cards", cardId);
      if (!entry) return res.status(404).json({ error: "Card not found" });
      card = entry.value;
      if (card.status === "revoked") {
        return res.status(403).json({ error: "Card revoked", card });
      }
    } else if (payload) {
      const result = verifyIdentityPayload(payload, IDENTITY_SECRET);
      if (!result.valid) return res.status(400).json({ error: result.error });

      const cardEntries = queryState("nfc-cards", (val) => val.patientDid === result.payload.did);
      if (cardEntries.length === 0) {
        return res.status(404).json({ error: "Card not registered in the system registry." });
      }

      // Sort by issuedAt descending to get the latest card
      cardEntries.sort((a, b) => new Date(b.value.issuedAt).getTime() - new Date(a.value.issuedAt).getTime());
      const latestCard = cardEntries[0].value;

      if (latestCard.status === "revoked") {
        return res.status(403).json({ error: "Card revoked", card: latestCard });
      }

      card = latestCard;
    } else {
      return res.status(400).json({ error: "cardId or payload required" });
    }

    logAudit(req, { resource: card.patientDid || cardId, action: "NFC_VERIFY" });
    res.json({ verified: true, card });
  });

  // ─── Infrastructure ─────────────────────────────────────────────────────────
  app.get("/api/infrastructure", requireRole("staff", "admin"), (req, res) => {
    const beds = getAllState("beds").map((e) => e.value);
    const equipment = getAllState("equipment").map((e) => e.value);
    const ambulances = getAllState("ambulances").map((e) => e.value);
    res.json({ beds, equipment, ambulances });
  });

  app.get("/api/infrastructure/ambulances", requireRole("staff", "admin"), (req, res) => {
    const all = getAllState("ambulances");
    res.json({ ambulances: all.map((e) => e.value), total: all.length });
  });

  app.post("/api/infrastructure/ambulances", requireRole("admin"), (req, res) => {
    const { vehicleNo, type, driver, paramedic, status, location } = req.body;
    const id = `amb_${randomUUID().slice(0, 8)}`;
    const ambulance = {
      id, vehicleNo, type, driver, paramedic,
      status: status || "available",
      location: location || "Hospital Bay",
      lastDeployment: new Date().toISOString(),
      did: `did:hosp:ambulance:${id}`,
    };
    putState("ambulances", id, ambulance, randomUUID());
    broadcast({ event: "ambulance:updated", data: ambulance });
    res.json({ ambulance });
  });

  app.get("/api/infrastructure/equipment", requireRole("staff", "admin"), (req, res) => {
    const all = getAllState("equipment");
    res.json({ equipment: all.map((e) => e.value), total: all.length });
  });

  // ─── Insurance Claims ──────────────────────────────────────────────────────
  app.get("/api/insurance/claims", (req, res) => {
    const patientDid = req.query.patientDid;
    let all = getAllState("insurance-claims");
    if (patientDid) {
      all = all.filter((e) => e.value.patientDid === patientDid);
    }
    res.json({ claims: all.map((e) => e.value), total: all.length });
  });

  app.post("/api/insurance/claims", requireRole("patient", "staff", "admin"), (req, res) => {
    const { patientDid, patientName, patientMRN, insuranceProvider, policyNo, claimType, amount, remarks } = req.body;
    const claimId = `CLM-${Date.now().toString(36).toUpperCase()}`;
    const claim = {
      id: claimId, claimNo: claimId, patientDid, patientName, patientMRN,
      insuranceProvider, policyNo, claimType, amount,
      status: "pending",
      submittedDate: new Date().toISOString(),
      remarks: remarks || "",
    };
    putState("insurance-claims", claimId, claim, randomUUID());
    broadcast({ event: "insurance:claimed", data: claim });
    res.json({ claim });
  });

  // ─── Vaccine Records ───────────────────────────────────────────────────────
  app.get("/api/vaccines/:patientDid", (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const all = queryState("vaccines", (v) => v.patientDid === req.params.patientDid);
    res.json({ vaccines: all.map((e) => e.value), total: all.length });
  });

  app.post("/api/vaccines", requireRole("staff", "admin"), (req, res) => {
    const { patientDid, vaccine, doses, lastDose, nextDue, manufacturer, batchNo, issuer, status } = req.body;
    const id = `vax_${randomUUID().slice(0, 8)}`;
    const record = {
      id, patientDid, vaccine, doses, lastDose, nextDue,
      manufacturer, batchNo, issuer,
      status: status || "complete",
      credential: `VCI-${Date.now().toString(36).toUpperCase()}`,
      recordedAt: new Date().toISOString(),
    };
    putState("vaccines", id, record, randomUUID());
    broadcast({ event: "vaccine:recorded", data: record });
    res.json({ vaccine: record });
  });

  // ─── Doctors List ──────────────────────────────────────────────────────────
  app.get("/api/doctors", (req, res) => {
    const dids = getAllState("did-registry");
    const users = getAllState("users");
    const doctors = [];

    for (const entry of users) {
      const u = entry.value;
      if (u.role === "doctor" || u.role === "staff") {
        const didEntry = dids.find((d) => d.value.ownerEmail === u.email);
        doctors.push({
          id: u.did || didEntry?.value?.did || entry.key,
          did: u.did || didEntry?.value?.did || "",
          name: u.name,
          email: u.email,
          specialty: u.specializations?.[0] || u.department || "General Medicine",
          department: u.department || "General Medicine",
          status: u.status || "active",
        });
      }
    }
    res.json({ doctors, total: doctors.length });
  });

  // ─── Inpatient Data ────────────────────────────────────────────────────────
  app.get("/api/inpatient/:patientDid", (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const admissions = queryState("admissions", (v) => v.patientDid === req.params.patientDid);
    const medications = queryState("medications", (v) => v.patientDid === req.params.patientDid);
    const nursingNotes = queryState("nursing-notes", (v) => v.patientDid === req.params.patientDid);
    const checkups = queryState("daily-checkups", (v) => v.patientDid === req.params.patientDid);
    const procedures = queryState("procedures", (v) => v.patientDid === req.params.patientDid);
    const dietOrders = queryState("diet-orders", (v) => v.patientDid === req.params.patientDid);
    const vitalsHistory = queryState("vitals-history", (v) => v.patientDid === req.params.patientDid);

    res.json({
      admission: admissions.length > 0 ? admissions.sort((a, b) => (b.value.admissionDate || "").localeCompare(a.value.admissionDate || ""))[0].value : null,
      medications: medications.map((e) => e.value),
      nursingNotes: nursingNotes.map((e) => e.value),
      checkups: checkups.map((e) => e.value),
      procedures: procedures.map((e) => e.value),
      dietOrder: dietOrders.length > 0 ? dietOrders[dietOrders.length - 1].value : null,
      vitalSigns: vitalsHistory.map((e) => e.value),
    });
  });

  // ─── Identity signed payloads ───────────────────────────────────────────────
  app.post("/api/identity/sign-payload", requireRole("patient", "staff", "admin"), (req, res) => {
    const { did, mrn, name, network } = req.body;
    if (!did) return res.status(400).json({ error: "did required" });
    if (req.user.role === "patient" && req.user.did && req.user.did !== did) {
      return res.status(403).json({ error: "Forbidden: own DID only" });
    }
    const payload = signIdentityPayload(
      { did, mrn, name, network: network || "embrace-health-network", exp: Date.now() + 60_000 },
      IDENTITY_SECRET,
    );
    res.json({ payload });
  });

  app.post("/api/identity/verify-payload", requireRole("staff", "admin"), (req, res) => {
    const result = verifyIdentityPayload(req.body.payload || req.body, IDENTITY_SECRET);
    if (!result.valid) return res.status(400).json({ error: result.error });
    logAudit(req, { resource: result.payload.did, action: "IDENTITY_VERIFY" });
    res.json({ verified: true, payload: result.payload });
  });

  // ─── Visitors ───────────────────────────────────────────────────────────────
  app.get("/api/visitors/:patientDid", requireRole("patient", "staff", "admin"), (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const all = queryState("visitors", (v) => v.patientDid === req.params.patientDid);
    res.json({ visitors: all.map((e) => e.value), total: all.length });
  });

  app.post("/api/visitors/request", requireRole("patient", "staff", "admin"), (req, res) => {
    const { patientDid, visitorName, relation, visitDate, purpose } = req.body;
    if (!patientDid || !visitorName) {
      return res.status(400).json({ error: "patientDid and visitorName required" });
    }
    const id = `vis-${randomUUID().slice(0, 8)}`;
    const request = {
      id,
      patientDid,
      visitorName,
      relation,
      visitDate,
      purpose,
      status: "pending",
      requestedAt: new Date().toISOString(),
      requestedBy: req.user.email,
    };
    putState("visitors", id, request, randomUUID());
    res.json({ request });
  });

  app.patch("/api/visitors/:id/approve", requireRole("patient", "admin"), (req, res) => {
    const entry = getState("visitors", req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    if (req.user.role === "patient" && entry.value.patientDid !== req.user.did) {
      return res.status(403).json({ error: "Forbidden" });
    }
    entry.value.status = req.body.approved === false ? "denied" : "approved";
    entry.value.resolvedAt = new Date().toISOString();
    putState("visitors", req.params.id, entry.value, randomUUID());
    logAudit(req, {
      resource: req.params.id,
      action: `VISITOR_${entry.value.status.toUpperCase()}`,
    });
    res.json({ visitor: entry.value });
  });

  // ─── Attendance ─────────────────────────────────────────────────────────────
  app.get("/api/attendance/:staffEmail", requireRole("staff", "admin"), (req, res) => {
    const email = req.params.staffEmail;
    if (req.user.role === "staff" && req.user.email !== email) {
      return res.status(403).json({ error: "Forbidden: own attendance only" });
    }
    const all = queryState("attendance", (v) => v.staffEmail === email);
    res.json({ records: all.map((e) => e.value), total: all.length });
  });

  app.post("/api/attendance/clock", requireRole("staff", "admin"), (req, res) => {
    const { action, nfcCardId, location } = req.body;
    if (!action || !["in", "out"].includes(action)) {
      return res.status(400).json({ error: "action must be 'in' or 'out'" });
    }
    const id = `att-${randomUUID().slice(0, 8)}`;
    const record = {
      id,
      staffEmail: req.user.email,
      staffDid: req.user.did,
      action,
      nfcCardId: nfcCardId || null,
      location: location || "Main Hospital",
      timestamp: new Date().toISOString(),
    };
    putState("attendance", id, record, randomUUID());
    logAudit(req, { resource: id, action: `ATTENDANCE_CLOCK_${action.toUpperCase()}` });
    solana.scheduleAnchor({ computeRecordHash }, record, "attendance", req.user.did);
    res.json({ record });
  });

  // ─── Solana ─────────────────────────────────────────────────────────────────
  app.post("/api/solana/anchor", requireRole("staff", "admin"), async (req, res) => {
    const { recordHash, recordType, actorDid, recordId } = req.body;
    if (!recordHash || !recordType) {
      return res.status(400).json({ error: "recordHash and recordType required" });
    }
    try {
      const anchor = await solana.anchorHash({
        recordHash,
        recordType,
        actorDid: actorDid || req.user.did,
        recordId,
      });
      res.json(anchor);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/solana/verify/:signature", requireRole("staff", "admin"), (req, res) => {
    const result = solana.verifyAnchor(req.params.signature);
    if (!result.found) return res.status(404).json(result);
    res.json(result);
  });

  app.get("/api/solana/anchors", requireRole("admin", "staff"), (req, res) => {
    const limit = parseInt(req.query.limit ?? "50");
    res.json({ anchors: solana.listRecentAnchors(limit), simulated: solana.isSimulatedMode() });
  });

  // ─── Per-user notifications (override in server if needed) ──────────────────
  app.get("/api/notifications/v2", (req, res) => {
    const { notifications: list, unreadCount } = notifications.getNotificationsForUser(
      req.user.email,
    );
    res.json({ notifications: list, unreadCount });
  });

  // Export helpers for server.js to use
  return { signCredential, notifications, solana, computeRecordHash, splitRecord };
}
