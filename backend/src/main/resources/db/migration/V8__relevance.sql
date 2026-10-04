ALTER TABLE information_understanding ADD COLUMN IF NOT EXISTS relevance_score numeric(4,1);
ALTER TABLE information_understanding ADD COLUMN IF NOT EXISTS why_relevant text;
