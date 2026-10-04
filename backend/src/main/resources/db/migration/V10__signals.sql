DROP TABLE IF EXISTS signals CASCADE;

CREATE TABLE signals (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster_id     uuid REFERENCES signal_clusters(id) ON DELETE SET NULL,
    information_id uuid NOT NULL REFERENCES information(id) ON DELETE CASCADE,
    title          text NOT NULL,
    summary        text,
    signal_score   numeric(4,1),
    why_it_matters text,
    urgency        text,
    status         text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SAVED','IMPORTANT','ARCHIVED')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signal_user ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_score ON signals(user_id, signal_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_information ON signals(information_id);
