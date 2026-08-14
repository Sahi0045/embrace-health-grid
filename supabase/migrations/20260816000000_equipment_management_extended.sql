-- ============================================================================
-- Equipment Management Extended — Embrace Health Grid (Sprint 7)
-- ============================================================================
-- Extends equipment table with comprehensive clinical engineering attributes:
--   - Manufacturer, model, serial number, department, floor, ward
--   - Warranty expiration, purchase date, live utilization percentage
--   - Calibration schedule & precision tracking
--   - equipment_maintenance_log: audit ledger for preventive/corrective actions
-- ============================================================================

-- ─── 1. Alter Equipment Table ───────────────────────────────────────────────
alter table public.equipment
  add column if not exists manufacturer     text,
  add column if not exists model            text,
  add column if not exists serial_number    text,
  add column if not exists department       text,
  add column if not exists floor_number     int default 1,
  add column if not exists equipment_type   text default 'general',
  add column if not exists next_service_on  date,
  add column if not exists warranty_expiry  date,
  add column if not exists purchase_date    date,
  add column if not exists utilization_pct  int default 0 check (utilization_pct between 0 and 100),
  add column if not exists calibration_date date,
  add column if not exists next_calibration date,
  add column if not exists assigned_ward    text,
  add column if not exists did              text;

create index if not exists equipment_type_idx       on public.equipment (equipment_type);
create index if not exists equipment_department_idx on public.equipment (department);
create index if not exists equipment_status_idx     on public.equipment (status);

-- ─── 2. Equipment Maintenance Log Table ──────────────────────────────────────
create table if not exists public.equipment_maintenance_log (
  log_id            text primary key,
  equipment_id      text not null references public.equipment(equipment_id) on delete cascade,
  hospital_id       uuid references public.hospitals(hospital_id) on delete cascade,
  maintenance_type  text not null check (maintenance_type in ('preventive', 'corrective', 'calibration', 'routine_check')),
  description       text not null,
  performed_by      text not null,
  performed_at      timestamptz not null default now(),
  next_due          date,
  cost              numeric(12,2) not null default 0.00,
  status            text not null default 'completed' check (status in ('completed', 'scheduled', 'overdue', 'in_progress')),
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists eq_maint_equipment_idx on public.equipment_maintenance_log (equipment_id, performed_at desc);
create index if not exists eq_maint_hospital_idx  on public.equipment_maintenance_log (hospital_id);
create index if not exists eq_maint_status_idx    on public.equipment_maintenance_log (status);

-- ─── 3. Row Level Security for Maintenance Log ──────────────────────────────
alter table public.equipment_maintenance_log enable row level security;

create policy equipment_maint_select_staff on public.equipment_maintenance_log
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy equipment_maint_insert_staff on public.equipment_maintenance_log
  for insert to authenticated
  with check (
    private.current_user_role() in ('staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

create policy equipment_maint_update_staff on public.equipment_maintenance_log
  for update to authenticated
  using (
    private.current_user_role() in ('staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  )
  with check (
    private.current_user_role() in ('staff', 'admin', 'super_admin')
    and (hospital_id is null or private.can_access_hospital(hospital_id))
  );

-- ─── 4. Realtime Configuration ──────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'equipment_maintenance_log'
  ) then
    alter publication supabase_realtime add table public.equipment_maintenance_log;
  end if;
end $$;

alter table public.equipment                 replica identity full;
alter table public.equipment_maintenance_log replica identity full;

-- ─── 5. Seed Real Clinical Equipment & Maintenance Records ──────────────────
do $$
declare
  seed_hospital uuid;
begin
  select hospital_id into seed_hospital
  from public.hospitals
  where status = 'active'
  order by created_at asc
  limit 1;

  if seed_hospital is not null then
    -- Upsert clinical equipment inventory
    insert into public.equipment (
      equipment_id, hospital_id, name, category, status, location,
      manufacturer, model, serial_number, department, floor_number,
      equipment_type, last_serviced_on, next_service_on, warranty_expiry,
      purchase_date, utilization_pct, calibration_date, next_calibration,
      assigned_ward, did, updated_at
    )
    values
      (
        'EQ-MRI-001', seed_hospital, 'MAGNETOM Vida 3T MRI Scanner', 'Diagnostic Imaging', 'in-use', 'Radiology Suite 101',
        'Siemens Healthineers', 'Vida 3T BioMatrix', 'SN-MRI-98421-V', 'Radiology & Imaging', 1,
        'mri', '2026-06-15', '2026-09-15', '2029-12-31',
        '2023-01-10', 88, '2026-06-15', '2026-12-15',
        'Advanced Diagnostic Center', 'did:solana:4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', now()
      ),
      (
        'EQ-CT-001', seed_hospital, 'Aquilion ONE GENESIS 640-Slice CT', 'Diagnostic Imaging', 'operational', 'Imaging Bay B',
        'Canon Medical Systems', 'Aquilion ONE PRISM', 'SN-CT-77412-C', 'Radiology & Imaging', 1,
        'ct', '2026-07-20', '2026-10-20', '2028-06-30',
        '2022-05-18', 74, '2026-07-20', '2027-01-20',
        'Emergency Diagnostic Wing', 'did:solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', now()
      ),
      (
        'EQ-VENT-001', seed_hospital, 'Hamilton-G5 Intensive Care Ventilator', 'Critical Care', 'in-use', 'ICU Pod 4 Bed 2',
        'Hamilton Medical', 'Hamilton-G5 Pro', 'SN-VNT-55109-H', 'Intensive Care Unit (ICU)', 3,
        'ventilator', '2026-08-01', '2026-09-01', '2027-08-15',
        '2023-04-12', 95, '2026-08-01', '2026-11-01',
        'ICU Ward Alpha', 'did:solana:9v8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k3412', now()
      ),
      (
        'EQ-VENT-002', seed_hospital, 'Hamilton-C6 High-End Transport Ventilator', 'Critical Care', 'operational', 'ICU Equipment Depot',
        'Hamilton Medical', 'Hamilton-C6', 'SN-VNT-55244-H', 'Intensive Care Unit (ICU)', 3,
        'ventilator', '2026-07-10', '2026-09-10', '2027-10-22',
        '2023-08-05', 40, '2026-07-10', '2026-10-10',
        'ICU Ward Beta', 'did:solana:3m8Y7tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k8921', now()
      ),
      (
        'EQ-XRAY-001', seed_hospital, 'MobileDaRt Evolution MX8 Digital X-Ray', 'Diagnostic Imaging', 'operational', 'Trauma Bay 1',
        'Shimadzu Medical', 'MobileDaRt MX8', 'SN-XRY-33290-S', 'Emergency Medicine', 1,
        'xray', '2026-05-18', '2026-08-18', '2028-03-15',
        '2022-11-20', 62, '2026-05-18', '2026-11-18',
        'Emergency Department', 'did:solana:5v9Y8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k7733', now()
      ),
      (
        'EQ-DEFIB-001', seed_hospital, 'HeartStart XL+ Defibrillator / Monitor', 'Emergency & Resuscitation', 'operational', 'Crash Cart Station 2A',
        'Philips Healthcare', 'HeartStart XL+', 'SN-DFB-88301-P', 'Cardiology', 2,
        'defibrillator', '2026-08-05', '2026-09-05', '2029-01-30',
        '2024-02-14', 25, '2026-08-05', '2026-11-05',
        'Coronary Care Unit', 'did:solana:2p8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k4488', now()
      ),
      (
        'EQ-DEFIB-002', seed_hospital, 'ZOLL R Series Plus ALS Defibrillator', 'Emergency & Resuscitation', 'maintenance', 'Biomedical Workshop',
        'ZOLL Medical', 'R Series Plus', 'SN-DFB-44129-Z', 'Biomedical Engineering', 1,
        'defibrillator', '2026-08-12', '2026-08-19', '2027-05-10',
        '2023-03-01', 0, '2026-08-12', '2026-08-19',
        'Biomedical Repair Lab', 'did:solana:8h7X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k9901', now()
      ),
      (
        'EQ-US-001', seed_hospital, 'EPIQ Elite Premium Ultrasound System', 'Diagnostic Ultrasound', 'in-use', 'Cardiovascular Lab 3',
        'Philips Ultrasound', 'EPIQ Elite Matrix', 'SN-USG-66289-P', 'Cardiology', 2,
        'ultrasound', '2026-06-30', '2026-09-30', '2028-11-15',
        '2023-06-25', 82, '2026-06-30', '2026-12-30',
        'Cardiac Diagnostic Suite', 'did:solana:1a9X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k1122', now()
      ),
      (
        'EQ-ECG-001', seed_hospital, 'MAC 7 Diagnostic 12-Lead Resting ECG', 'Cardiovascular Monitoring', 'operational', 'Outpatient Clinic 104',
        'GE HealthCare', 'MAC 7 Workstation', 'SN-ECG-11983-G', 'Outpatient Services', 1,
        'ecg', '2026-07-15', '2026-10-15', '2027-12-01',
        '2023-09-12', 48, '2026-07-15', '2027-01-15',
        'Cardiology Consultation Clinic', 'did:solana:6b8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k3344', now()
      ),
      (
        'EQ-DIAL-001', seed_hospital, 'Fresenius 5008S CorDiax Hemodialysis', 'Nephrology & Renal Care', 'in-use', 'Dialysis Bay 06',
        'Fresenius Medical Care', '5008S CorDiax HDF', 'SN-DIA-99410-F', 'Nephrology', 4,
        'dialysis', '2026-07-28', '2026-08-28', '2028-09-10',
        '2022-08-30', 91, '2026-07-28', '2026-10-28',
        'Hemodialysis Center', 'did:solana:4e8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k7766', now()
      ),
      (
        'EQ-DIAL-002', seed_hospital, 'Fresenius 5008S CorDiax Hemodialysis', 'Nephrology & Renal Care', 'offline', 'Dialysis Storage Bay',
        'Fresenius Medical Care', '5008S CorDiax HDF', 'SN-DIA-99411-F', 'Nephrology', 4,
        'dialysis', '2026-04-10', '2026-07-10', '2028-09-10',
        '2022-08-30', 0, '2026-04-10', '2026-07-10',
        'Hemodialysis Center', 'did:solana:7c8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k5544', now()
      ),
      (
        'EQ-INF-001', seed_hospital, 'Alaris CC Plus Smart Infusion Pump', 'Infusion Therapy', 'in-use', 'Post-Op Recovery Room 204',
        'BD Medical', 'Alaris CC Plus', 'SN-INF-33100-B', 'Surgical Ward', 2,
        'infusion', '2026-08-02', '2026-11-02', '2027-04-15',
        '2023-10-05', 78, '2026-08-02', '2027-02-02',
        'Surgical Step-Down Unit', 'did:solana:8w8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k2211', now()
      ),
      (
        'EQ-INF-002', seed_hospital, 'Alaris CC Plus Smart Infusion Pump', 'Infusion Therapy', 'operational', 'Central Nursing Supply',
        'BD Medical', 'Alaris CC Plus', 'SN-INF-33105-B', 'General Medicine', 2,
        'infusion', '2026-08-02', '2026-11-02', '2027-04-15',
        '2023-10-05', 35, '2026-08-02', '2027-02-02',
        'Ward 2B Station', 'did:solana:9q8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k6655', now()
      ),
      (
        'EQ-OXY-001', seed_hospital, 'BOC Medical Mobile Oxygen Cylinder Unit (10L)', 'Respiratory Support', 'operational', 'ER Triage Zone',
        'BOC Healthcare', 'OxyLite Mobile 10L', 'SN-OXY-10042-B', 'Emergency Medicine', 1,
        'oxygen-cylinder', '2026-07-01', '2026-10-01', '2030-01-01',
        '2024-01-15', 55, '2026-07-01', '2027-01-01',
        'Emergency Rapid Response', 'did:solana:1x8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k9988', now()
      ),
      (
        'EQ-WCH-001', seed_hospital, 'Invacare Action 3 NG Heavy Duty Wheelchair', 'Patient Mobility', 'operational', 'Main Hospital Lobby',
        'Invacare Corp', 'Action 3 NG', 'SN-WCH-88019-I', 'Patient Transport', 1,
        'wheelchair', '2026-06-01', '2026-12-01', '2028-05-01',
        '2023-05-10', 50, '2026-06-01', '2027-06-01',
        'Patient Transport Hub', 'did:solana:3v8X8tC45y3VwBf89J7LKsPqNm67TyUip8XzV91k4433', now()
      )
    on conflict (equipment_id) do update set
      manufacturer     = excluded.manufacturer,
      model            = excluded.model,
      serial_number    = excluded.serial_number,
      department       = excluded.department,
      floor_number     = excluded.floor_number,
      equipment_type   = excluded.equipment_type,
      last_serviced_on = excluded.last_serviced_on,
      next_service_on  = excluded.next_service_on,
      warranty_expiry  = excluded.warranty_expiry,
      purchase_date    = excluded.purchase_date,
      utilization_pct  = excluded.utilization_pct,
      calibration_date = excluded.calibration_date,
      next_calibration = excluded.next_calibration,
      assigned_ward    = excluded.assigned_ward,
      did              = excluded.did,
      status           = excluded.status,
      updated_at       = now();

    -- Insert maintenance logs
    insert into public.equipment_maintenance_log (
      log_id, equipment_id, hospital_id, maintenance_type, description,
      performed_by, performed_at, next_due, cost, status, notes
    )
    values
      (
        'LOG-MRI-001', 'EQ-MRI-001', seed_hospital, 'preventive', 'Quarterly Cryogen Level & Gradient Coil Inspection',
        'Klaus Schneider (Siemens Service)', now() - interval '60 days', (now() + interval '30 days')::date, 1250.00, 'completed',
        'Liquid helium levels at 96%. RF shield integrity nominal.'
      ),
      (
        'LOG-MRI-002', 'EQ-MRI-001', seed_hospital, 'calibration', 'High-Order Shimming & B0 Magnetic Homogeneity Recalibration',
        'Dr. Elena Vance (Lead Medical Physicist)', now() - interval '60 days', (now() + interval '120 days')::date, 450.00, 'completed',
        'Passes SNR threshold tests across all standard multi-channel head/spine arrays.'
      ),
      (
        'LOG-CT-001', 'EQ-CT-001', seed_hospital, 'preventive', 'X-Ray Tube Heat Capacity & Detector Ring Alignment',
        'Takeshi Tanaka (Canon Service Engineer)', now() - interval '25 days', (now() + interval '65 days')::date, 890.00, 'completed',
        'Tube scan seconds: 48,200. High-voltage generator ripple within 0.5% tolerance.'
      ),
      (
        'LOG-VENT-001', 'EQ-VENT-001', seed_hospital, 'preventive', 'O2 Sensor Replacement & Flow Sensor Auto-Calibration',
        'Liam O’Connor (Biomedical Tech Lead)', now() - interval '13 days', (now() + interval '17 days')::date, 240.00, 'completed',
        'Replaced paramagnetic O2 sensor cell. Expiratory valve membrane verified intact.'
      ),
      (
        'LOG-VENT-002', 'EQ-VENT-001', seed_hospital, 'calibration', 'Pressure Transducer & Volume Delivery Calibration (ISO 80601)',
        'Liam O’Connor (Biomedical Tech Lead)', now() - interval '13 days', (now() + interval '77 days')::date, 180.00, 'completed',
        'Tidal volume delivery accurate to +/- 1.8% across PEEP range 5-20 cmH2O.'
      ),
      (
        'LOG-DEFIB-001', 'EQ-DEFIB-002', seed_hospital, 'corrective', 'Pacing Circuit Impedance Fault & Battery Pack Reconditioning',
        'Sarah Jenkins (Biomedical Tech)', now() - interval '2 days', (now() + interval '5 days')::date, 620.00, 'in_progress',
        'Detected intermittent contact on lead selector switch. Awaiting OEM replacement relay.'
      ),
      (
        'LOG-US-001', 'EQ-US-001', seed_hospital, 'preventive', 'PureWave Transducer Matrix Ultrasound Probe Acoustic Testing',
        'Philips Field Engineer', now() - interval '45 days', (now() + interval '45 days')::date, 350.00, 'completed',
        'All transducer elements firing with zero dead crystal artifacts.'
      ),
      (
        'LOG-DIAL-001', 'EQ-DIAL-001', seed_hospital, 'preventive', 'Hydraulics Disinfection, Ultrafilter Replacement & Conductivity Check',
        'Marco Rossi (Renal Bio-Tech)', now() - interval '17 days', (now() + interval '13 days')::date, 410.00, 'completed',
        'Thermal chemical disinfection cycle successful. Endotoxin filter pressure differential normal.'
      ),
      (
        'LOG-DIAL-002', 'EQ-DIAL-002', seed_hospital, 'corrective', 'Blood Pump Rotor Encoder Failure Investigation',
        'Marco Rossi (Renal Bio-Tech)', now() - interval '120 days', (now() + interval '10 days')::date, 750.00, 'overdue',
        'Unit taken offline pending optical sensor assembly replacement from manufacturer.'
      )
    on conflict (log_id) do nothing;
  end if;
end $$;
