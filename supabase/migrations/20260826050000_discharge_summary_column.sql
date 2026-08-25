-- ============================================================================
-- Discharge summary belongs in its own column, not appended to the diagnosis
-- ============================================================================
-- dischargePatient() string-concatenates the clinician's free-text discharge
-- note onto `admissions.diagnosis`:
--
--   diagnosis = '<original diagnosis> | Discharge: <free text>'
--
-- so the diagnosis of record — the field other screens, exports and the audit
-- payload read as the clinical diagnosis — becomes a compound string that grows
-- on every discharge and can no longer be matched, coded or compared. The
-- original diagnosis is not recoverable once a note contains the separator.
--
-- A discharge summary is its own clinical artefact. It gets its own column.

alter table public.admissions
  add column if not exists discharge_summary text;

comment on column public.admissions.discharge_summary is
  'Clinician''s discharge note. Separate from `diagnosis`, which must stay the admitting diagnosis alone — it was previously appended here and corrupted it.';

grant select, update on public.admissions to authenticated;
