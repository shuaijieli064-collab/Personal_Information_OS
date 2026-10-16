-- Phase 8: automation. A scheduled job per (user, type) with its run history, plus the
-- notification inbox the brief and the job runner feed. Statuses / types are text + CHECK
-- (there is no jsonb / enum mapping in this codebase); the notification payload is stored
-- as JSON text and read back by the service.

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                 text NOT NULL CHECK (type IN ('SOURCE_SYNC','DAILY_BRIEF','FEEDBACK_LOOP')),
    interval_minutes     int  NOT NULL,
    enabled              boolean NOT NULL DEFAULT true,
    last_run_at          timestamptz,
    next_run_at          timestamptz NOT NULL,
    consecutive_failures int  NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, type)
);

-- The tick's hot path: enabled jobs that are due.
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_due ON scheduled_jobs(next_run_at) WHERE enabled;

CREATE TABLE IF NOT EXISTS job_runs (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id      uuid NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      text NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED','DEAD')),
    attempt     int  NOT NULL DEFAULT 1,
    detail      text,
    error       text,
    started_at  timestamptz,
    finished_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_created ON job_runs(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);

CREATE TABLE IF NOT EXISTS notifications (
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       text NOT NULL CHECK (type IN ('DAILY_BRIEF','IMPORTANT_SIGNAL','JOB_FAILED')),
    title      text NOT NULL,
    body       text,
    read       boolean NOT NULL DEFAULT false,
    payload    text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
