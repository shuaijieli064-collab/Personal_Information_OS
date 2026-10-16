-- Phase 7: tool-using agent. An agent run plus its append-only step audit trail.
-- Statuses are text + CHECK (there is no jsonb / enum mapping in this codebase); the
-- arguments / result payloads are stored as JSON text and parsed back by the service.

CREATE TABLE IF NOT EXISTS agent_runs (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal       text NOT NULL,
    status     text NOT NULL CHECK (status IN ('PLANNING','RUNNING','AWAITING_CONFIRMATION','COMPLETED','FAILED','REJECTED')),
    answer     text,
    model      text,
    error      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created ON agent_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_steps (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id      uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    seq         int  NOT NULL,
    tool_name   text,
    permission  text,
    arguments   text,
    result      text,
    status      text NOT NULL CHECK (status IN ('PLANNED','PENDING_CONFIRMATION','RUNNING','SUCCEEDED','FAILED','SKIPPED','REJECTED')),
    rationale   text,
    error       text,
    started_at  timestamptz,
    finished_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_steps(run_id, seq);
