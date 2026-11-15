# Research records

## Schema and migrations

`lab.research_records` uses an application-generated UUID, nonblank title (120), summary (500), content (20,000), and a DB-generated `timestamptz` creation time. Ordering is `created_at DESC, id DESC` with a matching index. The first version intentionally omits users, tags, editing and deletion. No sample records are inserted by migrations.

Flyway runs explicitly via the Maven plugin, separately from application startup. The app never receives migration credentials. Use the existing development SSH tunnel and Java 17 / Maven:

```powershell
.\deploy\migrate-dev.ps1 info
.\deploy\migrate-dev.ps1 migrate
.\deploy\migrate-dev.ps1 validate
```

`STLAB_MAVEN_CMD` may point to a local Maven executable. The helper accepts only these three actions, always selects the development DB and migration credential file, then restores the caller's DB environment variables. Do not run Maven with debug output while credentials are present.

`clean` and automatic baseline are disabled; existing schemas are not created automatically. Applied versioned SQL must not be edited; add V2, V3, etc. for changes. The initial migration removes runtime access to Flyway history because the provisioned default privileges otherwise grant table DML. The runtime role keeps its research table DML without schema CREATE rights.

Production migrations are not run in this chapter. Plan backup, validation and a separate migration step before deploying the API there. Shared-instance failure isolation remains unchanged.

## API and development UI

- `GET /api/research-records?limit=20&offset=0`: summaries in creation-time/UUID descending order, `items` and `hasMore`. Limit 1–50, offset 0–10,000. Offset pages can shift during concurrent inserts.
- `GET /api/research-records/{uuid}`: full content; missing record 404, malformed ID 400.
- `POST /api/research-records`: accepts title, summary and content; returns 201 and Location. This controller is absent by default. `deploy/dev-env.ps1` enables it only for localhost development. Do not enable it on a public deployment before authentication/authorization is implemented.
- Database failures return a fixed 503 problem response. No editing/deletion API is implemented.
- Vite proxies `/api` to the localhost backend; production nginx already proxies `/api`. No broad CORS policy is added.
- The React dialog displays loading, empty, error/retry, summary pages and detail text. Closing it aborts active fetches. HTML content is rendered as React text, not injected markup.

Local sequence: open the existing SSH tunnel, run `migrate-dev.ps1`, load `dev-env.ps1` in the backend process, then start the Java 17 backend and Vite frontend. Set `JAVA_HOME` and Maven's executable path for your machine. Password files remain outside the repository.

CI uses a disposable PostgreSQL 18 service and test-only credentials from `backend/src/test/resources/bootstrap-ci.sql`; they are not deployment credentials. `backend/tests/research-api.mjs` requires `TEST_DATABASE_DISPOSABLE=true` because it inserts fixture records and leaves them in the disposable DB. Do not run it against development or production data. The suite checks creation, detail roundtrip, pagination boundaries, validation and 404s. Local development HTTP/browser verification uses separately tracked fixtures which are removed afterwards.
