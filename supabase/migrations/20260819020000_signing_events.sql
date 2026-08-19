-- ============================================================================
-- Signing Events Audit Trail
-- ============================================================================
-- Comprehensive log of all blockchain signing operations
-- Tracks who signed what, when, and with which wallet

create table public.signing_events (
  event_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  
  -- What was signed
  transaction_id text not null,
  record_type text,           -- 'prescription', 'diagnosis', 'dispensing', etc.
  record_hash text,           -- SHA-256 hash of record
  
  -- How it was signed
  signer_type text not null check (signer_type in ('phantom', 'embedded')),
  signer_wallet text,         -- Which wallet actually signed (Phantom user addr or hospital addr)
  user_wallet text,           -- If Phantom: user's public key (for attribution)
  
  -- Status tracking
  status text not null default 'success' check (status in ('success', 'failed', 'pending')),
  error_message text,         -- If failed, why?
  
  -- Blockchain confirmation
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  confirmation_slot int,
  confirmation_count int default 0,
  
  -- Metadata for audit
  metadata jsonb default '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz not null default now()
);

-- Indexes for fast queries
create index signing_events_hospital_idx on public.signing_events (hospital_id);
create index signing_events_user_idx on public.signing_events (user_id);
create index signing_events_signer_idx on public.signing_events (signer_type);
create index signing_events_tx_idx on public.signing_events (transaction_id);
create index signing_events_created_idx on public.signing_events (created_at desc);
create index signing_events_record_type_idx on public.signing_events (record_type);
create index signing_events_confirmed_idx on public.signing_events (confirmed);

-- ─── Row-Level Security ──────────────────────────────────────────────────

alter table public.signing_events enable row level security;

-- Users can view events for their own signings
create policy signing_events_own_view on public.signing_events
  for select to authenticated
  using (user_id = auth.uid());

-- Admins can view all signing events for their hospital.
-- 'auditor' is not a value of user_role (patient|doctor|staff|admin|super_admin),
-- so listing it made Postgres reject this policy outright.
create policy signing_events_admin_view on public.signing_events
  for select to authenticated
  using (
    hospital_id in (
      select hospital_id from public.profiles
       where id = (select auth.uid()) and role = 'admin'
    )
  );

-- Clinical staff can view their hospital's signing events, for transparency over
-- what was anchored on-chain.
--
-- This previously matched ANY profile in the hospital, which includes patients:
-- every patient could read every signing event for the whole hospital. The rows
-- are not raw PHI, but record_type ('prescription', 'diagnosis'), record_hash,
-- timestamps and user attribution together reveal who had what kind of record
-- signed and when. A patient's own events stay visible through
-- signing_events_own_view below.
create policy signing_events_hospital_view on public.signing_events
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and hospital_id in (
      select hospital_id from public.profiles
       where id = (select auth.uid())
    )
  );

-- Signing events are an audit trail, so a row must be attributable.
--
-- This was "with check (true)", which let any authenticated account write an
-- arbitrary signing event: forged transaction ids, another user's id, another
-- hospital. An audit log that anyone can write to proves nothing. A row may now
-- only be inserted for the caller, in the caller's own hospital.
create policy signing_events_insert on public.signing_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and hospital_id in (
      select hospital_id from public.profiles
       where id = (select auth.uid())
    )
  );

-- Confirmation status is updated once the chain reports the transaction.
--
-- This was "using (confirmed = false) with check (true)", which allowed any
-- authenticated account to rewrite any unconfirmed event in ANY hospital,
-- including its transaction_id, record_hash and user_id. Two changes:
--
--   * the row must belong to the caller's hospital, and must still be
--     unconfirmed, so a confirmed event is immutable
--   * only the confirmation columns are updatable at all, enforced with column
--     privileges rather than trusting the policy, since RLS cannot restrict
--     which columns an UPDATE touches
create policy signing_events_update_confirmation on public.signing_events
  for update to authenticated
  using (
    confirmed = false
    and hospital_id in (
      select hospital_id from public.profiles
       where id = (select auth.uid())
    )
  )
  with check (
    hospital_id in (
      select hospital_id from public.profiles
       where id = (select auth.uid())
    )
  );

revoke update on public.signing_events from anon, authenticated;

grant update (
  confirmed,
  confirmed_at,
  confirmation_slot,
  confirmation_count,
  status,
  error_message
) on public.signing_events to authenticated;

-- The immutable core of the audit record: what was signed, by whom, with which
-- wallet. Never updatable by a client.
comment on table public.signing_events is
  'Audit trail of blockchain signing operations. transaction_id, record_hash, user_id and signer columns are insert-only for clients: only the confirmation columns carry an UPDATE grant. Rows are attributable by policy (user_id must be the caller).';

-- ─── Audit Queries ──────────────────────────────────────────────────────

-- View: All confirmed signings by signer type
create or replace view public.signing_events_confirmed as
  select 
    event_id,
    hospital_id,
    user_id,
    transaction_id,
    record_type,
    signer_type,
    user_wallet,
    confirmed_at,
    created_at
  from public.signing_events
  where confirmed = true
  order by created_at desc;

-- View: Phantom user signings (for user wallet accountability)
create or replace view public.signing_events_phantom_users as
  select 
    event_id,
    hospital_id,
    user_id,
    transaction_id,
    record_type,
    user_wallet,
    confirmed_at,
    created_at
  from public.signing_events
  where signer_type = 'phantom'
  and confirmed = true
  order by created_at desc;

-- View: Embedded wallet signings (hospital signings)
create or replace view public.signing_events_embedded as
  select 
    event_id,
    hospital_id,
    user_id,
    transaction_id,
    record_type,
    signer_wallet,
    confirmed_at,
    created_at
  from public.signing_events
  where signer_type = 'embedded'
  and confirmed = true
  order by created_at desc;

-- View: Failed signings (for monitoring)
create or replace view public.signing_events_failed as
  select 
    event_id,
    hospital_id,
    user_id,
    transaction_id,
    record_type,
    signer_type,
    status,
    error_message,
    created_at
  from public.signing_events
  where status = 'failed'
  order by created_at desc;

-- ─── Helper Functions ──────────────────────────────────────────────────

-- Get signing statistics for a hospital
create or replace function public.get_signing_stats(p_hospital_id uuid)
returns table (
  total_signings bigint,
  phantom_signings bigint,
  embedded_signings bigint,
  failed_signings bigint,
  confirmed_signings bigint,
  success_rate numeric
) as $$
declare
  v_total bigint;
  v_phantom bigint;
  v_embedded bigint;
  v_failed bigint;
  v_confirmed bigint;
begin
  select count(*) into v_total 
  from public.signing_events 
  where hospital_id = p_hospital_id;
  
  select count(*) into v_phantom 
  from public.signing_events 
  where hospital_id = p_hospital_id and signer_type = 'phantom' and status = 'success';
  
  select count(*) into v_embedded 
  from public.signing_events 
  where hospital_id = p_hospital_id and signer_type = 'embedded' and status = 'success';
  
  select count(*) into v_failed 
  from public.signing_events 
  where hospital_id = p_hospital_id and status = 'failed';
  
  select count(*) into v_confirmed 
  from public.signing_events 
  where hospital_id = p_hospital_id and confirmed = true;
  
  return query select 
    v_total as total_signings,
    v_phantom as phantom_signings,
    v_embedded as embedded_signings,
    v_failed as failed_signings,
    v_confirmed as confirmed_signings,
    case when v_total > 0 
      then ((v_total - v_failed)::numeric / v_total::numeric * 100)
      else 0 
    end as success_rate;
end;
$$ language plpgsql stable;

-- Get user's signing history
create or replace function public.get_user_signing_history(
  p_user_id uuid,
  p_limit int default 50
)
returns table (
  event_id uuid,
  transaction_id text,
  record_type text,
  signer_type text,
  status text,
  confirmed boolean,
  created_at timestamptz
) as $$
begin
  return query
  select 
    se.event_id,
    se.transaction_id,
    se.record_type,
    se.signer_type,
    se.status,
    se.confirmed,
    se.created_at
  from public.signing_events se
  where se.user_id = p_user_id
  order by se.created_at desc
  limit p_limit;
end;
$$ language plpgsql stable;

-- Get today's signing volume
create or replace function public.get_daily_signing_volume(p_hospital_id uuid, p_date date default current_date)
returns table (
  date_key date,
  total_signings bigint,
  phantom_signings bigint,
  embedded_signings bigint
) as $$
begin
  return query
  select 
    date_trunc('day', se.created_at)::date as date_key,
    count(*) as total_signings,
    count(*) filter (where se.signer_type = 'phantom') as phantom_signings,
    count(*) filter (where se.signer_type = 'embedded') as embedded_signings
  from public.signing_events se
  where se.hospital_id = p_hospital_id
  and date_trunc('day', se.created_at)::date = p_date
  group by date_trunc('day', se.created_at)::date;
end;
$$ language plpgsql stable;
