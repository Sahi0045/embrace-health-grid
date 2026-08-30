create unique index if not exists appointments_doctor_slot_active_idx
  on public.appointments (doctor_did, slot)
  where status not in ('cancelled', 'rejected');
