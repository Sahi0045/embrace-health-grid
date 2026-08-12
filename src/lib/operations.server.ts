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
import { resolveCallerForAudit, tryWriteAudit, buildBedAudit, buildRoomAudit } from "./audit.server";

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
