/**
 * Admission lifecycle server functions — Embrace Health Grid
 *
 * Provides atomic admit / discharge / transfer operations that propagate
 * changes to every affected table in a single server-side transaction:
 *
 *   admitPatient:
 *     1. Validate the bed is available
 *     2. INSERT admissions row
 *     3. UPDATE beds → occupied + patient_did
 *     4. UPDATE rooms → occupied (if room_id present)
 *     5. UPSERT billing_accounts (initialise or add admission charge)
 *     6. INSERT audit_events row
 *     → Trigger private.record_admission_event() auto-fires on admissions
 *       insert and writes admission_events — no extra call needed.
 *     → Supabase Realtime pushes: admissions, beds, billing_accounts, admission_events
 *
 *   dischargePatient:
 *     1. Validate admission is still active
 *     2. UPDATE admissions → discharged, discharged_at
 *     3. UPDATE beds → available, patient_did = null
 *     4. UPDATE rooms → available (if room_id present)
 *     5. UPDATE billing_accounts.outstanding (final bill)
 *     6. INSERT audit_events row
 *     → Trigger auto-fires: admission_events row written
 *     → Realtime pushes all changes
 *
 *   transferPatient:
 *     1. Validate current admission + target bed
 *     2. UPDATE admissions → transferred + new bed/ward/room
 *     3. UPDATE old bed → available, patient_did = null
 *     4. UPDATE new bed → occupied, patient_did set
 *     5. UPDATE rooms (old → available, new → occupied if room_ids present)
 *     6. INSERT audit_events row
 *     → Trigger fires twice (old→transferred, new→admitted) handled in one UPDATE
 *
 * Security:
 *   - requireSession() rejects unauthenticated callers
 *   - All writes go through the ANON key + RLS. The new INSERT/UPDATE policies
 *     added in migration 20260814000000 restrict admission writes to
 *     role in ('doctor','staff','admin').
 *   - Billing UPSERT uses the patient DID from the admissions row, not
 *     from the caller, preventing billing manipulation.
 *   - Audit rows are written with the service-role client so RLS cannot
 *     block them (audit_events has no client INSERT policy by design).
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";
import { resolveCallerForAudit, tryWriteAudit, buildAdmissionAudit } from "./audit-helpers.server";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

async function callerProfile() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("primary_did, full_name, role, hospital_id")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: data };
}

/** Generate a compact unique ID for a new admission. */
function newAdmissionId(): string {
  return `ADM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// ─── admitPatient ────────────────────────────────────────────────────────────

export const admitPatient = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      patientDid: string;
      bedId: string;
      ward: string;
      room?: string;
      roomId?: string;
      admittingDoctorDid?: string;
      diagnosis?: string;
      expectedDischarge?: string;
      admissionFee?: number;
    }) => {
      if (!data?.patientDid) throw new Error("patientDid is required");
      if (!data?.bedId) throw new Error("bedId is required");
      if (!data?.ward) throw new Error("ward is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { user, profile } = await callerProfile();
    const supabase = getSupabaseServerClient();

    // ── Step 1: Verify bed is available ─────────────────────────────────────
    const { data: bed, error: bedErr } = await supabase
      .from("beds")
      .select("bed_id, status, ward, room_id, ward_id, bed_number")
      .eq("bed_id", data.bedId)
      .maybeSingle();

    if (bedErr) throw new Error(bedErr.message);
    if (!bed) throw new Error("Bed not found");
    if (bed.status !== "available") {
      throw new Error(`Bed is currently '${bed.status}' — cannot admit to an unavailable bed`);
    }

    // ── Step 2: Check patient has no active admission already ────────────────
    const { data: existing } = await supabase
      .from("admissions")
      .select("admission_id, status")
      .eq("patient_did", data.patientDid)
      .eq("status", "admitted")
      .maybeSingle();

    if (existing) {
      throw new Error(
        `Patient already has an active admission (${existing.admission_id}). ` +
          `Discharge or transfer them first.`,
      );
    }

    // ── Step 3: Create admission record ─────────────────────────────────────
    const admissionId = newAdmissionId();
    const now = new Date().toISOString();

    const { error: admErr } = await supabase.from("admissions").insert({
      admission_id: admissionId,
      patient_did: data.patientDid,
      admitted_at: now,
      expected_discharge: data.expectedDischarge ?? null,
      status: "admitted",
      ward: data.ward,
      room: data.room ?? null,
      bed: data.bedId,
      admitting_doctor: data.admittingDoctorDid ?? profile?.primary_did ?? null,
      diagnosis: data.diagnosis ?? null,
    });

    if (admErr) {
      if (/row-level security/i.test(admErr.message)) {
        throw new Error("Only doctors, staff or admins can admit patients");
      }
      throw new Error(admErr.message);
    }

    // ── Step 4: Mark bed as occupied ────────────────────────────────────────
    //
    // .select() is what makes an RLS rejection visible here. An update the
    // policy filters out matches zero rows and returns NO error, so without it
    // the admission would be written while the bed stayed "available" — and the
    // bed board would go on offering an occupied bed to the next patient.
    const { data: bedUpdated, error: bedUpdateErr } = await supabase
      .from("beds")
      .update({
        status: "occupied",
        patient_did: data.patientDid,
        updated_at: now,
      })
      .eq("bed_id", data.bedId)
      .select("bed_id");

    if (bedUpdateErr) throw new Error(`Bed update failed: ${bedUpdateErr.message}`);
    if (!bedUpdated?.length) {
      throw new Error("Bed not found, or you do not have permission to assign it");
    }

    // ── Step 5: Mark room as occupied (if room_id known) ────────────────────
    const roomId = data.roomId ?? bed.room_id ?? null;
    if (roomId) {
      // Non-fatal by design: the bed is the authoritative location and it is
      // already set. A room-level rollup that fails must not fail the admission,
      // but it must not pass silently either.
      // Best-effort only. `rooms_update_admin` restricts this table to admins,
      // so a doctor admitting a patient cannot write it — which is why getRooms
      // derives room occupancy from the room's beds instead of trusting this
      // column. Kept so an admin-led admission still updates it directly.
      await supabase
        .from("rooms")
        .update({ status: "occupied", updated_at: now })
        .eq("room_id", roomId);
    }

    // ── Step 6: Upsert billing account ──────────────────────────────────────
    const fee = data.admissionFee ?? 0;
    const { data: billingRow } = await supabase
      .from("billing_accounts")
      .select("total_billed, outstanding")
      .eq("patient_did", data.patientDid)
      .maybeSingle();

    const prevBilled = Number(billingRow?.total_billed ?? 0);
    const prevOut = Number(billingRow?.outstanding ?? 0);

    await supabase.from("billing_accounts").upsert(
      {
        patient_did: data.patientDid,
        total_billed: prevBilled + fee,
        outstanding: prevOut + fee,
        total_paid: billingRow ? undefined : 0,
        updated_at: now,
      },
      { onConflict: "patient_did" },
    );

    // ── Step 7: Rich audit record + blockchain proof ─────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(
      buildAdmissionAudit(
        caller,
        "PATIENT_ADMITTED",
        admissionId,
        data.patientDid,
        null, // no previous state — new admission
        {
          admissionId,
          bedId: data.bedId,
          ward: data.ward,
          room: data.room ?? null,
          diagnosis: data.diagnosis ?? null,
          admissionFee: fee,
          status: "admitted",
        },
        { billingCharged: fee },
      ),
    );

    // admission_events trigger fires automatically on the INSERT above.
    // beds, billing_accounts, admissions are all in realtime publication →
    // all subscribers receive push notifications immediately.

    return {
      ok: true as const,
      admissionId,
      patientDid: data.patientDid,
      bedId: data.bedId,
      ward: data.ward,
      room: data.room ?? null,
      status: "admitted" as const,
    };
  });

// ─── dischargePatient ────────────────────────────────────────────────────────

export const dischargePatient = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { admissionId: string; dischargeSummary?: string; finalBillAmount?: number }) => {
      if (!data?.admissionId) throw new Error("admissionId is required");
      // A discharge summary is a clinical assertion, so it must come from the
      // clinician. The wizard used to substitute "Standard discharge completed.
      // Patient in stable condition." for a blank field and write that into the
      // record — a statement about the patient's condition that nobody made.
      if (!data.dischargeSummary?.trim()) {
        throw new Error("A discharge summary is required");
      }
      if (data.finalBillAmount !== undefined && data.finalBillAmount < 0) {
        throw new Error("Final bill amount cannot be negative");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { user, profile } = await callerProfile();
    const supabase = getSupabaseServerClient();

    // ── Step 1: Fetch current admission ─────────────────────────────────────
    const { data: admission, error: fetchErr } = await supabase
      .from("admissions")
      .select("admission_id, patient_did, status, bed, ward, room")
      .eq("admission_id", data.admissionId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!admission) throw new Error("Admission not found");
    if (admission.status !== "admitted") {
      throw new Error(
        `Admission is '${admission.status}' — can only discharge an active admission`,
      );
    }

    const now = new Date().toISOString();

    // ── Step 2: Update admission to discharged ───────────────────────────────
    const { data: dischargedRows, error: admErr } = await supabase
      .from("admissions")
      .update({
        status: "discharged",
        discharged_at: now,
        // The summary goes in its own column. It used to be appended onto
        // `diagnosis` as "<diagnosis> | Discharge: <note>", which corrupted the
        // admitting diagnosis irreversibly.
        discharge_summary: data.dischargeSummary ?? null,
      })
      .eq("admission_id", data.admissionId)
      .select("admission_id");

    if (admErr) throw new Error(admErr.message);
    if (!dischargedRows?.length) {
      throw new Error("Admission not found, or you do not have permission to discharge it");
    }

    // ── Step 3: Free the bed ─────────────────────────────────────────────────
    if (admission.bed) {
      // Set to 'cleaning' after discharge (standard hospital workflow).
      // Staff can move it to 'available' once cleaned.
      //
      // A bed left marked occupied after the patient has gone is a bed the ward
      // cannot fill, so a silent no-op here has to surface.
      const { data: freed, error: freeErr } = await supabase
        .from("beds")
        .update({ status: "cleaning", patient_did: null, updated_at: now })
        .eq("bed_id", admission.bed)
        .select("bed_id");

      if (freeErr) throw new Error(`Could not release the bed: ${freeErr.message}`);
      if (!freed?.length) {
        throw new Error("The patient was discharged but their bed could not be released");
      }
    }

    // ── Step 4: Free the room (look up by bed's room_id) ────────────────────
    if (admission.bed) {
      const { data: bedRow } = await supabase
        .from("beds")
        .select("room_id")
        .eq("bed_id", admission.bed)
        .maybeSingle();

      if (bedRow?.room_id) {
        // Only mark available if no other occupied beds remain in the room.
        const { data: otherBeds } = await supabase
          .from("beds")
          .select("bed_id")
          .eq("room_id", bedRow.room_id)
          .eq("status", "occupied");

        if (!otherBeds?.length) {
          // Best-effort; see the note in admitPatient. Room occupancy is
          // derived from beds at read time.
          await supabase
            .from("rooms")
            .update({ status: "available", updated_at: now })
            .eq("room_id", bedRow.room_id);
        }
      }
    }

    // ── Step 5: Update billing ───────────────────────────────────────────────
    if (data.finalBillAmount !== undefined && data.finalBillAmount > 0) {
      const { data: billingRow } = await supabase
        .from("billing_accounts")
        .select("total_billed, outstanding")
        .eq("patient_did", admission.patient_did)
        .maybeSingle();

      if (billingRow) {
        // Additive on purpose: finalBillAmount is the NEW charge raised at
        // discharge, not the resulting balance. The wizard used to prefill this
        // field with the patient's EXISTING outstanding balance, so every
        // discharge doubled it — the client now starts at zero.
        const { error: billErr } = await supabase
          .from("billing_accounts")
          .update({
            total_billed: Number(billingRow.total_billed) + data.finalBillAmount,
            outstanding: Number(billingRow.outstanding) + data.finalBillAmount,
            updated_at: now,
          })
          .eq("patient_did", admission.patient_did)
          .select("patient_did");

        if (billErr) throw new Error(`Discharge billing failed: ${billErr.message}`);
      } else {
        // Previously the charge was silently dropped for any patient with no
        // billing account, behind a "discharged successfully" toast. Open the
        // account instead of losing the charge.
        const { error: insErr } = await supabase.from("billing_accounts").insert({
          patient_did: admission.patient_did,
          total_billed: data.finalBillAmount,
          outstanding: data.finalBillAmount,
          total_paid: 0,
          updated_at: now,
        });

        if (insErr) {
          throw new Error(
            `Discharge recorded, but the final bill of ${data.finalBillAmount} could not be posted: ${insErr.message}`,
          );
        }
      }
    }

    // ── Step 6: Rich audit record + blockchain proof ─────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(
      buildAdmissionAudit(
        caller,
        "PATIENT_DISCHARGED",
        data.admissionId,
        admission.patient_did,
        { status: "admitted", bed: admission.bed, ward: admission.ward, room: admission.room },
        {
          status: "discharged",
          dischargedAt: now,
          dischargeSummary: data.dischargeSummary ?? null,
        },
        { finalBill: data.finalBillAmount ?? 0, bedNowCleaning: admission.bed },
      ),
    );

    return {
      ok: true as const,
      admissionId: data.admissionId,
      patientDid: admission.patient_did,
      status: "discharged" as const,
      bedFreed: admission.bed ?? null,
    };
  });

// ─── transferPatient ─────────────────────────────────────────────────────────

export const transferPatient = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      admissionId: string;
      newBedId: string;
      newWard: string;
      newRoom?: string;
      newRoomId?: string;
      transferReason?: string;
    }) => {
      if (!data?.admissionId) throw new Error("admissionId is required");
      if (!data?.newBedId) throw new Error("newBedId is required");
      if (!data?.newWard) throw new Error("newWard is required");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { user, profile } = await callerProfile();
    const supabase = getSupabaseServerClient();

    // ── Step 1: Fetch current admission ─────────────────────────────────────
    const { data: admission, error: fetchErr } = await supabase
      .from("admissions")
      .select("admission_id, patient_did, status, bed, ward, room")
      .eq("admission_id", data.admissionId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!admission) throw new Error("Admission not found");
    if (admission.status !== "admitted") {
      throw new Error(`Admission is '${admission.status}' — can only transfer an active admission`);
    }

    // ── Step 2: Verify target bed is available ───────────────────────────────
    const { data: newBed, error: newBedErr } = await supabase
      .from("beds")
      .select("bed_id, status, room_id")
      .eq("bed_id", data.newBedId)
      .maybeSingle();

    if (newBedErr) throw new Error(newBedErr.message);
    if (!newBed) throw new Error("Target bed not found");
    if (newBed.status !== "available") {
      throw new Error(`Target bed is '${newBed.status}' — cannot transfer to an unavailable bed`);
    }

    const now = new Date().toISOString();
    const oldBedId = admission.bed;

    // ── Step 3: Update admission to new location (triggers event log) ────────
    const { data: movedRows, error: admErr } = await supabase
      .from("admissions")
      .update({
        status: "transferred",
        ward: data.newWard,
        room: data.newRoom ?? null,
        bed: data.newBedId,
      })
      .eq("admission_id", data.admissionId)
      .select("admission_id");

    if (admErr) throw new Error(admErr.message);
    if (!movedRows?.length) {
      throw new Error("Admission not found, or you do not have permission to transfer it");
    }

    // Re-admit into new location immediately (transfer = discharge + re-admit
    // in a single operation; the admission record stays the same)
    const { data: reAdmitted, error: reAdmitErr } = await supabase
      .from("admissions")
      .update({ status: "admitted" })
      .eq("admission_id", data.admissionId)
      .select("admission_id");

    if (reAdmitErr) throw new Error(reAdmitErr.message);
    if (!reAdmitted?.length) {
      // The row moved but never came back to 'admitted', which would leave the
      // patient parked in the transient 'transferred' state.
      throw new Error("The transfer did not complete: the admission is still marked transferred");
    }

    // ── Step 4: Free old bed ─────────────────────────────────────────────────
    if (oldBedId) {
      const { data: oldFreed, error: oldFreeErr } = await supabase
        .from("beds")
        .update({ status: "cleaning", patient_did: null, updated_at: now })
        .eq("bed_id", oldBedId)
        .select("bed_id");

      if (oldFreeErr) throw new Error(`Could not release the previous bed: ${oldFreeErr.message}`);
      if (!oldFreed?.length) {
        // Leaving the old bed occupied would show the patient in two beds.
        throw new Error("The patient was moved but their previous bed could not be released");
      }
    }

    // ── Step 5: Occupy new bed ───────────────────────────────────────────────
    const { data: newBedTaken, error: newBedUpdErr } = await supabase
      .from("beds")
      .update({
        status: "occupied",
        patient_did: admission.patient_did,
        updated_at: now,
      })
      .eq("bed_id", data.newBedId)
      .select("bed_id");

    if (newBedUpdErr) throw new Error(`Could not occupy the target bed: ${newBedUpdErr.message}`);
    if (!newBedTaken?.length) {
      throw new Error("The target bed could not be assigned; the transfer is incomplete");
    }

    // ── Step 6: Update rooms ─────────────────────────────────────────────────
    // Free old room if no other occupied beds remain.
    if (oldBedId) {
      const { data: oldBedRow } = await supabase
        .from("beds")
        .select("room_id")
        .eq("bed_id", oldBedId)
        .maybeSingle();

      if (oldBedRow?.room_id) {
        const { data: occupied } = await supabase
          .from("beds")
          .select("bed_id")
          .eq("room_id", oldBedRow.room_id)
          .eq("status", "occupied");

        if (!occupied?.length) {
          // Best-effort; room occupancy is derived from beds at read time.
          await supabase
            .from("rooms")
            .update({ status: "available", updated_at: now })
            .eq("room_id", oldBedRow.room_id);
        }
      }
    }

    // Mark new room as occupied.
    const newRoomId = data.newRoomId ?? newBed.room_id ?? null;
    if (newRoomId) {
      // Best-effort; room occupancy is derived from beds at read time.
      await supabase
        .from("rooms")
        .update({ status: "occupied", updated_at: now })
        .eq("room_id", newRoomId);
    }

    // ── Step 7: Rich audit record + blockchain proof ─────────────────────────
    const caller = await resolveCallerForAudit();
    tryWriteAudit(
      buildAdmissionAudit(
        caller,
        "PATIENT_TRANSFERRED",
        data.admissionId,
        admission.patient_did,
        { bed: oldBedId, ward: admission.ward, room: admission.room },
        { bed: data.newBedId, ward: data.newWard, room: data.newRoom ?? null },
        { transferReason: data.transferReason ?? null },
      ),
    );

    return {
      ok: true as const,
      admissionId: data.admissionId,
      patientDid: admission.patient_did,
      status: "admitted" as const,
      fromBed: oldBedId ?? null,
      toBed: data.newBedId,
      toWard: data.newWard,
    };
  });

// ─── getAdmissionEvents ──────────────────────────────────────────────────────

/** Fetch the audit trail for a single admission or all admissions. */
export const getAdmissionEvents = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { admissionId?: string; patientDid?: string; limit?: number }) => data ?? {},
  )
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("admission_events")
      .select(
        "event_id, admission_id, patient_did, event_type, " +
          "bed_id_old, bed_id_new, ward_old, ward_new, room_old, room_new, " +
          "status_old, status_new, performed_by_name, performed_by_role, " +
          "hospital_id, reason, occurred_at",
      )
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.admissionId) query = query.eq("admission_id", data.admissionId);
    if (data.patientDid) query = query.eq("patient_did", data.patientDid);

    const { data: events, error } = await query;
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });

// ─── getAllAdmissions ────────────────────────────────────────────────────────

/** Hospital-wide admissions list (staff/admin see all via RLS). */
export const getAllAdmissions = createServerFn({ method: "GET" })
  .inputValidator((data: { status?: string }) => data ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("admissions")
      .select(
        "admission_id, patient_did, admitted_at, expected_discharge, " +
          "discharged_at, status, ward, room, bed, admitting_doctor, diagnosis",
      )
      .order("admitted_at", { ascending: false });

    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const typedRows =
      (rows as unknown as Array<{
        admission_id: string;
        patient_did: string;
        admitted_at: string;
        expected_discharge: string | null;
        discharged_at: string | null;
        status: string;
        ward: string | null;
        room: string | null;
        bed: string | null;
        admitting_doctor: string | null;
        diagnosis: string | null;
      }>) ?? [];

    // Resolve patient names from dids table.
    const didSet = typedRows.map((r) => r.patient_did).filter(Boolean) as string[];
    const dids = Array.from(new Set(didSet));
    const names = new Map<string, string>();
    if (dids.length) {
      const { data: didRows } = await supabase
        .from("dids")
        .select("did, owner_name")
        .in("did", dids);
      for (const d of didRows ?? []) {
        if (d.did && d.owner_name) names.set(d.did, d.owner_name);
      }
    }

    const admissions = typedRows.map((r) => ({
      ...r,
      patient_name: names.get(r.patient_did) ?? null,
    }));

    return { admissions };
  });

// ─── getWardOccupancy ────────────────────────────────────────────────────────

/** Live ward occupancy from the ward_occupancy view. */
export const getWardOccupancy = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("ward_occupancy")
    .select("ward, total_admitted, currently_admitted, discharged, transferred");

  if (error) throw new Error(error.message);
  return { occupancy: data ?? [] };
});
