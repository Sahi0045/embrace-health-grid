-- ============================================================================
-- Ambulance dispatch states the UI already uses
-- ============================================================================
-- `ambulances.status` is the shared `asset_status` enum
-- ('available','in-use','maintenance','retired'), but the ambulance console is
-- built around a five-stage dispatch pipeline: available -> en-route ->
-- at-scene -> returning -> available, with maintenance off to one side.
--
-- Three of those five are not enum members. So:
--   - the En-Route / At Scene / Returning buttons in the detail panel wrote an
--     invalid enum value and the update failed (silently — updateAmbulanceStatus
--     swallowed the error and still returned ok);
--   - the four dispatch KPI tiles filtered on those same values and were
--     therefore permanently 0/0/0, whatever the fleet was doing.
--
-- Adding the values to the shared enum rather than giving ambulances their own
-- type is a deliberate trade-off. It technically lets an X-ray machine be
-- 'at-scene', which is meaningless but harmless, and it avoids rewriting a
-- column that `equipment`, `beds` and `rooms` policies all reference. The
-- alternative — a separate dispatch_status column — is the better long-term
-- model, because availability and dispatch stage are really two axes; it is not
-- done here because it would require reworking every consumer of `status`, and
-- the immediate defect is that three buttons and four tiles do not work.
--
-- ALTER TYPE ... ADD VALUE is not transactional-safe if the new value is USED in
-- the same transaction. Nothing below uses them, so this is safe.

alter type asset_status add value if not exists 'en-route';
alter type asset_status add value if not exists 'at-scene';
alter type asset_status add value if not exists 'returning';

comment on type asset_status is
  'Status for physical assets. available|in-use|maintenance|retired apply to all of them; en-route|at-scene|returning are ambulance dispatch stages and are not meaningful for other asset types.';
