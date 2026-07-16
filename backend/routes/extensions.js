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
    const patientDid = req.params.patientDid;
    let all = queryState("medical-records", (v) => v.patientDid === patientDid);
    if (all.length === 0) {
      const defaultRecords = [
        { recordId: "MR-SEED-1", patientDid, title: "Type 2 Diabetes Checkup", type: "lab-report", content: "Blood sugar levels stable. HBA1c at 6.4%.", doctorDid: "did:key:z6Mku", doctorName: "Dr. Sameer Khan", createdAt: "2026-05-18T10:00:00.000Z", status: "Controlled" },
        { recordId: "MR-SEED-2", patientDid, title: "Routine Cardiac Echo", type: "procedure-report", content: "Healthy Ejection Fraction (60%). No signs of ischemia.", doctorDid: "did:key:z6Mkv", doctorName: "Dr. Ravi Menon", createdAt: "2026-04-12T14:30:00.000Z", status: "Healthy" }
      ];
      defaultRecords.forEach((rec) => {
        putState("medical-records", rec.recordId, rec, randomUUID());
      });
      all = queryState("medical-records", (v) => v.patientDid === patientDid);
    }
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

  app.post("/api/prescriptions/sign", requireRole("staff", "admin", "doctor"), (req, res) => {
    const { rxId, staffDid } = req.body;
    if (!rxId) return res.status(400).json({ error: "rxId required" });

    const entry = getState("prescriptions", rxId);
    if (!entry) return res.status(404).json({ error: "Prescription not found" });

    entry.value.signed = true;
    entry.value.status = "active";
    entry.value.signedBy = staffDid;
    entry.value.signedAt = new Date().toISOString();

    putState("prescriptions", rxId, entry.value, randomUUID());
    broadcast({ event: "prescription:signed", data: { rxId } });
    res.json({ success: true, rx: entry.value });
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
    let admissions = queryState("admissions", (v) => v.patientDid === req.params.patientDid);
    let medications = queryState("medications", (v) => v.patientDid === req.params.patientDid);
    let nursingNotes = queryState("nursing-notes", (v) => v.patientDid === req.params.patientDid);
    let checkups = queryState("daily-checkups", (v) => v.patientDid === req.params.patientDid);
    let procedures = queryState("procedures", (v) => v.patientDid === req.params.patientDid);
    let dietOrders = queryState("diet-orders", (v) => v.patientDid === req.params.patientDid);
    let vitalsHistory = queryState("vitals-history", (v) => v.patientDid === req.params.patientDid);

    if (admissions.length === 0) {
      const patientDid = req.params.patientDid;
      const defaultAdmission = {
        id: "ADM-2026-001234",
        patientDid,
        patientId: patientDid,
        admissionDate: "2026-05-27",
        admissionTime: "14:30",
        expectedDischargeDate: "2026-06-02",
        status: "admitted",
        ward: "Cardiology Ward",
        room: "C-402",
        bed: "B2",
        admittingDoctor: "Dr. Ravi Menon",
        primaryDiagnosis: "Acute Coronary Syndrome",
        secondaryDiagnoses: ["Hypertension", "Type 2 Diabetes"],
        admissionType: "emergency",
        chiefComplaint: "Chest pain and shortness of breath",
      };
      putState("admissions", defaultAdmission.id, defaultAdmission, randomUUID());

      const defaultMedications = [
        { id: "med1", patientDid, name: "Aspirin", dosage: "75 mg", frequency: "Once daily", route: "Oral", startDate: "2026-05-27", prescribedBy: "Dr. Ravi Menon", status: "active", nextDose: "2026-05-30 08:00" },
        { id: "med2", patientDid, name: "Atorvastatin", dosage: "40 mg", frequency: "Once daily (evening)", route: "Oral", startDate: "2026-05-27", prescribedBy: "Dr. Ravi Menon", status: "active", nextDose: "2026-05-30 20:00" },
        { id: "med3", patientDid, name: "Metoprolol", dosage: "50 mg", frequency: "Twice daily", route: "Oral", startDate: "2026-05-27", prescribedBy: "Dr. Ravi Menon", status: "active", nextDose: "2026-05-30 08:00" },
        { id: "med4", patientDid, name: "Insulin (Rapid-acting)", dosage: "8 units", frequency: "Before meals", route: "Subcutaneous injection", startDate: "2026-05-27", prescribedBy: "Dr. Sameer Khan", status: "active", nextDose: "2026-05-30 12:00" },
        { id: "med5", patientDid, name: "Enoxaparin", dosage: "40 mg", frequency: "Once daily", route: "Subcutaneous injection", startDate: "2026-05-27", endDate: "2026-05-29", prescribedBy: "Dr. Ravi Menon", status: "completed" }
      ];
      defaultMedications.forEach((m) => putState("medications", m.id, m, randomUUID()));

      const defaultNursingNotes = [
        { id: "nn1", patientDid, timestamp: "2026-05-30 07:30", nurse: "Nurse Priya K.", category: "vitals", note: "Morning vitals recorded. Patient resting comfortably. No complaints.", priority: "routine" },
        { id: "nn2", patientDid, timestamp: "2026-05-30 08:15", nurse: "Nurse Priya K.", category: "medication", note: "Morning medications administered. Patient tolerated well.", priority: "routine" },
        { id: "nn3", patientDid, timestamp: "2026-05-29 22:00", nurse: "Nurse Anjali M.", category: "general", note: "Patient reports mild chest discomfort. Dr. Menon notified. ECG performed - no acute changes.", priority: "important" },
        { id: "nn4", patientDid, timestamp: "2026-05-29 14:30", nurse: "Nurse Priya K.", category: "care", note: "Assisted patient with ambulation. Walked 50 meters in corridor without difficulty.", priority: "routine" }
      ];
      defaultNursingNotes.forEach((nn) => putState("nursing-notes", nn.id, nn, randomUUID()));

      const defaultCheckups = [
        { id: "dc1", patientDid, date: "2026-05-30", time: "08:00", type: "routine", doctor: "Dr. Ravi Menon", specialty: "Cardiology", notes: "Patient stable, chest pain resolved. Continue current medications.", findings: ["Heart sounds normal", "No respiratory distress", "Wound healing well"], status: "completed" },
        { id: "dc2", patientDid, date: "2026-05-30", time: "14:00", type: "specialist", doctor: "Dr. Sameer Khan", specialty: "Endocrinology", notes: "Blood sugar levels improving with insulin therapy.", findings: ["HbA1c trending down", "No hypoglycemic episodes"], status: "scheduled" },
        { id: "dc3", patientDid, date: "2026-05-29", time: "08:30", type: "routine", doctor: "Dr. Ravi Menon", specialty: "Cardiology", notes: "Post-procedure check. Patient recovering well.", findings: ["Vital signs stable", "No complications", "Pain managed"], status: "completed" }
      ];
      defaultCheckups.forEach((c) => putState("daily-checkups", c.id, c, randomUUID()));

      const defaultProcedures = [
        { id: "proc1", patientDid, name: "Coronary Angiography", scheduledDate: "2026-05-28", scheduledTime: "10:00", completedDate: "2026-05-28", status: "completed", performedBy: "Dr. Ravi Menon", location: "Cath Lab 2", notes: "Procedure successful. 70% stenosis in LAD, stent placed.", requiresFasting: true },
        { id: "proc2", patientDid, name: "Echocardiogram", scheduledDate: "2026-05-31", scheduledTime: "09:30", status: "scheduled", location: "Cardiology Imaging", requiresFasting: false },
        { id: "proc3", patientDid, name: "Stress Test", scheduledDate: "2026-06-01", scheduledTime: "11:00", status: "scheduled", location: "Cardiac Rehab Center", notes: "Pre-discharge evaluation", requiresFasting: false }
      ];
      defaultProcedures.forEach((p) => putState("procedures", p.id, p, randomUUID()));

      const defaultDietOrder = {
        id: "diet1",
        patientDid,
        type: "Cardiac Diet (Low-sodium, Diabetic)",
        restrictions: ["Low sodium (< 2g/day)", "Low saturated fat", "Controlled carbohydrates"],
        startDate: "2026-05-27",
        orderedBy: "Dr. Ravi Menon",
        specialInstructions: "Small frequent meals. Monitor blood sugar before meals.",
      };
      putState("diet-orders", defaultDietOrder.id, defaultDietOrder, randomUUID());

      const defaultVitalsHistory = [
        { id: "v1", patientDid, timestamp: "2026-05-30 06:00", temperature: 37.2, bloodPressure: { systolic: 128, diastolic: 82 }, heartRate: 76, respiratoryRate: 16, oxygenSaturation: 98, recordedBy: "Nurse Priya K." },
        { id: "v2", patientDid, timestamp: "2026-05-30 12:00", temperature: 37.4, bloodPressure: { systolic: 132, diastolic: 84 }, heartRate: 78, respiratoryRate: 17, oxygenSaturation: 97, recordedBy: "Nurse Priya K." },
        { id: "v3", patientDid, timestamp: "2026-05-29 18:00", temperature: 37.1, bloodPressure: { systolic: 125, diastolic: 80 }, heartRate: 74, respiratoryRate: 16, oxygenSaturation: 98, recordedBy: "Nurse Anjali M." },
        { id: "v4", patientDid, timestamp: "2026-05-29 12:00", temperature: 37.3, bloodPressure: { systolic: 130, diastolic: 85 }, heartRate: 80, respiratoryRate: 18, oxygenSaturation: 96, recordedBy: "Nurse Priya K." }
      ];
      defaultVitalsHistory.forEach((v) => putState("vitals-history", v.id, v, randomUUID()));

      admissions = queryState("admissions", (v) => v.patientDid === patientDid);
      medications = queryState("medications", (v) => v.patientDid === patientDid);
      nursingNotes = queryState("nursing-notes", (v) => v.patientDid === patientDid);
      checkups = queryState("daily-checkups", (v) => v.patientDid === patientDid);
      procedures = queryState("procedures", (v) => v.patientDid === patientDid);
      dietOrders = queryState("diet-orders", (v) => v.patientDid === patientDid);
      vitalsHistory = queryState("vitals-history", (v) => v.patientDid === patientDid);
    }

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

  // ─── Health Metrics ─────────────────────────────────────────────────────────
  app.get("/api/medical-records/:patientDid/metrics", consentGate, (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let all = queryState("health-metrics", (v) => v.patientDid === req.params.patientDid);
    
    if (all.length === 0) {
      const defaultMetrics = [
        { date: "2026-06-01", weight: 68.5, bmi: 25.2, bloodSugar: { fasting: 112, postMeal: 148 }, bloodPressure: { systolic: 138, diastolic: 88 }, cholesterol: { total: 210, hdl: 42, ldl: 142 }, hba1c: 7.2, patientDid: req.params.patientDid },
        { date: "2026-05-01", weight: 69.2, bmi: 25.4, bloodSugar: { fasting: 118, postMeal: 154 }, bloodPressure: { systolic: 142, diastolic: 90 }, cholesterol: { total: 218, hdl: 40, ldl: 150 }, hba1c: 7.4, patientDid: req.params.patientDid },
        { date: "2026-04-01", weight: 70.1, bmi: 25.8, bloodSugar: { fasting: 124, postMeal: 162 }, bloodPressure: { systolic: 145, diastolic: 92 }, cholesterol: { total: 225, hdl: 38, ldl: 158 }, hba1c: 7.6, patientDid: req.params.patientDid },
        { date: "2026-03-01", weight: 70.8, bmi: 26.0, bloodSugar: { fasting: 130, postMeal: 170 }, bloodPressure: { systolic: 148, diastolic: 95 }, cholesterol: { total: 232, hdl: 36, ldl: 166 }, hba1c: 7.9, patientDid: req.params.patientDid },
        { date: "2026-02-01", weight: 71.5, bmi: 26.3, bloodSugar: { fasting: 135, postMeal: 178 }, bloodPressure: { systolic: 152, diastolic: 98 }, cholesterol: { total: 240, hdl: 35, ldl: 175 }, hba1c: 8.2, patientDid: req.params.patientDid }
      ];
      defaultMetrics.forEach((m, idx) => {
        putState("health-metrics", `HM-${req.params.patientDid}-${idx}`, m, randomUUID());
      });
      all = queryState("health-metrics", (v) => v.patientDid === req.params.patientDid);
    }
    res.json({ metrics: all.map((e) => e.value) });
  });

  // ─── Pharmacy Orders ────────────────────────────────────────────────────────
  app.get("/api/pharmacy-orders/:patientDid", consentGate, (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let all = queryState("pharmacy-orders", (v) => v.patientDid === req.params.patientDid);
    
    if (all.length === 0) {
      const defaultOrders = [
        {
          id: "pho_001",
          patientDid: req.params.patientDid,
          orderedOn: "2026-05-29",
          status: "dispensed",
          medicines: [
            { name: "Aspirin 75mg", quantity: 30, instruction: "Once daily (Morning)" },
            { name: "Atorvastatin 40mg", quantity: 30, instruction: "Once daily (Evening)" }
          ]
        },
        {
          id: "pho_002",
          patientDid: req.params.patientDid,
          orderedOn: "2026-05-20",
          status: "dispensed",
          medicines: [
            { name: "Metformin 1000mg", quantity: 60, instruction: "Twice daily with meals" }
          ]
        }
      ];
      defaultOrders.forEach((o) => {
        putState("pharmacy-orders", o.id, o, randomUUID());
      });
      all = queryState("pharmacy-orders", (v) => v.patientDid === req.params.patientDid);
    }
    res.json({ orders: all.map((e) => e.value) });
  });

  // ─── Rehab Sessions ─────────────────────────────────────────────────────────
  app.get("/api/rehab-sessions/:patientDid", consentGate, (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let all = queryState("rehab-sessions", (v) => v.patientDid === req.params.patientDid);
    
    if (all.length === 0) {
      const defaultSessions = [
        {
          id: "reh_001",
          patientDid: req.params.patientDid,
          sessionType: "Cardiac Rehabilitation Phase II",
          date: "2026-05-28",
          therapist: "Dr. Ananya Sen",
          status: "completed",
          notes: "Treadmill test 15 mins (moderate). Heart rate response normal. BP stable."
        },
        {
          id: "reh_002",
          patientDid: req.params.patientDid,
          sessionType: "Cardiac Rehabilitation Phase II",
          date: "2026-05-26",
          therapist: "Dr. Ananya Sen",
          status: "completed",
          notes: "Initial assessment. Target training zones defined. Warm-up exercises."
        }
      ];
      defaultSessions.forEach((s) => {
        putState("rehab-sessions", s.id, s, randomUUID());
      });
      all = queryState("rehab-sessions", (v) => v.patientDid === req.params.patientDid);
    }
    res.json({ sessions: all.map((e) => e.value) });
  });

  // ─── Feedback List ──────────────────────────────────────────────────────────
  app.get("/api/feedback/:patientDid", consentGate, (req, res) => {
    if (req.user.role === "patient" && req.user.did !== req.params.patientDid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let all = queryState("feedback", (v) => v.patientDid === req.params.patientDid);
    
    if (all.length === 0) {
      const defaultFeedback = [
        {
          id: "fb_001",
          patientDid: req.params.patientDid,
          date: "2026-05-29",
          doctor: "Dr. Ravi Menon",
          rating: 5,
          comments: "Excellent care during my angiogram. Explained everything clearly."
        }
      ];
      defaultFeedback.forEach((f) => {
        putState("feedback", f.id, f, randomUUID());
      });
      all = queryState("feedback", (v) => v.patientDid === req.params.patientDid);
    }
    res.json({ feedback: all.map((e) => e.value) });
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
    let all = queryState("attendance", (v) => v.staffEmail === email);
    
    if (all.length === 0) {
      const defaultHistory = [
        { staffEmail: email, action: "in", timestamp: "2026-06-02T07:52:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "in", timestamp: "2026-06-01T07:58:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "out", timestamp: "2026-06-01T16:14:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "in", timestamp: "2026-05-30T08:05:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "out", timestamp: "2026-05-30T16:02:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "in", timestamp: "2026-05-29T08:10:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "out", timestamp: "2026-05-29T19:22:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "in", timestamp: "2026-05-28T07:45:00.000Z", location: "Cardiology OPD" },
        { staffEmail: email, action: "out", timestamp: "2026-05-28T16:00:00.000Z", location: "Cardiology OPD" }
      ];
      defaultHistory.forEach((h, idx) => {
        putState("attendance", `ATT-SEED-${email}-${idx}`, h, randomUUID());
      });
      all = queryState("attendance", (v) => v.staffEmail === email);
    }
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

  app.post("/api/staff-requests", requireRole("staff", "admin"), (req, res) => {
    const { requestType, leaveType, fromDate, toDate, reason, shiftDate, shiftType, unit } = req.body;
    if (!requestType) return res.status(400).json({ error: "requestType required" });
    const id = `REQ-${Date.now().toString(36).toUpperCase()}`;
    const record = {
      id,
      staffEmail: req.user.email,
      staffDid: req.user.did,
      requestType,
      leaveType: leaveType || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      reason: reason || null,
      shiftDate: shiftDate || null,
      shiftType: shiftType || null,
      unit: unit || null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    putState("staff-requests", id, record, randomUUID());
    logAudit(req, { resource: id, action: `STAFF_REQUEST_CREATE_${requestType.toUpperCase()}` });
    res.json({ success: true, record });
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

  // ─── Insurance Policies ─────────────────────────────────────────────────────
  app.get("/api/insurance/policies/:patientDid", (req, res) => {
    let all = queryState("insurance-policies", (v) => v.patientDid === req.params.patientDid);
    if (all.length === 0) {
      const defaultPolicies = [
        {
          id: "pol1",
          patientDid: req.params.patientDid,
          provider: "Star Health Insurance",
          policyNo: "POL-2025-STAR-00881",
          type: "Comprehensive Health Plan",
          sumInsured: 1000000,
          used: 145000,
          validFrom: "2025-04-01",
          validTo: "2026-03-31",
          status: "active",
        },
        {
          id: "pol2",
          patientDid: req.params.patientDid,
          provider: "HDFC Ergo",
          policyNo: "POL-2024-HDFC-44201",
          type: "Top-Up Policy (₹5L)",
          sumInsured: 500000,
          used: 0,
          validFrom: "2024-07-15",
          validTo: "2025-07-14",
          status: "expired",
        }
      ];
      defaultPolicies.forEach((p) => putState("insurance-policies", p.id, p, randomUUID()));
      all = queryState("insurance-policies", (v) => v.patientDid === req.params.patientDid);
    }
    res.json({ policies: all.map((e) => e.value), total: all.length });
  });

  // ─── Consent Preferences ────────────────────────────────────────────────────
  app.get("/api/preferences/:patientDid", (req, res) => {
    const entry = getState("patient-preferences", req.params.patientDid);
    if (!entry) {
      const defaultPrefs = {
        patientDid: req.params.patientDid,
        emergencyAccess: true,
        insuranceVerification: true,
        researchSharing: false,
        crossHospital: false,
      };
      putState("patient-preferences", req.params.patientDid, defaultPrefs, randomUUID());
      return res.json({ preferences: defaultPrefs });
    }
    res.json({ preferences: entry.value });
  });

  app.post("/api/preferences/:patientDid", (req, res) => {
    const { emergencyAccess, insuranceVerification, researchSharing, crossHospital } = req.body;
    const preferences = {
      patientDid: req.params.patientDid,
      emergencyAccess: typeof emergencyAccess === "boolean" ? emergencyAccess : true,
      insuranceVerification: typeof insuranceVerification === "boolean" ? insuranceVerification : true,
      researchSharing: typeof researchSharing === "boolean" ? researchSharing : false,
      crossHospital: typeof crossHospital === "boolean" ? crossHospital : false,
    };
    putState("patient-preferences", req.params.patientDid, preferences, randomUUID());
    res.json({ preferences });
  });

  // ─── Staff Schedules ────────────────────────────────────────────────────────
  app.get("/api/staff/schedule/:staffEmail", (req, res) => {
    const email = req.params.staffEmail;
    let all = queryState("staff-schedule", (v) => v.staffEmail === email);
    if (all.length === 0) {
      const defaultShifts = [
        { id: "s1", staffEmail: email, day: "Mon", date: "2026-06-08", role: "OPD",         start: "09:00", end: "17:00", unit: "Cardiology OPD",   patients: 24, notes: "Routine consultations + 4 new referrals", confirmed: true },
        { id: "s2", staffEmail: email, day: "Tue", date: "2026-06-09", role: "Ward rounds",  start: "08:00", end: "14:00", unit: "Cardiology Ward 4A",patients: 12, notes: "Post-cath follow-ups", confirmed: true },
        { id: "s3", staffEmail: email, day: "Tue", date: "2026-06-09", role: "Telemedicine", start: "15:00", end: "18:00", unit: "Virtual Clinic",   patients: 8,  notes: "4 teleconsults + 4 review calls", confirmed: true },
        { id: "s4", staffEmail: email, day: "Wed", date: "2026-06-10", role: "Surgery",      start: "07:30", end: "15:30", unit: "OR Suite 3",       patients: 2,  notes: "CABG × 1, Pacemaker implant × 1", confirmed: true },
        { id: "s5", staffEmail: email, day: "Thu", date: "2026-06-11", role: "ICU",          start: "08:00", end: "20:00", unit: "ICU Block B",      patients: 6,  notes: "Critical monitoring + 2 new admissions", confirmed: true },
        { id: "s6", staffEmail: email, day: "Fri", date: "2026-06-12", role: "OPD",          start: "09:00", end: "13:00", unit: "Cardiology OPD",   patients: 16, confirmed: true },
        { id: "s7", staffEmail: email, day: "Fri", date: "2026-06-12", role: "On-call",      start: "20:00", end: "08:00", unit: "Emergency + Cardio",patients: null, notes: "Night on-call. Emergency pager active.", confirmed: true },
        { id: "s8", staffEmail: email, day: "Sat", date: "2026-06-13", role: "Leave",        start: "—",     end: "—",     unit: "—", confirmed: true },
        { id: "s9", staffEmail: email, day: "Sun", date: "2026-06-14", role: "Off",          start: "—",     end: "—",     unit: "—", confirmed: true },
      ];
      defaultShifts.forEach((s) => putState("staff-schedule", s.id, s, randomUUID()));
      all = queryState("staff-schedule", (v) => v.staffEmail === email);
    }
    res.json({ schedule: all.map((e) => e.value) });
  });

  // ─── Surgeries List ──────────────────────────────────────────────────────────
  app.get("/api/staff/surgeries", (req, res) => {
    let all = getAllState("surgeries");
    if (all.length === 0) {
      const defaultSurgeries = [
        {
          id: "s1", patient: "Anika Sharma", mrn: "MRN-204871",
          procedure: "Cardiac Catheterization (PCI)",
          room: "Cath Lab 2", date: "2026-06-04", time: "11:00",
          surgeon: "Dr. Ravi Menon", anesthesiologist: "Dr. Deepak Joshi",
          nurses: ["Nurse Priya K.", "Nurse Ananya V."],
          equipment: ["Cath Lab C-Arm", "Defibrillator", "Hemodynamic Monitor", "Infusion Pump ×3"],
          status: "scheduled", estDuration: "90 min",
        },
        {
          id: "s2", patient: "Rohan Iyer", mrn: "MRN-204902",
          procedure: "Total Hip Replacement (Left)",
          room: "OR-4", date: "2026-06-04", time: "13:30",
          surgeon: "Dr. Priya Nair", anesthesiologist: "Dr. Sunita Kapoor",
          nurses: ["Nurse Rekha S.", "Nurse Vijay T."],
          equipment: ["Orthopedic Power Tools Set", "C-Arm", "Cell Saver", "Electrosurgical Unit"],
          status: "scheduled", estDuration: "3 hours",
        },
        {
          id: "s3", patient: "Deepak Joshi", mrn: "MRN-203001",
          procedure: "Laparoscopic Appendectomy",
          room: "OR-2", date: "2026-06-02", time: "09:00",
          surgeon: "Dr. Kiran Bose", anesthesiologist: "Dr. Alok Sharma",
          nurses: ["Nurse Sunita V.", "Nurse Ram K."],
          equipment: ["Laparoscopic Tower", "Ultrasonic Scalpel", "Electrosurgical Unit"],
          status: "in-progress", estDuration: "45 min",
        },
        {
          id: "s4", patient: "Kavya Reddy", mrn: "MRN-206114",
          procedure: "LASIK Eye Surgery (Bilateral)",
          room: "Eye Suite 1", date: "2026-06-01", time: "14:00",
          surgeon: "Dr. Reena Pillai", anesthesiologist: "Local Anesthesia",
          nurses: ["Nurse Pooja A."],
          equipment: ["LASIK Excimer Laser", "Microkeratome", "Aberrometer"],
          status: "completed", estDuration: "30 min",
        }
      ];
      defaultSurgeries.forEach((s) => putState("surgeries", s.id, s, randomUUID()));
      all = getAllState("surgeries");
    }
    res.json({ surgeries: all.map((e) => e.value), total: all.length });
  });

  // ─── Policies ───────────────────────────────────────────────────────────────
  app.get("/api/policies", (req, res) => {
    let all = getAllState("governance-policies");
    if (all.length === 0) {
      const defaultPolicies = [
        {
          id: "p1",
          name: "Patient Consent Policy",
          category: "Consent",
          status: "active",
          updatedAt: "2026-06-08",
          description: "Enforce patient consent verification for all electronic medical records access requests by physicians.",
        },
        {
          id: "p2",
          name: "Audit Logging Policy",
          category: "Audit",
          status: "active",
          updatedAt: "2026-06-08",
          description: "Every read and write access on medical records must be immutably anchored on the decentralized ledger.",
        }
      ];
      defaultPolicies.forEach((p) => putState("governance-policies", p.id, p, randomUUID()));
      all = getAllState("governance-policies");
    }
    res.json({ policies: all.map((e) => e.value), total: all.length });
  });

  app.post("/api/policies", requireRole("admin"), (req, res) => {
    const { name, category, description, status } = req.body;
    const id = `p_${Date.now()}`;
    const policy = {
      id, name, category, description,
      status: status || "draft",
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    putState("governance-policies", id, policy, randomUUID());
    logAudit(req, { resource: id, action: "POLICY_CREATE" });
    res.json({ policy });
  });

  app.patch("/api/policies/:id", requireRole("admin"), (req, res) => {
    const entry = getState("governance-policies", req.params.id);
    if (!entry) return res.status(404).json({ error: "Policy not found" });
    Object.assign(entry.value, req.body, { updatedAt: new Date().toISOString().slice(0, 10) });
    putState("governance-policies", req.params.id, entry.value, randomUUID());
    logAudit(req, { resource: req.params.id, action: "POLICY_UPDATE" });
    res.json({ policy: entry.value });
  });

  // ─── Fraud Alerts status update ──────────────────────────────────────────────
  app.patch("/api/fraud/alerts/:id", requireRole("admin"), (req, res) => {
    const entry = getState("fraud-alerts", req.params.id);
    if (entry) {
      Object.assign(entry.value, req.body);
      putState("fraud-alerts", req.params.id, entry.value, randomUUID());
      logAudit(req, { resource: req.params.id, action: "FRAUD_ALERT_UPDATE" });
      return res.json({ alert: entry.value });
    }
    res.json({ success: true, id: req.params.id, updatedFields: req.body });
  });

  // Export helpers for server.js to use
  return { signCredential, notifications, solana, computeRecordHash, splitRecord };
}
