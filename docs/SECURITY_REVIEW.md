# MVP security review

Review scope: authentication, job secrets, external content, SSRF, redirects, response limits/timeouts, logs, secrets, dependencies and retention.

| Area | Release disposition |
| --- | --- |
| Owner authentication | Production database mode requires one allowlisted email plus a 32+ character shared secret over HTTP Basic. `proxy.ts` protects pages/routes; fixture preview is intentionally public/read-only. Platform TLS and rate limiting remain deployment controls. |
| State changes | Classification requires owner auth, JSON validation, a same-origin `Origin`, and an idempotent mutation UUID. Production fixture preview cannot mutate. |
| Job authentication | Jobs accept POST only, reject browser Cookie headers, compare a bearer secret without early string exit, return no secret details, and use no-store unauthorized responses. |
| Job overlap | Per-source/retention PostgreSQL advisory leases reject overlap; run keys and durable keys protect retries. |
| Untrusted content | Source-specific and canonical Zod validation, bounded strings/arrays, text sanitization, no `dangerouslySetInnerHTML`, hashed Reddit authors, and no instruction execution. |
| SSRF and links | Canonical URLs require public HTTP(S), no credentials, literal private/loopback ranges rejected, and retailer item links require source host allowlists. Provider base URLs require public HTTPS. Production product images are not server-fetched unless they are committed local assets. DNS rebinding protection remains the responsibility of an approved connector’s fixed host/egress policy. |
| Redirects | Reddit OAuth fetch rejects redirects. Approved retail provider connectors must do the same at their transport boundary. External UI links use `noopener noreferrer`. |
| Response/time bounds | Retail adapters enforce 15-second default timeout, 512 KB serialized payload cap, bounded pages/items/terms/cursors and no internal retry loop. Reddit has bounded pages/page size/response size, timeout and interval controls. |
| Browser policy | CSP, frame denial, content-type sniff prevention, referrer policy, permissions policy, HSTS and cross-origin opener policy are emitted by Next.js. |
| Logs/errors | Ingestion stores error codes and sanitized messages; provider exception strings, payloads and secrets are not returned. Status exposes counts/health but no credentials. Platform log access must be owner/admin only. |
| Secret scanning | GitHub gitleaks scans full history; `.env*` is ignored except `.env.example`. One exact fingerprint is ignored for a documented synthetic unit-test value; no path or rule is broadly exempted. Release validation also searches tracked files and runs dependency audit. |
| Dependencies | Exact versions and committed lockfile; safe scoped `esbuild` overrides remove Drizzle Kit's deprecated-loader advisory and keep Vite on its compatible release. CI runs a production dependency audit at high severity; the release audit reports zero findings across production and development dependencies. |
| Retention/takedown | Daily authenticated retention removes crowd excerpts, author hashes and raw pointers after the configured period; minimum external ID/content hash remains for idempotency. Source takedown can invoke the same redaction earlier. |
| Privacy | No home address, retailer credentials/cookies, production payload, private social data or multi-user profile system is stored. |

Accepted limitations for this single-user MVP: Basic auth has no self-service rotation/MFA/session UI, rate limiting is delegated to the hosting edge, and literal URL validation does not perform DNS resolution. Production remains unavailable for every external source until a connector receives a separate security/access review.
