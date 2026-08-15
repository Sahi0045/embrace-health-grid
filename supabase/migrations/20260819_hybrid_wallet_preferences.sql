-- ============================================================================
-- Hybrid Wallet Preferences Table
-- ============================================================================
-- Stores user's wallet preference (auto-detect, Phantom, or Embedded)
-- Allows users to override automatic wallet selection

create table public.user_wallet_preferences (
  preference_id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(hospital_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Wallet mode selection
  wallet_mode text not null default 'auto' 
    check (wallet_mode in ('auto', 'phantom', 'embedded')),
  
  -- Phantom detection info
  phantom_public_key text,
  phantom_connected_at timestamptz,
  phantom_disconnected_at timestamptz,
  
  -- Settings
  prefer_user_signing boolean not null default true,
  require_confirmation boolean not null default true,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unique_user_wallet unique (hospital_id, user_id)
);

-- Indexes for fast lookup
create index user_wallet_prefs_hospital_idx on public.user_wallet_preferences (hospital_id);
create index user_wallet_prefs_user_idx on public.user_wallet_preferences (user_id);
create index user_wallet_prefs_mode_idx on public.user_wallet_preferences (wallet_mode);

-- ─── Row-Level Security ──────────────────────────────────────────────────

alter table public.user_wallet_preferences enable row level security;

-- Users can see/edit their own preferences
create policy user_wallet_prefs_own on public.user_wallet_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy user_wallet_prefs_own_update on public.user_wallet_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can see all preferences for their hospital
create policy user_wallet_prefs_admin on public.user_wallet_preferences
  for select to authenticated
  using (
    hospital_id in (
      select hospital_id from public.hospital_staff 
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Users can insert their own preferences
create policy user_wallet_prefs_insert on public.user_wallet_preferences
  for insert to authenticated
  with check (user_id = auth.uid());

-- Auto-update updated_at timestamp
create or replace function public.touch_user_wallet_prefs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_wallet_prefs_touch_updated_at
  before update on public.user_wallet_preferences
  for each row
  execute function public.touch_user_wallet_prefs_updated_at();
