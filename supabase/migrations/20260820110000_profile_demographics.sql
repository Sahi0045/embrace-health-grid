-- ============================================================================
-- Patient demographic and emergency fields on profiles
-- ============================================================================
-- These five columns already exist on the deployed database but no migration
-- ever created them — they were added directly against the remote project. That
-- is schema drift: a fresh environment built from migrations would not have them,
-- and any code depending on them would fail there while working in production.
-- Declared here so the schema is reproducible. All idempotent, so applying this
-- against the drifted database is a no-op.
--
-- They live on profiles rather than a separate patients table because they
-- describe the account holder and are read on nearly every patient screen. They
-- are not clinical findings: allergies here is the self-declared emergency list a
-- patient maintains, not a diagnosis, and carries no consent requirement beyond
-- the existing profile policies.

alter table public.profiles add column if not exists phone       text;
alter table public.profiles add column if not exists age         int;
alter table public.profiles add column if not exists gender      text;
alter table public.profiles add column if not exists blood_group text;
alter table public.profiles add column if not exists allergies   text[];

-- Guard against nonsense ages without being clinically opinionated.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_age_sane'
  ) then
    alter table public.profiles
      add constraint profiles_age_sane check (age is null or (age >= 0 and age <= 150));
  end if;
end $$;

comment on column public.profiles.allergies is
  'Self-declared emergency allergy list maintained by the account holder. Not a clinical diagnosis — those live in medical_records under consent.';

comment on column public.profiles.blood_group is
  'Self-declared blood group shown on the emergency card. Free text: a clinically authoritative value would belong in a verified credential.';
