-- The inbox is a triage surface, so triage has to be a fact the server knows.
-- Until now "ignore" only hid a row in React state and "keep" did nothing at all:
-- a refresh resurrected everything the user had just dismissed.
--
-- V15 already gave information a status (ACTIVE / ARCHIVED) and the per-user index,
-- so this only widens the vocabulary instead of adding a second status column:
--
--   ACTIVE   — arrived, waiting for a decision
--   KEPT     — the user decided to keep it (it stays in the review list)
--   ARCHIVED — dismissed by the user, or archived by the agent tool (same meaning)
ALTER TABLE information DROP CONSTRAINT IF EXISTS chk_information_status;
ALTER TABLE information ADD CONSTRAINT chk_information_status
  CHECK (status IN ('ACTIVE', 'KEPT', 'ARCHIVED'));
