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

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/** Resolve the caller's primary DID for writes that must be self-scoped. */
async function callerDid(): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("primary_did").single();
  if (!data?.primary_did) throw new Error("No DID associated with this account");
  return data.primary_did;
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
    .select("shift_id, staff_id, shift_date, role, starts_at, ends_at, unit, patient_count, notes, confirmed")
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
    .select("doctor_did, doctor_name, status, current_room, room_id, checked_in_at, checked_out_at, last_action, updated_at");

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
    const did = await callerDid();

    const { data: profile } = await supabase.from("profiles").select("full_name").single();
    const now = new Date().toISOString();

    const { error: upsertErr } = await supabase.from("room_checkins").upsert(
      {
        doctor_did: did,
        doctor_name: profile?.full_name ?? null,
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
      query = query.gte("occurred_at", `${data.date}T00:00:00Z`).lte("occurred_at", `${data.date}T23:59:59Z`);
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
    .select("visitor_id, patient_did, visitor_name, relation, visit_date, purpose, status, requested_at, resolved_at")
    .order("requested_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { visitors: data ?? [] };
});

export const createVisitorRequest = createServerFn({ method: "POST" })
  .validator((data: {
    patientDid?: string;
    visitorName: string;
    relation?: string;
    visitDate?: string;
    purpose?: string;
  }) => {
    if (!data?.visitorName) throw new Error("visitorName is required");
    return data;
  })
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
    if (card.status !== "active") return { valid: false as const, reason: `Card is ${card.status}` };

    return { valid: true as const, patientDid: card.patient_did, cardType: card.card_type };
  });

// ─── Insurance ──────────────────────────────────────────────────────────────

export const getInsurancePolicy = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("insurance_policies")
    .select("*")
    .maybeSingle();

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
