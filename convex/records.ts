import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── DIDs ────────────────────────────────────────────────────────────────────
export const getDIDs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("dids").order("desc").collect();
  },
});

export const getDIDByURI = query({
  args: { did: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dids")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
  },
});

export const createDID = mutation({
  args: {
    did: v.string(),
    owner: v.string(),
    ownerType: v.string(),
    controller: v.string(),
    publicKey: v.string(),
    status: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    serviceEndpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dids")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("dids", args);
  },
});

export const revokeDID = mutation({
  args: { did: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("dids")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (doc) {
      await ctx.db.patch(doc._id, { status: "revoked", updatedAt: new Date().toISOString() });
      return true;
    }
    return false;
  },
});

// ─── Credentials ──────────────────────────────────────────────────────────────
export const getCredentials = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("credentials").order("desc").collect();
  },
});

export const issueCredential = mutation({
  args: {
    id: v.string(),
    type: v.string(),
    issuer: v.string(),
    subject: v.string(),
    issuedAt: v.string(),
    expiresAt: v.string(),
    claims: v.any(),
    signature: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("credentials", args);
  },
});

export const revokeCredential = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const cred = await ctx.db
      .query("credentials")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .unique();
    if (cred) {
      await ctx.db.patch(cred._id, { status: "revoked" });
      return true;
    }
    return false;
  },
});

// ─── Consents ──────────────────────────────────────────────────────────────────
export const getConsents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("consents").order("desc").collect();
  },
});

export const grantConsent = mutation({
  args: {
    grantId: v.string(),
    patientDid: v.string(),
    doctorDid: v.string(),
    resource: v.string(),
    status: v.string(),
    expiry: v.string(),
    grantedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("consents", args);
  },
});

export const revokeConsent = mutation({
  args: { grantId: v.string() },
  handler: async (ctx, args) => {
    const con = await ctx.db
      .query("consents")
      .withIndex("by_grantId", (q) => q.eq("grantId", args.grantId))
      .unique();
    if (con) {
      await ctx.db.patch(con._id, { status: "revoked" });
      return true;
    }
    return false;
  },
});

// ─── Audit Events ─────────────────────────────────────────────────────────────
export const getAuditEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("auditEvents").order("desc").collect();
  },
});

export const logAuditEvent = mutation({
  args: {
    txId: v.string(),
    actor: v.string(),
    resource: v.string(),
    action: v.string(),
    outcome: v.string(),
    severity: v.string(),
    loggedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditEvents", args);
  },
});

// ─── Beds ─────────────────────────────────────────────────────────────────────
export const getBeds = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("beds").collect();
  },
});

export const updateBed = mutation({
  args: {
    bedId: v.string(),
    ward: v.string(),
    status: v.string(),
    patientDid: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const bed = await ctx.db
      .query("beds")
      .withIndex("by_bedId", (q) => q.eq("bedId", args.bedId))
      .unique();
    if (bed) {
      await ctx.db.patch(bed._id, {
        status: args.status,
        patientDid: args.patientDid,
        updatedAt: args.updatedAt,
      });
      return bed._id;
    }
    return await ctx.db.insert("beds", args);
  },
});

// ─── Prescriptions ────────────────────────────────────────────────────────────
export const getPrescriptions = query({
  args: { patientDid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prescriptions")
      .filter((q) => q.eq(q.field("patientDid"), args.patientDid))
      .collect();
  },
});

export const createPrescription = mutation({
  args: {
    rxId: v.string(),
    patientDid: v.string(),
    doctorDid: v.string(),
    drugs: v.array(v.any()),
    diagnosis: v.string(),
    notes: v.string(),
    signedBy: v.string(),
    signedAt: v.string(),
    status: v.string(),
    hash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("prescriptions", args);
  },
});

// ─── Appointments ─────────────────────────────────────────────────────────────
export const getAppointments = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("appointments").order("desc").collect();
  },
});

export const getAppointmentsByPatient = query({
  args: { patientDid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appointments")
      .withIndex("by_patientDid", (q) => q.eq("patientDid", args.patientDid))
      .order("desc")
      .collect();
  },
});

export const getAppointmentsByDoctor = query({
  args: { doctorDid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appointments")
      .withIndex("by_doctorDid", (q) => q.eq("doctorDid", args.doctorDid))
      .order("desc")
      .collect();
  },
});

export const createAppointment = mutation({
  args: {
    apptId: v.string(),
    patientDid: v.string(),
    patientName: v.string(),
    doctorDid: v.string(),
    doctorName: v.string(),
    slot: v.string(),
    mode: v.string(),
    specialty: v.string(),
    status: v.string(),
    reason: v.optional(v.string()),
    suggestedSlot: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    bookedAt: v.string(),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Deduplicate by apptId
    const existing = await ctx.db
      .query("appointments")
      .withIndex("by_apptId", (q) => q.eq("apptId", args.apptId))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("appointments", args);
  },
});

export const updateAppointment = mutation({
  args: {
    apptId: v.string(),
    status: v.string(),
    suggestedSlot: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.db
      .query("appointments")
      .withIndex("by_apptId", (q) => q.eq("apptId", args.apptId))
      .unique();
    if (!appt) throw new Error(`Appointment ${args.apptId} not found`);

    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: args.updatedAt,
    };
    if (args.suggestedSlot !== undefined) patch.suggestedSlot = args.suggestedSlot;
    if (args.rejectionReason !== undefined) patch.rejectionReason = args.rejectionReason;
    if (args.status === "rescheduled" && args.suggestedSlot) patch.slot = args.suggestedSlot;

    await ctx.db.patch(appt._id, patch);
    return appt._id;
  },
});

// ─── Generic World State ──────────────────────────────────────────────────────
export const getGenericWorldState = query({
  args: { namespace: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("worldState")
      .withIndex("by_ns_key", (q) => q.eq("namespace", args.namespace).eq("key", args.key))
      .unique();
  },
});

export const putGenericWorldState = mutation({
  args: {
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    txId: v.string(),
    version: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("worldState")
      .withIndex("by_ns_key", (q) => q.eq("namespace", args.namespace).eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        txId: args.txId,
        version: args.version,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("worldState", args);
  },
});

export const deleteGenericWorldState = mutation({
  args: { namespace: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("worldState")
      .withIndex("by_ns_key", (q) => q.eq("namespace", args.namespace).eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

export const getAllGenericWorldState = query({
  args: { namespace: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("worldState")
      .withIndex("by_ns", (q) => q.eq("namespace", args.namespace))
      .collect();
  },
});

// ─── Staff ────────────────────────────────────────────────────────────────────
export const getStaff = query({
  args: {
    role: v.optional(v.string()),
    department: v.optional(v.string()),
    onDuty: v.optional(v.boolean()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let staff = await ctx.db.query("staff").order("desc").collect();

    if (args.role) {
      staff = staff.filter((s) => s.role === args.role);
    }
    if (args.department) {
      staff = staff.filter((s) => s.department === args.department);
    }
    if (args.onDuty !== undefined) {
      staff = staff.filter((s) => s.onDuty === args.onDuty);
    }
    if (args.status) {
      staff = staff.filter((s) => s.status === args.status);
    }

    return staff;
  },
});

export const getStaffByDID = query({
  args: { did: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
  },
});

export const getStaffByEmployeeId = query({
  args: { employeeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .unique();
  },
});

export const getStaffByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const createStaff = mutation({
  args: {
    staffId: v.string(),
    did: v.string(),
    name: v.string(),
    employeeId: v.string(),
    role: v.string(),
    department: v.string(),
    specialty: v.optional(v.string()),
    email: v.string(),
    phone: v.string(),
    shift: v.string(),
    onDuty: v.boolean(),
    joinedDate: v.string(),
    status: v.string(),
    credentials: v.number(),
    patientsToday: v.number(),
    currentLocation: v.optional(v.string()),
    lastSignal: v.optional(v.string()),
    beaconStrength: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existingByDID = await ctx.db
      .query("staff")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (existingByDID) {
      throw new Error("Staff member with this DID already exists");
    }

    const existingByEmployeeId = await ctx.db
      .query("staff")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .unique();
    if (existingByEmployeeId) {
      throw new Error("Staff member with this employee ID already exists");
    }

    const existingByEmail = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existingByEmail) {
      throw new Error("Staff member with this email already exists");
    }

    return await ctx.db.insert("staff", args);
  },
});

export const updateStaff = mutation({
  args: {
    did: v.string(),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    department: v.optional(v.string()),
    specialty: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    shift: v.optional(v.string()),
    onDuty: v.optional(v.boolean()),
    status: v.optional(v.string()),
    credentials: v.optional(v.number()),
    patientsToday: v.optional(v.number()),
    currentLocation: v.optional(v.string()),
    lastSignal: v.optional(v.string()),
    beaconStrength: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (!staff) {
      throw new Error("Staff member not found");
    }

    if (args.email && args.email !== staff.email) {
      const existingByEmail = await ctx.db
        .query("staff")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique();
      if (existingByEmail && existingByEmail._id !== staff._id) {
        throw new Error("Another staff member with this email already exists");
      }
    }

    const { did, ...updates } = args;
    await ctx.db.patch(staff._id, updates);
    return staff._id;
  },
});

export const deleteStaff = mutation({
  args: { did: v.string() },
  handler: async (ctx, args) => {
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (staff) {
      await ctx.db.delete(staff._id);
      return true;
    }
    return false;
  },
});

export const updateStaffLocation = mutation({
  args: {
    did: v.string(),
    location: v.string(),
    beaconStrength: v.optional(v.string()),
    txId: v.string(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (!staff) {
      throw new Error("Staff member not found");
    }

    const updatedAt = new Date().toISOString();

    await ctx.db.patch(staff._id, {
      currentLocation: args.location,
      beaconStrength: args.beaconStrength,
      lastSignal: updatedAt,
      updatedAt,
    });

    const locationKey = `${staff.employeeId}_location`;
    await ctx.db
      .query("worldState")
      .withIndex("by_ns_key", (q) => q.eq("namespace", "staff_location").eq("key", locationKey))
      .unique()
      .then(async (existing) => {
        const locationData = {
          staffId: staff.staffId,
          employeeId: staff.employeeId,
          name: staff.name,
          did: staff.did,
          location: args.location,
          beaconStrength: args.beaconStrength,
          timestamp: updatedAt,
        };

        if (existing) {
          await ctx.db.patch(existing._id, {
            value: locationData,
            txId: args.txId,
            version: args.version,
            updatedAt,
          });
        } else {
          await ctx.db.insert("worldState", {
            namespace: "staff_location",
            key: locationKey,
            value: locationData,
            txId: args.txId,
            version: args.version,
            updatedAt,
          });
        }
      });

    return staff._id;
  },
});

// ─── Patients ─────────────────────────────────────────────────────────────────

/**
 * Query to get all patients with optional filtering
 */
export const getPatients = query({
  args: {
    status: v.optional(v.string()),
    ward: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let patients = await ctx.db.query("patients").order("desc").collect();

    // Apply optional filters
    if (args.status) {
      patients = patients.filter((p) => p.status === args.status);
    }
    if (args.ward) {
      patients = patients.filter((p) => p.ward === args.ward);
    }

    return patients;
  },
});

/**
 * Query to get a patient by their DID (Decentralized Identifier)
 */
export const getPatientByDID = query({
  args: { did: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
  },
});

/**
 * Query to get a patient by their Medical Record Number (MRN)
 */
export const getPatientByMRN = query({
  args: { mrn: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
      .unique();
  },
});

/**
 * Query to get a patient by their email address
 */
export const getPatientByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

/**
 * Mutation to create a new patient
 */
export const createPatient = mutation({
  args: {
    patientId: v.string(),
    did: v.string(),
    name: v.string(),
    mrn: v.string(),
    age: v.number(),
    gender: v.string(),
    bloodGroup: v.string(),
    allergies: v.array(v.string()),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    dob: v.string(),
    ward: v.string(),
    bed: v.string(),
    admitDate: v.string(),
    status: v.string(),
    primaryDoctor: v.string(),
    conditions: v.array(v.string()),
    insuranceProvider: v.string(),
    insurancePolicyNo: v.string(),
    emergencyContact: v.object({
      name: v.string(),
      relation: v.string(),
      phone: v.string(),
    }),
    organDonor: v.boolean(),
    nationality: v.string(),
    totalVisits: v.number(),
    outstandingBills: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if patient with same DID already exists
    const existingByDID = await ctx.db
      .query("patients")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    if (existingByDID) {
      throw new Error(`Patient with DID ${args.did} already exists`);
    }

    // Check if patient with same MRN already exists
    const existingByMRN = await ctx.db
      .query("patients")
      .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
      .unique();
    if (existingByMRN) {
      throw new Error(`Patient with MRN ${args.mrn} already exists`);
    }

    // Check if patient with same email already exists
    const existingByEmail = await ctx.db
      .query("patients")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existingByEmail) {
      throw new Error(`Patient with email ${args.email} already exists`);
    }

    return await ctx.db.insert("patients", args);
  },
});

/**
 * Mutation to update patient data
 */
export const updatePatient = mutation({
  args: {
    did: v.string(),
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    dob: v.optional(v.string()),
    ward: v.optional(v.string()),
    bed: v.optional(v.string()),
    admitDate: v.optional(v.string()),
    status: v.optional(v.string()),
    primaryDoctor: v.optional(v.string()),
    conditions: v.optional(v.array(v.string())),
    insuranceProvider: v.optional(v.string()),
    insurancePolicyNo: v.optional(v.string()),
    emergencyContact: v.optional(
      v.object({
        name: v.string(),
        relation: v.string(),
        phone: v.string(),
      }),
    ),
    organDonor: v.optional(v.boolean()),
    nationality: v.optional(v.string()),
    totalVisits: v.optional(v.number()),
    outstandingBills: v.optional(v.number()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();

    if (!patient) {
      throw new Error(`Patient with DID ${args.did} not found`);
    }

    // If email is being updated, check for conflicts
    if (args.email && args.email !== patient.email) {
      const existingByEmail = await ctx.db
        .query("patients")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique();
      if (existingByEmail && existingByEmail._id !== patient._id) {
        throw new Error(`Patient with email ${args.email} already exists`);
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = { updatedAt: args.updatedAt };

    const optionalFields = [
      "name",
      "age",
      "gender",
      "bloodGroup",
      "allergies",
      "phone",
      "email",
      "address",
      "dob",
      "ward",
      "bed",
      "admitDate",
      "status",
      "primaryDoctor",
      "conditions",
      "insuranceProvider",
      "insurancePolicyNo",
      "emergencyContact",
      "organDonor",
      "nationality",
      "totalVisits",
      "outstandingBills",
    ];

    for (const field of optionalFields) {
      if (args[field as keyof typeof args] !== undefined) {
        updateData[field] = args[field as keyof typeof args];
      }
    }

    await ctx.db.patch(patient._id, updateData);
    return patient._id;
  },
});

/**
 * Mutation to delete a patient
 */
export const deletePatient = mutation({
  args: { did: v.string() },
  handler: async (ctx, args) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();

    if (!patient) {
      throw new Error(`Patient with DID ${args.did} not found`);
    }

    await ctx.db.delete(patient._id);
    return true;
  },
});

/**
 * Mutation to update patient vitals
 * Stores vitals in worldState namespace "vitals" with key as patient DID
 */
export const updatePatientVitals = mutation({
  args: {
    patientDid: v.string(),
    vitals: v.object({
      heartRate: v.optional(v.number()),
      bloodPressure: v.optional(
        v.object({
          systolic: v.number(),
          diastolic: v.number(),
        }),
      ),
      temperature: v.optional(v.number()),
      respiratoryRate: v.optional(v.number()),
      oxygenSaturation: v.optional(v.number()),
      weight: v.optional(v.number()),
      height: v.optional(v.number()),
      bmi: v.optional(v.number()),
      glucoseLevel: v.optional(v.number()),
      notes: v.optional(v.string()),
    }),
    txId: v.string(),
    version: v.string(),
    recordedAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify patient exists
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_did", (q) => q.eq("did", args.patientDid))
      .unique();

    if (!patient) {
      throw new Error(`Patient with DID ${args.patientDid} not found`);
    }

    // Store vitals in worldState with namespace "vitals"
    const existing = await ctx.db
      .query("worldState")
      .withIndex("by_ns_key", (q) => q.eq("namespace", "vitals").eq("key", args.patientDid))
      .unique();

    const vitalsData = {
      ...args.vitals,
      recordedAt: args.recordedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: vitalsData,
        txId: args.txId,
        version: args.version,
        updatedAt: args.recordedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("worldState", {
      namespace: "vitals",
      key: args.patientDid,
      value: vitalsData,
      txId: args.txId,
      version: args.version,
      updatedAt: args.recordedAt,
    });
  },
});

export const putWorldState = mutation({
  args: {
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    txId: v.string(),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("worldState")
      .withIndex("by_ns_key", (q) => q.eq("namespace", args.namespace).eq("key", args.key))
      .unique();

    const updatedAt = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        txId: args.txId,
        version: args.version || "1",
        updatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("worldState", {
      namespace: args.namespace,
      key: args.key,
      value: args.value,
      txId: args.txId,
      version: args.version || "1",
      updatedAt,
    });
  },
});
