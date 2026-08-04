-- ============================================================================
-- Migration 008 — Remaining clinical and facility domains
-- ============================================================================
-- The last schema needed before Express can be retired.
--
--   Inpatient care (PHI, consent-gated):
--     admissions, procedures, surgeries, rehab_sessions, medications,
--     pharmacy_orders, nursing_notes, daily_checkups, diet_orders, vaccines
--
--   Patient-owned:
--     patient_preferences, feedback
--
--   Facility / operations:
--     ambulances, equipment
--
--   Administrative:
--     fraud_alerts (admin-only), billing_accounts + payments
--
-- PHI tables reuse the established pattern: own rows via
-- private.current_user_dids(), plus consented clinicians via
-- private.has_active_consent(). Facility inventory is clinician-readable since
-- an ambulance's availability is not patient data.
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type admission_status  as enum ('admitted', 'discharged', 'transferred');
create type schedule_status   as enum ('scheduled', 'in-progress', 'completed', 'cancelled');
create type med_status        as enum ('active', 'held', 'discontinued', 'completed');
create type dispense_status   as enum ('pending', 'dispensed', 'cancelled');
create type alert_status      as enum ('open', 'investigating', 'resolved', 'dismissed');
create type alert_severity    as enum ('info', 'warning', 'critical');
create type asset_status      as enum ('available', 'in-use', 'maintenance', 'retired');
create type payment_status    as enum ('pending', 'paid', 'failed', 'refunded');

-- ─── admissions ─────────────────────────────────────────────────────────────
create table public.admissions (
  admission_id    text primary key,
  patient_did     text not null references public.dids(did) on delete cascade,
  admitted_at     timestamptz not null default now(),
  expected_discharge date,
  discharged_at   timestamptz,
  status          admission_status not null default 'admitted',
  ward            text,
  room            text,
  bed             text,
  admitting_doctor text,
  diagnosis       text,

  -- A discharged admission must record when.
  constraint admissions_discharge_consistent
    check (status <> 'discharged' or discharged_at is not null)
);

create index admissions_patient_idx on public.admissions (patient_did, admitted_at desc);

-- ─── procedures / surgeries ─────────────────────────────────────────────────
create table public.procedures (
  procedure_id   text primary key,
  patient_did    text not null references public.dids(did) on delete cascade,
  name           text not null,
  scheduled_for  timestamptz,
  completed_at   timestamptz,
  status         schedule_status not null default 'scheduled',
  performed_by   text,
  location       text,
  notes          text,
  created_at     timestamptz not null default now()
);

create index procedures_patient_idx on public.procedures (patient_did);

create table public.surgeries (
  surgery_id       text primary key,
  patient_did      text references public.dids(did) on delete cascade,
  procedure_name   text not null,
  operating_room   text,
  scheduled_for    timestamptz,
  surgeon          text,
  anesthesiologist text,
  status           schedule_status not null default 'scheduled',
  est_duration_min int,
  created_at       timestamptz not null default now(),

  constraint surgeries_duration_positive check (est_duration_min is null or est_duration_min > 0)
);

create index surgeries_scheduled_idx on public.surgeries (scheduled_for);

-- ─── rehab_sessions ─────────────────────────────────────────────────────────
create table public.rehab_sessions (
  session_id   text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  session_type text not null,
  session_date date,
  therapist    text,
  status       schedule_status not null default 'scheduled',
  notes        text
);

create index rehab_sessions_patient_idx on public.rehab_sessions (patient_did);

-- ─── medications ────────────────────────────────────────────────────────────
create table public.medications (
  medication_id text primary key,
  patient_did   text not null references public.dids(did) on delete cascade,
  name          text not null,
  dosage        text,
  frequency     text,
  route         text,
  started_on    date,
  prescribed_by text,
  status        med_status not null default 'active',
  next_dose_at  timestamptz
);

create index medications_patient_idx on public.medications (patient_did, status);

-- ─── pharmacy_orders ────────────────────────────────────────────────────────
create table public.pharmacy_orders (
  order_id    text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  ordered_on  date not null default current_date,
  status      dispense_status not null default 'pending',
  medicines   jsonb not null default '[]'::jsonb,
  dispensed_at timestamptz,

  constraint pharmacy_dispensed_consistent
    check (status <> 'dispensed' or dispensed_at is not null)
);

create index pharmacy_orders_patient_idx on public.pharmacy_orders (patient_did);

-- ─── nursing_notes / daily_checkups / diet_orders ───────────────────────────
create table public.nursing_notes (
  note_id     text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  nurse_name  text,
  category    text,
  note        text not null,
  priority    text not null default 'routine',
  recorded_at timestamptz not null default now()
);

create index nursing_notes_patient_idx on public.nursing_notes (patient_did, recorded_at desc);

create table public.daily_checkups (
  checkup_id   text primary key,
  patient_did  text not null references public.dids(did) on delete cascade,
  checkup_at   timestamptz not null default now(),
  checkup_type text,
  doctor       text,
  specialty    text,
  notes        text,
  findings     jsonb not null default '[]'::jsonb
);

create index daily_checkups_patient_idx on public.daily_checkups (patient_did, checkup_at desc);

create table public.diet_orders (
  diet_id              text primary key,
  patient_did          text not null references public.dids(did) on delete cascade,
  diet_type            text not null,
  restrictions         jsonb not null default '[]'::jsonb,
  started_on           date,
  ordered_by           text,
  special_instructions text
);

create index diet_orders_patient_idx on public.diet_orders (patient_did);

-- ─── vaccines ───────────────────────────────────────────────────────────────
create table public.vaccines (
  vaccine_id     text primary key,
  patient_did    text not null references public.dids(did) on delete cascade,
  vaccine_name   text not null,
  dose_number    int,
  administered_on date,
  administered_by text,
  batch_number   text,
  next_due_on    date,

  constraint vaccines_dose_positive check (dose_number is null or dose_number > 0)
);

create index vaccines_patient_idx on public.vaccines (patient_did);

-- ─── patient_preferences ────────────────────────────────────────────────────
-- Consent-adjacent switches the patient controls themselves.
create table public.patient_preferences (
  patient_did            text primary key references public.dids(did) on delete cascade,
  emergency_access       boolean not null default true,
  insurance_verification boolean not null default true,
  research_sharing       boolean not null default false,
  cross_hospital         boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- ─── feedback ───────────────────────────────────────────────────────────────
create table public.feedback (
  feedback_id text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  doctor      text,
  rating      int not null,
  comments    text,
  created_at  timestamptz not null default now(),

  constraint feedback_rating_range check (rating between 1 and 5)
);

create index feedback_patient_idx on public.feedback (patient_did);

-- ─── ambulances / equipment ─────────────────────────────────────────────────
create table public.ambulances (
  ambulance_id  text primary key,
  registration  text not null,
  vehicle_type  text,
  status        asset_status not null default 'available',
  current_location text,
  driver_name   text,
  updated_at    timestamptz not null default now()
);

create table public.equipment (
  equipment_id text primary key,
  name         text not null,
  category     text,
  status       asset_status not null default 'available',
  location     text,
  last_serviced_on date,
  updated_at   timestamptz not null default now()
);

-- ─── fraud_alerts ───────────────────────────────────────────────────────────
-- Administrative only. These describe suspected misuse by staff, so exposing
-- them to the subject would defeat the purpose.
create table public.fraud_alerts (
  alert_id    text primary key,
  severity    alert_severity not null default 'warning',
  status      alert_status not null default 'open',
  alert_type  text not null,
  message     text not null,
  actor       text,
  risk_score  int,
  details     text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint fraud_risk_score_range check (risk_score is null or risk_score between 0 and 100)
);

create index fraud_alerts_status_idx on public.fraud_alerts (status, detected_at desc);

-- ─── billing_accounts / payments ────────────────────────────────────────────
create table public.billing_accounts (
  patient_did    text primary key references public.dids(did) on delete cascade,
  outstanding    numeric(12, 2) not null default 0,
  total_billed   numeric(12, 2) not null default 0,
  total_paid     numeric(12, 2) not null default 0,
  updated_at     timestamptz not null default now(),

  constraint billing_non_negative check (outstanding >= 0 and total_billed >= 0 and total_paid >= 0)
);

create table public.payments (
  payment_id  text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  amount      numeric(12, 2) not null,
  method      text,
  status      payment_status not null default 'pending',
  reference   text,
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),

  constraint payments_amount_positive check (amount > 0),
  constraint payments_paid_consistent check (status <> 'paid' or paid_at is not null)
);

create index payments_patient_idx on public.payments (patient_did, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.admissions          enable row level security;
alter table public.procedures          enable row level security;
alter table public.surgeries           enable row level security;
alter table public.rehab_sessions      enable row level security;
alter table public.medications         enable row level security;
alter table public.pharmacy_orders     enable row level security;
alter table public.nursing_notes       enable row level security;
alter table public.daily_checkups      enable row level security;
alter table public.diet_orders         enable row level security;
alter table public.vaccines            enable row level security;
alter table public.patient_preferences enable row level security;
alter table public.feedback            enable row level security;
alter table public.ambulances          enable row level security;
alter table public.equipment           enable row level security;
alter table public.fraud_alerts        enable row level security;
alter table public.billing_accounts    enable row level security;
alter table public.payments            enable row level security;

-- ─── PHI tables: own rows, or a consented clinician ─────────────────────────
-- Generated uniformly: every one of these is patient-linked clinical data and
-- must follow exactly the same gate as medical_records. Writing them out
-- individually (rather than one clever loop) keeps each policy greppable.

create policy admissions_select_own on public.admissions
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy admissions_select_consented on public.admissions
  for select to authenticated using (private.has_active_consent(patient_did));

create policy procedures_select_own on public.procedures
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy procedures_select_consented on public.procedures
  for select to authenticated using (private.has_active_consent(patient_did));

-- Surgeries are also a theatre schedule, so clinical staff see the roster.
create policy surgeries_select_own on public.surgeries
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy surgeries_select_staff on public.surgeries
  for select to authenticated using (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy rehab_sessions_select_own on public.rehab_sessions
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy rehab_sessions_select_consented on public.rehab_sessions
  for select to authenticated using (private.has_active_consent(patient_did));

create policy medications_select_own on public.medications
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy medications_select_consented on public.medications
  for select to authenticated using (private.has_active_consent(patient_did));

create policy pharmacy_orders_select_own on public.pharmacy_orders
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy pharmacy_orders_select_consented on public.pharmacy_orders
  for select to authenticated using (private.has_active_consent(patient_did));

create policy nursing_notes_select_own on public.nursing_notes
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy nursing_notes_select_consented on public.nursing_notes
  for select to authenticated using (private.has_active_consent(patient_did));

create policy daily_checkups_select_own on public.daily_checkups
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy daily_checkups_select_consented on public.daily_checkups
  for select to authenticated using (private.has_active_consent(patient_did));

create policy diet_orders_select_own on public.diet_orders
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy diet_orders_select_consented on public.diet_orders
  for select to authenticated using (private.has_active_consent(patient_did));

create policy vaccines_select_own on public.vaccines
  for select to authenticated using (patient_did in (select private.current_user_dids()));
create policy vaccines_select_consented on public.vaccines
  for select to authenticated using (private.has_active_consent(patient_did));

-- Clinical staff author these records; service_role handles system imports.
create policy nursing_notes_insert_staff on public.nursing_notes
  for insert to authenticated
  with check (
    private.current_user_role() in ('doctor', 'staff')
    and private.has_active_consent(patient_did)
  );

-- ─── patient_preferences: the patient owns these outright ───────────────────
create policy patient_preferences_select_own on public.patient_preferences
  for select to authenticated using (patient_did in (select private.current_user_dids()));

create policy patient_preferences_insert_own on public.patient_preferences
  for insert to authenticated with check (patient_did in (select private.current_user_dids()));

create policy patient_preferences_update_own on public.patient_preferences
  for update to authenticated
  using (patient_did in (select private.current_user_dids()))
  with check (patient_did in (select private.current_user_dids()));

-- ─── feedback: patient writes it, staff read it ─────────────────────────────
create policy feedback_select_own on public.feedback
  for select to authenticated using (patient_did in (select private.current_user_dids()));

create policy feedback_select_staff on public.feedback
  for select to authenticated using (private.current_user_role() in ('staff', 'admin'));

create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (patient_did in (select private.current_user_dids()));

-- ─── ambulances / equipment: facility inventory ─────────────────────────────
-- Availability is operational data, not patient data.
create policy ambulances_select_staff on public.ambulances
  for select to authenticated using (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy ambulances_update_staff on public.ambulances
  for update to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'))
  with check (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy equipment_select_staff on public.equipment
  for select to authenticated using (private.current_user_role() in ('doctor', 'staff', 'admin'));

create policy equipment_update_staff on public.equipment
  for update to authenticated
  using (private.current_user_role() in ('doctor', 'staff', 'admin'))
  with check (private.current_user_role() in ('doctor', 'staff', 'admin'));

-- ─── fraud_alerts: admin only ───────────────────────────────────────────────
-- Deliberately no policy for other roles: an alert names a suspected actor, and
-- letting that actor read it would undermine the investigation.
create policy fraud_alerts_select_admin on public.fraud_alerts
  for select to authenticated using (private.current_user_role() = 'admin');

create policy fraud_alerts_update_admin on public.fraud_alerts
  for update to authenticated
  using (private.current_user_role() = 'admin')
  with check (private.current_user_role() = 'admin');

-- Detection writes via service_role, so a client cannot fabricate or suppress.

-- ─── billing / payments ─────────────────────────────────────────────────────
create policy billing_accounts_select_own on public.billing_accounts
  for select to authenticated using (patient_did in (select private.current_user_dids()));

create policy billing_accounts_select_staff on public.billing_accounts
  for select to authenticated using (private.current_user_role() in ('staff', 'admin'));

create policy payments_select_own on public.payments
  for select to authenticated using (patient_did in (select private.current_user_dids()));

create policy payments_select_staff on public.payments
  for select to authenticated using (private.current_user_role() in ('staff', 'admin'));

-- A patient may record their own payment intent; settlement is service_role,
-- so a client cannot mark a payment 'paid' without a real transaction.
create policy payments_insert_own on public.payments
  for insert to authenticated
  with check (patient_did in (select private.current_user_dids()) and status = 'pending');

-- ─── updated_at triggers ────────────────────────────────────────────────────
create trigger patient_preferences_touch_updated_at
  before update on public.patient_preferences
  for each row execute function public.touch_updated_at();

create trigger ambulances_touch_updated_at
  before update on public.ambulances
  for each row execute function public.touch_updated_at();

create trigger equipment_touch_updated_at
  before update on public.equipment
  for each row execute function public.touch_updated_at();

create trigger billing_accounts_touch_updated_at
  before update on public.billing_accounts
  for each row execute function public.touch_updated_at();
