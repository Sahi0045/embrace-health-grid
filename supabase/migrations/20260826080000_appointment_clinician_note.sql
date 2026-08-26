-- ============================================================================
-- Separate the clinician's note from the patient's reason for visit
-- ============================================================================
-- `appointments.reason` is what the PATIENT wrote when booking — their symptoms
-- and why they want to be seen. updateAppointmentStatus unconditionally patched
--
--   reason: data.reason ?? null
--
-- and the accept/reject modals in staff.appointments.tsx and staff.schedule.tsx
-- pass their optional "note to patient" field into that slot, defaulting to "".
--
-- So a doctor accepting an appointment overwrote the patient's stated symptoms
-- with their own note — or, far more often, with an empty string, because the
-- note field is optional and usually left blank. The clinical reason the patient
-- gave for the visit was destroyed at the moment the appointment was confirmed,
-- and nothing recorded that it had ever been there.
--
-- The two are different things written by different people, so they get
-- different columns.

alter table public.appointments
  add column if not exists clinician_note text;

comment on column public.appointments.reason is
  'The PATIENT''s stated reason for the visit, written at booking. Never overwrite this on a status change — it is their words, not the clinic''s.';

comment on column public.appointments.clinician_note is
  'Note from the clinician when accepting, rejecting or rescheduling. Separate from `reason`, which it used to overwrite.';

grant select, update on public.appointments to authenticated;
