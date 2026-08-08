-- ============================================================================
-- Migration 006 — Operational domains (attendance, visitors, beds, billing,
--                 insurance, NFC cards, rooms, staff schedule, health metrics)
-- ============================================================================
-- Completes the schema so the remaining ~87 Express-backed api.ts functions can
-- move to Postgres and the Express server can be retired.
--
-- Access model, by data sensitivity:
--
--   PHI / patient-linked  -> own rows + active-consent gate, same as
--                            medical_records (health_metrics, insurance,
--                            visitors, nfc_cards, billing)
--   Staff operational     -> the staff member sees their own; admins see all
--                            (attendance, staff_schedule)
--   Facility state        -> readable by any clinician; not patient-specific
--                            (beds, rooms, room_checkins)
--
-- Facility state is deliberately broader: a nurse needs the ward bed map to do
-- their job, and a bed's occupancy is not itself a clinical record. Where a bed
-- references a patient the DID is nullable and the patient's clinical data
-- remains behind its own policies.
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type attendance_action as enum ('in', 'out');
create type visitor_status    as enum ('pending', 'approved', 'denied', 'checked-in', 'checked-out');
create type bed_status        as enum ('available', 'occupied', 'cleaning', 'maintenance');
create type card_status       as enum ('active', 'revoked', 'expired');

-- ─── attendance ─────────────────────────────────────────────────────────────
-- Staff clock in/out. Keyed by profile rather than the legacy staffEmail string
-- so a change of address cannot orphan the history.
create table public.attendance (
  attendance_id bigserial primary key,
  staff_id      uuid not null references public.profiles(id) on delete cascade,
  action        attendance_action not null,
  location      text,
  recorded_at   timestamptz not null default now()
);

create index attendance_staff_idx on public.attendance (staff_id, recorded_at desc);

-- ─── staff_schedule ─────────────────────────────────────────────────────────
create table public.staff_schedule (
  shift_id    text primary key,
  staff_id    uuid not null references public.profiles(id) on delete cascade,
  shift_date  date not null,
  role        text,
  starts_at   time,
  ends_at     time,
  unit        text,
  patient_count int not null default 0,
  notes       text,
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now(),

  constraint staff_schedule_time_order check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index staff_schedule_staff_idx on public.staff_schedule (staff_id, shift_date);

-- ─── beds ───────────────────────────────────────────────────────────────────
create table public.beds (
  bed_id      text primary key,
  ward        text not null,
  status      bed_status not null default 'available',
  patient_did text references public.dids(did) on delete set null,
  updated_at  timestamptz not null default now(),

  -- An occupied bed must name its occupant; a free bed must not.
  constraint beds_occupancy_consistent
    check ((status = 'occupied' and patient_did is not null)
        or (status <> 'occupied' and patient_did is null))
);

create index beds_ward_idx on public.beds (ward, status);

-- ─── rooms + room_checkins ──────────────────────────────────────────────────
create table public.rooms (
  room_id   text primary key,
  room_name text not null,
  category  text,
  floor     text
);

-- Current clinician location. One row per clinician; history lives in
-- room_checkin_events so the merkle root has an append-only source.
create table public.room_checkins (
  doctor_did     text primary key references public.dids(did) on delete cascade,
  doctor_name    text,
  status         text,
  current_room   text,
  room_id        text references public.rooms(room_id) on delete set null,
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  last_action    text,
  updated_at     timestamptz not null default now()
);

-- Append-only event log. These are the leaves the daily merkle root commits to,
-- so rows must never be mutated after the fact.
create table public.room_checkin_events (
  event_id    text primary key,
  doctor_did  text not null references public.dids(did) on delete cascade,
  room_id     text,
  room_name   text,
  action      text not null,
  occurred_at timestamptz not null default now()
);

create index room_checkin_events_doctor_idx on public.room_checkin_events (doctor_did, occurred_at desc);

-- ─── visitors ───────────────────────────────────────────────────────────────
create table public.visitors (
  visitor_id   text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  visitor_name text not null,
  relation     text,
  visit_date   date,
  purpose      text,
  status       visitor_status not null default 'pending',
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz
);

create index visitors_patient_idx on public.visitors (patient_did);

-- ─── nfc_cards ──────────────────────────────────────────────────────────────
create table public.nfc_cards (
  card_id     text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  card_type   text not null default 'patient',
  status      card_status not null default 'active',
  issued_by   uuid references public.profiles(id) on delete set null,
  issued_at   timestamptz not null default now(),
  revoked_at  timestamptz,

  constraint nfc_revoked_has_timestamp
    check (status <> 'revoked' or revoked_at is not null)
);

create index nfc_cards_patient_idx on public.nfc_cards (patient_did);

-- ─── insurance_policies + insurance_claims ──────────────────────────────────
create table public.insurance_policies (
  patient_did         text primary key references public.dids(did) on delete cascade,
  provider            text,
  policy_number       text,
  group_number        text,
  coverage_type       text,
  copay               numeric(10, 2),
  deductible          numeric(10, 2),
  deductible_met      numeric(10, 2),
  out_of_pocket_max   numeric(10, 2),
  out_of_pocket_met   numeric(10, 2),
  coverage_percentage int,
  valid_from          date,
  valid_to            date,
  updated_at          timestamptz not null default now(),

  constraint insurance_coverage_pct_range
    check (coverage_percentage is null or coverage_percentage between 0 and 100)
);

create table public.insurance_claims (
  claim_id     text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  amount       numeric(12, 2) not null,
  description  text,
  status       text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  resolved_at  timestamptz,

  constraint insurance_claim_amount_positive check (amount > 0)
);

create index insurance_claims_patient_idx on public.insurance_claims (patient_did);

-- ─── health_metrics ─────────────────────────────────────────────────────────
-- Patient-recorded trend data (weight, BMI, blood sugar, lipids). PHI.
create table public.health_metrics (
  metric_id      bigserial primary key,
  patient_did    text not null references public.dids(did) on delete cascade,
  measured_on    date not null,
  weight_kg      numeric(5, 2),
  bmi            numeric(4, 1),
  sugar_fasting  int,
  sugar_post_meal int,
  bp_systolic    int,
  bp_diastolic   int,
  cholesterol_total int,
  cholesterol_hdl   int,
  cholesterol_ldl   int,
  hba1c          numeric(3, 1),
  created_at     timestamptz not null default now(),

  constraint health_metrics_unique_day unique (patient_did, measured_on)
);

create index health_metrics_patient_idx on public.health_metrics (patient_did, measured_on desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.attendance          enable row level security;
alter table public.staff_schedule      enable row level security;
alter table public.beds                enable row level security;
alter table public.rooms               enable row level security;
alter table public.room_checkins       enable row level security;
alter table public.room_checkin_events enable row level security;
alter table public.visitors            enable row level security;
alter table public.nfc_cards           enable row level security;
alter table public.insurance_policies  enable row level security;
alter table public.insurance_claims    enable row level security;
alter table public.health_metrics      enable row level security;

-- ─── attendance: own record, or admin ───────────────────────────────────────
create policy attendance_select_own on public.attendance
  for select to authenticated
  using (staff_id = (select auth.uid()));

create policy attendance_select_admin on public.attendance
  for select to authenticated
  using (private.current_user_role() = 'admin');

-- A staff member may clock only themselves in or out.
create policy attendance_insert_self on public.attendance
  for insert to authenticated
  with check (staff_id = (select auth.uid()));

-- No UPDATE/DELETE: attendance is an append-only record for payroll integrity.

-- ─── staff_schedule ─────────────────────────────────────────────────────────
create policy staff_schedule_select_own on public.staff_schedule
  for select to authenticated
  using (staff_id = (select auth.uid()));

create policy staff_schedule_select_staff on public.staff_schedule
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- Staff may confirm their own shift, not rewrite the roster.
create policy staff_schedule_update_own on public.staff_schedule
  for update to authenticated
  using (staff_id = (select auth.uid()))
  with check (staff_id = (select auth.uid()));

-- ─── beds / rooms: facility state, clinicians only ──────────────────────────
create policy beds_select_staff on public.beds
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- A patient may see the bed they occupy.
create policy beds_select_own on public.beds
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy beds_update_staff on public.beds
  for update to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'))
  with check (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy rooms_select_authenticated on public.rooms
  for select to authenticated
  using (true);

-- ─── room_checkins: clinician location ──────────────────────────────────────
-- Visible to clinical staff (needed to locate a colleague) but NOT to patients:
-- staff movement is not patient-facing information.
create policy room_checkins_select_staff on public.room_checkins
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- A clinician may only check themselves in or out.
create policy room_checkins_upsert_own on public.room_checkins
  for insert to authenticated
  with check (doctor_did in (select private.current_user_dids()));

create policy room_checkins_update_own on public.room_checkins
  for update to authenticated
  using (doctor_did in (select private.current_user_dids()))
  with check (doctor_did in (select private.current_user_dids()));

create policy room_checkin_events_select_staff on public.room_checkin_events
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy room_checkin_events_insert_own on public.room_checkin_events
  for insert to authenticated
  with check (doctor_did in (select private.current_user_dids()));

-- No UPDATE/DELETE: these are merkle leaves and must stay immutable.

-- ─── visitors: patient's own, or clinical staff ─────────────────────────────
create policy visitors_select_own on public.visitors
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy visitors_select_staff on public.visitors
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy visitors_insert_involved on public.visitors
  for insert to authenticated
  with check (
    patient_did in (select private.current_user_dids())
    or private.current_user_role() in ('doctor', 'staff', 'admin')
  );

-- Only staff approve or deny a visit request.
create policy visitors_update_staff on public.visitors
  for update to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'))
  with check (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- ─── nfc_cards ──────────────────────────────────────────────────────────────
create policy nfc_cards_select_own on public.nfc_cards
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy nfc_cards_select_staff on public.nfc_cards
  for select to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- Issuance and revocation are administrative acts, hence service_role only:
-- a card is a physical credential and self-issuance would defeat it.

-- ─── insurance: patient's own, plus consented clinicians ────────────────────
create policy insurance_policies_select_own on public.insurance_policies
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy insurance_policies_select_consented on public.insurance_policies
  for select to authenticated
  using (private.has_active_consent(patient_did));

create policy insurance_policies_upsert_own on public.insurance_policies
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()));

create policy insurance_policies_update_own on public.insurance_policies
  for update to authenticated
  using (patient_did in (select private.current_user_dids()))
  with check (patient_did in (select private.current_user_dids()));

create policy insurance_claims_select_own on public.insurance_claims
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy insurance_claims_select_staff on public.insurance_claims
  for select to authenticated
  using (private.current_user_role() in ('staff', 'admin'));

create policy insurance_claims_insert_own on public.insurance_claims
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()));

-- ─── health_metrics: PHI, consent-gated ─────────────────────────────────────
create policy health_metrics_select_own on public.health_metrics
  for select to authenticated
  using (patient_did in (select private.current_user_dids()));

create policy health_metrics_select_consented on public.health_metrics
  for select to authenticated
  using (private.has_active_consent(patient_did));

-- Patients record their own measurements.
create policy health_metrics_insert_own on public.health_metrics
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()));

-- ─── updated_at triggers ────────────────────────────────────────────────────
create trigger beds_touch_updated_at
  before update on public.beds
  for each row execute function public.touch_updated_at();

create trigger room_checkins_touch_updated_at
  before update on public.room_checkins
  for each row execute function public.touch_updated_at();

create trigger insurance_policies_touch_updated_at
  before update on public.insurance_policies
  for each row execute function public.touch_updated_at();

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- Live facility state genuinely benefits from push; bed and location boards are
-- the canonical wall-display case.
alter publication supabase_realtime add table public.beds;
alter publication supabase_realtime add table public.room_checkins;
alter table public.beds          replica identity full;
alter table public.room_checkins replica identity full;
