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
    bookedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("appointments", args);
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

