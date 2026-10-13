-- V18: restore source_items' unbounded text columns (content_text, url, title) to `text`.
--
-- Why: V1 defines these columns as `text` (and the sibling `information.content/excerpt`
-- columns are `text`), but this database's `source_items` table carries varchar(255) for
-- them — the whole table drifted from V1 (e.g. `lang` is varchar(255) instead of V1's
-- varchar(8)). Hibernate schema validation accepts both `text` and `varchar` as VARCHAR,
-- so the drift was silent until runtime.
--
-- Impact of the drift: importing any item whose body exceeds 255 characters fails with
--   ERROR: value too long for type character varying(255)
-- i.e. every real article / README / file import is rejected. Long URLs and titles have
-- the same failure mode.
--
-- Idempotent: ALTER … TYPE text is a no-op when the column is already `text`.
-- Only widens columns — no data is lost and no constraint is affected
-- (the source_items uniqueness is on (source_id, url_hash), which is untouched).

ALTER TABLE source_items ALTER COLUMN content_text TYPE text;
ALTER TABLE source_items ALTER COLUMN url          TYPE text;
ALTER TABLE source_items ALTER COLUMN title        TYPE text;
