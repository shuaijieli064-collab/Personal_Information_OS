-- Phase 6 K1: long-term knowledge layer (docs/DATABASE.md "Knowledge (Phase 6)").

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id  uuid REFERENCES signals(id) ON DELETE SET NULL,
    title      text NOT NULL,
    body       text,
    concepts   jsonb NOT NULL DEFAULT '[]'::jsonb,
    embedding  vector(384),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user ON knowledge_entries(user_id);

CREATE TABLE IF NOT EXISTS knowledge_relations (
    id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_entry_id  uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    target_entry_id  uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    relation         text NOT NULL CHECK (relation IN ('related','part-of','learns-from')),
    weight           numeric(3,2),
    UNIQUE (source_entry_id, target_entry_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source ON knowledge_relations(source_entry_id);
