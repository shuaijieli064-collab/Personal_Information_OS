ALTER TABLE information_understanding ADD COLUMN IF NOT EXISTS key_points jsonb NOT NULL DEFAULT '[]';
