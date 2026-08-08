-- Appointment rescheduling: store the time a clinician proposes.
--
-- The staff UI offers Accept / Reject / Reschedule, but "Reschedule" had nowhere
-- to record the proposed slot — the appointments table has `slot` (the agreed
-- time) and nothing else, so updateAppointmentStatus silently dropped it and the
-- patient never saw the suggestion.
--
-- Overwriting `slot` directly would be wrong: until the patient agrees, the
-- originally requested time is still the one on the books. This keeps the two
-- distinct, so the patient can see both what they asked for and what was offered.
alter table public.appointments
  add column if not exists suggested_slot text;

comment on column public.appointments.suggested_slot is
  'Alternative time proposed by the clinician, pending patient acceptance. The agreed time remains in slot until the patient accepts.';

-- The UI models a "suggested" state, and status is an enum, so the label has to
-- exist or the write fails outright. `rescheduled` already covers a completed
-- reschedule; this is the intermediate state where a proposal is outstanding.
alter type public.appt_status add value if not exists 'suggested';
