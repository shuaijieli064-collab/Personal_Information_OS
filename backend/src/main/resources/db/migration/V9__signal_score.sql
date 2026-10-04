ALTER TABLE information_understanding ADD COLUMN IF NOT EXISTS signal_score numeric(4,1);
ALTER TABLE information_understanding ADD COLUMN IF NOT EXISTS score_factors jsonb NOT NULL DEFAULT '{}';
