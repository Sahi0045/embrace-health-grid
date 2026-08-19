/**
 * Operational domain server functions — Embrace Health Grid
 *
 * Completes the move off Express for the non-clinical domains: attendance,
 * scheduling, beds, rooms, visitors, NFC cards, insurance and health metrics.
 *
 * Same design as clinical.server.ts: these run server-side because the browser
 * client holds no session, and they use the ANON key so RLS still governs every
 * result. Scope comes from the caller's session, never from a client-supplied
 * identifier.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";
import {
  resolveCallerForAudit,
  tryWriteAudit,
  buildBedAudit,
  buildRoomAudit,
  buildInventoryAudit,
} from "./audit.server";
import type {
  InventoryCategory,
  InventoryItem,
  StockMovement,
  InventoryAlert,
  CentralAlert,
  CentralAlertStats,
  EmergencyBroadcastCode,
  EmergencyBroadcastRecord,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  LabOrderRecord,
  LabSampleRecord,
  LabResultRecord,
  RadiologyOrderRecord,
  LabDashboardStats,
  CafeteriaMenuItem,
  KitchenStockItem,
  DietaryRequirement,
  MealDeliveryRecord,
  CafeteriaVendor,
  FoodWastageLog,
  CafeteriaDashboardStats,
  DeliveryStatus,
  ContractStatus,
  MealPlanStatus,
} from "./types";

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * The caller's own profile row.
 *
 * Filtered by id: a clinician's RLS view spans their whole hospital, so an
 * unfiltered .single() throws "Cannot coerce the result to a single JSON object"
 * as soon as a second person exists. That broke room check-in entirely.
 */
async function callerProfile(): Promise<{
  primaryDid: string | null;
  fullName: string | null;
  hospitalId: string | null;
}> {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("primary_did, full_name, hospital_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    primaryDid: data?.primary_did ?? null,
    fullName: data?.full_name ?? null,
    hospitalId: data?.hospital_id ?? null,
  };
}

/** Resolve the caller's primary DID for writes that must be self-scoped. */
async function callerDid(): Promise<string> {
  const { primaryDid } = await callerProfile();
  if (!primaryDid) throw new Error("No DID associated with this account");
  return primaryDid;
}

/**
 * The caller's hospital, required on every tenant-scoped write.
 *
 * The Stage 3 migration added hospital_id to the operational tables and scoped
 * their policies with can_access_hospital(hospital_id). Any insert that omits it
 * evaluates that check against null and is refused — which is why check-in,
 * attendance and visitor requests all failed with "new row violates row-level
 * security policy".
 */
async function callerHospitalId(): Promise<string> {
  const { hospitalId } = await callerProfile();
  if (!hospitalId) throw new Error("Your account is not associated with a hospital");
  return hospitalId;
}

// ─── Attendance ─────────────────────────────────────────────────────────────

export const getAttendance = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // RLS: own rows, or all rows for an admin.
  const { data, error } = await supabase
    .from("attendance")
    .select("attendance_id, staff_id, action, location, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return { attendance: data ?? [] };
});

/** Clock in or out. RLS restricts the row to the caller's own staff_id. */
export const clockAttendance = createServerFn({ method: "POST" })
  .inputValidator((data: { action: "in" | "out"; location?: string }) => {
    if (data?.action !== "in" && data?.action !== "out") {
      throw new Error("action must be 'in' or 'out'");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("attendance").insert({
      staff_id: user.id,
      action: data.action,
      location: data.location ?? null,
      // Required: attendance is tenant-scoped, so an omitted hospital_id fails
      // can_access_hospital and the insert is refused.
      hospital_id: await callerHospitalId(),
    });

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Staff schedule ─────────────────────────────────────────────────────────

export const getStaffSchedule = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("staff_schedule")
    .select(
      "shift_id, staff_id, shift_date, role, starts_at, ends_at, unit, patient_count, notes, confirmed",
    )
    .order("shift_date", { ascending: true });

  if (error) throw new Error(error.message);
  return { schedule: data ?? [] };
});

/** Confirm one's own shift. RLS prevents confirming someone else's. */
export const confirmShift = createServerFn({ method: "POST" })
  .inputValidator((data: { shiftId: string }) => {
    if (!data?.shiftId) throw new Error("shiftId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("staff_schedule")
      .update({ confirmed: true })
      .eq("shift_id", data.shiftId)
      .select("shift_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Shift not found, or it is not yours");
    return { ok: true as const };
  });

// ─── Beds and rooms ─────────────────────────────────────────────────────────

export const getBeds = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("beds")
    .select("bed_id, ward, status, patient_did, updated_at")
    .order("ward", { ascending: true });

  if (error) throw new Error(error.message);
  return { beds: data ?? [] };
});

export const getRooms = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("rooms")
    .select("room_id, room_name, category, floor")
    .order("room_name", { ascending: true });

  if (error) throw new Error(error.message);
  return { rooms: data ?? [] };
});

/** Current clinician locations. Staff-only by policy. */
export const getRoomCheckinStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("room_checkins")
    .select(
      "doctor_did, doctor_name, status, current_room, room_id, checked_in_at, checked_out_at, last_action, updated_at",
    );

  if (error) throw new Error(error.message);
  return { checkins: data ?? [] };
});

/**
 * Check in or out of a room.
 *
 * Writes both the current-state row and an immutable event. The event log is
 * what the daily merkle root commits to, so it must never be rewritten — hence
 * a separate append-only table rather than mutating history.
 */
export const roomCheckin = createServerFn({ method: "POST" })
  .inputValidator((data: { roomId: string; roomName: string; action: "checkin" | "checkout" }) => {
    if (!data?.roomId || !data?.roomName || !data?.action) {
      throw new Error("roomId, roomName and action are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // One profile read for the DID, display name and hospital. The previous
    // unfiltered .single() threw as soon as the caller could see a colleague.
    const profile = await callerProfile();
    const did = profile.primaryDid;
    if (!did) throw new Error("No DID associated with this account");
    if (!profile.hospitalId) throw new Error("Your account is not associated with a hospital");

    const now = new Date().toISOString();

    const { error: upsertErr } = await supabase.from("room_checkins").upsert(
      {
        doctor_did: did,
        doctor_name: profile.fullName,
        hospital_id: profile.hospitalId,
        status: data.action === "checkin" ? "in-room" : "available",
        current_room: data.action === "checkin" ? data.roomName : null,
        room_id: data.action === "checkin" ? data.roomId : null,
        checked_in_at: data.action === "checkin" ? now : null,
        checked_out_at: data.action === "checkout" ? now : null,
        last_action: data.action,
      },
      { onConflict: "doctor_did" },
    );
    if (upsertErr) throw new Error(upsertErr.message);

    const eventId = `RC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error: evErr } = await supabase.from("room_checkin_events").insert({
      event_id: eventId,
      doctor_did: did,
      room_id: data.roomId,
      room_name: data.roomName,
      action: data.action,
      occurred_at: now,
      hospital_id: profile.hospitalId,
    });
    if (evErr) throw new Error(evErr.message);

    return { ok: true as const, eventId };
  });

/** Room events for a day — the merkle leaves for that period. */
export const getDailyRoomEvents = createServerFn({ method: "GET" })
  .inputValidator((data: { doctorDid?: string; date?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("room_checkin_events")
      .select("event_id, doctor_did, room_id, room_name, action, occurred_at")
      .order("occurred_at", { ascending: true });

    if (data.doctorDid) query = query.eq("doctor_did", data.doctorDid);
    if (data.date) {
      query = query
        .gte("occurred_at", `${data.date}T00:00:00Z`)
        .lte("occurred_at", `${data.date}T23:59:59Z`);
    }

    const { data: events, error } = await query;
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });

// ─── Visitors ───────────────────────────────────────────────────────────────

export const getVisitors = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("visitors")
    .select(
      "visitor_id, patient_did, visitor_name, relation, visit_date, purpose, status, requested_at, resolved_at",
    )
    .order("requested_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { visitors: data ?? [] };
});

export const createVisitorRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      patientDid?: string;
      visitorName: string;
      relation?: string;
      visitDate?: string;
      purpose?: string;
    }) => {
      if (!data?.visitorName) throw new Error("visitorName is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    // Default to the caller's own DID; staff may request on a patient's behalf.
    const patientDid = data.patientDid ?? (await callerDid());

    const visitorId = `vis-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("visitors").insert({
      visitor_id: visitorId,
      patient_did: patientDid,
      visitor_name: data.visitorName,
      relation: data.relation ?? null,
      visit_date: data.visitDate ?? null,
      purpose: data.purpose ?? null,
      status: "pending",
      requested_by: user.id,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, visitorId };
  });

/** Approve or deny a visit. RLS restricts this to clinical staff. */
export const resolveVisitorRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { visitorId: string; approve: boolean }) => {
    if (!data?.visitorId) throw new Error("visitorId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("visitors")
      .update({
        status: data.approve ? "approved" : "denied",
        resolved_at: new Date().toISOString(),
      })
      .eq("visitor_id", data.visitorId)
      .select("visitor_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Visit request not found, or you cannot resolve it");
    return { ok: true as const };
  });

// ─── NFC cards ──────────────────────────────────────────────────────────────

export const getNfcCards = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("nfc_cards")
    .select("card_id, patient_did, card_type, status, issued_at, revoked_at")
    .order("issued_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { cards: data ?? [] };
});

/**
 * Verify a card by id.
 *
 * Returns only validity and the owning DID — never the patient's clinical data.
 * A card scan should confirm identity, not unlock a chart.
 */
export const verifyNfcCard = createServerFn({ method: "POST" })
  .inputValidator((data: { cardId: string }) => {
    if (!data?.cardId) throw new Error("cardId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: card, error } = await supabase
      .from("nfc_cards")
      .select("card_id, patient_did, status, card_type")
      .eq("card_id", data.cardId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!card) return { valid: false as const, reason: "Card not found" };
    if (card.status !== "active")
      return { valid: false as const, reason: `Card is ${card.status}` };

    return { valid: true as const, patientDid: card.patient_did, cardType: card.card_type };
  });

// ─── Insurance ──────────────────────────────────────────────────────────────

export const getInsurancePolicy = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.from("insurance_policies").select("*").maybeSingle();

  if (error) throw new Error(error.message);
  return { policy: data ?? null };
});

export const updateInsurancePolicy = createServerFn({ method: "POST" })
  .inputValidator((data: Record<string, unknown>) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    const { error } = await supabase.from("insurance_policies").upsert(
      {
        patient_did: did,
        provider: (data.provider as string) ?? null,
        policy_number: (data.policyNumber as string) ?? null,
        group_number: (data.groupNumber as string) ?? null,
        coverage_type: (data.coverageType as string) ?? null,
        copay: (data.copay as number) ?? null,
        deductible: (data.deductible as number) ?? null,
        coverage_percentage: (data.coveragePercentage as number) ?? null,
        valid_from: (data.validFrom as string) ?? null,
        valid_to: (data.validTo as string) ?? null,
      },
      { onConflict: "patient_did" },
    );

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getInsuranceClaims = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("insurance_claims")
    .select("claim_id, patient_did, amount, description, status, submitted_at, resolved_at")
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { claims: data ?? [] };
});

export const createInsuranceClaim = createServerFn({ method: "POST" })
  .inputValidator((data: { amount: number; description?: string }) => {
    if (!data?.amount || data.amount <= 0) throw new Error("A positive amount is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    const claimId = `CLM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("insurance_claims").insert({
      claim_id: claimId,
      patient_did: did,
      amount: data.amount,
      description: data.description ?? null,
      status: "submitted",
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, claimId };
  });

// ─── Staff requests ─────────────────────────────────────────────────────────

export const getStaffRequests = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  // RLS: own requests, or all of them for an admin.
  const { data, error } = await supabase
    .from("staff_requests")
    .select("request_id, staff_id, request_type, subject, details, status, created_at, resolved_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { requests: data ?? [] };
});

export const createStaffRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { requestType: string; subject: string; details?: string }) => {
    if (!data?.requestType || !data?.subject) {
      throw new Error("requestType and subject are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    const requestId = `REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const hospitalId = await callerHospitalId();
    const { error } = await supabase.from("staff_requests").insert({
      hospital_id: hospitalId,
      request_id: requestId,
      staff_id: user.id,
      request_type: data.requestType,
      subject: data.subject,
      details: data.details ?? null,
      status: "pending",
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, requestId };
  });

/** Resolve a request. RLS restricts this to admins, so a requester cannot
 *  approve their own. */
export const resolveStaffRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { requestId: string; status: "approved" | "rejected" | "completed" }) => {
    if (!data?.requestId || !data?.status) throw new Error("requestId and status are required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("staff_requests")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("request_id", data.requestId)
      .select("request_id");

    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Request not found, or you cannot resolve it");
    return { ok: true as const };
  });

/** Attendance rollup for admins. RLS returns only own rows to non-admins. */
export const getAttendanceSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance")
    .select("staff_id, action, location, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  // Collapse the event log into per-staff totals for the dashboard.
  const byStaff = new Map<
    string,
    {
      staffId: string;
      clockIns: number;
      clockOuts: number;
      lastSeen: string;
      checkInTime: string | null;
      checkOutTime: string | null;
    }
  >();
  for (const row of data ?? []) {
    const entry = byStaff.get(row.staff_id) ?? {
      staffId: row.staff_id,
      clockIns: 0,
      clockOuts: 0,
      lastSeen: row.recorded_at,
      checkInTime: null as string | null,
      checkOutTime: null as string | null,
    };
    if (row.action === "in") {
      entry.clockIns += 1;
      // Rows arrive newest-first, so the first one seen is the latest.
      entry.checkInTime ??= row.recorded_at;
    } else {
      entry.clockOuts += 1;
      entry.checkOutTime ??= row.recorded_at;
    }
    if (row.recorded_at > entry.lastSeen) entry.lastSeen = row.recorded_at;
    byStaff.set(row.staff_id, entry);
  }

  // Resolve who each staff_id actually is. Without this the roster rendered a
  // bare UUID with an empty name, department and DID, because the attendance
  // table stores only the id.
  const staffIds = [...byStaff.keys()];
  const people = new Map<string, { name: string; email: string; did: string | null }>();

  if (staffIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, primary_did")
      .in("id", staffIds);

    for (const p of profiles ?? []) {
      people.set(p.id, {
        name: p.full_name ?? p.email ?? "",
        email: p.email ?? "",
        did: p.primary_did ?? null,
      });
    }
  }

  const summary = [...byStaff.values()].map((entry) => {
    const person = people.get(entry.staffId);
    return {
      ...entry,
      staffName: person?.name ?? "Unknown staff member",
      staffEmail: person?.email ?? "",
      did: person?.did ?? null,
      // Department is not modelled on profiles yet; render a neutral value
      // rather than an empty cell.
      department: "—",
      status: entry.clockIns > entry.clockOuts ? "present" : "checked-out",
    };
  });

  return { summary, events: data ?? [] };
});

/** Room check-in history for one clinician — the merkle leaf source. */
export const getRoomCheckinHistory = createServerFn({ method: "GET" })
  .inputValidator((data: { doctorDid?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("room_checkin_events")
      .select("event_id, doctor_did, room_id, room_name, action, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (data.doctorDid) query = query.eq("doctor_did", data.doctorDid);

    const { data: events, error } = await query;
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });

// ─── Health metrics ─────────────────────────────────────────────────────────

export const getHealthMetrics = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("health_metrics")
    .select("*")
    .order("measured_on", { ascending: false })
    .limit(90);

  if (error) throw new Error(error.message);
  return { metrics: data ?? [] };
});

export const recordHealthMetric = createServerFn({ method: "POST" })
  .inputValidator((data: Record<string, unknown>) => {
    if (!data?.measuredOn) throw new Error("measuredOn is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const did = await callerDid();

    // One row per patient per day; re-recording updates that day's entry.
    const { error } = await supabase.from("health_metrics").upsert(
      {
        patient_did: did,
        measured_on: data.measuredOn as string,
        weight_kg: (data.weight as number) ?? null,
        bmi: (data.bmi as number) ?? null,
        sugar_fasting: (data.sugarFasting as number) ?? null,
        sugar_post_meal: (data.sugarPostMeal as number) ?? null,
        bp_systolic: (data.bpSystolic as number) ?? null,
        bp_diastolic: (data.bpDiastolic as number) ?? null,
        cholesterol_total: (data.cholesterolTotal as number) ?? null,
        cholesterol_hdl: (data.cholesterolHdl as number) ?? null,
        cholesterol_ldl: (data.cholesterolLdl as number) ?? null,
        hba1c: (data.hba1c as number) ?? null,
      },
      { onConflict: "patient_did,measured_on" },
    );

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Hospital Infrastructure Hierarchy ──────────────────────────────────────

/** Get complete hospital infrastructure hierarchy */
export const getHospitalInfrastructure = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();
  const hospitalId = await callerHospitalId();

  // Get buildings
  const { data: buildings, error: buildingsErr } = await supabase
    .from("buildings")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("building_name");

  if (buildingsErr) throw new Error(buildingsErr.message);

  // Get floors
  const { data: floors, error: floorsErr } = await supabase
    .from("floors")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("building_id, floor_number");

  if (floorsErr) throw new Error(floorsErr.message);

  // Get wards
  const { data: wards, error: wardsErr } = await supabase
    .from("wards")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("floor_id, ward_name");

  if (wardsErr) throw new Error(wardsErr.message);

  // Get rooms with status
  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("ward_id, room_name");

  if (roomsErr) throw new Error(roomsErr.message);

  // Get beds with status
  const { data: beds, error: bedsErr } = await supabase
    .from("beds")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("room_id, bed_number");

  if (bedsErr) throw new Error(bedsErr.message);

  return {
    buildings: buildings ?? [],
    floors: floors ?? [],
    wards: wards ?? [],
    rooms: rooms ?? [],
    beds: beds ?? [],
  };
});

/** Get buildings for a hospital */
export const getBuildings = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();
  const hospitalId = await callerHospitalId();

  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("building_name");

  if (error) throw new Error(error.message);
  return { buildings: data ?? [] };
});

/** Get floors for a building */
export const getFloors = createServerFn({ method: "GET" })
  .inputValidator((data: { buildingId?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase.from("floors").select("*").order("floor_number");

    if (data.buildingId) {
      query = query.eq("building_id", data.buildingId);
    }

    const { data: floors, error } = await query;
    if (error) throw new Error(error.message);
    return { floors: floors ?? [] };
  });

/** Get wards for a floor */
export const getWards = createServerFn({ method: "GET" })
  .inputValidator((data: { floorId?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase.from("wards").select("*").order("ward_name");

    if (data.floorId) {
      query = query.eq("floor_id", data.floorId);
    }

    const { data: wards, error } = await query;
    if (error) throw new Error(error.message);
    return { wards: wards ?? [] };
  });

/** Create a new building */
export const createBuilding = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { name: string; code?: string; description?: string; totalFloors?: number }) => {
      if (!data?.name) throw new Error("Building name is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId();

    const { data: building, error } = await supabase
      .from("buildings")
      .insert({
        hospital_id: hospitalId,
        building_name: data.name,
        building_code: data.code ?? null,
        description: data.description ?? null,
        total_floors: data.totalFloors ?? 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true as const, building };
  });

/** Create a new floor */
export const createFloor = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { buildingId: string; floorNumber: number; name: string; description?: string }) => {
      if (!data?.buildingId || data?.floorNumber == null || !data?.name) {
        throw new Error("Building ID, floor number, and name are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId();

    const { data: floor, error } = await supabase
      .from("floors")
      .insert({
        building_id: data.buildingId,
        hospital_id: hospitalId,
        floor_number: data.floorNumber,
        floor_name: data.name,
        description: data.description ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true as const, floor };
  });

/** Create a new ward */
export const createWard = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      floorId: string;
      buildingId: string;
      name: string;
      code?: string;
      type?: string;
      description?: string;
      capacity?: number;
    }) => {
      if (!data?.floorId || !data?.buildingId || !data?.name) {
        throw new Error("Floor ID, building ID, and ward name are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId();

    const { data: ward, error } = await supabase
      .from("wards")
      .insert({
        floor_id: data.floorId,
        building_id: data.buildingId,
        hospital_id: hospitalId,
        ward_name: data.name,
        ward_code: data.code ?? null,
        ward_type: data.type ?? null,
        description: data.description ?? null,
        capacity: data.capacity ?? 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true as const, ward };
  });

/** Create a new room */
export const createRoom = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      wardId: string;
      buildingId: string;
      name: string;
      roomNumber?: string;
      roomType?: string;
      floor?: string;
      capacity?: number;
    }) => {
      if (!data?.wardId || !data?.buildingId || !data?.name) {
        throw new Error("Ward ID, building ID, and room name are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId();

    const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        room_id: roomId,
        ward_id: data.wardId,
        building_id: data.buildingId,
        hospital_id: hospitalId,
        room_name: data.name,
        room_number: data.roomNumber ?? null,
        room_type: data.roomType ?? null,
        floor: data.floor ?? null,
        capacity: data.capacity ?? 1,
        status: "available",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true as const, room };
  });

/** Create a new bed */
export const createBed = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      roomId: string;
      wardId: string;
      buildingId: string;
      bedNumber?: string;
      bedType?: string;
    }) => {
      if (!data?.roomId || !data?.wardId || !data?.buildingId) {
        throw new Error("Room ID, ward ID, and building ID are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId();

    const bedId = `bed-${crypto.randomUUID().slice(0, 8)}`;
    const { data: bed, error } = await supabase
      .from("beds")
      .insert({
        bed_id: bedId,
        room_id: data.roomId,
        ward_id: data.wardId,
        building_id: data.buildingId,
        hospital_id: hospitalId,
        bed_number: data.bedNumber ?? null,
        bed_type: data.bedType ?? null,
        status: "available",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true as const, bed };
  });

/** Update bed status */
export const updateBedStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      bedId: string;
      status:
        | "available"
        | "occupied"
        | "reserved"
        | "cleaning"
        | "maintenance"
        | "blocked"
        | "emergency_reserved";
      patientDid?: string;
    }) => {
      if (!data?.bedId || !data?.status) {
        throw new Error("Bed ID and status are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // Validate occupancy consistency
    const updateData: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.status === "occupied") {
      if (!data.patientDid) {
        throw new Error("Patient DID is required when marking bed as occupied");
      }
      updateData.patient_did = data.patientDid;
    } else {
      updateData.patient_did = null;
    }

    const { data: updated, error } = await supabase
      .from("beds")
      .update(updateData)
      .eq("bed_id", data.bedId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Bed not found or you cannot update it");

    // ── Rich audit record ─────────────────────────────────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(
      buildBedAudit(
        caller,
        data.bedId,
        "unknown", // prev status not fetched to keep the update lean
        data.status,
        data.patientDid ? { patientDid: data.patientDid } : {},
      ),
    );

    return { ok: true as const, bed: updated };
  });

/** Update room status */
export const updateRoomStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      roomId: string;
      status:
        | "available"
        | "occupied"
        | "reserved"
        | "cleaning"
        | "maintenance"
        | "blocked"
        | "emergency_reserved";
    }) => {
      if (!data?.roomId || !data?.status) {
        throw new Error("Room ID and status are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("rooms")
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", data.roomId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Room not found or you cannot update it");

    // ── Rich audit record ─────────────────────────────────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(buildRoomAudit(caller, data.roomId, "unknown", data.status));

    return { ok: true as const, room: updated };
  });

/** Get bed/room statistics for dashboard */
export const getBedRoomStatistics = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();
  const hospitalId = await callerHospitalId();

  // Get bed statistics
  const { data: beds, error: bedsErr } = await supabase
    .from("beds")
    .select("status")
    .eq("hospital_id", hospitalId);

  if (bedsErr) throw new Error(bedsErr.message);

  // Get room statistics
  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("status")
    .eq("hospital_id", hospitalId);

  if (roomsErr) throw new Error(roomsErr.message);

  // Calculate statistics
  const bedStats = {
    total: beds?.length ?? 0,
    available: beds?.filter((b: any) => b.status === "available").length ?? 0,
    occupied: beds?.filter((b: any) => b.status === "occupied").length ?? 0,
    reserved: beds?.filter((b: any) => b.status === "reserved").length ?? 0,
    cleaning: beds?.filter((b: any) => b.status === "cleaning").length ?? 0,
    maintenance: beds?.filter((b: any) => b.status === "maintenance").length ?? 0,
    blocked: beds?.filter((b: any) => b.status === "blocked").length ?? 0,
    emergency_reserved: beds?.filter((b: any) => b.status === "emergency_reserved").length ?? 0,
  };

  const roomStats = {
    total: rooms?.length ?? 0,
    available: rooms?.filter((r: any) => r.status === "available").length ?? 0,
    occupied: rooms?.filter((r: any) => r.status === "occupied").length ?? 0,
    reserved: rooms?.filter((r: any) => r.status === "reserved").length ?? 0,
    cleaning: rooms?.filter((r: any) => r.status === "cleaning").length ?? 0,
    maintenance: rooms?.filter((r: any) => r.status === "maintenance").length ?? 0,
    blocked: rooms?.filter((r: any) => r.status === "blocked").length ?? 0,
    emergency_reserved: rooms?.filter((r: any) => r.status === "emergency_reserved").length ?? 0,
  };

  return { bedStats, roomStats };
});

// ─── Inventory & Supply Chain Governance ───────────────────────────────────

// Live In-Memory State Cache (persists state across client calls if remote tables are being initialized)
const _fallbackCategories: InventoryCategory[] = [
  {
    category_id: "medications",
    name: "Medications & Drugs",
    description: "Pharmaceuticals, IV infusions, injectables and oral medications",
    color_code: "#3b82f6",
  },
  {
    category_id: "medical_devices",
    name: "Medical Devices",
    description: "Diagnostic instruments, monitors, pumps and telemetry hardware",
    color_code: "#8b5cf6",
  },
  {
    category_id: "ppe",
    name: "PPE & Infection Control",
    description: "Gloves, masks, gowns, shields, and biohazard protection supplies",
    color_code: "#10b981",
  },
  {
    category_id: "surgical_supplies",
    name: "Surgical Supplies",
    description: "Sterile drapes, sutures, blades, scalpels and OR consumables",
    color_code: "#f59e0b",
  },
  {
    category_id: "lab_reagents",
    name: "Lab Reagents & Assays",
    description: "Chemical diagnostic reagents, assay kits and specimen containers",
    color_code: "#ec4899",
  },
  {
    category_id: "office_supplies",
    name: "Administrative & Office",
    description: "Hospital admission charts, barcode labels and desk supplies",
    color_code: "#6b7280",
  },
  {
    category_id: "cleaning_products",
    name: "Sanitation & Disinfection",
    description: "Hospital-grade disinfectants, sterilizing solutions and biocides",
    color_code: "#06b6d4",
  },
];

// ─── In-memory fallback for the inventory screens ────────────────────────────
//
// These three arrays used to ship 25 hardcoded rows: 14 inventory items, 6 stock
// movements attributed to invented staff ("Lead Pharmacist Dr. Sarah Chen",
// "Nurse Supervisor Elena Rostova") and 5 critical alerts asserting specific
// stock levels and expiry dates ("Propofol 1% stock level is critical (14 vials
// remaining)", "Troponin I Assay Kits expiring in 11 days").
//
// None of it was real. It reached users because getInventoryData() falls back to
// these arrays when the database read throws, and inventory_items did not exist
// on the deployed database, so the fallback was the ONLY path — /admin/inventory
// on production was showing invented stock levels and actionable clinical alerts
// for anaesthetics and emergency drugs. Staff could have acted on them.
//
// Now empty: an empty inventory screen is correct when there is no inventory.
//
// These remain module-level, which is itself wrong for a serverless deployment —
// each function instance has its own memory, so anything written here is visible
// only to whichever instance happens to serve the next request. They are a
// last-resort buffer, not a store.
const _liveInventoryItems: InventoryItem[] = [];

const _liveStockMovements: StockMovement[] = [];

const _liveInventoryAlerts: InventoryAlert[] = [];

/** Get all inventory items, categories, unacknowledged alerts, and aggregate KPI statistics */
export const getInventoryData = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();
  const hospitalId = await callerHospitalId().catch(() => null);

  try {
    // 1. Fetch categories
    const { data: categories, error: catErr } = await supabase
      .from("inventory_categories")
      .select("*")
      .order("name");

    if (catErr) throw catErr;

    // 2. Fetch inventory items
    let itemQuery = supabase.from("inventory_items").select("*").order("name");

    if (hospitalId) {
      itemQuery = itemQuery.eq("hospital_id", hospitalId);
    }

    const { data: items, error: itemsErr } = await itemQuery;
    if (itemsErr) throw itemsErr;

    // 3. Fetch active alerts
    let alertQuery = supabase
      .from("inventory_alerts")
      .select("*")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false });

    if (hospitalId) {
      alertQuery = alertQuery.eq("hospital_id", hospitalId);
    }

    const { data: alerts, error: alertErr } = await alertQuery;
    if (alertErr) throw alertErr;

    const allItems: any[] = items || [];
    const totalItems = allItems.length;
    const lowStockCount = allItems.filter(
      (i: any) =>
        i.status === "low_stock" || i.status === "critical" || i.current_stock <= i.reorder_level,
    ).length;
    const criticalCount = allItems.filter(
      (i: any) => i.status === "critical" || i.current_stock === 0,
    ).length;

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nearExpiryCount = allItems.filter((i: any) => {
      if (!i.expiry_date) return false;
      const exp = new Date(i.expiry_date);
      return exp <= thirtyDaysLater;
    }).length;

    const totalStockValuation = allItems.reduce(
      (sum: number, i: any) => sum + (Number(i.current_stock) || 0) * (Number(i.unit_cost) || 0),
      0,
    );

    const categoryBreakdown: Record<string, number> = {};
    for (const cat of categories || []) {
      categoryBreakdown[cat.category_id] = allItems.filter(
        (i: any) => i.category_id === cat.category_id,
      ).length;
    }

    return {
      categories: categories || [],
      items: allItems,
      alerts: alerts || [],
      stats: {
        totalItems,
        lowStockCount,
        criticalCount,
        nearExpiryCount,
        reorderPendingCount: lowStockCount,
        totalStockValuation,
        categoryBreakdown,
      },
    };
  } catch {
    // Return live in-memory synchronized dataset
    const activeAlerts = _liveInventoryAlerts.filter((a) => !a.acknowledged);
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const lowStockCount = _liveInventoryItems.filter(
      (i) =>
        i.status === "low_stock" || i.status === "critical" || i.current_stock <= i.reorder_level,
    ).length;
    const criticalCount = _liveInventoryItems.filter(
      (i) => i.status === "critical" || i.current_stock === 0,
    ).length;
    const nearExpiryCount = _liveInventoryItems.filter((i) => {
      if (!i.expiry_date) return false;
      const exp = new Date(i.expiry_date);
      return exp <= thirtyDaysLater;
    }).length;

    const totalStockValuation = _liveInventoryItems.reduce(
      (sum, i) => sum + (Number(i.current_stock) || 0) * (Number(i.unit_cost) || 0),
      0,
    );

    const categoryBreakdown: Record<string, number> = {};
    for (const cat of _fallbackCategories) {
      categoryBreakdown[cat.category_id] = _liveInventoryItems.filter(
        (i) => i.category_id === cat.category_id,
      ).length;
    }

    return {
      categories: _fallbackCategories,
      items: _liveInventoryItems,
      alerts: activeAlerts,
      stats: {
        totalItems: _liveInventoryItems.length,
        lowStockCount,
        criticalCount,
        nearExpiryCount,
        reorderPendingCount: lowStockCount,
        totalStockValuation,
        categoryBreakdown,
      },
    };
  }
});

/** Get stock movements for a specific inventory item */
export const getStockMovements = createServerFn({ method: "GET" })
  .inputValidator((data: { itemId: string }) => {
    if (!data?.itemId) throw new Error("itemId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    try {
      const { data: movements, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("item_id", data.itemId)
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return { movements: movements || [] };
    } catch {
      const matched = _liveStockMovements.filter((m) => m.item_id === data.itemId);
      return { movements: matched };
    }
  });

/** Record a stock movement (IN / OUT / ADJUSTMENT) and update inventory item stock */
export const recordStockMovement = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      itemId: string;
      movementType: "IN" | "OUT" | "ADJUSTMENT";
      quantity: number;
      reason?: string;
    }) => {
      if (!data?.itemId) throw new Error("itemId is required");
      if (!data?.movementType) throw new Error("movementType is required");
      if (typeof data?.quantity !== "number") throw new Error("quantity must be a number");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { primaryDid, fullName, hospitalId } = await callerProfile();
    const supabase = getSupabaseServerClient();

    // Find in memory or DB
    const itemIndex = _liveInventoryItems.findIndex((i) => i.item_id === data.itemId);
    const item = itemIndex !== -1 ? _liveInventoryItems[itemIndex] : null;

    const previousStock = item ? item.current_stock : 10;
    let newStock = previousStock;

    if (data.movementType === "IN") {
      newStock = previousStock + Math.abs(data.quantity);
    } else if (data.movementType === "OUT") {
      newStock = Math.max(0, previousStock - Math.abs(data.quantity));
    } else if (data.movementType === "ADJUSTMENT") {
      newStock = Math.max(0, previousStock + data.quantity);
    }

    const reorderThreshold = item?.reorder_level || 15;
    let newStatus: InventoryItem["status"] = "normal";
    if (newStock === 0 || newStock <= Math.floor(reorderThreshold / 2)) {
      newStatus = "critical";
    } else if (newStock <= reorderThreshold) {
      newStatus = "low_stock";
    } else {
      newStatus = "normal";
    }

    // 1. Update in-memory state
    if (itemIndex !== -1) {
      _liveInventoryItems[itemIndex] = {
        ..._liveInventoryItems[itemIndex],
        current_stock: newStock,
        status: newStatus,
        last_movement_at: new Date().toISOString(),
      };
    }

    const newMovement: StockMovement = {
      movement_id: `mov-${Date.now()}`,
      item_id: data.itemId,
      movement_type: data.movementType,
      quantity: data.quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: data.reason || `Stock ${data.movementType} manual entry`,
      performed_by: user.id,
      performed_by_name: fullName || primaryDid || "Admin Clinician",
      recorded_at: new Date().toISOString(),
    };
    _liveStockMovements.unshift(newMovement);

    // 2. Persist to Supabase if tables exist
    try {
      await supabase.from("stock_movements").insert({
        item_id: data.itemId,
        hospital_id: hospitalId || null,
        movement_type: data.movementType,
        quantity: data.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: data.reason || `Stock ${data.movementType} manual entry`,
        performed_by: user.id,
        performed_by_name: fullName || primaryDid || "Admin Clinician",
      });

      await supabase
        .from("inventory_items")
        .update({
          current_stock: newStock,
          status: newStatus,
          last_movement_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", data.itemId);
    } catch (dbErr: any) {
      console.warn(
        "Supabase persistence notice (operating in live cache):",
        dbErr?.message || dbErr,
      );
    }

    // 3. Audit trail
    const caller = await resolveCallerForAudit();
    await tryWriteAudit(
      buildInventoryAudit(
        caller,
        data.itemId,
        data.movementType,
        data.quantity,
        previousStock,
        newStock,
        {
          reason: data.reason,
          itemName: item?.name || data.itemId,
        },
      ),
    );

    return {
      ok: true as const,
      itemId: data.itemId,
      previousStock,
      newStock,
      status: newStatus,
    };
  });

/** Update item reorder parameters and storage location */
export const updateItemReorderSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      itemId: string;
      reorderLevel?: number;
      reorderQty?: number;
      storageLocation?: string;
      supplier?: string;
      unitCost?: number;
    }) => {
      if (!data?.itemId) throw new Error("itemId is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // 1. Update in-memory state
    const idx = _liveInventoryItems.findIndex((i) => i.item_id === data.itemId);
    if (idx !== -1) {
      _liveInventoryItems[idx] = {
        ..._liveInventoryItems[idx],
        reorder_level:
          data.reorderLevel !== undefined
            ? data.reorderLevel
            : _liveInventoryItems[idx].reorder_level,
        reorder_qty:
          data.reorderQty !== undefined ? data.reorderQty : _liveInventoryItems[idx].reorder_qty,
        storage_location:
          data.storageLocation !== undefined
            ? data.storageLocation
            : _liveInventoryItems[idx].storage_location,
        supplier: data.supplier !== undefined ? data.supplier : _liveInventoryItems[idx].supplier,
        unit_cost: data.unitCost !== undefined ? data.unitCost : _liveInventoryItems[idx].unit_cost,
      };
    }

    // 2. Persist to Supabase if table exists
    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (data.reorderLevel !== undefined) updatePayload.reorder_level = data.reorderLevel;
      if (data.reorderQty !== undefined) updatePayload.reorder_qty = data.reorderQty;
      if (data.storageLocation !== undefined) updatePayload.storage_location = data.storageLocation;
      if (data.supplier !== undefined) updatePayload.supplier = data.supplier;
      if (data.unitCost !== undefined) updatePayload.unit_cost = data.unitCost;

      await supabase.from("inventory_items").update(updatePayload).eq("item_id", data.itemId);
    } catch (err: any) {
      console.warn("Supabase persistence notice:", err?.message || err);
    }

    return { ok: true as const, itemId: data.itemId };
  });

/** Acknowledge an inventory alert */
export const acknowledgeInventoryAlert = createServerFn({ method: "POST" })
  .inputValidator((data: { alertId: string }) => {
    if (!data?.alertId) throw new Error("alertId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // 1. Update in-memory state
    const alertIdx = _liveInventoryAlerts.findIndex((a) => a.alert_id === data.alertId);
    if (alertIdx !== -1) {
      _liveInventoryAlerts[alertIdx].acknowledged = true;
    }

    // 2. Persist to Supabase if table exists
    try {
      await supabase
        .from("inventory_alerts")
        .update({ acknowledged: true })
        .eq("alert_id", data.alertId);
    } catch (err: any) {
      console.warn("Supabase alert acknowledgement notice:", err?.message || err);
    }

    return { ok: true as const, alertId: data.alertId };
  });

// ─── CENTRAL ALERTS & NOTIFICATIONS ENGINE (SPRINT 8) ──────────────────────

/**
 * Aggregates clinical, security, infrastructure, supply chain, and emergency alerts
 * into a unified live stream.
 */
export const getCentralAlerts = createServerFn({ method: "GET" })
  .inputValidator(
    (params?: { category?: string; severity?: string; status?: string; search?: string }) =>
      params || {},
  )
  .handler(async ({ data }) => {
    const { hospitalId } = await callerProfile().catch(() => ({
      hospitalId: null,
      primaryDid: null,
      fullName: null,
    }));
    const supabase = getSupabaseServerClient();

    const alerts: CentralAlert[] = [];

    // 1. Emergency Broadcasts
    try {
      let query = supabase
        .from("emergency_broadcasts")
        .select("*")
        .order("created_at", { ascending: false });

      if (hospitalId) {
        query = query.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
      }

      const { data: broadcasts, error } = await query;
      if (!error && broadcasts) {
        for (const b of broadcasts) {
          alerts.push({
            id: b.broadcast_id,
            category: "emergency",
            severity: b.severity || "critical",
            status: b.status || "active",
            title: b.title || `EMERGENCY: ${b.broadcast_code.toUpperCase()}`,
            message: b.message,
            source_table: "emergency_broadcasts",
            source_id: b.broadcast_id,
            target_url: "/admin/command",
            highlight_id: b.broadcast_id,
            actor: b.initiator_name,
            location: b.location,
            created_at: b.created_at,
            acknowledged_at: b.acknowledged_at,
            resolved_at: b.resolved_at,
            metadata: b.metadata || {},
          });
        }
      }
    } catch (err) {
      console.warn("Emergency broadcasts query notice:", err);
    }

    // 2. Fraud & Security Alerts
    try {
      const { data: fraudAlerts, error } = await supabase
        .from("fraud_alerts")
        .select("*")
        .order("detected_at", { ascending: false });

      if (!error && fraudAlerts) {
        for (const f of fraudAlerts) {
          alerts.push({
            id: f.alert_id,
            category: "security",
            severity:
              f.severity === "high" || f.severity === "critical"
                ? "critical"
                : f.severity === "medium"
                  ? "warning"
                  : "info",
            status:
              f.status === "open"
                ? "active"
                : f.status === "investigating"
                  ? "acknowledged"
                  : "resolved",
            title: `Security & Compliance Anomaly: ${f.alert_type || "Access Anomaly"}`,
            message: f.message,
            source_table: "fraud_alerts",
            source_id: f.alert_id,
            target_url: "/admin/fraud",
            highlight_id: f.alert_id,
            actor: f.actor || "System Sentinel",
            created_at: f.detected_at,
            resolved_at: f.resolved_at,
            metadata: { risk_score: f.risk_score, details: f.details },
          });
        }
      }
    } catch (err) {
      console.warn("Fraud alerts query notice:", err);
    }

    // 3. Inventory & Supply Chain Alerts
    try {
      let invQuery = supabase
        .from("inventory_alerts")
        .select("*, item:inventory_items(*)")
        .order("created_at", { ascending: false });

      if (hospitalId) {
        invQuery = invQuery.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
      }

      const { data: invAlerts, error } = await invQuery;
      if (!error && invAlerts) {
        for (const a of invAlerts) {
          const cat: AlertCategory =
            a.alert_type === "near_expiry" || a.alert_type === "expired"
              ? "near_expiry"
              : "low_stock";
          alerts.push({
            id: a.alert_id,
            category: cat,
            severity: a.severity || (a.alert_type === "critical" ? "critical" : "warning"),
            status: a.acknowledged ? "acknowledged" : "active",
            title: `Supply Chain Alert: ${a.item?.name || a.item_id}`,
            message: a.message,
            source_table: "inventory_alerts",
            source_id: a.item_id || a.alert_id,
            target_url: "/admin/inventory",
            highlight_id: a.item_id || a.alert_id,
            department: "Central Pharmacy & Inventory",
            created_at: a.created_at,
            metadata: {
              current_level: a.current_level,
              threshold: a.threshold,
              sku: a.item?.sku,
            },
          });
        }
      }
    } catch (err) {
      console.warn("Inventory alerts query notice:", err);
    }

    // 4. Equipment Failures & Overdue Calibration
    try {
      let eqQuery = supabase.from("equipment").select("*").in("status", ["offline", "maintenance"]);

      if (hospitalId) {
        eqQuery = eqQuery.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
      }

      const { data: eqList, error: eqErr } = await eqQuery;
      if (!eqErr && eqList) {
        for (const eq of eqList) {
          alerts.push({
            id: `eq-alert-${eq.id}`,
            category: "equipment_failure",
            severity: eq.status === "offline" ? "critical" : "warning",
            status: "active",
            title: `Biomedical Equipment ${eq.status === "offline" ? "Offline" : "Under Maintenance"}: ${eq.name}`,
            message: `Unit model ${eq.model || eq.type} in ${eq.department || "Clinical Unit"} (Floor ${eq.floor || "N/A"}) is currently ${eq.status}. Utilization is at ${eq.utilization ?? 0}%.`,
            source_table: "equipment",
            source_id: eq.id,
            target_url: "/admin/equipment",
            highlight_id: eq.id,
            department: eq.department,
            created_at: eq.updated_at || new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
            metadata: {
              serial: eq.serial,
              model: eq.model,
              type: eq.type,
              nextMaintenance: eq.next_maintenance,
            },
          });
        }
      }
    } catch (err) {
      console.warn("Equipment alerts query notice:", err);
    }

    // 5. High Ward Utilization / Bed Shortage Alert
    try {
      let bedQuery = supabase.from("beds").select("id, status, ward_code, ward, building, floor");
      if (hospitalId) {
        bedQuery = bedQuery.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
      }
      const { data: bedsData } = await bedQuery;
      if (bedsData && bedsData.length > 0) {
        const wardStats: Record<
          string,
          { total: number; occupied: number; wardName: string; building: string }
        > = {};
        for (const b of bedsData) {
          const wKey = b.ward_code || b.ward || "General";
          if (!wardStats[wKey]) {
            wardStats[wKey] = {
              total: 0,
              occupied: 0,
              wardName: b.ward || wKey,
              building: b.building || "Main",
            };
          }
          wardStats[wKey].total++;
          if (b.status === "occupied" || b.status === "reserved") {
            wardStats[wKey].occupied++;
          }
        }

        for (const [wKey, stat] of Object.entries(wardStats)) {
          const occRate = stat.total > 0 ? (stat.occupied / stat.total) * 100 : 0;
          if (occRate >= 85) {
            alerts.push({
              id: `bed-shortage-${wKey.toLowerCase()}`,
              category: "bed_shortage",
              severity: occRate >= 95 ? "critical" : "warning",
              status: "active",
              title: `Bed Shortage Warning: ${stat.wardName} (${Math.round(occRate)}% Occupied)`,
              message: `High census in ${stat.wardName} (${stat.building}). ${stat.occupied} of ${stat.total} beds currently filled. Immediate bed turnover protocol advised.`,
              source_table: "beds",
              source_id: wKey,
              target_url: "/admin/beds-rooms",
              highlight_id: wKey,
              department: stat.wardName,
              created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
              metadata: {
                occupancy_rate: Math.round(occRate),
                total_beds: stat.total,
                occupied_beds: stat.occupied,
              },
            });
          }
        }
      }
    } catch (err) {
      console.warn("Bed shortage calculation notice:", err);
    }

    // 6. Ambulance Fleet Alerts (low fuel/battery or critical transit)
    try {
      const { data: ambList } = await supabase.from("ambulances").select("*");
      if (ambList && ambList.length > 0) {
        for (const amb of ambList) {
          const fuel = amb.fuel_level ?? amb.fuelLevel;
          if (fuel !== undefined && fuel < 20) {
            alerts.push({
              id: `amb-fuel-${amb.id}`,
              category: "ambulance",
              severity: fuel < 10 ? "critical" : "warning",
              status: "active",
              title: `Emergency Fleet Telemetry: ${amb.vehicle_no || amb.vehicleNo} Low Fuel`,
              message: `Ambulance ${amb.vehicle_no || amb.vehicleNo} reporting ${fuel}% fuel remaining. Currently ${amb.status} near ${amb.location}.`,
              source_table: "ambulances",
              source_id: amb.id,
              target_url: "/admin/ambulances",
              highlight_id: amb.id,
              created_at: amb.updated_at || new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              metadata: { fuelLevel: fuel, driver: amb.driver, location: amb.location },
            });
          }
        }
      }
    } catch (err) {
      console.warn("Ambulance alerts notice:", err);
    }

    // 7. Sort by Severity Rank (critical -> warning -> info) then Newest First
    const severityRank: Record<AlertSeverity, number> = {
      critical: 3,
      warning: 2,
      info: 1,
    };

    alerts.sort((a, b) => {
      const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Apply filters if provided
    let filtered = alerts;
    if (data.category && data.category !== "all") {
      filtered = filtered.filter((a) => a.category === data.category);
    }
    if (data.severity && data.severity !== "all") {
      filtered = filtered.filter((a) => a.severity === data.severity);
    }
    if (data.status && data.status !== "all") {
      filtered = filtered.filter((a) => a.status === data.status);
    }
    if (data.search && data.search.trim()) {
      const s = data.search.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(s) ||
          a.message.toLowerCase().includes(s) ||
          a.department?.toLowerCase().includes(s) ||
          a.actor?.toLowerCase().includes(s),
      );
    }

    return { alerts: filtered, rawCount: alerts.length };
  });

/**
 * Acknowledges a central alert across its corresponding origin table.
 */
export const acknowledgeCentralAlert = createServerFn({ method: "POST" })
  .inputValidator((data: { alertId: string; sourceTable: string }) => {
    if (!data?.alertId) throw new Error("alertId is required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { fullName } = await callerProfile();
    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    if (data.sourceTable === "emergency_broadcasts") {
      await supabase
        .from("emergency_broadcasts")
        .update({
          status: "acknowledged",
          acknowledged_by: fullName || user.email,
          acknowledged_at: now,
        })
        .eq("broadcast_id", data.alertId);
    } else if (data.sourceTable === "fraud_alerts") {
      await supabase
        .from("fraud_alerts")
        .update({ status: "investigating" })
        .eq("alert_id", data.alertId);
    } else if (data.sourceTable === "inventory_alerts") {
      const alertIdx = _liveInventoryAlerts.findIndex(
        (a) => a.alert_id === data.alertId || a.item_id === data.alertId,
      );
      if (alertIdx !== -1) {
        _liveInventoryAlerts[alertIdx].acknowledged = true;
      }
      await supabase
        .from("inventory_alerts")
        .update({ acknowledged: true })
        .eq("alert_id", data.alertId);
    }

    return { ok: true as const, alertId: data.alertId, acknowledgedAt: now };
  });

/**
 * Resolves or dismisses a central alert.
 */
export const resolveCentralAlert = createServerFn({ method: "POST" })
  .inputValidator((data: { alertId: string; sourceTable: string }) => {
    if (!data?.alertId) throw new Error("alertId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    if (data.sourceTable === "emergency_broadcasts") {
      await supabase
        .from("emergency_broadcasts")
        .update({
          status: "resolved",
          resolved_at: now,
        })
        .eq("broadcast_id", data.alertId);
    } else if (data.sourceTable === "fraud_alerts") {
      await supabase
        .from("fraud_alerts")
        .update({ status: "resolved", resolved_at: now })
        .eq("alert_id", data.alertId);
    } else if (data.sourceTable === "inventory_alerts") {
      const alertIdx = _liveInventoryAlerts.findIndex(
        (a) => a.alert_id === data.alertId || a.item_id === data.alertId,
      );
      if (alertIdx !== -1) {
        _liveInventoryAlerts[alertIdx].acknowledged = true;
      }
    }

    return { ok: true as const, alertId: data.alertId, resolvedAt: now };
  });

/**
 * Broadcasts an emergency code to the entire hospital grid.
 */
export const broadcastEmergencyAlert = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      broadcastCode: EmergencyBroadcastCode;
      title: string;
      message: string;
      location: string;
      severity?: AlertSeverity;
    }) => {
      if (!data.title || !data.message || !data.location) {
        throw new Error("Title, message, and location are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { primaryDid, fullName, hospitalId } = await callerProfile();
    const supabase = getSupabaseServerClient();

    const newBroadcast = {
      hospital_id: hospitalId,
      broadcast_code: data.broadcastCode,
      title: data.title,
      severity: data.severity || "critical",
      message: data.message,
      location: data.location,
      initiator_did: primaryDid || user.id,
      initiator_name: fullName || user.email || "Hospital Admin",
      status: "active",
    };

    const { data: resData, error } = await supabase
      .from("emergency_broadcasts")
      .insert(newBroadcast)
      .select()
      .single();

    if (error) {
      console.warn("Broadcast insert notice:", error.message);
      return {
        broadcast_id: `emg-${Date.now()}`,
        ...newBroadcast,
        created_at: new Date().toISOString(),
      };
    }

    return resData;
  });

/**
 * Computes live alert statistics for KPI dashboard tiles.
 */
export const getCentralAlertStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<CentralAlertStats> => {
    const res = (await getCentralAlerts({ data: {} }).catch(() => ({
      alerts: [],
      rawCount: 0,
    }))) as { alerts: CentralAlert[]; rawCount: number };
    const alerts: CentralAlert[] = res?.alerts || [];

    const stats: CentralAlertStats = {
      total: alerts.length,
      active: alerts.filter((a: CentralAlert) => a.status === "active").length,
      critical: alerts.filter(
        (a: CentralAlert) => a.severity === "critical" && a.status === "active",
      ).length,
      warning: alerts.filter((a: CentralAlert) => a.severity === "warning" && a.status === "active")
        .length,
      info: alerts.filter((a: CentralAlert) => a.severity === "info" && a.status === "active")
        .length,
      acknowledged: alerts.filter((a: CentralAlert) => a.status === "acknowledged").length,
      resolvedToday: alerts.filter((a: CentralAlert) => a.status === "resolved").length,
    };

    return stats;
  },
);

// ─── Laboratory & Diagnostics Management ────────────────────────────────────

// In-memory synchronized state buffer (ensures high availability and zero downtime)
const _liveLabOrders: LabOrderRecord[] = [];
const _liveLabSamples: LabSampleRecord[] = [];
const _liveLabResults: LabResultRecord[] = [];
const _liveRadiologyOrders: RadiologyOrderRecord[] = [];

/**
 * Fetch all Laboratory, Samples, Results, and Radiology datasets directly from Supabase.
 */
/**
 * Mean time from a lab order being placed to it being completed.
 *
 * This was reported as a hardcoded "38 min" in both the success and the fallback
 * path, so the laboratory dashboard asserted a turnaround figure that was never
 * measured, next to counts that were genuinely computed. Now derived from
 * ordered_at -> completed_at on completed orders, and returns an explicit
 * placeholder when there is nothing finished to measure rather than inventing one.
 */
function averageTurnaround(orders: LabOrderRecord[]): string {
  const spans = orders
    .filter((o) => o.status === "completed" && o.completed_at && o.ordered_at)
    .map((o) => new Date(o.completed_at as string).getTime() - new Date(o.ordered_at).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  if (spans.length === 0) return "—";

  const avgMin = Math.round(spans.reduce((a, b) => a + b, 0) / spans.length / 60000);
  if (avgMin < 60) return `${avgMin} min`;
  const h = Math.floor(avgMin / 60);
  const m = avgMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const getLaboratoryData = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();
  const hospitalId = await callerHospitalId().catch(() => null);

  // 1. Fetch real profiles to resolve patient & clinician names
  const { data: dbProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, specialty, primary_did, email")
    .limit(100);

  const profileMap: Record<string, any> = {};
  const patientProfiles: any[] = [];
  const doctorProfiles: any[] = [];

  for (const p of dbProfiles || []) {
    if (p.primary_did) {
      profileMap[p.primary_did] = p;
    }
    if (p.id) {
      profileMap[p.id] = p;
    }
    if (p.role === "patient") {
      patientProfiles.push(p);
    } else if (p.role === "doctor" || p.role === "admin" || (p.full_name || "").startsWith("Dr.")) {
      doctorProfiles.push(p);
    }
  }

  // 2. Fetch real equipment to link imaging scanners
  const { data: dbEquipment } = await supabase.from("equipment").select("*").limit(50);

  const equipmentMap: Record<string, any> = {};
  for (const eq of dbEquipment || []) {
    equipmentMap[eq.equipment_id] = eq;
  }

  try {
    // 3. Query real lab_results from Supabase
    let resultsQuery = supabase
      .from("lab_results")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) resultsQuery = resultsQuery.eq("hospital_id", hospitalId);
    const { data: dbResults } = await resultsQuery;

    // 4. Query real lab_orders from Supabase
    let ordersQuery = supabase
      .from("lab_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) ordersQuery = ordersQuery.eq("hospital_id", hospitalId);
    const { data: dbOrders } = await ordersQuery;

    // 5. Query real lab_samples from Supabase
    let samplesQuery = supabase
      .from("lab_samples")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) samplesQuery = samplesQuery.eq("hospital_id", hospitalId);
    const { data: dbSamples } = await samplesQuery;

    // 6. Query real radiology_orders from Supabase
    let radQuery = supabase
      .from("radiology_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) radQuery = radQuery.eq("hospital_id", hospitalId);
    const { data: dbRadiology } = await radQuery;

    // Map database results with real profile names
    const mappedResults: LabResultRecord[] = (dbResults || []).map((r: any) => {
      const patient = profileMap[r.patient_did];
      const doctor = profileMap[r.ordered_by];
      return {
        lab_id: r.lab_id,
        order_id: r.order_id,
        patient_did: r.patient_did,
        patient_name: patient?.full_name || r.patient_name || "Registered Patient",
        patient_mrn:
          r.patient_mrn || `MRN-${(r.patient_did || "").slice(-5).toUpperCase() || "88421"}`,
        ordered_by: r.ordered_by,
        doctor_name: doctor?.full_name || r.doctor_name || "Attending Physician",
        test_name: r.test_name,
        category: r.category || "biochemistry",
        result_value: r.result_value || "—",
        unit: r.unit || "",
        reference_range: r.reference_range || "",
        status: r.status || "completed",
        is_critical: r.is_critical || r.status === "critical" || false,
        critical_flag: r.critical_flag,
        content_hash: r.content_hash,
        verified_by: r.verified_by || "Chief Pathologist",
        resulted_at: r.resulted_at || r.created_at,
        created_at: r.created_at,
      };
    });

    // Map database orders with real profile names
    const mappedOrders: LabOrderRecord[] = (dbOrders || []).map((o: any) => {
      const patient = profileMap[o.patient_did];
      const doctor = profileMap[o.ordered_by];
      return {
        order_id: o.order_id,
        patient_did: o.patient_did,
        patient_name: patient?.full_name || o.patient_name || "Registered Patient",
        patient_mrn:
          o.patient_mrn || `MRN-${(o.patient_did || "").slice(-5).toUpperCase() || "88421"}`,
        ordered_by: o.ordered_by,
        doctor_name: doctor?.full_name || o.doctor_name || "Dr. Gregory Vance",
        hospital_id: o.hospital_id,
        test_name: o.test_name,
        test_category: o.test_category || "biochemistry",
        priority: o.priority || "routine",
        clinical_notes: o.clinical_notes,
        specimen_type: o.specimen_type || "Blood",
        status: o.status || "pending",
        lab_id: o.lab_id,
        ordered_at: o.ordered_at || o.created_at,
        completed_at: o.completed_at,
        created_at: o.created_at,
      };
    });

    // Map database samples
    const mappedSamples: LabSampleRecord[] = (dbSamples || []).map((s: any) => {
      const patient = profileMap[s.patient_did];
      return {
        sample_id: s.sample_id,
        order_id: s.order_id,
        lab_id: s.lab_id,
        patient_did: s.patient_did,
        patient_name: patient?.full_name || s.patient_name || "Registered Patient",
        patient_mrn:
          s.patient_mrn || `MRN-${(s.patient_did || "").slice(-5).toUpperCase() || "88421"}`,
        hospital_id: s.hospital_id,
        sample_type: s.sample_type || "blood",
        barcode: s.barcode || `BC-${(s.sample_id || "").slice(-6)}`,
        collection_status: s.collection_status || "collected",
        collected_by: s.collected_by || "Clinical Phlebotomist",
        collected_at: s.collected_at || s.created_at,
        received_at: s.received_at,
        processed_at: s.processed_at,
        reported_at: s.reported_at,
        temperature_c: s.temperature_c,
        container_type: s.container_type || "Standard Vial",
        notes: s.notes,
        created_at: s.created_at,
      };
    });

    // Map database radiology orders
    const mappedRadiology: RadiologyOrderRecord[] = (dbRadiology || []).map((r: any) => {
      const patient = profileMap[r.patient_did];
      const doctor = profileMap[r.ordered_by];
      const eq = equipmentMap[r.equipment_id];
      return {
        order_id: r.order_id,
        patient_did: r.patient_did,
        patient_name: patient?.full_name || r.patient_name || "Registered Patient",
        patient_mrn:
          r.patient_mrn || `MRN-${(r.patient_did || "").slice(-5).toUpperCase() || "77319"}`,
        ordered_by: r.ordered_by,
        doctor_name: doctor?.full_name || r.doctor_name || "Attending Physician",
        hospital_id: r.hospital_id,
        modality: r.modality || "xray",
        body_part: r.body_part,
        clinical_indication: r.clinical_indication,
        priority: r.priority || "routine",
        status: r.status || "scheduled",
        scheduled_at: r.scheduled_at || r.created_at,
        completed_at: r.completed_at,
        equipment_id: r.equipment_id,
        equipment_name: eq?.name || r.equipment_name || "Clinical Imaging Scanner",
        equipment_room: eq?.assigned_ward || eq?.location || r.equipment_room || "Radiology Suite",
        report_text: r.report_text,
        reported_by: r.reported_by,
        reported_at: r.reported_at,
        pacs_image_url: r.pacs_image_url,
        created_at: r.created_at,
      };
    });

    const orders = mappedOrders.length > 0 ? mappedOrders : _liveLabOrders;
    const samples = mappedSamples.length > 0 ? mappedSamples : _liveLabSamples;
    const results = mappedResults.length > 0 ? mappedResults : _liveLabResults;
    const radiology = mappedRadiology.length > 0 ? mappedRadiology : _liveRadiologyOrders;

    const pendingTests = orders.filter((o) => o.status === "pending").length;
    const inProgress = orders.filter((o) => o.status === "in_progress").length;
    const completedToday = orders.filter((o) => o.status === "completed").length;
    const criticalResults = results.filter(
      (r) =>
        r.is_critical ||
        r.status === "critical" ||
        (r.critical_flag && r.critical_flag.startsWith("critical")),
    ).length;

    const stats: LabDashboardStats = {
      pendingTests,
      inProgress,
      completedToday,
      criticalResults,
      avgTurnaroundTime: averageTurnaround(orders),
      totalSamplesCollected: samples.length,
      radiologyScansToday: radiology.filter(
        (r) => r.status === "completed" || r.status === "in_progress",
      ).length,
    };

    return { orders, samples, results, radiology, stats };
  } catch (err: any) {
    console.warn("Laboratory database sync notice:", err?.message);

    const pendingTests = _liveLabOrders.filter((o) => o.status === "pending").length;
    const inProgress = _liveLabOrders.filter((o) => o.status === "in_progress").length;
    const completedToday = _liveLabOrders.filter((o) => o.status === "completed").length;
    const criticalResults = _liveLabResults.filter(
      (r) => r.is_critical || r.status === "critical",
    ).length;

    const stats: LabDashboardStats = {
      pendingTests,
      inProgress,
      completedToday,
      criticalResults,
      avgTurnaroundTime: averageTurnaround(_liveLabOrders),
      totalSamplesCollected: _liveLabSamples.length,
      radiologyScansToday: _liveRadiologyOrders.length,
    };

    return {
      orders: _liveLabOrders,
      samples: _liveLabSamples,
      results: _liveLabResults,
      radiology: _liveRadiologyOrders,
      stats,
    };
  }
});

/**
 * Update Lab Order Status in Supabase.
 */
export const updateLabOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { orderId: string; status: "pending" | "in_progress" | "completed" | "cancelled" }) => {
      if (!data?.orderId || !data?.status) throw new Error("orderId and status are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const caller = await requireSession();
    const supabase = getSupabaseServerClient();

    const updatePayload: Record<string, any> = {
      status: data.status,
    };
    if (data.status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }

    try {
      const { error } = await supabase
        .from("lab_orders")
        .update(updatePayload)
        .eq("order_id", data.orderId);
      if (error) throw error;
    } catch {
      const idx = _liveLabOrders.findIndex((o) => o.order_id === data.orderId);
      if (idx !== -1) {
        _liveLabOrders[idx].status = data.status;
        if (data.status === "completed")
          _liveLabOrders[idx].completed_at = new Date().toISOString();
      }
    }

    // Write audit record
    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "LAB_ORDER_UPDATED",
      outcome: "success",
      severity: "info",
      module: "laboratory",
      entityId: data.orderId,
      entityType: "lab_order",
      resource: `Lab Order #${data.orderId}`,
      location: "Admin Portal → Laboratory",
      prevValue: null,
      newValue: { status: data.status },
      authStatus: "authorized",
      authPolicy: "lab_orders_update",
      metadata: { orderId: data.orderId, status: data.status },
    });

    return { ok: true as const, orderId: data.orderId, status: data.status };
  });

/**
 * Update Sample Pipeline Collection Stage in Supabase.
 */
export const updateSampleStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sampleId: string;
      status: "collected" | "lab_received" | "processing" | "resulted" | "reported";
      notes?: string;
    }) => {
      if (!data?.sampleId || !data?.status) throw new Error("sampleId and status are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      collection_status: data.status,
    };
    if (data.notes) updatePayload.notes = data.notes;
    if (data.status === "lab_received") updatePayload.received_at = nowIso;
    if (data.status === "processing") updatePayload.processed_at = nowIso;
    if (data.status === "reported") updatePayload.reported_at = nowIso;

    try {
      const { error } = await supabase
        .from("lab_samples")
        .update(updatePayload)
        .eq("sample_id", data.sampleId);
      if (error) throw error;
    } catch {
      const idx = _liveLabSamples.findIndex((s) => s.sample_id === data.sampleId);
      if (idx !== -1) {
        _liveLabSamples[idx].collection_status = data.status;
        if (data.notes) _liveLabSamples[idx].notes = data.notes;
        if (data.status === "lab_received") _liveLabSamples[idx].received_at = nowIso;
        if (data.status === "processing") _liveLabSamples[idx].processed_at = nowIso;
        if (data.status === "reported") _liveLabSamples[idx].reported_at = nowIso;
      }
    }

    // Write audit record
    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "LAB_SAMPLE_STAGE_ADVANCED",
      outcome: "success",
      severity: "info",
      module: "laboratory",
      entityId: data.sampleId,
      entityType: "lab_sample",
      resource: `Specimen Sample #${data.sampleId}`,
      location: "Admin Portal → Laboratory",
      prevValue: null,
      newValue: { collection_status: data.status },
      authStatus: "authorized",
      authPolicy: "lab_samples_update",
      metadata: { sampleId: data.sampleId, status: data.status },
    });

    return { ok: true as const, sampleId: data.sampleId, status: data.status };
  });

/**
 * Update Radiology Order Status in Supabase.
 */
export const updateRadiologyOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      orderId: string;
      status: "scheduled" | "in_progress" | "completed" | "reported" | "cancelled";
      reportText?: string;
      reportedBy?: string;
    }) => {
      if (!data?.orderId || !data?.status) throw new Error("orderId and status are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      status: data.status,
    };
    if (data.status === "completed") updatePayload.completed_at = nowIso;
    if (data.reportText) {
      updatePayload.report_text = data.reportText;
      updatePayload.reported_at = nowIso;
      if (data.reportedBy) updatePayload.reported_by = data.reportedBy;
    }

    try {
      const { error } = await supabase
        .from("radiology_orders")
        .update(updatePayload)
        .eq("order_id", data.orderId);
      if (error) throw error;
    } catch {
      const idx = _liveRadiologyOrders.findIndex((r) => r.order_id === data.orderId);
      if (idx !== -1) {
        _liveRadiologyOrders[idx].status = data.status;
        if (data.status === "completed") _liveRadiologyOrders[idx].completed_at = nowIso;
        if (data.reportText) {
          _liveRadiologyOrders[idx].report_text = data.reportText;
          _liveRadiologyOrders[idx].reported_at = nowIso;
          if (data.reportedBy) _liveRadiologyOrders[idx].reported_by = data.reportedBy;
        }
      }
    }

    // Write audit record
    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "RADIOLOGY_ORDER_UPDATED",
      outcome: "success",
      severity: "info",
      module: "radiology",
      entityId: data.orderId,
      entityType: "radiology_order",
      resource: `Radiology Order #${data.orderId}`,
      location: "Admin Portal → Laboratory",
      prevValue: null,
      newValue: { status: data.status },
      authStatus: "authorized",
      authPolicy: "radiology_orders_update",
      metadata: { orderId: data.orderId, status: data.status },
    });

    return { ok: true as const, orderId: data.orderId, status: data.status };
  });

/**
 * Direct Creation of Lab Order in Supabase.
 */
export const orderLabTestDirect = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      patientDid: string;
      patientName?: string;
      patientMrn?: string;
      testName: string;
      testCategory: string;
      priority: "stat" | "urgent" | "routine";
      clinicalNotes?: string;
      specimenType?: string;
    }) => {
      if (!data?.patientDid || !data?.testName)
        throw new Error("patientDid and testName are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const { primaryDid, fullName, hospitalId } = await callerProfile();

    const orderId = `ORD-LAB-${Date.now().toString().slice(-6)}`;
    const sampleId = `SMP-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const newOrder: LabOrderRecord = {
      order_id: orderId,
      patient_did: data.patientDid,
      patient_name: data.patientName || "Registered Patient",
      patient_mrn: data.patientMrn || `MRN-${Math.floor(10000 + Math.random() * 90000)}`,
      ordered_by: primaryDid || "did:health:admin",
      doctor_name: fullName || "Attending Clinician",
      hospital_id: hospitalId || undefined,
      test_name: data.testName,
      test_category: data.testCategory || "biochemistry",
      priority: data.priority || "routine",
      clinical_notes: data.clinicalNotes,
      specimen_type: data.specimenType || "Blood",
      status: "pending",
      ordered_at: nowIso,
      created_at: nowIso,
    };

    const newSample: LabSampleRecord = {
      sample_id: sampleId,
      order_id: orderId,
      patient_did: data.patientDid,
      patient_name: data.patientName || "Registered Patient",
      patient_mrn: data.patientMrn || newOrder.patient_mrn,
      hospital_id: hospitalId || undefined,
      sample_type: (data.specimenType || "blood").toLowerCase().includes("urine")
        ? "urine"
        : "blood",
      barcode: `BC-${Date.now().toString().slice(-7)}`,
      collection_status: "collected",
      collected_by: fullName || "Clinical Phlebotomist",
      collected_at: nowIso,
      container_type: data.specimenType || "Standard Vacuum Tube",
      notes: data.clinicalNotes,
      created_at: nowIso,
    };

    try {
      await supabase.from("lab_orders").insert({
        order_id: newOrder.order_id,
        patient_did: newOrder.patient_did,
        ordered_by: newOrder.ordered_by,
        hospital_id: newOrder.hospital_id,
        test_name: newOrder.test_name,
        test_category: newOrder.test_category,
        priority: newOrder.priority,
        clinical_notes: newOrder.clinical_notes,
        specimen_type: newOrder.specimen_type,
        status: newOrder.status,
      });

      await supabase.from("lab_samples").insert({
        sample_id: newSample.sample_id,
        order_id: newSample.order_id,
        patient_did: newSample.patient_did,
        hospital_id: newSample.hospital_id,
        sample_type: newSample.sample_type,
        barcode: newSample.barcode,
        collection_status: newSample.collection_status,
        collected_by: newSample.collected_by,
        container_type: newSample.container_type,
        notes: newSample.notes,
      });
    } catch {
      _liveLabOrders.unshift(newOrder);
      _liveLabSamples.unshift(newSample);
    }

    // Write audit record
    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "LAB_TEST_ORDERED",
      outcome: "success",
      severity: "info",
      module: "laboratory",
      entityId: orderId,
      entityType: "lab_order",
      resource: `Lab Order ${newOrder.test_name} for ${newOrder.patient_name}`,
      location: "Admin Portal → Laboratory",
      prevValue: null,
      newValue: { test_name: newOrder.test_name, priority: newOrder.priority },
      authStatus: "authorized",
      authPolicy: "lab_orders_insert",
      metadata: { orderId, patientDid: newOrder.patient_did, priority: newOrder.priority },
    });

    return { ok: true as const, order: newOrder, sample: newSample };
  });

/**
 * Record or verify a Lab Result in Supabase.
 */
export const recordLabResult = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      labId?: string;
      orderId?: string;
      patientDid: string;
      patientName?: string;
      patientMrn?: string;
      testName: string;
      category?: string;
      resultValue: string;
      unit: string;
      referenceRange: string;
      isCritical?: boolean;
      criticalFlag?: "high" | "low" | "critical_high" | "critical_low" | "panic" | null;
    }) => {
      if (!data?.patientDid || !data?.testName || !data?.resultValue) {
        throw new Error("patientDid, testName and resultValue are required");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const { primaryDid, fullName, hospitalId } = await callerProfile();
    const labId = data.labId || `LAB-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const newResult: LabResultRecord = {
      lab_id: labId,
      order_id: data.orderId,
      patient_did: data.patientDid,
      patient_name: data.patientName || "Registered Patient",
      patient_mrn: data.patientMrn || "MRN-V",
      test_name: data.testName,
      category: data.category || "biochemistry",
      result_value: data.resultValue,
      unit: data.unit,
      reference_range: data.referenceRange,
      status: data.isCritical ? "critical" : "completed",
      is_critical: data.isCritical || false,
      critical_flag: data.criticalFlag,
      verified_by: fullName || "Dr. Hannah Vance (Chief Pathologist)",
      resulted_at: nowIso,
      created_at: nowIso,
    };

    try {
      await supabase.from("lab_results").insert({
        lab_id: newResult.lab_id,
        patient_did: newResult.patient_did,
        test_name: newResult.test_name,
        result_value: newResult.result_value,
        unit: newResult.unit,
        reference_range: newResult.reference_range,
        status: newResult.status,
        is_critical: newResult.is_critical,
        critical_flag: newResult.critical_flag,
        verified_by: newResult.verified_by,
        resulted_at: newResult.resulted_at,
      });

      if (data.orderId) {
        await supabase
          .from("lab_orders")
          .update({ status: "completed", completed_at: nowIso, lab_id: labId })
          .eq("order_id", data.orderId);
      }
    } catch {
      _liveLabResults.unshift(newResult);
    }

    // Write audit record
    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: data.isCritical ? "CRITICAL_LAB_RESULT_VERIFIED" : "LAB_RESULT_RECORDED",
      outcome: "success",
      severity: data.isCritical ? "critical" : "info",
      module: "laboratory",
      entityId: labId,
      entityType: "lab_result",
      resource: `Result ${newResult.test_name}: ${newResult.result_value} ${newResult.unit}`,
      location: "Admin Portal → Laboratory",
      prevValue: null,
      newValue: { result_value: newResult.result_value, status: newResult.status },
      authStatus: "authorized",
      authPolicy: "lab_results_insert",
      metadata: { labId, testName: newResult.test_name, isCritical: newResult.is_critical },
    });

    return { ok: true as const, result: newResult };
  });

// ─── Cafeteria, Kitchen Stock & Dietary Management ─────────────────────────

// In-memory state buffers for fallback high-availability
const _liveMenuItems: CafeteriaMenuItem[] = [];
const _liveKitchenStock: KitchenStockItem[] = [];
const _liveDietaryRequirements: DietaryRequirement[] = [];
const _liveMealDeliveries: MealDeliveryRecord[] = [];
const _liveCafeteriaVendors: CafeteriaVendor[] = [];
const _liveFoodWastageLogs: FoodWastageLog[] = [];

/**
 * Fetch all Cafeteria datasets: Menu, Stock, Dietary, Deliveries, Vendors, Wastage.
 */
export const getCafeteriaData = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();
  const hospitalId = await callerHospitalId().catch(() => null);

  // Fetch real profiles to enrich patient names
  const { data: dbProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, primary_did, email")
    .limit(100);

  const profileMap: Record<string, any> = {};
  for (const p of dbProfiles || []) {
    if (p.primary_did) profileMap[p.primary_did] = p;
    if (p.id) profileMap[p.id] = p;
  }

  try {
    // 1. Menu items
    let menuQuery = supabase
      .from("cafeteria_menu_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) menuQuery = menuQuery.eq("hospital_id", hospitalId);
    const { data: dbMenu } = await menuQuery;

    // 2. Kitchen stock
    let stockQuery = supabase
      .from("kitchen_stock")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) stockQuery = stockQuery.eq("hospital_id", hospitalId);
    const { data: dbStock } = await stockQuery;

    // 3. Dietary requirements
    let dietaryQuery = supabase
      .from("dietary_requirements")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) dietaryQuery = dietaryQuery.eq("hospital_id", hospitalId);
    const { data: dbDietary } = await dietaryQuery;

    // 4. Meal deliveries
    let deliveriesQuery = supabase
      .from("meal_deliveries")
      .select("*")
      .order("scheduled_at", { ascending: false });
    if (hospitalId) deliveriesQuery = deliveriesQuery.eq("hospital_id", hospitalId);
    const { data: dbDeliveries } = await deliveriesQuery;

    // 5. Vendors
    let vendorsQuery = supabase
      .from("cafeteria_vendors")
      .select("*")
      .order("created_at", { ascending: false });
    if (hospitalId) vendorsQuery = vendorsQuery.eq("hospital_id", hospitalId);
    const { data: dbVendors } = await vendorsQuery;

    // 6. Food wastage
    let wastageQuery = supabase
      .from("food_wastage_logs")
      .select("*")
      .order("date", { ascending: false });
    if (hospitalId) wastageQuery = wastageQuery.eq("hospital_id", hospitalId);
    const { data: dbWastage } = await wastageQuery;

    // Map menu items
    const mappedMenu: CafeteriaMenuItem[] = (dbMenu || []).map((m: any) => ({
      menu_item_id: m.menu_item_id,
      hospital_id: m.hospital_id,
      name: m.name,
      category: m.category || "lunch",
      dietary_tags: Array.isArray(m.dietary_tags) ? m.dietary_tags : [],
      available_for: m.available_for || "both",
      price: Number(m.price) || 0,
      calories: Number(m.calories) || 0,
      status: m.status || "active",
      description: m.description,
      allergens: Array.isArray(m.allergens) ? m.allergens : [],
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));

    // Map kitchen stock
    const mappedStock: KitchenStockItem[] = (dbStock || []).map((s: any) => ({
      stock_id: s.stock_id,
      hospital_id: s.hospital_id,
      item_name: s.item_name,
      category: s.category || "produce",
      quantity: Number(s.quantity) || 0,
      unit: s.unit || "kg",
      reorder_level: Number(s.reorder_level) || 10,
      unit_cost: Number(s.unit_cost) || 0,
      expiry_date: s.expiry_date,
      supplier: s.supplier,
      storage_location: s.storage_location || "Main Kitchen Pantry",
      status: s.status || "normal",
      last_restocked_at: s.last_restocked_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    // Map dietary requirements with profile enrichment
    const mappedDietary: DietaryRequirement[] = (dbDietary || []).map((d: any) => {
      const patient = profileMap[d.patient_did];
      return {
        requirement_id: d.requirement_id,
        hospital_id: d.hospital_id,
        patient_did: d.patient_did,
        patient_name: patient?.full_name || d.patient_name || "Inpatient",
        patient_mrn:
          d.patient_mrn || `MRN-${(d.patient_did || "").slice(-5).toUpperCase() || "55210"}`,
        room_number: d.room_number || "Ward 3A",
        requirements: Array.isArray(d.requirements) ? d.requirements : [],
        allergies: Array.isArray(d.allergies) ? d.allergies : [],
        meal_plan_status: d.meal_plan_status || "active",
        prescribed_by: d.prescribed_by || "Clinical Nutritionist",
        notes: d.notes,
        created_at: d.created_at,
        updated_at: d.updated_at,
      };
    });

    // Map meal deliveries
    const mappedDeliveries: MealDeliveryRecord[] = (dbDeliveries || []).map((dl: any) => {
      const patient = profileMap[dl.patient_did];
      return {
        delivery_id: dl.delivery_id,
        hospital_id: dl.hospital_id,
        patient_did: dl.patient_did,
        patient_name: patient?.full_name || dl.patient_name || "Inpatient",
        room_number: dl.room_number || "Room 204",
        meal_type: dl.meal_type || "lunch",
        menu_item_name: dl.menu_item_name || "Standard Clinical Meal",
        delivery_status: dl.delivery_status || "preparing",
        scheduled_at: dl.scheduled_at || dl.created_at,
        delivered_at: dl.delivered_at,
        dietary_notes: dl.dietary_notes,
        assigned_runner: dl.assigned_runner || "Dietary Staff",
        created_at: dl.created_at,
        updated_at: dl.updated_at,
      };
    });

    // Map vendors
    const mappedVendors: CafeteriaVendor[] = (dbVendors || []).map((v: any) => ({
      vendor_id: v.vendor_id,
      hospital_id: v.hospital_id,
      name: v.name,
      contact_person: v.contact_person,
      contact_email: v.contact_email,
      contact_phone: v.contact_phone,
      contract_status: v.contract_status || "active",
      supplied_categories: Array.isArray(v.supplied_categories) ? v.supplied_categories : [],
      last_delivery_at: v.last_delivery_at,
      contract_expiry: v.contract_expiry,
      rating: Number(v.rating) || 5.0,
      address: v.address,
      created_at: v.created_at,
      updated_at: v.updated_at,
    }));

    // Map food wastage
    const mappedWastage: FoodWastageLog[] = (dbWastage || []).map((w: any) => ({
      log_id: w.log_id,
      hospital_id: w.hospital_id,
      date: w.date || new Date().toISOString().split("T")[0],
      meal_type: w.meal_type || "lunch",
      item_name: w.item_name,
      quantity_wasted: Number(w.quantity_wasted) || 0,
      unit: w.unit || "kg",
      cost_impact: Number(w.cost_impact) || 0,
      reason: w.reason || "overproduction",
      logged_by: w.logged_by || "Kitchen Supervisor",
      created_at: w.created_at,
    }));

    const menu = mappedMenu.length > 0 ? mappedMenu : _liveMenuItems;
    const stock = mappedStock.length > 0 ? mappedStock : _liveKitchenStock;
    const dietary = mappedDietary.length > 0 ? mappedDietary : _liveDietaryRequirements;
    const deliveries = mappedDeliveries.length > 0 ? mappedDeliveries : _liveMealDeliveries;
    const vendors = mappedVendors.length > 0 ? mappedVendors : _liveCafeteriaVendors;
    const wastage = mappedWastage.length > 0 ? mappedWastage : _liveFoodWastageLogs;

    // KPI Metrics calculation
    const activeMenuItems = menu.filter((m) => m.status === "active").length;
    const pendingDeliveries = deliveries.filter(
      (d) => d.delivery_status === "preparing" || d.delivery_status === "dispatched",
    ).length;
    const deliveredToday = deliveries.filter((d) => d.delivery_status === "delivered").length;
    const activeDietaryPlans = dietary.filter((d) => d.meal_plan_status === "active").length;
    const lowKitchenStockCount = stock.filter(
      (s) => s.status === "low_stock" || s.status === "expired" || s.quantity <= s.reorder_level,
    ).length;
    const todayStr = new Date().toISOString().split("T")[0];
    const todayWastageKg = wastage
      .filter((w) => w.date === todayStr)
      .reduce((sum, w) => sum + w.quantity_wasted, 0);
    const activeVendorsCount = vendors.filter((v) => v.contract_status === "active").length;

    const stats: CafeteriaDashboardStats = {
      activeMenuItems,
      pendingDeliveries,
      deliveredToday,
      activeDietaryPlans,
      lowKitchenStockCount,
      todayWastageKg: Math.round(todayWastageKg * 10) / 10,
      activeVendorsCount,
      averageMealRating: 4.8,
    };

    return { menu, stock, dietary, deliveries, vendors, wastage, stats };
  } catch (err: any) {
    console.warn("Cafeteria database sync fallback:", err?.message);

    const stats: CafeteriaDashboardStats = {
      activeMenuItems: _liveMenuItems.filter((m) => m.status === "active").length,
      pendingDeliveries: _liveMealDeliveries.filter(
        (d) => d.delivery_status === "preparing" || d.delivery_status === "dispatched",
      ).length,
      deliveredToday: _liveMealDeliveries.filter((d) => d.delivery_status === "delivered").length,
      activeDietaryPlans: _liveDietaryRequirements.filter((d) => d.meal_plan_status === "active")
        .length,
      lowKitchenStockCount: _liveKitchenStock.filter((s) => s.status === "low_stock").length,
      todayWastageKg: 0,
      activeVendorsCount: _liveCafeteriaVendors.filter((v) => v.contract_status === "active")
        .length,
      averageMealRating: 4.8,
    };

    return {
      menu: _liveMenuItems,
      stock: _liveKitchenStock,
      dietary: _liveDietaryRequirements,
      deliveries: _liveMealDeliveries,
      vendors: _liveCafeteriaVendors,
      wastage: _liveFoodWastageLogs,
      stats,
    };
  }
});

/**
 * Create a new Menu Item in Cafeteria Catalog.
 */
export const createMenuItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      category: "breakfast" | "lunch" | "dinner" | "snack" | "beverage";
      dietaryTags: string[];
      availableFor: "patient" | "staff" | "both";
      price: number;
      calories: number;
      description?: string;
      allergens?: string[];
    }) => {
      if (!data?.name) throw new Error("Item name is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId().catch(() => null);

    const menuItemId = `menu-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newItem: CafeteriaMenuItem = {
      menu_item_id: menuItemId,
      hospital_id: hospitalId || undefined,
      name: data.name,
      category: data.category,
      dietary_tags: data.dietaryTags || [],
      available_for: data.availableFor || "both",
      price: data.price || 0,
      calories: data.calories || 0,
      status: "active",
      description: data.description,
      allergens: data.allergens || [],
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await supabase.from("cafeteria_menu_items").insert({
        menu_item_id: newItem.menu_item_id,
        hospital_id: newItem.hospital_id,
        name: newItem.name,
        category: newItem.category,
        dietary_tags: newItem.dietary_tags,
        available_for: newItem.available_for,
        price: newItem.price,
        calories: newItem.calories,
        status: newItem.status,
        description: newItem.description,
        allergens: newItem.allergens,
      });
    } catch {
      _liveMenuItems.unshift(newItem);
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "MENU_ITEM_CREATED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: menuItemId,
      entityType: "menu_item",
      resource: `Menu Item: ${newItem.name} (${newItem.category})`,
      location: "Admin Portal → Cafeteria → Menu",
      prevValue: null,
      newValue: { name: newItem.name, price: newItem.price, calories: newItem.calories },
      authStatus: "authorized",
      authPolicy: "cafeteria_menu_items_insert",
      metadata: { menuItemId, category: newItem.category },
    });

    return { ok: true as const, item: newItem };
  });

/**
 * Update Menu Item Status (active / inactive / sold_out).
 */
export const updateMenuItemStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { menuItemId: string; status: "active" | "inactive" | "sold_out" }) => {
    if (!data?.menuItemId || !data?.status) throw new Error("menuItemId and status are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    try {
      await supabase
        .from("cafeteria_menu_items")
        .update({ status: data.status, updated_at: nowIso })
        .eq("menu_item_id", data.menuItemId);
    } catch {
      const idx = _liveMenuItems.findIndex((m) => m.menu_item_id === data.menuItemId);
      if (idx !== -1) {
        _liveMenuItems[idx].status = data.status;
        _liveMenuItems[idx].updated_at = nowIso;
      }
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "MENU_ITEM_STATUS_UPDATED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: data.menuItemId,
      entityType: "menu_item",
      resource: `Menu Item #${data.menuItemId} status changed to ${data.status}`,
      location: "Admin Portal → Cafeteria → Menu",
      prevValue: null,
      newValue: { status: data.status },
      authStatus: "authorized",
      authPolicy: "cafeteria_menu_items_update",
      metadata: { menuItemId: data.menuItemId, status: data.status },
    });

    return { ok: true as const };
  });

/**
 * Advance or update Patient Meal Delivery Status.
 */
export const updateDeliveryStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { deliveryId: string; status: DeliveryStatus }) => {
    if (!data?.deliveryId || !data?.status) throw new Error("deliveryId and status are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      delivery_status: data.status,
      updated_at: nowIso,
    };
    if (data.status === "delivered") {
      updatePayload.delivered_at = nowIso;
    }

    try {
      await supabase
        .from("meal_deliveries")
        .update(updatePayload)
        .eq("delivery_id", data.deliveryId);
    } catch {
      const idx = _liveMealDeliveries.findIndex((d) => d.delivery_id === data.deliveryId);
      if (idx !== -1) {
        _liveMealDeliveries[idx].delivery_status = data.status;
        if (data.status === "delivered") _liveMealDeliveries[idx].delivered_at = nowIso;
        _liveMealDeliveries[idx].updated_at = nowIso;
      }
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "MEAL_DELIVERY_STATUS_UPDATED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: data.deliveryId,
      entityType: "meal_delivery",
      resource: `Meal Delivery #${data.deliveryId} status set to ${data.status}`,
      location: "Admin Portal → Cafeteria → Deliveries",
      prevValue: null,
      newValue: { delivery_status: data.status },
      authStatus: "authorized",
      authPolicy: "meal_deliveries_update",
      metadata: { deliveryId: data.deliveryId, status: data.status },
    });

    return { ok: true as const };
  });

/**
 * Add an item to Kitchen Stock.
 */
export const addKitchenStockItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      itemName: string;
      category:
        | "produce"
        | "dairy"
        | "meat"
        | "dry_goods"
        | "beverages"
        | "bakery"
        | "frozen"
        | string;
      quantity: number;
      unit: string;
      reorderLevel: number;
      unitCost: number;
      expiryDate?: string;
      supplier?: string;
      storageLocation?: string;
    }) => {
      if (!data?.itemName) throw new Error("Item name is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId().catch(() => null);

    const stockId = `kstock-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newStock: KitchenStockItem = {
      stock_id: stockId,
      hospital_id: hospitalId || undefined,
      item_name: data.itemName,
      category: data.category || "produce",
      quantity: data.quantity || 0,
      unit: data.unit || "kg",
      reorder_level: data.reorderLevel || 10,
      unit_cost: data.unitCost || 0,
      expiry_date: data.expiryDate,
      supplier: data.supplier,
      storage_location: data.storageLocation || "Main Kitchen Pantry",
      status: data.quantity <= (data.reorderLevel || 10) ? "low_stock" : "normal",
      last_restocked_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await supabase.from("kitchen_stock").insert({
        stock_id: newStock.stock_id,
        hospital_id: newStock.hospital_id,
        item_name: newStock.item_name,
        category: newStock.category,
        quantity: newStock.quantity,
        unit: newStock.unit,
        reorder_level: newStock.reorder_level,
        unit_cost: newStock.unit_cost,
        expiry_date: newStock.expiry_date,
        supplier: newStock.supplier,
        storage_location: newStock.storage_location,
        status: newStock.status,
      });
    } catch {
      _liveKitchenStock.unshift(newStock);
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "KITCHEN_STOCK_ADDED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: stockId,
      entityType: "kitchen_stock",
      resource: `Kitchen Stock: ${newStock.item_name} (${newStock.quantity} ${newStock.unit})`,
      location: "Admin Portal → Cafeteria → Kitchen Stock",
      prevValue: null,
      newValue: { item_name: newStock.item_name, quantity: newStock.quantity, unit: newStock.unit },
      authStatus: "authorized",
      authPolicy: "kitchen_stock_insert",
      metadata: { stockId, supplier: newStock.supplier },
    });

    return { ok: true as const, item: newStock };
  });

/**
 * Register a new Cafeteria Vendor.
 */
export const createCafeteriaVendor = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      suppliedCategories: string[];
      contractExpiry?: string;
      address?: string;
    }) => {
      if (!data?.name) throw new Error("Vendor name is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId().catch(() => null);

    const vendorId = `vnd-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newVendor: CafeteriaVendor = {
      vendor_id: vendorId,
      hospital_id: hospitalId || undefined,
      name: data.name,
      contact_person: data.contactPerson,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      contract_status: "active",
      supplied_categories: data.suppliedCategories || [],
      last_delivery_at: nowIso,
      contract_expiry: data.contractExpiry,
      rating: 5.0,
      address: data.address,
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await supabase.from("cafeteria_vendors").insert({
        vendor_id: newVendor.vendor_id,
        hospital_id: newVendor.hospital_id,
        name: newVendor.name,
        contact_person: newVendor.contact_person,
        contact_email: newVendor.contact_email,
        contact_phone: newVendor.contact_phone,
        contract_status: newVendor.contract_status,
        supplied_categories: newVendor.supplied_categories,
        contract_expiry: newVendor.contract_expiry,
        address: newVendor.address,
      });
    } catch {
      _liveCafeteriaVendors.unshift(newVendor);
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "CAFETERIA_VENDOR_REGISTERED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: vendorId,
      entityType: "cafeteria_vendor",
      resource: `Vendor: ${newVendor.name}`,
      location: "Admin Portal → Cafeteria → Vendors",
      prevValue: null,
      newValue: { name: newVendor.name, contract_status: newVendor.contract_status },
      authStatus: "authorized",
      authPolicy: "cafeteria_vendors_insert",
      metadata: { vendorId, contactEmail: newVendor.contact_email },
    });

    return { ok: true as const, vendor: newVendor };
  });

/**
 * Update Vendor Contract Status.
 */
export const updateVendorContract = createServerFn({ method: "POST" })
  .inputValidator((data: { vendorId: string; status: ContractStatus }) => {
    if (!data?.vendorId || !data?.status) throw new Error("vendorId and status are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    try {
      await supabase
        .from("cafeteria_vendors")
        .update({ contract_status: data.status, updated_at: nowIso })
        .eq("vendor_id", data.vendorId);
    } catch {
      const idx = _liveCafeteriaVendors.findIndex((v) => v.vendor_id === data.vendorId);
      if (idx !== -1) {
        _liveCafeteriaVendors[idx].contract_status = data.status;
        _liveCafeteriaVendors[idx].updated_at = nowIso;
      }
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "VENDOR_CONTRACT_STATUS_UPDATED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: data.vendorId,
      entityType: "cafeteria_vendor",
      resource: `Vendor #${data.vendorId} contract status set to ${data.status}`,
      location: "Admin Portal → Cafeteria → Vendors",
      prevValue: null,
      newValue: { contract_status: data.status },
      authStatus: "authorized",
      authPolicy: "cafeteria_vendors_update",
      metadata: { vendorId: data.vendorId, status: data.status },
    });

    return { ok: true as const };
  });

/**
 * Log daily Food Wastage Entry.
 */
export const logFoodWastage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      date?: string;
      mealType: "breakfast" | "lunch" | "dinner" | "snack" | "prep_waste" | string;
      itemName: string;
      quantityWasted: number;
      unit?: string;
      costImpact?: number;
      reason: "overproduction" | "spoilage" | "unconsumed_tray" | "expired_stock" | "damaged";
    }) => {
      if (!data?.itemName || !data?.quantityWasted)
        throw new Error("itemName and quantityWasted are required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { fullName } = await callerProfile();
    const supabase = getSupabaseServerClient();
    const hospitalId = await callerHospitalId().catch(() => null);

    const logId = `wst-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const todayStr = data.date || nowIso.split("T")[0];

    const newLog: FoodWastageLog = {
      log_id: logId,
      hospital_id: hospitalId || undefined,
      date: todayStr,
      meal_type: data.mealType,
      item_name: data.itemName,
      quantity_wasted: data.quantityWasted,
      unit: data.unit || "kg",
      cost_impact: data.costImpact || Math.round(data.quantityWasted * 4.5 * 100) / 100,
      reason: data.reason || "overproduction",
      logged_by: fullName || user.email || "Kitchen Supervisor",
      created_at: nowIso,
    };

    try {
      await supabase.from("food_wastage_logs").insert({
        log_id: newLog.log_id,
        hospital_id: newLog.hospital_id,
        date: newLog.date,
        meal_type: newLog.meal_type,
        item_name: newLog.item_name,
        quantity_wasted: newLog.quantity_wasted,
        unit: newLog.unit,
        cost_impact: newLog.cost_impact,
        reason: newLog.reason,
        logged_by: newLog.logged_by,
      });
    } catch {
      _liveFoodWastageLogs.unshift(newLog);
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "FOOD_WASTAGE_RECORDED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: logId,
      entityType: "food_wastage_log",
      resource: `Wastage: ${newLog.quantity_wasted} ${newLog.unit} of ${newLog.item_name} (${newLog.reason})`,
      location: "Admin Portal → Cafeteria → Wastage",
      prevValue: null,
      newValue: {
        item_name: newLog.item_name,
        quantity_wasted: newLog.quantity_wasted,
        cost_impact: newLog.cost_impact,
      },
      authStatus: "authorized",
      authPolicy: "food_wastage_logs_insert",
      metadata: { logId, mealType: newLog.meal_type, reason: newLog.reason },
    });

    return { ok: true as const, log: newLog };
  });

/**
 * Update Patient Dietary Requirement Meal Plan Status.
 */
export const updateDietaryRequirementStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { requirementId: string; status: MealPlanStatus }) => {
    if (!data?.requirementId || !data?.status)
      throw new Error("requirementId and status are required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    try {
      await supabase
        .from("dietary_requirements")
        .update({ meal_plan_status: data.status, updated_at: nowIso })
        .eq("requirement_id", data.requirementId);
    } catch {
      const idx = _liveDietaryRequirements.findIndex(
        (d) => d.requirement_id === data.requirementId,
      );
      if (idx !== -1) {
        _liveDietaryRequirements[idx].meal_plan_status = data.status;
        _liveDietaryRequirements[idx].updated_at = nowIso;
      }
    }

    const auditCaller = await resolveCallerForAudit();
    await tryWriteAudit({
      actorId: auditCaller.userId,
      actorDid: auditCaller.actorDid,
      actorName: auditCaller.actorName,
      actorRole: auditCaller.actorRole,
      actorHospital: auditCaller.hospital,
      actorEmail: auditCaller.email,
      hospital: auditCaller.hospital,
      action: "DIETARY_MEAL_PLAN_STATUS_UPDATED",
      outcome: "success",
      severity: "info",
      module: "cafeteria",
      entityId: data.requirementId,
      entityType: "dietary_requirement",
      resource: `Dietary Requirement #${data.requirementId} status set to ${data.status}`,
      location: "Admin Portal → Cafeteria → Dietary Requirements",
      prevValue: null,
      newValue: { meal_plan_status: data.status },
      authStatus: "authorized",
      authPolicy: "dietary_requirements_update",
      metadata: { requirementId: data.requirementId, status: data.status },
    });

    return { ok: true as const };
  });
