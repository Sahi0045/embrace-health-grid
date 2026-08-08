-- ============================================================================
-- Migration 004 — Blockchain anchoring + clinical namespaces
-- ============================================================================
-- Adds:
--   solana_anchors    on-chain anchor receipts (hashes only, never PHI)
--   merkle_roots      published daily roots, linked to an anchor
--   audit_events      append-only audit trail
--   prescriptions     PHI, consent-gated
--   appointments      scheduling, visible to the patient and the clinician
--   lab_results       PHI, consent-gated
--
-- Blockchain design notes
-- -----------------------
-- 1. Only SHA-256 hashes go on-chain. The existing implementation already
--    respects this and it is preserved: no PHI ever leaves Postgres.
--
-- 2. `status` + nullable `signature` replaces a real flaw in the legacy code.
--    lib/solana.js wrote failures as rows with network='devnet-error' and a
--    fabricated signature ('err_<base36>'), making a failed anchor
--    indistinguishable from a successful one. Here a failed anchor has
--    status='failed', signature IS NULL and a populated error — so stuck
--    anchors are queryable and retryable.
--
-- 3. Anchors and roots are READ-ONLY to clients. There is no client INSERT
--    policy, so only service_role (Edge Functions holding the wallet key) can
--    write them. A patient must not be able to forge an anchor or backdate a
--    merkle root — that would defeat the point of anchoring.
--
-- 4. Verification stays client-side. Proof checking is pure SHA-256 over public
--    data, so the browser reads roots/anchors and verifies integrity itself
--    rather than trusting a server's answer.
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type anchor_status as enum ('pending', 'confirmed', 'failed');
create type rx_status     as enum ('active', 'dispensed', 'cancelled', 'expired');
create type appt_status   as enum ('pending', 'confirmed', 'rejected', 'rescheduled', 'cancelled', 'completed');

-- ─── solana_anchors ─────────────────────────────────────────────────────────
create table public.solana_anchors (
  anchor_id    text primary key,
  record_hash  text not null,
  record_type  text not null,
  record_id    text,
  actor_did    text,
  status       anchor_status not null default 'pending',
  signature    text,                    -- null until confirmed on-chain
  slot         bigint,                  -- legacy code always wrote 0; capture the real slot
  network      text not null,
  error        text,                    -- populated only when status='failed'
  anchored_at  timestamptz not null default now(),
  confirmed_at timestamptz,

  -- Enforce the state machine so a "confirmed" row cannot lack a signature.
  constraint anchors_confirmed_needs_signature
    check (status <> 'confirmed' or signature is not null),
  constraint anchors_failed_has_no_signature
    check (status <> 'failed' or signature is null)
);

create index solana_anchors_record_hash_idx on public.solana_anchors (record_hash);
create index solana_anchors_record_id_idx   on public.solana_anchors (record_id);
create index solana_anchors_status_idx      on public.solana_anchors (status)
  where status = 'pending';   -- supports the retry sweep

comment on table public.solana_anchors is
  'On-chain anchor receipts. Hashes only — never PHI. Client-readable, service_role-writable.';

-- ─── merkle_roots ───────────────────────────────────────────────────────────
create table public.merkle_roots (
  publish_id   text primary key,
  subject_did  text not null,           -- doctor or patient the root summarises
  root_hash    text not null,
  event_count  int  not null check (event_count > 0),
  event_ids    jsonb not null default '[]'::jsonb,
  period_date  date not null,
  anchor_id    text references public.solana_anchors(anchor_id) on delete set null,
  published_at timestamptz not null default now(),

  -- One published root per subject per day.
  constraint merkle_roots_unique_subject_day unique (subject_did, period_date)
);

create index merkle_roots_subject_did_idx on public.merkle_roots (subject_did);

-- ─── audit_events ───────────────────────────────────────────────────────────
create table public.audit_events (
  tx_id      uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  actor_did  text,
  resource   text,
  action     text not null,
  outcome    text not null,
  severity   text not null default 'info',
  metadata   jsonb not null default '{}'::jsonb,
  logged_at  timestamptz not null default now()
);

create index audit_events_actor_id_idx  on public.audit_events (actor_id);
create index audit_events_logged_at_idx on public.audit_events (logged_at desc);

comment on table public.audit_events is
  'Append-only audit trail. No UPDATE or DELETE policy exists for any client role.';

-- ─── prescriptions ──────────────────────────────────────────────────────────
create table public.prescriptions (
  rx_id        text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  doctor_did   text not null references public.dids(did) on delete restrict,
  drugs        jsonb not null default '[]'::jsonb,
  diagnosis    text,
  notes        text,
  status       rx_status not null default 'active',
  signed       boolean not null default false,
  signed_by    text,
  signed_at    timestamptz,
  content_hash text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index prescriptions_patient_did_idx on public.prescriptions (patient_did);
create index prescriptions_doctor_did_idx   on public.prescriptions (doctor_did);

-- ─── appointments ───────────────────────────────────────────────────────────
create table public.appointments (
  appt_id      text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  doctor_did   text not null references public.dids(did) on delete cascade,
  slot         text not null,
  mode         text not null default 'in-person',
  specialty    text,
  status       appt_status not null default 'pending',
  reason       text,
  booked_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index appointments_patient_did_idx on public.appointments (patient_did);
create index appointments_doctor_did_idx  on public.appointments (doctor_did);

-- ─── lab_results ────────────────────────────────────────────────────────────
create table public.lab_results (
  lab_id       text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  ordered_by   text references public.dids(did) on delete set null,
  test_name    text not null,
  result_value text,
  unit         text,
  reference_range text,
  status       text not null default 'pending',
  content_hash text,
  resulted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index lab_results_patient_did_idx on public.lab_results (patient_did);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.solana_anchors enable row level security;
alter table public.merkle_roots   enable row level security;
alter table public.audit_events   enable row level security;
alter table public.prescriptions  enable row level security;
alter table public.appointments   enable row level security;
alter table public.lab_results    enable row level security;

-- ─── solana_anchors: read-only to clients ───────────────────────────────────
-- Hashes are not PHI and verification must be possible without a server.
create policy solana_anchors_select on public.solana_anchors
  for select to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy → service_role (Edge Functions) only.

-- ─── merkle_roots: read-only to clients ─────────────────────────────────────
create policy merkle_roots_select on public.merkle_roots
  for select to authenticated
  using (true);

-- No write policies → publication is an Edge Function operation.

-- ─── audit_events ───────────────────────────────────────────────────────────
-- A user may read their own trail; admins may read everything.
create policy audit_events_select_own on public.audit_events
  for select to authenticated
  using (actor_id = (select auth.uid()));

create policy audit_events_select_admin on public.audit_events
  for select to authenticated
  using (private.current_user_role() = 'admin');

-- No UPDATE or DELETE policy for any client role: the trail is append-only.
-- Inserts are performed by service_role so an actor cannot suppress their own
-- audit entries.

-- ─── prescriptions: same consent gate as medical_records ────────────────────
create policy prescriptions_select_own on public.prescriptions
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

-- The prescribing clinician retains access to what they wrote.
create policy prescriptions_select_author on public.prescriptions
  for select to authenticated
  using (doctor_did in (select private.current_user_dids()));

create policy prescriptions_select_consented on public.prescriptions
  for select to authenticated
  using (private.has_active_consent(patient_did));

create policy prescriptions_insert_clinician on public.prescriptions
  for insert to authenticated
  with check (
    private.current_user_role() in ('doctor', 'staff')
    and doctor_did in (select private.current_user_dids())
    and private.has_active_consent(patient_did)
  );

-- No client UPDATE/DELETE: a signed prescription must not be mutable.

-- ─── appointments ───────────────────────────────────────────────────────────
-- Both parties to the appointment can see it.
create policy appointments_select_involved on public.appointments
  for select to authenticated
  using (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  );

-- A patient books only for themselves.
create policy appointments_insert_patient on public.appointments
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()));

-- Either party may update status (confirm / reschedule / cancel).
create policy appointments_update_involved on public.appointments
  for update to authenticated
  using (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  )
  with check (
    patient_did in (select private.current_user_dids())
    or doctor_did in (select private.current_user_dids())
  );

-- ─── lab_results ────────────────────────────────────────────────────────────
create policy lab_results_select_own on public.lab_results
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy lab_results_select_consented on public.lab_results
  for select to authenticated
  using (private.has_active_consent(patient_did));

-- Results are entered by the lab via service_role, not by clients.

-- ─── updated_at triggers ────────────────────────────────────────────────────
create trigger prescriptions_touch_updated_at
  before update on public.prescriptions
  for each row execute function public.touch_updated_at();

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();
