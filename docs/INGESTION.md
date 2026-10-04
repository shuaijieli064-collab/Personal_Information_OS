# Ingestion Architecture (Phase 4)

```
                 Source (user-owned: RSS / GITHUB / URL / FILE)
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      RssCollector   GithubCollector  UrlCollector   (File: parsed in ImportController)
          └──────────────┬──────────────┘
                         ▼
                    NormalizedItem   (title / clean text / url / author / publishedAt / type)
                         ▼
              IngestionPersister  (ONLY DB writes, @Transactional)
                 │ exact dedup: externalId → canonical URL → SHA-256
                 ▼
          SourceItem ──1:0..1──> Information  (clean content, provenance)
                         ▼
                    PostgreSQL
```

## Boundary
- External HTTP **never** runs inside a DB transaction. Collect → normalize → then persist.
- All collected bytes are `UNTRUSTED_CONTENT`: HTML stripped with Jsoup Safelist.none() before storage.
- **AI boundary**: Phase 4 calls no LLM. Understanding / classification / summary / semantic dedup = Phase 5.

## Security
- URL import: scheme whitelist (http/https), DNS-resolved IP checked against loopback / private / link-local / multicast / metadata (169.254.169.254).
- All fetches bounded: connect+read timeout 8s, max response 5 MB; file upload max 10 MB, extensions txt/md/pdf only.
- Redirect-SSRF: HttpFetcher follows redirects MANUALLY (HttpClient NEVER), and **re-runs UrlValidator on every hop** — public→localhost/private/metadata redirects are blocked. DNS-rebinding between resolve and connect remains DEFERRED.

## Dedup (exact only)
1. `(source_id, sha256(externalId or canonicalUrl))` on source_items — repeat sync = no duplicates.
2. `source_item_id UNIQUE` on information — one normalized item per raw item.
3. Semantic / embedding dedup is intentionally NOT here.

## Provenance
Every Information keeps source_id → source_item_id → original url, so Phase 6 Signals can always trace back.
