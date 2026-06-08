import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  dids: defineTable({
    did: v.string(),
    owner: v.string(),
    ownerType: v.string(),
    controller: v.string(),
    publicKey: v.string(),
    status: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    serviceEndpoint: v.optional(v.string()),
  }).index("by_did", ["did"]),

  credentials: defineTable({
    id: v.string(),
    type: v.string(),
    issuer: v.string(),
    subject: v.string(),
    issuedAt: v.string(),
    expiresAt: v.string(),
    claims: v.any(),
    signature: v.string(),
    status: v.string(),
  }).index("by_id", ["id"]),

  consents: defineTable({
    grantId: v.string(),
    patientDid: v.string(),
    doctorDid: v.string(),
    resource: v.string(),
    status: v.string(),
    expiry: v.string(),
    grantedAt: v.string(),
  }).index("by_grantId", ["grantId"]),

  auditEvents: defineTable({
    txId: v.string(),
    actor: v.string(),
    resource: v.string(),
    action: v.string(),
    outcome: v.string(),
    severity: v.string(),
    loggedAt: v.string(),
  }).index("by_txId", ["txId"]),

  beds: defineTable({
    bedId: v.string(),
    ward: v.string(),
    status: v.string(),
    patientDid: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_bedId", ["bedId"]),

  prescriptions: defineTable({
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
  }).index("by_rxId", ["rxId"]),

  appointments: defineTable({
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
  }).index("by_apptId", ["apptId"]),

  worldState: defineTable({
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    txId: v.string(),
    version: v.string(),
    updatedAt: v.string(),
  })
    .index("by_ns_key", ["namespace", "key"])
    .index("by_ns", ["namespace"]),
});

