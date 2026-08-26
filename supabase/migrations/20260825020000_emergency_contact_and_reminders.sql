-- ============================================================================
-- Emergency contact, clinical flags, and reminder preferences
-- ============================================================================
-- Two screens collect data that has nowhere to go:
--
--   1. The emergency-profile dialog accepts emergency contact, organ-donor
--      status and critical conditions. updateEmergencyProfile() can only forward
--      blood group and allergies, because `profiles` has no columns for the
--      other three — so they were accepted from the user and dropped in transit
--      while the UI reported success. It now says which fields were not saved;
--      this makes that message unnecessary by giving them somewhere to live.
--
--   2. The appointment reminder toggles (WhatsApp / SMS / email) are local
--      component state and reset on every page load. patient_preferences has no
--      reminder columns.
--
-- Both additions are additive and defaulted; no existing policy is touched.
-- profiles_update_own remains row-scoped and still re-asserts
-- `role = private.current_user_role()`, so widening the row does not widen what
-- a user may change about their own role.

-- ─── Emergency contact and clinical flags ───────────────────────────────────

alter table public.profiles add column if not exists emergency_contact_name     text;
alter table public.profiles add column if not exists emergency_contact_relation text;
alter table public.profiles add column if not exists emergency_contact_phone    text;
alter table public.profiles add column if not exists organ_donor                boolean;
alter table public.profiles add column if not exists conditions                 text[] not null default '{}';

comment on column public.profiles.organ_donor is
  'Tri-state on purpose: NULL means the patient has not answered. Rendering an unanswered value as "No" asserts a decision they never made.';

comment on column public.profiles.conditions is
  'Critical conditions shown on the emergency card. Defaults to an empty array so the UI never has to distinguish "none" from "not loaded".';

comment on column public.profiles.emergency_contact_phone is
  'Free text: international formats vary and a responder needs whatever the patient actually entered.';

-- ─── Reminder channels ──────────────────────────────────────────────────────

alter table public.patient_preferences
  add column if not exists reminder_whatsapp boolean not null default true;
alter table public.patient_preferences
  add column if not exists reminder_sms      boolean not null default true;
alter table public.patient_preferences
  add column if not exists reminder_email    boolean not null default true;

-- Grants on both tables are table-level, so new columns inherit them. Re-asserted
-- because a column added later is easy to forget.
grant select, update on public.profiles            to authenticated;
grant select, update on public.patient_preferences to authenticated;
