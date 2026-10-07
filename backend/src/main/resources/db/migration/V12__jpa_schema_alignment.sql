-- V12: Align the migration-built schema with the JPA entities (Phase 5 frozen set).
--
-- Why: the long-running dev database was partly shaped by an earlier Hibernate
-- "update" run (varchar/double precision/text columns, audit timestamps), while
-- V1-V11 alone never produced a schema that passes `spring.jpa.hibernate.ddl-auto=validate`
-- on an empty database. This migration closes that gap so a from-scratch rebuild
-- starts cleanly. Every statement is guarded/idempotent: on the existing database
-- the target shape is already in place and each statement is a no-op.
--
-- Decisions:
--   * audit timestamps use timestamptz NOT NULL DEFAULT now() (entities write explicit values).
--   * numeric(…) score/weight columns become double precision to match entity double/Double.
--   * jsonb payload columns become text: every JPA field mapping is String
--     (several with columnDefinition = "text"), the working dev DB stores them as
--     text, and no SQL in the codebase uses jsonb operators or GIN indexes.
--     Phase 6 may reintroduce jsonb together with entity/query changes (V13+).

-- 1) Missing audit timestamps ------------------------------------------------
ALTER TABLE goals         ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE goals         ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE interests     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) numeric -> double precision (entity double/Double) -----------------------
ALTER TABLE interests
    ALTER COLUMN weight TYPE double precision USING weight::double precision;
ALTER TABLE information_understanding
    ALTER COLUMN confidence TYPE double precision USING confidence::double precision;
ALTER TABLE information_understanding
    ALTER COLUMN relevance_score TYPE double precision USING relevance_score::double precision;
ALTER TABLE information_understanding
    ALTER COLUMN signal_score TYPE double precision USING signal_score::double precision;
ALTER TABLE signals
    ALTER COLUMN signal_score TYPE double precision USING signal_score::double precision;

-- 3) jsonb -> text (entity String payloads) -----------------------------------
ALTER TABLE information
    ALTER COLUMN metadata TYPE text USING metadata::text;
ALTER TABLE sources
    ALTER COLUMN config TYPE text USING config::text;
ALTER TABLE source_items
    ALTER COLUMN raw TYPE text USING raw::text;
ALTER TABLE information_understanding
    ALTER COLUMN topics TYPE text USING topics::text;
ALTER TABLE information_understanding
    ALTER COLUMN entities TYPE text USING entities::text;
ALTER TABLE information_understanding
    ALTER COLUMN key_points TYPE text USING key_points::text;
ALTER TABLE information_understanding
    ALTER COLUMN score_factors TYPE text USING score_factors::text;
