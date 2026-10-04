CREATE TABLE IF NOT EXISTS user_feedback (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id  uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    type       text NOT NULL CHECK (type IN ('USEFUL','NOT_USEFUL','SAVE','IGNORE','IMPORTANT')),
    reason     text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, signal_id)
);
