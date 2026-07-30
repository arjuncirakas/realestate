# Deployment — WP12

Google Cloud Run for both services, Cloud SQL for Postgres with PostGIS, Cloud
Storage for uploaded media. Everything below assumes `PROJECT_ID`, `REGION`
(e.g. `asia-south1`) and an Artifact Registry repository called `estate`.

---

## 1. What ships

| Service | Image | Serves |
| --- | --- | --- |
| `estate-api` | `backend/Dockerfile` | Express API on `/api/v1`, `/health` |
| `estate-web` | `frontend/Dockerfile` | nginx serving the Vite build |

Service definitions are in `deploy/cloud-run/`. Apply with:

```bash
gcloud run services replace deploy/cloud-run/api.service.yaml --region="$REGION"
gcloud run services replace deploy/cloud-run/web.service.yaml --region="$REGION"
```

### Building

The API image builds from `backend/`:

```bash
docker build -f backend/Dockerfile -t "$REGION-docker.pkg.dev/$PROJECT_ID/estate/api:$TAG" backend
```

**The web image builds from the repository root**, not from `frontend/`:

```bash
docker build -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL="https://api.estate.example.com/api/v1" \
  --build-arg VITE_GOOGLE_MAPS_API_KEY="$MAPS_BROWSER_KEY" \
  -t "$REGION-docker.pkg.dev/$PROJECT_ID/estate/web:$TAG" .
```

`frontend/src/contracts/` is generated and gitignored (Section 9.4), so a fresh
checkout does not contain it. The web build copies `backend/src/contracts/` plus
the sync script and regenerates it, then runs `contracts:sync --check` to prove
the two trees agree before spending the rest of the build. That is why the
backend tree has to be inside the build context.

**`VITE_*` values are baked in at build time.** Vite substitutes them into the
bundle; they are not runtime environment. Pointing the front end at a different
API, or rotating the browser Maps key, requires a rebuild and redeploy — not a
service update.

---

## 2. Cloud SQL

Create a Postgres 16 instance and enable the extensions the schema needs.

```bash
gcloud sql instances create estate-db \
  --database-version=POSTGRES_16 --region="$REGION" \
  --tier=db-custom-1-3840 --storage-type=SSD --storage-size=20GB \
  --availability-type=ZONAL --backup --backup-start-time=19:00

gcloud sql databases create estate --instance=estate-db
gcloud sql users create estate --instance=estate-db --password="$DB_PASSWORD"
```

### Connection string

Cloud Run connects over a **unix socket**, not TCP. The
`run.googleapis.com/cloudsql-instances` annotation in `api.service.yaml` mounts
the instance at `/cloudsql/<connection-name>`, and Prisma addresses it through
the `host` query parameter:

```
postgresql://estate:PASSWORD@localhost/estate?host=/cloudsql/PROJECT_ID:REGION:estate-db&schema=public
```

Store that whole string in Secret Manager as `estate-database-url`. Two things
about it are easy to get wrong: the host component of the URL stays `localhost`
(it is ignored), and the socket directory goes in `?host=`, not in the authority.

### Extensions

`postgis`, `citext` and `pgcrypto` are created by the first migration
(`20260730000100_init_extensions`), so `migrate deploy` handles them. On Cloud
SQL, `postgis` must also be allow-listed on the instance:

```bash
gcloud sql instances patch estate-db --database-flags=cloudsql.enable_postgis=on
```

### Migrations

**Migrations do not run on container start.** Several Cloud Run instances boot
concurrently and would race each other. Run them as a discrete step before
routing traffic to the new revision:

```bash
gcloud run jobs create estate-migrate \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/estate/api:$TAG" \
  --region "$REGION" \
  --set-cloudsql-instances "$PROJECT_ID:$REGION:estate-db" \
  --set-secrets DATABASE_URL=estate-database-url:latest \
  --command npx --args "prisma,migrate,deploy"

gcloud run jobs execute estate-migrate --region "$REGION" --wait
```

Read `backend/prisma/README.md` before generating any new migration. Three
database objects are not represented in `schema.prisma` — the lat/lng sync
trigger and two GIST indexes — and a generated migration will try to drop the
indexes. That file documents the exact `migrate diff` command to see the
expected noise.

### Seeding

`db:seed` is idempotent and safe to re-run, but it creates **test accounts with
a known password**. Never run it against production.

---

## 3. Cloud Storage

Uploaded media moves from the local filesystem driver to GCS in production. The
switch is `STORAGE_DRIVER=gcs` — `services/storage.js` imports
`services/storage-gcs.js` dynamically only when that is set, so the SDK is never
loaded in development.

```bash
gcloud storage buckets create "gs://estate-media-$PROJECT_ID" \
  --location="$REGION" --uniform-bucket-level-access

# Objects are served directly to browsers; the app stores the public URL.
gcloud storage buckets add-iam-policy-binding "gs://estate-media-$PROJECT_ID" \
  --member=allUsers --role=roles/storage.objectViewer

# Only the API's service account writes.
gcloud storage buckets add-iam-policy-binding "gs://estate-media-$PROJECT_ID" \
  --member="serviceAccount:estate-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin
```

CORS is only needed if the browser fetches objects with credentials; plain
`<img src>` does not require it. Add a policy only if that changes.

Storage keys are server-generated (`prefix/uuid.ext`, extension derived from the
allow-listed MIME type, never from the uploaded filename), so a bucket listing
reveals nothing about who uploaded what.

---

## 4. Secrets

| Secret | Contents |
| --- | --- |
| `estate-database-url` | the full Cloud SQL connection string above |
| `estate-jwt-access-secret` | ≥32 random characters |
| `estate-jwt-refresh-secret` | ≥32 random characters, different from the access secret |
| `estate-geocoding-api-key` | server-side Maps key, **unrestricted by referrer** |

```bash
printf '%s' "$(openssl rand -hex 32)" | \
  gcloud secrets create estate-jwt-access-secret --data-file=-
```

`config/env.js` refuses to boot in production if either JWT secret still
contains a placeholder marker (`change-me`, `dev-only`, `test-`), so a
half-configured deploy fails immediately and loudly rather than running with a
guessable signing key.

---

## 5. Google Maps keys (Section 7.3)

**Two separate keys.** They are not interchangeable.

| Key | Used by | Restriction |
| --- | --- | --- |
| Browser key | `VITE_GOOGLE_MAPS_API_KEY`, baked into the web bundle | **HTTP referrer** restricted to the web domain; enable only Maps JavaScript API and Static Maps API |
| Server key | `GEOCODING_API_KEY`, Secret Manager | No referrer restriction (server-side has no referrer); enable only Geocoding API. **Never** ship this to the browser |

The browser key is readable by anyone who loads the site — referrer restriction
is the only thing preventing its use elsewhere, so it must be set before launch.

Set a billing budget with alerts on the project. Maps is the largest recurring
cost, and the code-side controls (Static Maps for cards, one interactive map per
page, 500 ms viewport debounce, 5-minute cache on rounded bounds) bound usage
per session but not the number of sessions.

---

## 6. Deploy order

1. `docker build` both images and push to Artifact Registry.
2. Run `estate-migrate` and wait for it to succeed.
3. `gcloud run services replace` the API, then the web service.
4. Check `https://api.../health` returns `{"data":{"status":"ok",...}}`.
5. Sign in through the web service and load one plot detail page — that exercises
   the API, the database, the storage URLs and CORS in one path.

Roll back by routing traffic to the previous revision:

```bash
gcloud run services update-traffic estate-api --region "$REGION" --to-revisions=PREVIOUS=100
```

Migrations do not roll back automatically. Keep them additive so the previous
revision keeps working against the new schema — that is what makes a traffic
rollback survivable.

---

## 7. What is deliberately not here

- **No CDN or custom domain mapping.** Both are Cloud Run domain-mapping or load
  balancer configuration and depend on the DNS the agency actually owns.
- **No Terraform.** The spec asks for deployment notes and service config; a
  second source of truth for infrastructure is a decision for the project owner.
- **No transactional email.** Section 15 leaves the provider undecided; a mailer
  stub is all the code expects.
