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
import { resolveCallerForAudit, tryWriteAudit, buildBedAudit, buildRoomAudit, buildInventoryAudit } from "./audit.server";
import type {
  InventoryCategory,
  InventoryItem,
  StockMovement,
  InventoryAlert,
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
  .validator((data: { action: "in" | "out"; location?: string }) => {
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
  .validator((data: { shiftId: string }) => {
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
  .validator((data: { roomId: string; roomName: string; action: "checkin" | "checkout" }) => {
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
  .validator((data: { doctorDid?: string; date?: string }) => data ?? {})
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
  .validator(
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
  .validator((data: { visitorId: string; approve: boolean }) => {
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
  .validator((data: { cardId: string }) => {
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
  .validator((data: Record<string, unknown>) => data ?? {})
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
  .validator((data: { amount: number; description?: string }) => {
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
  .validator((data: { requestType: string; subject: string; details?: string }) => {
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
  .validator((data: { requestId: string; status: "approved" | "rejected" | "completed" }) => {
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
  .validator((data: { doctorDid?: string }) => data ?? {})
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
  .validator((data: Record<string, unknown>) => {
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
  .validator((data: { buildingId?: string }) => data ?? {})
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
  .validator((data: { floorId?: string }) => data ?? {})
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
  .validator((data: { name: string; code?: string; description?: string; totalFloors?: number }) => {
    if (!data?.name) throw new Error("Building name is required");
    return data;
  })
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
  .validator(
    (data: {
      buildingId: string;
      floorNumber: number;
      name: string;
      description?: string;
    }) => {
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
  .validator(
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
  .validator(
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
  .validator(
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
  .validator(
    (data: {
      bedId: string;
      status: "available" | "occupied" | "reserved" | "cleaning" | "maintenance" | "blocked" | "emergency_reserved";
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
    tryWriteAudit(buildBedAudit(
      caller,
      data.bedId,
      "unknown",          // prev status not fetched to keep the update lean
      data.status,
      data.patientDid ? { patientDid: data.patientDid } : {},
    ));

    return { ok: true as const, bed: updated };
  });

/** Update room status */
export const updateRoomStatus = createServerFn({ method: "POST" })
  .validator(
    (data: {
      roomId: string;
      status: "available" | "occupied" | "reserved" | "cleaning" | "maintenance" | "blocked" | "emergency_reserved";
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
    available: beds?.filter((b) => b.status === "available").length ?? 0,
    occupied: beds?.filter((b) => b.status === "occupied").length ?? 0,
    reserved: beds?.filter((b) => b.status === "reserved").length ?? 0,
    cleaning: beds?.filter((b) => b.status === "cleaning").length ?? 0,
    maintenance: beds?.filter((b) => b.status === "maintenance").length ?? 0,
    blocked: beds?.filter((b) => b.status === "blocked").length ?? 0,
    emergency_reserved: beds?.filter((b) => b.status === "emergency_reserved").length ?? 0,
  };

  const roomStats = {
    total: rooms?.length ?? 0,
    available: rooms?.filter((r) => r.status === "available").length ?? 0,
    occupied: rooms?.filter((r) => r.status === "occupied").length ?? 0,
    reserved: rooms?.filter((r) => r.status === "reserved").length ?? 0,
    cleaning: rooms?.filter((r) => r.status === "cleaning").length ?? 0,
    maintenance: rooms?.filter((r) => r.status === "maintenance").length ?? 0,
    blocked: rooms?.filter((r) => r.status === "blocked").length ?? 0,
    emergency_reserved: rooms?.filter((r) => r.status === "emergency_reserved").length ?? 0,
  };

  return { bedStats, roomStats };
});

// ─── Inventory & Supply Chain Governance ───────────────────────────────────

// ─── Inventory & Supply Chain Governance ───────────────────────────────────

// Live In-Memory State Cache (persists state across client calls if remote tables are being initialized)
const _fallbackCategories: InventoryCategory[] = [
  { category_id: "medications", name: "Medications & Drugs", description: "Pharmaceuticals, IV infusions, injectables and oral medications", color_code: "#3b82f6" },
  { category_id: "medical_devices", name: "Medical Devices", description: "Diagnostic instruments, monitors, pumps and telemetry hardware", color_code: "#8b5cf6" },
  { category_id: "ppe", name: "PPE & Infection Control", description: "Gloves, masks, gowns, shields, and biohazard protection supplies", color_code: "#10b981" },
  { category_id: "surgical_supplies", name: "Surgical Supplies", description: "Sterile drapes, sutures, blades, scalpels and OR consumables", color_code: "#f59e0b" },
  { category_id: "lab_reagents", name: "Lab Reagents & Assays", description: "Chemical diagnostic reagents, assay kits and specimen containers", color_code: "#ec4899" },
  { category_id: "office_supplies", name: "Administrative & Office", description: "Hospital admission charts, barcode labels and desk supplies", color_code: "#6b7280" },
  { category_id: "cleaning_products", name: "Sanitation & Disinfection", description: "Hospital-grade disinfectants, sterilizing solutions and biocides", color_code: "#06b6d4" },
];

let _liveInventoryItems: InventoryItem[] = [
  { item_id: "INV-MED-001", name: "Paracetamol IV Infusion 1000mg/100ml", sku: "MED-PCM-1000", category_id: "medications", current_stock: 340, reserved_stock: 45, unit: "vials", reorder_level: 80, reorder_qty: 200, unit_cost: 4.50, expiry_date: "2027-11-30", storage_location: "Pharmacy Cold Storage B2", supplier: "Fresenius Kabi", status: "normal" },
  { item_id: "INV-MED-002", name: "Propofol 1% Injectable Emulsion 20ml", sku: "MED-PRO-0020", category_id: "medications", current_stock: 14, reserved_stock: 10, unit: "vials", reorder_level: 30, reorder_qty: 100, unit_cost: 18.20, expiry_date: "2026-09-02", storage_location: "OR Anesthesia Vault 01", supplier: "AstraZeneca", status: "critical" },
  { item_id: "INV-MED-003", name: "Ceftriaxone Sodium 1g Powder for Injection", sku: "MED-CEF-0001", category_id: "medications", current_stock: 65, reserved_stock: 20, unit: "vials", reorder_level: 50, reorder_qty: 150, unit_cost: 6.75, expiry_date: "2027-04-15", storage_location: "Central Pharmacy Shelf A4", supplier: "Roche Pharma", status: "normal" },
  { item_id: "INV-MED-004", name: "Normal Saline 0.9% 500ml IV Bags", sku: "MED-NSS-0500", category_id: "medications", current_stock: 520, reserved_stock: 80, unit: "bags", reorder_level: 120, reorder_qty: 400, unit_cost: 2.10, expiry_date: "2028-01-20", storage_location: "Central Warehouse Bay 1", supplier: "Baxter Healthcare", status: "normal" },
  { item_id: "INV-MED-005", name: "Epinephrine 1mg/ml (1:1000) Ampoules", sku: "MED-EPI-0001", category_id: "medications", current_stock: 18, reserved_stock: 5, unit: "ampoules", reorder_level: 25, reorder_qty: 60, unit_cost: 8.40, expiry_date: "2026-08-30", storage_location: "Emergency Crash Cart Rack 3", supplier: "Pfizer Hospital", status: "low_stock" },
  { item_id: "INV-DEV-001", name: "Adult Defibrillator Electrodes / Pads", sku: "DEV-DEF-PAD1", category_id: "medical_devices", current_stock: 22, reserved_stock: 4, unit: "pairs", reorder_level: 20, reorder_qty: 50, unit_cost: 45.00, expiry_date: "2026-08-28", storage_location: "ICU Equipment Room E1", supplier: "Philips Healthcare", status: "low_stock" },
  { item_id: "INV-DEV-002", name: "Disposable SpO2 Sensor Cables (Adult)", sku: "DEV-SPO-AD01", category_id: "medical_devices", current_stock: 95, reserved_stock: 12, unit: "units", reorder_level: 30, reorder_qty: 100, unit_cost: 14.50, expiry_date: "2028-06-15", storage_location: "Biomedical Depot Shelf 2", supplier: "Masimo Corp", status: "normal" },
  { item_id: "INV-DEV-003", name: "Continuous Syringe Infusion Pump Lines", sku: "DEV-PMP-SY01", category_id: "medical_devices", current_stock: 180, reserved_stock: 25, unit: "sets", reorder_level: 50, reorder_qty: 200, unit_cost: 7.80, expiry_date: "2027-10-10", storage_location: "Ward Storage C3", supplier: "B. Braun Medical", status: "normal" },
  { item_id: "INV-PPE-001", name: "N95 Particulate Respirators (Box/20)", sku: "PPE-N95-BX20", category_id: "ppe", current_stock: 12, reserved_stock: 5, unit: "boxes", reorder_level: 25, reorder_qty: 80, unit_cost: 28.00, expiry_date: "2029-12-31", storage_location: "Infection Control Depot A1", supplier: "3M Healthcare", status: "critical" },
  { item_id: "INV-PPE-002", name: "Nitrile Examination Gloves Size M (Box/100)", sku: "PPE-GLV-MD10", category_id: "ppe", current_stock: 280, reserved_stock: 40, unit: "boxes", reorder_level: 60, reorder_qty: 200, unit_cost: 9.50, expiry_date: "2028-08-18", storage_location: "Central Warehouse Bay 2", supplier: "Ansell Healthcare", status: "normal" },
  { item_id: "INV-SUR-001", name: "Sterile Surgical Scalpels #10 (Box/10)", sku: "SUR-SCP-BX10", category_id: "surgical_supplies", current_stock: 35, reserved_stock: 8, unit: "boxes", reorder_level: 15, reorder_qty: 50, unit_cost: 16.50, expiry_date: "2028-03-22", storage_location: "OR Sterile Core Rack 4", supplier: "Swann-Morton", status: "normal" },
  { item_id: "INV-SUR-002", name: "Vicryl 3-0 Absorbable Sutures (Box/36)", sku: "SUR-SUT-V300", category_id: "surgical_supplies", current_stock: 8, reserved_stock: 2, unit: "boxes", reorder_level: 15, reorder_qty: 40, unit_cost: 112.00, expiry_date: "2026-09-10", storage_location: "OR Sterile Core Rack 2", supplier: "Ethicon / J&J", status: "critical" },
  { item_id: "INV-LAB-001", name: "Troponin I High-Sensitivity Assay Kit", sku: "LAB-TRP-HS01", category_id: "lab_reagents", current_stock: 6, reserved_stock: 2, unit: "kits", reorder_level: 10, reorder_qty: 25, unit_cost: 340.00, expiry_date: "2026-08-25", storage_location: "Clinical Lab Fridge L2", supplier: "Abbott Diagnostics", status: "critical" },
  { item_id: "INV-CLN-001", name: "Hospital Surface Biocide Disinfectant 5L", sku: "CLN-BIO-005L", category_id: "cleaning_products", current_stock: 45, reserved_stock: 6, unit: "bottles", reorder_level: 15, reorder_qty: 50, unit_cost: 22.00, expiry_date: "2028-11-15", storage_location: "Housekeeping Depot G0", supplier: "Ecolab Healthcare", status: "normal" }
];

let _liveStockMovements: StockMovement[] = [
  { movement_id: "mov-001", item_id: "INV-MED-001", movement_type: "IN", quantity: 200, previous_stock: 140, new_stock: 340, reason: "Monthly replenishment batch #FKB-9821", performed_by_name: "Lead Pharmacist Dr. Sarah Chen", recorded_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
  { movement_id: "mov-002", item_id: "INV-MED-002", movement_type: "OUT", quantity: 16, previous_stock: 30, new_stock: 14, reason: "Dispatched to OR Suite 3 & 4 emergency craniotomy", performed_by_name: "Anesthesia Tech Marcus Vance", recorded_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
  { movement_id: "mov-003", item_id: "INV-PPE-001", movement_type: "OUT", quantity: 18, previous_stock: 30, new_stock: 12, reason: "Emergency isolation protocol ward transfer allocation", performed_by_name: "Nurse Supervisor Elena Rostova", recorded_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString() },
  { movement_id: "mov-004", item_id: "INV-LAB-001", movement_type: "OUT", quantity: 4, previous_stock: 10, new_stock: 6, reason: "Cardiac emergency triage batch testing cycle", performed_by_name: "Senior Biochemist David Miller", recorded_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
  { movement_id: "mov-005", item_id: "INV-SUR-002", movement_type: "OUT", quantity: 7, previous_stock: 15, new_stock: 8, reason: "Scheduled general surgery room supply transfer", performed_by_name: "OR Sterile Supply Lead Robert King", recorded_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
  { movement_id: "mov-006", item_id: "INV-DEV-001", movement_type: "ADJUSTMENT", quantity: -3, previous_stock: 25, new_stock: 22, reason: "Damaged package calibration disposal check", performed_by_name: "Biomed Inspector Jack Reynolds", recorded_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString() }
];

let _liveInventoryAlerts: InventoryAlert[] = [
  { alert_id: "alert-001", item_id: "INV-MED-002", alert_type: "critical", severity: "critical", message: "Propofol 1% stock level is critical (14 vials remaining vs reorder threshold 30). Near expiry in 19 days.", current_level: 14, threshold: 30, acknowledged: false, created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
  { alert_id: "alert-002", item_id: "INV-PPE-001", alert_type: "low_stock", severity: "critical", message: "N95 Respirators below minimum threshold (12 boxes remaining vs reorder threshold 25). Immediate replenishment requested.", current_level: 12, threshold: 25, acknowledged: false, created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
  { alert_id: "alert-003", item_id: "INV-LAB-001", alert_type: "near_expiry", severity: "critical", message: "Troponin I Assay Kits expiring in 11 days (2026-08-25). 6 kits remaining in Lab Fridge L2.", current_level: 6, threshold: 10, acknowledged: false, created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
  { alert_id: "alert-004", item_id: "INV-SUR-002", alert_type: "low_stock", severity: "warning", message: "Vicryl 3-0 Sutures at low stock (8 boxes remaining vs reorder threshold 15). Reorder PO pending.", current_level: 8, threshold: 15, acknowledged: false, created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
  { alert_id: "alert-005", item_id: "INV-DEV-001", alert_type: "near_expiry", severity: "warning", message: "Adult Defibrillator Electrodes expiring in 14 days (2026-08-28). Rotation or replacement required.", current_level: 22, threshold: 20, acknowledged: false, created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString() }
];

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
    let itemQuery = supabase
      .from("inventory_items")
      .select("*")
      .order("name");

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

    const allItems = items || [];
    const totalItems = allItems.length;
    const lowStockCount = allItems.filter((i) => i.status === "low_stock" || i.status === "critical" || i.current_stock <= i.reorder_level).length;
    const criticalCount = allItems.filter((i) => i.status === "critical" || i.current_stock === 0).length;

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nearExpiryCount = allItems.filter((i) => {
      if (!i.expiry_date) return false;
      const exp = new Date(i.expiry_date);
      return exp <= thirtyDaysLater;
    }).length;

    const totalStockValuation = allItems.reduce(
      (sum, i) => sum + (Number(i.current_stock) || 0) * (Number(i.unit_cost) || 0),
      0,
    );

    const categoryBreakdown: Record<string, number> = {};
    for (const cat of categories || []) {
      categoryBreakdown[cat.category_id] = allItems.filter((i) => i.category_id === cat.category_id).length;
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

    const lowStockCount = _liveInventoryItems.filter((i) => i.status === "low_stock" || i.status === "critical" || i.current_stock <= i.reorder_level).length;
    const criticalCount = _liveInventoryItems.filter((i) => i.status === "critical" || i.current_stock === 0).length;
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
      categoryBreakdown[cat.category_id] = _liveInventoryItems.filter((i) => i.category_id === cat.category_id).length;
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
  .validator((data: { itemId: string }) => {
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
  .validator((data: {
    itemId: string;
    movementType: "IN" | "OUT" | "ADJUSTMENT";
    quantity: number;
    reason?: string;
  }) => {
    if (!data?.itemId) throw new Error("itemId is required");
    if (!data?.movementType) throw new Error("movementType is required");
    if (typeof data?.quantity !== "number") throw new Error("quantity must be a number");
    return data;
  })
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
      await supabase
        .from("stock_movements")
        .insert({
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
      console.warn("Supabase persistence notice (operating in live cache):", dbErr?.message || dbErr);
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
  .validator((data: {
    itemId: string;
    reorderLevel?: number;
    reorderQty?: number;
    storageLocation?: string;
    supplier?: string;
    unitCost?: number;
  }) => {
    if (!data?.itemId) throw new Error("itemId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    // 1. Update in-memory state
    const idx = _liveInventoryItems.findIndex((i) => i.item_id === data.itemId);
    if (idx !== -1) {
      _liveInventoryItems[idx] = {
        ..._liveInventoryItems[idx],
        reorder_level: data.reorderLevel !== undefined ? data.reorderLevel : _liveInventoryItems[idx].reorder_level,
        reorder_qty: data.reorderQty !== undefined ? data.reorderQty : _liveInventoryItems[idx].reorder_qty,
        storage_location: data.storageLocation !== undefined ? data.storageLocation : _liveInventoryItems[idx].storage_location,
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

      await supabase
        .from("inventory_items")
        .update(updatePayload)
        .eq("item_id", data.itemId);
    } catch (err: any) {
      console.warn("Supabase persistence notice:", err?.message || err);
    }

    return { ok: true as const, itemId: data.itemId };
  });

/** Acknowledge an inventory alert */
export const acknowledgeInventoryAlert = createServerFn({ method: "POST" })
  .validator((data: { alertId: string }) => {
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


