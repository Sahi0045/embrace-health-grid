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
    status: v.string(),  // pending | confirmed | rejected | rescheduled | cancelled
    reason: v.optional(v.string()),
    suggestedSlot: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    bookedAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
    .index("by_apptId", ["apptId"])
    .index("by_patientDid", ["patientDid"])
    .index("by_doctorDid", ["doctorDid"]),

  patients: defineTable({
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
  })
    .index("by_did", ["did"])
    .index("by_mrn", ["mrn"])
    .index("by_email", ["email"]),

  staff: defineTable({
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
  })
    .index("by_did", ["did"])
    .index("by_employeeId", ["employeeId"])
    .index("by_email", ["email"]),

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
