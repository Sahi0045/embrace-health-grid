-- ============================================================================
-- EMBRACE HEALTH GRID — LABORATORY & CAFETERIA DEMO DATA SEED
-- Migration: 20260825000000_seed_laboratory_cafeteria_demo.sql
-- ============================================================================
-- Seeds comprehensive operational data for Laboratory Diagnostics and
-- Cafeteria / Dietary Management to ensure full dashboard telemetry and
-- sync readiness for Admin and Clinical portals.
-- ============================================================================

DO $$
DECLARE
  seed_hospital UUID;
  patient1_did TEXT := 'did:health:patient:sarah-jenkins-88421';
  patient2_did TEXT := 'did:health:patient:marcus-chen-55210';
  patient3_did TEXT := 'did:health:patient:elena-rostova-77319';
  doctor1_did  TEXT := 'did:health:doctor:gregory-vance-001';
  doctor2_did  TEXT := 'did:health:doctor:sarah-lin-002';
BEGIN
  -- 1. Resolve seed hospital
  SELECT hospital_id INTO seed_hospital
    FROM public.hospitals
   WHERE slug IN ('apollo-general', 'apollo-consortium-general')
   ORDER BY created_at ASC
   LIMIT 1;

  IF seed_hospital IS NULL THEN
    SELECT hospital_id INTO seed_hospital
      FROM public.hospitals
     WHERE status = 'active'
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  IF seed_hospital IS NULL THEN
    RAISE NOTICE 'No hospital found, skipping lab and cafeteria seed';
    RETURN;
  END IF;

  -- 2. Ensure Seed DIDs exist (FK requirement for lab records)
  INSERT INTO public.dids (did, owner_name, owner_type, public_key, controller, status)
  VALUES
    (patient1_did, 'Sarah Jenkins', 'patient', 'ed25519:sarahjenkinskey88421pub', 'self', 'active'),
    (patient2_did, 'Marcus Chen', 'patient', 'ed25519:marcuschenkey55210pub', 'self', 'active'),
    (patient3_did, 'Elena Rostova', 'patient', 'ed25519:elenarostovakey77319pub', 'self', 'active'),
    (doctor1_did, 'Dr. Gregory Vance', 'doctor', 'ed25519:drgregoryvance001pub', 'hospital', 'active'),
    (doctor2_did, 'Dr. Sarah Lin', 'doctor', 'ed25519:drsarahlin002pub', 'hospital', 'active')
  ON CONFLICT (did) DO UPDATE
    SET owner_name = EXCLUDED.owner_name,
        status = EXCLUDED.status;

  -- 3. Seed Lab Results
  INSERT INTO public.lab_results (
    lab_id, patient_did, ordered_by, hospital_id, test_name,
    result_value, unit, reference_range, status, is_critical,
    critical_flag, category, resulted_at, created_at
  )
  VALUES
    (
      'LAB-RES-001', patient1_did, doctor1_did, seed_hospital, 'High-Sensitivity Cardiac Troponin I',
      '0.082', 'ng/mL', '< 0.034', 'critical', TRUE,
      'critical_high', 'biochemistry', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '3 hours'
    ),
    (
      'LAB-RES-002', patient2_did, doctor2_did, seed_hospital, 'Comprehensive Metabolic Panel (Creatinine)',
      '1.12', 'mg/dL', '0.70 - 1.30', 'normal', FALSE,
      'normal', 'biochemistry', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours'
    ),
    (
      'LAB-RES-003', patient3_did, doctor1_did, seed_hospital, 'Complete Blood Count (WBC)',
      '14.8', '10^3/uL', '4.5 - 11.0', 'abnormal', FALSE,
      'elevated', 'hematology', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '2 hours'
    ),
    (
      'LAB-RES-004', patient1_did, doctor2_did, seed_hospital, 'Arterial Blood Gas (pH)',
      '7.38', 'pH units', '7.35 - 7.45', 'normal', FALSE,
      'normal', 'biochemistry', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 hour'
    )
  ON CONFLICT (lab_id) DO NOTHING;

  -- 4. Seed Lab Orders
  INSERT INTO public.lab_orders (
    order_id, patient_did, ordered_by, hospital_id, test_name,
    test_category, priority, clinical_notes, specimen_type, status,
    lab_id, ordered_at, completed_at, created_at
  )
  VALUES
    (
      'ORD-LAB-001', patient1_did, doctor1_did, seed_hospital, 'High-Sensitivity Cardiac Troponin I',
      'biochemistry', 'stat', 'Acute retrosternal chest pain radiating to left arm', 'Blood', 'completed',
      'LAB-RES-001', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '3 hours'
    ),
    (
      'ORD-LAB-002', patient2_did, doctor2_did, seed_hospital, 'Complete Blood Count with Differential',
      'hematology', 'urgent', 'Pre-operative clearance for inguinal hernia repair', 'Whole Blood EDTA', 'in_progress',
      NULL, NOW() - INTERVAL '2 hours', NULL, NOW() - INTERVAL '2 hours'
    ),
    (
      'ORD-LAB-003', patient3_did, doctor1_did, seed_hospital, 'Blood Culture & Antimicrobial Sensitivity',
      'microbiology', 'urgent', 'Persistent fever spike post central line insertion', 'Blood Culture Bottles', 'in_progress',
      NULL, NOW() - INTERVAL '90 minutes', NULL, NOW() - INTERVAL '90 minutes'
    ),
    (
      'ORD-LAB-004', patient1_did, doctor2_did, seed_hospital, 'Serum Electrolytes & Renal Function Panel',
      'biochemistry', 'routine', 'Routine inpatient morning telemetry panel', 'Serum Separator Tube', 'completed',
      'LAB-RES-002', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours'
    ),
    (
      'ORD-LAB-005', patient2_did, doctor1_did, seed_hospital, 'Coagulation Profile (PT/INR & aPTT)',
      'hematology', 'routine', 'Warfarin dosing adjustment protocol monitoring', 'Citrated Plasma', 'pending',
      NULL, NOW() - INTERVAL '45 minutes', NULL, NOW() - INTERVAL '45 minutes'
    ),
    (
      'ORD-LAB-006', patient3_did, doctor2_did, seed_hospital, 'Autoimmune Panel (ANA & Anti-dsDNA)',
      'immunology', 'routine', 'Evaluation of systemic lupus erythematosus symptoms', 'Serum', 'pending',
      NULL, NOW() - INTERVAL '30 minutes', NULL, NOW() - INTERVAL '30 minutes'
    ),
    (
      'ORD-LAB-007', patient1_did, doctor1_did, seed_hospital, 'Urine Microscopy, Culture & Sensitivity',
      'microbiology', 'routine', 'Suspected catheter-associated urinary tract infection', 'Midstream Urine', 'pending',
      NULL, NOW() - INTERVAL '15 minutes', NULL, NOW() - INTERVAL '15 minutes'
    ),
    (
      'ORD-LAB-008', patient2_did, doctor2_did, seed_hospital, 'Histopathology Core Biopsy',
      'pathology', 'urgent', 'Soft tissue lesion biopsy specimen from OR 2', 'Formalin Fixed Tissue', 'in_progress',
      NULL, NOW() - INTERVAL '1 hour', NULL, NOW() - INTERVAL '1 hour'
    )
  ON CONFLICT (order_id) DO NOTHING;

  -- 5. Seed Lab Samples (Specimen tracking pipeline)
  INSERT INTO public.lab_samples (
    sample_id, order_id, lab_id, patient_did, hospital_id,
    sample_type, barcode, collection_status, collected_by, collected_at,
    received_at, processed_at, reported_at, temperature_c, container_type, notes
  )
  VALUES
    (
      'SMP-001', 'ORD-LAB-001', 'LAB-RES-001', patient1_did, seed_hospital,
      'blood', 'BC-884210', 'reported', 'Nurse Supervisor Elena', NOW() - INTERVAL '2 hours 45 minutes',
      NOW() - INTERVAL '2 hours 30 minutes', NOW() - INTERVAL '1 hour 45 minutes', NOW() - INTERVAL '1 hour',
      4.0, 'Gold Top SST Tube', 'STAT analysis completed without hemolysis'
    ),
    (
      'SMP-002', 'ORD-LAB-002', NULL, patient2_did, seed_hospital,
      'blood', 'BC-552101', 'processing', 'Clinical Phlebotomist J. Ramos', NOW() - INTERVAL '1 hour 50 minutes',
      NOW() - INTERVAL '1 hour 20 minutes', NOW() - INTERVAL '40 minutes', NULL,
      4.2, 'Lavender Top EDTA', 'Running automated hematology analyzer batch #4'
    ),
    (
      'SMP-003', 'ORD-LAB-003', NULL, patient3_did, seed_hospital,
      'blood', 'BC-773192', 'lab_received', 'Phlebotomy Tech A. Cooper', NOW() - INTERVAL '1 hour 15 minutes',
      NOW() - INTERVAL '45 minutes', NULL, NULL,
      36.5, 'BD Bactec Plus Aerobic/Anaerobic', 'Incubating in continuous culture monitor'
    ),
    (
      'SMP-004', 'ORD-LAB-005', NULL, patient2_did, seed_hospital,
      'blood', 'BC-552103', 'collected', 'Floor Nurse T. Nguyen', NOW() - INTERVAL '30 minutes',
      NULL, NULL, NULL,
      21.0, 'Light Blue Top Sodium Citrate', 'Specimen collected at bedside, ready for transport'
    ),
    (
      'SMP-005', 'ORD-LAB-008', NULL, patient2_did, seed_hospital,
      'tissue', 'BC-552104', 'processing', 'OR Scrub Nurse D. Miller', NOW() - INTERVAL '50 minutes',
      NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '20 minutes', NULL,
      22.0, 'Formalin Specimen Jar 50ml', 'Tissue sectioning and slide staining in progress'
    ),
    (
      'SMP-006', 'ORD-LAB-007', NULL, patient1_did, seed_hospital,
      'urine', 'BC-884215', 'collected', 'Ward Assistant P. Kelly', NOW() - INTERVAL '10 minutes',
      NULL, NULL, NULL,
      20.5, 'Sterile Screw-cap Container', 'Awaiting pneumatic tube transfer to central lab'
    )
  ON CONFLICT (sample_id) DO NOTHING;

  -- 6. Seed Radiology Orders & Scans
  INSERT INTO public.radiology_orders (
    order_id, patient_did, ordered_by, hospital_id, modality,
    body_part, clinical_indication, priority, status, scheduled_at,
    completed_at, report_text, reported_by, reported_at
  )
  VALUES
    (
      'RAD-ORD-001', patient1_did, doctor1_did, seed_hospital, 'mri',
      'Brain with Contrast', 'Evaluate for ischemic stroke vs intracranial hemorrhage', 'urgent', 'completed',
      NOW() - INTERVAL '2 hours', NOW() - INTERVAL '45 minutes',
      'No acute intracranial hemorrhage or mass effect. Mild chronic microvascular ischemic changes noted in periventricular white matter.',
      'Dr. Robert King (Lead Radiologist)', NOW() - INTERVAL '30 minutes'
    ),
    (
      'RAD-ORD-002', patient2_did, doctor2_did, seed_hospital, 'ct',
      'Chest, Abdomen & Pelvis with IV Contrast', 'Trauma staging, rule out blunt abdominal organ laceration', 'stat', 'in_progress',
      NOW() - INTERVAL '1 hour', NULL, NULL, NULL, NULL
    ),
    (
      'RAD-ORD-003', patient3_did, doctor1_did, seed_hospital, 'xray',
      'Chest 2-Views (PA & Lateral)', 'Post-op monitoring, rule out pneumothorax or atelectasis', 'routine', 'scheduled',
      NOW() + INTERVAL '30 minutes', NULL, NULL, NULL, NULL
    ),
    (
      'RAD-ORD-004', patient1_did, doctor2_did, seed_hospital, 'ultrasound',
      'Complete Abdomen and Gallbladder', 'Right upper quadrant abdominal pain and elevated ALT/AST', 'routine', 'scheduled',
      NOW() + INTERVAL '2 hours', NULL, NULL, NULL, NULL
    )
  ON CONFLICT (order_id) DO NOTHING;

  -- 7. Seed Cafeteria Menu Items
  INSERT INTO public.cafeteria_menu_items (
    menu_item_id, hospital_id, name, category, dietary_tags,
    available_for, price, calories, status, description, allergens
  )
  VALUES
    (
      'menu-001', seed_hospital, 'Steel-Cut Oatmeal with Berries & Honey', 'breakfast',
      ARRAY['Vegetarian', 'Heart Healthy', 'Low Sodium', 'High Fiber'], 'both', 4.50, 280, 'active',
      'Slow-cooked steel cut oats topped with fresh organic blueberries, strawberries and wild clover honey',
      ARRAY['Gluten']
    ),
    (
      'menu-002', seed_hospital, 'Egg White Omelet with Spinach & Feta', 'breakfast',
      ARRAY['High Protein', 'Gluten Free', 'Diabetic Friendly'], 'both', 6.25, 240, 'active',
      'Fluffy egg whites whisked with fresh baby spinach, cherry tomatoes, and crumbled low-fat feta',
      ARRAY['Eggs', 'Dairy']
    ),
    (
      'menu-003', seed_hospital, 'Grilled Wild Salmon with Steamed Asparagus', 'lunch',
      ARRAY['Heart Healthy', 'High Protein', 'Gluten Free', 'Renal Diet'], 'both', 12.50, 420, 'active',
      'Pan-seared Atlantic salmon fillet with lemon herb seasoning, roasted sweet potatoes and asparagus',
      ARRAY['Fish']
    ),
    (
      'menu-004', seed_hospital, 'Mediterranean Quinoa Salad Bowl', 'lunch',
      ARRAY['Vegetarian', 'Vegan', 'Gluten Free', 'High Fiber'], 'both', 8.75, 340, 'active',
      'Fluffy organic tri-color quinoa with cucumbers, kalamata olives, chickpeas and herb vinaigrette',
      ARRAY[]::TEXT[]
    ),
    (
      'menu-005', seed_hospital, 'Herb-Roasted Chicken Breast with Brown Rice', 'dinner',
      ARRAY['High Protein', 'Low Sodium', 'Diabetic Friendly'], 'both', 10.50, 390, 'active',
      'Tender free-range chicken breast roasted with thyme and rosemary, served with steamed broccoli',
      ARRAY[]::TEXT[]
    ),
    (
      'menu-006', seed_hospital, 'Creamy Butternut Squash Soup', 'dinner',
      ARRAY['Vegetarian', 'Soft Diet', 'Low Sodium'], 'both', 5.50, 190, 'active',
      'Smooth pureed roasted butternut squash with a touch of coconut milk and fresh sage',
      ARRAY[]::TEXT[]
    ),
    (
      'menu-007', seed_hospital, 'Greek Yogurt Parfait with Granola', 'snack',
      ARRAY['Vegetarian', 'High Protein'], 'both', 3.75, 210, 'active',
      'Rich probiotic Greek yogurt layered with artisan nut-free granola and raspberry puree',
      ARRAY['Dairy', 'Gluten']
    ),
    (
      'menu-008', seed_hospital, 'Fresh Cut Seasonal Fruit Cup', 'snack',
      ARRAY['Vegan', 'Gluten Free', 'Heart Healthy'], 'both', 3.25, 95, 'active',
      'Crisp cantaloupe, honeydew melon, pineapple chunks, and seedless red grapes',
      ARRAY[]::TEXT[]
    ),
    (
      'menu-009', seed_hospital, 'Cold-Pressed Green Detox Juice', 'beverage',
      ARRAY['Vegan', 'Gluten Free', 'Immunity Boost'], 'staff', 4.95, 80, 'active',
      'Fresh kale, green apple, celery, cucumber, ginger root and lemon juice blend',
      ARRAY['Celery']
    ),
    (
      'menu-010', seed_hospital, 'Electrolyte Hydration Infusion (Citrus)', 'beverage',
      ARRAY['Clinical Hydration', 'Sugar Free'], 'patient', 2.50, 15, 'active',
      'Osmotically balanced mineral beverage formulated for inpatient rehydration',
      ARRAY[]::TEXT[]
    ),
    (
      'menu-011', seed_hospital, 'Grass-Fed Beef Sirloin Steak with Mash', 'dinner',
      ARRAY['High Protein'], 'staff', 14.50, 560, 'sold_out',
      'Center-cut lean sirloin with garlic mashed red potatoes and glazed baby carrots',
      ARRAY['Dairy']
    ),
    (
      'menu-012', seed_hospital, 'Organic Fair-Trade Espresso / Americano', 'beverage',
      ARRAY['Beverage'], 'staff', 2.80, 5, 'active',
      'Freshly roasted Ethiopian single-origin whole bean espresso',
      ARRAY[]::TEXT[]
    )
  ON CONFLICT (menu_item_id) DO NOTHING;

  -- 8. Seed Kitchen Stock (Raw food inventories)
  INSERT INTO public.kitchen_stock (
    stock_id, hospital_id, item_name, category, quantity,
    unit, reorder_level, unit_cost, expiry_date, supplier,
    storage_location, status
  )
  VALUES
    (
      'kstock-001', seed_hospital, 'Organic Brown Rice 25kg Sacks', 'dry_goods', 18.00,
      'sacks', 5.00, 32.50, CURRENT_DATE + INTERVAL '180 days', 'Catering Provisions Inc',
      'Dry Goods Bulk Pantry Shelf A', 'normal'
    ),
    (
      'kstock-002', seed_hospital, 'Fresh Atlantic Salmon Fillets', 'meat', 14.50,
      'kg', 10.00, 18.00, CURRENT_DATE + INTERVAL '4 days', 'Ocean Direct Seafood',
      'Fish Cooler 01 (0°C - 2°C)', 'normal'
    ),
    (
      'kstock-003', seed_hospital, 'Organic Baby Spinach (Cleaned)', 'produce', 4.20,
      'kg', 8.00, 6.50, CURRENT_DATE + INTERVAL '3 days', 'Valley Green Farms',
      'Vegetable Walk-in Cooler', 'low_stock'
    ),
    (
      'kstock-004', seed_hospital, 'Whole Pasteurized Milk 2L Cartons', 'dairy', 48.00,
      'cartons', 20.00, 2.80, CURRENT_DATE + INTERVAL '8 days', 'Highland Dairy Co',
      'Dairy Cooler Shelf 2', 'normal'
    ),
    (
      'kstock-005', seed_hospital, 'Boneless Chicken Breast (Free-Range)', 'meat', 35.00,
      'kg', 15.00, 9.20, CURRENT_DATE + INTERVAL '5 days', 'Prime Meats Supply',
      'Poultry Refrigerator 02', 'normal'
    ),
    (
      'kstock-006', seed_hospital, 'Greek Style Plain Yogurt 5kg Tub', 'dairy', 6.00,
      'tubs', 4.00, 16.50, CURRENT_DATE + INTERVAL '14 days', 'Highland Dairy Co',
      'Dairy Cooler Shelf 1', 'normal'
    ),
    (
      'kstock-007', seed_hospital, 'Tri-Color Organic Quinoa 10kg Sacks', 'dry_goods', 2.00,
      'sacks', 4.00, 45.00, CURRENT_DATE + INTERVAL '240 days', 'Catering Provisions Inc',
      'Dry Goods Bulk Pantry Shelf B', 'low_stock'
    ),
    (
      'kstock-008', seed_hospital, 'Frozen Sweet Corn & Pea Medley', 'frozen', 25.00,
      'kg', 10.00, 3.80, CURRENT_DATE + INTERVAL '120 days', 'Apex Cold Logistics',
      'Walk-In Deep Freezer (-18°C)', 'normal'
    )
  ON CONFLICT (stock_id) DO NOTHING;

  -- 9. Seed Dietary Requirements (Inpatient clinical plans)
  INSERT INTO public.dietary_requirements (
    requirement_id, hospital_id, patient_did, patient_name,
    patient_mrn, room_number, requirements, allergies,
    meal_plan_status, prescribed_by, notes
  )
  VALUES
    (
      'diet-001', seed_hospital, patient1_did, 'Sarah Jenkins',
      'MRN-88421', 'Room 204', ARRAY['Cardiac Low Sodium', 'Soft Texture', 'Fluid Restriction 1.5L/day'],
      ARRAY['Peanuts', 'Shellfish'], 'active', 'Dr. Gregory Vance',
      'Post-cardiac catheterization protocol. Strict salt restriction < 2g/day.'
    ),
    (
      'diet-002', seed_hospital, patient2_did, 'Marcus Chen',
      'MRN-55210', 'Room 205', ARRAY['Diabetic Consistent Carb (45g/meal)', 'High Protein'],
      ARRAY['Penicillin (Clinical)', 'Tree Nuts'], 'active', 'Dr. Sarah Lin',
      'Pre-op fasting begins at 22:00 tonight. Clear liquids only until midnight.'
    ),
    (
      'diet-003', seed_hospital, patient3_did, 'Elena Rostova',
      'MRN-77319', 'Room 110', ARRAY['Renal Low Potassium', 'Low Phosphorus', 'Gluten Free'],
      ARRAY['Gluten', 'Soy'], 'active', 'Dr. Gregory Vance',
      'Stage 3 CKD nutrition management. Avoid bananas, tomatoes, and dark leafy greens.'
    ),
    (
      'diet-004', seed_hospital, patient1_did, 'Sarah Jenkins',
      'MRN-88421', 'Room 204', ARRAY['Clear Liquid Transition Diet'],
      ARRAY['Peanuts'], 'review', 'Dietary Lead Karen Walsh',
      'Step-down evaluation planned for tomorrow morning pending bowel motility recovery.'
    )
  ON CONFLICT (requirement_id) DO NOTHING;

  -- 10. Seed Meal Deliveries (Tray distribution queue)
  INSERT INTO public.meal_deliveries (
    delivery_id, hospital_id, patient_did, patient_name,
    room_number, meal_type, menu_item_name, delivery_status,
    scheduled_at, delivered_at, dietary_notes, assigned_runner
  )
  VALUES
    (
      'deliv-001', seed_hospital, patient1_did, 'Sarah Jenkins',
      'Room 204', 'lunch', 'Grilled Wild Salmon with Steamed Asparagus', 'delivered',
      NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '60 minutes',
      'Low sodium tray, no added salt shaker', 'Runner Tom Becker'
    ),
    (
      'deliv-002', seed_hospital, patient2_did, 'Marcus Chen',
      'Room 205', 'lunch', 'Herb-Roasted Chicken Breast with Brown Rice', 'delivered',
      NOW() - INTERVAL '80 minutes', NOW() - INTERVAL '50 minutes',
      'Diabetic carb controlled meal (42g)', 'Runner Tom Becker'
    ),
    (
      'deliv-003', seed_hospital, patient3_did, 'Elena Rostova',
      'Room 110', 'lunch', 'Mediterranean Quinoa Salad Bowl', 'delivered',
      NOW() - INTERVAL '70 minutes', NOW() - INTERVAL '40 minutes',
      'Gluten free kitchen prep protocol', 'Runner Lisa Chen'
    ),
    (
      'deliv-004', seed_hospital, patient1_did, 'Sarah Jenkins',
      'Room 204', 'dinner', 'Creamy Butternut Squash Soup', 'preparing',
      NOW() + INTERVAL '2 hours', NULL,
      'Soft consistency, serve with lukewarm decaf herbal tea', 'Runner Lisa Chen'
    ),
    (
      'deliv-005', seed_hospital, patient2_did, 'Marcus Chen',
      'Room 205', 'dinner', 'Egg White Omelet with Spinach & Feta', 'preparing',
      NOW() + INTERVAL '2 hours 15 minutes', NULL,
      'Evening diabetic meal prior to NPO protocol', 'Runner Tom Becker'
    ),
    (
      'deliv-006', seed_hospital, patient3_did, 'Elena Rostova',
      'Room 110', 'dinner', 'Grilled Wild Salmon with Steamed Asparagus', 'dispatched',
      NOW() + INTERVAL '1 hour 45 minutes', NULL,
      'Renal portion sizing, low potassium recipe variant', 'Runner Lisa Chen'
    )
  ON CONFLICT (delivery_id) DO NOTHING;

  -- 11. Seed Cafeteria Vendors
  INSERT INTO public.cafeteria_vendors (
    vendor_id, hospital_id, name, contact_person,
    contact_email, contact_phone, contract_status,
    supplied_categories, last_delivery_at, contract_expiry,
    rating, address
  )
  VALUES
    (
      'vnd-001', seed_hospital, 'Valley Green Farm Organics', 'David Miller',
      'orders@valleygreenfarms.com', '+1 (555) 234-8901', 'active',
      ARRAY['produce', 'herbs', 'fresh_fruits'], NOW() - INTERVAL '1 day',
      CURRENT_DATE + INTERVAL '300 days', 4.9, '142 Agricultural Way, Fresno, CA'
    ),
    (
      'vnd-002', seed_hospital, 'Highland Dairy Consortium', 'Rachel Vance',
      'commercial@highlanddairy.com', '+1 (555) 345-9012', 'active',
      ARRAY['dairy', 'yogurt', 'milk', 'cheese'], NOW() - INTERVAL '2 days',
      CURRENT_DATE + INTERVAL '240 days', 4.8, '88 Meadowbrook Lane, Sonoma, CA'
    ),
    (
      'vnd-003', seed_hospital, 'Ocean Direct Seafood Logistics', 'Captain James Ray',
      'hospital-supply@oceandirect.com', '+1 (555) 456-0123', 'active',
      ARRAY['fish', 'seafood', 'frozen_fillets'], NOW() - INTERVAL '3 days',
      CURRENT_DATE + INTERVAL '180 days', 4.7, 'Pier 45 Commercial Docks, San Francisco, CA'
    )
  ON CONFLICT (vendor_id) DO NOTHING;

  -- 12. Seed Food Wastage Logs
  INSERT INTO public.food_wastage_logs (
    log_id, hospital_id, date, meal_type,
    item_name, quantity_wasted, unit, cost_impact,
    reason, logged_by, created_at
  )
  VALUES
    (
      -- meal_type 'prep_waste' is valid, but REASON 'prep_waste' is not:
      -- food_wastage_logs_reason_check allows overproduction | spoilage |
      -- unconsumed_tray | expired_stock | damaged. The insert failed with
      -- SQLSTATE 23514 and rolled the whole migration back, so this seed had
      -- never run anywhere. 'damaged' is what the UI labels "Prep Damage".
      'wst-001', seed_hospital, CURRENT_DATE, 'prep_waste',
      'Butternut Squash Trimmings & Peels', 4.20, 'kg', 8.40,
      'damaged', 'Sous Chef Marco Bellini', NOW() - INTERVAL '5 hours'
    ),
    (
      'wst-002', seed_hospital, CURRENT_DATE, 'lunch',
      'Unconsumed Inpatient Tray Servings', 3.50, 'kg', 18.50,
      'unconsumed_tray', 'Dietary Lead Karen Walsh', NOW() - INTERVAL '2 hours'
    ),
    (
      'wst-003', seed_hospital, CURRENT_DATE, 'breakfast',
      'Overproduced Steel Cut Oatmeal', 2.10, 'kg', 6.30,
      'overproduction', 'Morning Cook Arthur Dent', NOW() - INTERVAL '8 hours'
    ),
    (
      'wst-004', seed_hospital, CURRENT_DATE - 1, 'dinner',
      'Expired Spinach Leaves from Prep Bay', 1.80, 'kg', 11.70,
      'spoilage', 'Kitchen Supervisor Dave Ross', NOW() - INTERVAL '26 hours'
    )
  ON CONFLICT (log_id) DO NOTHING;

  RAISE NOTICE 'Laboratory and Cafeteria demo datasets seeded successfully';
END $$;
