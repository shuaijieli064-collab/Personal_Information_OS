-- SIGNAL · V5 Classification. Does NOT modify earlier migrations.

ALTER TABLE information_understanding ADD COLUMN IF NOT EXISTS confidence numeric(4,3);
