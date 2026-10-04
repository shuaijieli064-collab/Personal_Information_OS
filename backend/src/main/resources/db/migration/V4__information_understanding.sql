-- SIGNAL · V4 Information Understanding infrastructure. Does NOT modify V1/V2/V3.
-- Phase 5.1: schema + status only. No LLM/embedding here.

CREATE TABLE IF NOT EXISTS information_understanding (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    information_id      uuid NOT NULL UNIQUE REFERENCES information(id) ON DELETE CASCADE,
    language            text,
    content_type        text,
    classification      text,
    topics              jsonb NOT NULL DEFAULT '[]',
    entities            jsonb NOT NULL DEFAULT '[]',
    summary             text,
    understanding_status text NOT NULL DEFAULT 'PENDING'
                        CHECK (understanding_status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
    model               text,
    model_version       text,
    processed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_understanding_status ON information_understanding(understanding_status);
