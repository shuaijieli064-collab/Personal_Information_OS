-- SIGNAL · V24 Realign the dedup tables with the V7 contract.
--
-- Why this exists: the V7 file was rewritten *after* it had already been applied to some
-- databases. Flyway records V7 as run and never revisits it, so those databases kept the
-- original shape (signal_clusters.canonical_url / canonical_title, signal_sources.signal_id
-- -> source_item_id) while a fresh rebuild gets the documented one. The two are not
-- interchangeable: same-event detection clusters by an *information* anchor.
--
-- This migration reconciles the drifted databases. It is a no-op on any database that
-- already has the V7 shape, so it is safe on a fresh rebuild too.
--
-- Nothing is dropped. The legacy tables are renamed to *_legacy and left alone — they hold
-- 17 rows no code reads, and guessing what they meant would be worse than keeping them.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'signal_sources' AND column_name = 'cluster_id'
    ) THEN
        RETURN; -- already the documented V7 shape; fresh-rebuild case
    END IF;

    ALTER TABLE signal_sources RENAME TO signal_sources_legacy;
    ALTER TABLE signal_clusters RENAME TO signal_clusters_legacy;

    -- Index names are schema-global: renaming a table does not rename its indexes, and the
    -- legacy table's index still owns the name the new one needs.
    IF EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'idx_cluster_user' AND relkind = 'i'
    ) THEN
        ALTER INDEX idx_cluster_user RENAME TO idx_cluster_user_legacy;
    END IF;

    ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_cluster_id_fkey;

    CREATE TABLE signal_clusters (
        id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title                text,
        anchor_information_id uuid REFERENCES information(id) ON DELETE SET NULL,
        confidence           numeric(4,3),
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_cluster_user ON signal_clusters(user_id);

    CREATE TABLE signal_sources (
        cluster_id     uuid NOT NULL REFERENCES signal_clusters(id) ON DELETE CASCADE,
        information_id uuid NOT NULL REFERENCES information(id) ON DELETE CASCADE,
        similarity     numeric(4,3),
        PRIMARY KEY (cluster_id, information_id)
    );

    ALTER TABLE signals ADD CONSTRAINT signals_cluster_id_fkey
        FOREIGN KEY (cluster_id) REFERENCES signal_clusters(id) ON DELETE SET NULL;
END $$;
