-- ============================================================================
-- Migration 005 — Enable Realtime on selected tables
-- ============================================================================
-- Replaces the WebSocket server in backend/server.js (ws://localhost:3001).
--
-- Realtime respects RLS: a client subscribed to a table receives change events
-- only for rows its SELECT policies would return. That is the property that
-- makes direct client subscriptions safe here — a patient cannot observe
-- another patient's records appearing, even though both write to the same table.
--
-- Tables are added DELIBERATELY, not wholesale:
--
--   appointments     both parties already see the row; status changes drive the UI
--   solana_anchors   pending -> confirmed pushes replace polling for tx status
--   merkle_roots     new publications appear without a refresh
--   medical_records  a patient sees new records as clinicians add them
--   prescriptions    same
--   lab_results      results arriving is the canonical "push" case
--
-- NOT added:
--   profiles      — no realtime need; also the roster is broad for staff
--   dids          — effectively static
--   credentials   — issuance is infrequent; fetch on demand
--   consents      — deliberately excluded, see below
--   audit_events  — a live feed of audit activity is itself sensitive, and
--                   admins can already query it on demand
--
-- On consents: streaming consent changes would let a clinician observe the
-- exact moment a patient revokes access. That is a surveillance signal with no
-- clinical value, so consent state is fetched rather than pushed.
--
-- REPLICA IDENTITY FULL is required on tables whose UPDATE events need the old
-- row values (for example to detect a status transition). Without it Postgres
-- only publishes the primary key for the old tuple.
-- ============================================================================

alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.solana_anchors;
alter publication supabase_realtime add table public.merkle_roots;
alter publication supabase_realtime add table public.medical_records;
alter publication supabase_realtime add table public.prescriptions;
alter publication supabase_realtime add table public.lab_results;

-- Anchors transition pending -> confirmed -> failed, and appointments move
-- through their status enum. Both need the previous row to tell a real
-- transition from an unrelated column update.
alter table public.solana_anchors replica identity full;
alter table public.appointments   replica identity full;

-- ─── Live vitals ────────────────────────────────────────────────────────────
-- The legacy WebSocket streamed a `vitals:update` event carrying heart rate,
-- BP, SpO2, temperature and respiratory rate. There was no table behind it —
-- values were generated in-memory by the Express server and lost on restart.
--
-- Vitals are PHI, so this table gets the same consent-gated RLS as
-- medical_records rather than being readable by any authenticated user.
create table public.vitals (
  vitals_id    bigserial primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  heart_rate   int,
  bp_systolic  int,
  bp_diastolic int,
  spo2         int,
  temperature  numeric(4, 1),
  resp_rate    int,
  recorded_at  timestamptz not null default now(),

  -- Reject physiologically impossible values rather than storing noise.
  constraint vitals_heart_rate_range  check (heart_rate is null or heart_rate between 0 and 300),
  constraint vitals_spo2_range        check (spo2 is null or spo2 between 0 and 100),
  constraint vitals_temperature_range check (temperature is null or temperature between 25 and 45)
);

create index vitals_patient_did_idx  on public.vitals (patient_did, recorded_at desc);

alter table public.vitals enable row level security;

create policy vitals_select_own on public.vitals
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy vitals_select_consented on public.vitals
  for select to authenticated
  using (private.has_active_consent(patient_did));

-- Devices and clinical systems write vitals via service_role; no client INSERT
-- policy, so a patient cannot fabricate their own readings.

alter publication supabase_realtime add table public.vitals;
