-- Phase 6 backlog (ROADMAP): Information archive action — status column + list filter support.

ALTER TABLE information ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE information DROP CONSTRAINT IF EXISTS chk_information_status;
ALTER TABLE information ADD CONSTRAINT chk_information_status CHECK (status IN ('ACTIVE','ARCHIVED'));

CREATE INDEX IF NOT EXISTS idx_information_user_status ON information(user_id, status);
