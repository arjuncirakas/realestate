# Estate Platform — Build Requirements

**Version:** 2.0
**Document status:** authoritative spec for the MVP build
**Audience:** Claude Code agents working in parallel
**Location:** `docs/PROJECT_REQUIREMENTS.md`

**Changed in v2.0:** stack is JavaScript (ESM), not TypeScript. Tailwind v4 CSS-first configuration replaces `tailwind.config.js`. Shared contracts are now zod schema modules rather than TypeScript types. Section 14 (agent team operating procedure) is new.

---

## 0. How to use this document

This is the single source of truth. If an instruction in a chat prompt conflicts with this file, this file wins — raise the conflict rather than silently diverging.

**Critical rule for parallel work:** Work Package 0 (Section 13) must be completed and merged by a single agent *before* any other agent starts. Everything downstream depends on the database schema, the shared contract schemas, and the error conventions being frozen first. Agents that start before WP0 lands will produce code that does not compose.

Each agent owns an exclusive set of file paths, listed in Section 13. Do not create or edit files outside your assigned paths. If you need a change in someone else's territory, stop and report it to the team lead.

---

## 1. Product overview

A web platform for a real estate agency dealing primarily in land plots. It serves three audiences:

- **Public visitors and subscribers** browse plots for sale, save favourites, enquire, and book site visits.
- **Property owners** (subscribers who have bought) view their holdings, the agency's management activity on their land, and periodic site photographs.
- **Agents and admins** manage listings, media, enquiries, visits, ownership records, and management logs.

The agency also markets some plots as group-purchase opportunities. In this MVP the platform records *expressions of interest only* — it never takes, holds, or moves money.

### 1.1 In scope

| Area | Included |
|---|---|
| Public catalogue | Listing grid, filters, map search, detail pages, image galleries |
| Accounts | Email/password registration, login, JWT sessions, roles |
| Subscriber portal | Saved plots, enquiry history, site visit requests |
| Group purchase | Offer pages, expression-of-interest register, agent follow-up queue |
| Owner dashboard | Owned plots, ownership records, management logs, site photo timeline |
| Agent panel | Listing CRUD, media upload, enquiry/visit/interest queues, log entry |
| Infrastructure | Dockerised Postgres + PostGIS, seed data, env config, deploy notes |

### 1.2 Explicitly out of scope

Do not build these. Do not add placeholder UI hinting at them beyond what is specified.

- Any payment processing, escrow, wallet, or transaction handling
- Live video streaming from site cameras
- Native mobile applications
- Real KYC/identity verification integration
- SMS OTP delivery (the schema reserves a `phone` field; no SMS provider is wired up)
- Automated valuation, price prediction, or recommendation engines
- Multi-language support

### 1.3 Non-negotiable content rule

The group-purchase feature is an enquiry mechanism, not an investment product. All copy in that flow — page headings, button labels, form text, confirmation messages, emails — must use the language of *registering interest*. The following are prohibited anywhere in the codebase, including seed data and placeholder copy:

- Any stated, projected, guaranteed, or historical **return, yield, ROI, or appreciation figure**
- The words "invest", "investment", "investor", "shares", "units", "portfolio returns", "dividend"
- Countdown timers, funding progress bars expressed in money raised, or "X spots left" urgency devices
- Any implication that submitting the form creates a binding commitment or entitlement

Approved vocabulary: "register your interest", "indicative amount", "the agency will contact you", "group purchase opportunity", "enquiry". If you are unsure whether a phrase crosses the line, use the plainer wording.

---

## 2. Technology stack

Pinned. Do not substitute libraries without raising it first.

### 2.1 Language

**JavaScript with ES modules throughout — both frontend and backend.** No TypeScript, no build step on the backend, no `.ts` files anywhere.

Both `package.json` files declare `"type": "module"`. Backend uses `import`/`export`, never `require`.

Because there is no compiler enforcing shapes across the frontend/backend boundary, **zod schemas are the contract** (Section 2.4). This is not optional bookkeeping — it is the mechanism that keeps parallel agents from drifting.

### 2.2 Frontend (`/frontend` — already scaffolded)

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite |
| Language | JavaScript ESM, `.jsx` for components, `.js` for modules |
| Styling | Tailwind CSS **v4** via `@tailwindcss/vite` (already installed) |
| Routing | `react-router-dom` v6 |
| Server state | `@tanstack/react-query` v5 |
| Forms | `react-hook-form` + `zod` via `@hookform/resolvers` |
| HTTP | `axios` with a single configured instance |
| Maps | `@vis.gl/react-google-maps` |
| Icons | `lucide-react` |
| Dates | `date-fns` |
| Toasts | `sonner` |
| Editor support | `jsconfig.json` with `baseUrl: "src"` for path resolution |

Do not add a global state library. React Query handles server state; `useState`/`useContext` handles the rest.

Do not add `typescript`, `tsc`, or `@types/*` packages.

### 2.3 Backend (`/backend` — empty, build from scratch)

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 4 |
| Language | JavaScript ESM |
| ORM | Prisma |
| Geo queries | Raw SQL via `prisma.$queryRaw` (Prisma has no native PostGIS support) |
| Validation | `zod` on every request boundary |
| Auth | `jsonwebtoken` + `bcrypt` |
| File upload | `multer` (memory storage) behind a storage adapter |
| Logging | `pino` + `pino-http` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Testing | `vitest` + `supertest` |
| Dev server | `node --watch src/server.js` — no nodemon, no ts-node |

### 2.4 The contract mechanism

`backend/src/contracts/` is the single source of truth for every data shape crossing the API boundary. It contains only zod schemas and frozen enum objects — no imports from anywhere else in the codebase, no side effects.

```
backend/src/contracts/
├── enums.js               <- frozen enum objects
├── auth.contract.js
├── property.contract.js
├── media.contract.js
├── engagement.contract.js <- enquiries, visits, saved, interests
├── ownership.contract.js
├── envelope.contract.js   <- success/error/pagination envelopes
└── index.js               <- re-exports everything
```

Each domain file exports request and response schemas, for example:

```js
export const PropertyCreateSchema = z.object({ /* ... */ });
export const PropertyUpdateSchema = PropertyCreateSchema.partial();
export const PropertyResponseSchema = z.object({ /* ... */ });
export const PropertyListQuerySchema = z.object({ /* ... */ });
```

**Two rules make this work:**

1. **Frontend consumes the same files.** `npm run contracts:sync` copies `backend/src/contracts/` to `frontend/src/contracts/`. CI runs `npm run contracts:check`, which re-copies to a temp directory and fails the build if the two trees differ. Never hand-edit `frontend/src/contracts/`.
2. **Response schemas are asserted in tests.** Every integration test parses its response body through the matching response schema:
   ```js
   const parsed = PropertyResponseSchema.safeParse(res.body.data);
   expect(parsed.success).toBe(true);
   ```
   This is what turns the contract from documentation into enforcement. An agent that returns a differently-shaped object fails its own test suite.

Only WP0 may create or change files in `contracts/`. Any other agent needing a contract change stops and reports it to the lead.

### 2.5 Data and storage

- PostgreSQL 16 with the **PostGIS** extension enabled
- Object storage behind an adapter interface: local filesystem in development, Google Cloud Storage in production. Application code must never import the GCS SDK directly — it talks to the adapter only.

---

## 3. Repository layout

```
/
├── CLAUDE.md                         <- agent operating rules (see Section 14.2)
├── .claude/
│   ├── settings.json
│   └── agents/                       <- teammate role definitions
├── docs/
│   ├── PROJECT_REQUIREMENTS.md       <- this file
│   └── API.md                        <- maintained as endpoints land
├── frontend/
│   ├── jsconfig.json
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── src/
│   │   ├── api/                      <- axios client + one hook module per domain
│   │   ├── contracts/                <- GENERATED, do not edit
│   │   ├── components/
│   │   │   ├── ui/                   <- primitives (Button, Input, Card...)
│   │   │   ├── layout/               <- PublicShell, DashboardShell, AdminShell
│   │   │   └── property/             <- domain components
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── catalogue/
│   │   │   ├── subscriber/
│   │   │   ├── owner/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── lib/                      <- formatters, constants, utils
│   │   ├── routes/                   <- route config + guards
│   │   ├── index.css                 <- Tailwind v4 import + @theme tokens
│   │   ├── App.jsx
│   │   └── main.jsx
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── src/
│   │   ├── config/                   <- env parsing, constants
│   │   ├── contracts/                <- zod schemas, WP0 only
│   │   ├── middleware/               <- auth, error handler, validate, upload
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── properties/
│   │   │   ├── media/
│   │   │   ├── enquiries/
│   │   │   ├── visits/
│   │   │   ├── saved/
│   │   │   ├── interests/
│   │   │   ├── ownership/
│   │   │   └── logs/
│   │   ├── services/                 <- storage adapter, mailer stub
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── scripts/
│   │   └── sync-contracts.js
│   └── tests/
├── docker-compose.yml
└── README.md
```

Each backend module folder contains exactly: `*.routes.js`, `*.controller.js`, `*.service.js`, and optionally `*.helpers.js`. Validation schemas live in `contracts/`, not in the module.

---

## 4. Database schema

PostgreSQL 16 + PostGIS. This section is authoritative. WP0 translates it into `schema.prisma` plus a raw-SQL migration for the PostGIS columns, trigger, and indexes.

### 4.1 Enums

Mirror each of these in `contracts/enums.js` as a frozen object plus a matching `z.enum`.

```
UserRole            SUBSCRIBER | AGENT | ADMIN
PropertyType        PLOT | HOUSE | APARTMENT | COMMERCIAL | FARMLAND
PropertyStatus      DRAFT | AVAILABLE | UNDER_OFFER | SOLD | WITHDRAWN
AreaUnit            SQFT | SQM | CENT | ACRE | HECTARE
MediaType           IMAGE | VIDEO | DOCUMENT | TOUR_360
EnquiryStatus       NEW | CONTACTED | QUALIFIED | CLOSED
VisitStatus         REQUESTED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
InterestStatus      NEW | CONTACTED | QUALIFIED | WITHDRAWN | CLOSED
LogType             INSPECTION | MAINTENANCE | TAX | LEGAL | BOUNDARY | OTHER
VisitSlot           MORNING | AFTERNOON | EVENING
```

### 4.2 Tables

**users**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| email | citext UNIQUE NOT NULL | |
| phone | varchar(20) | nullable, reserved for future OTP |
| password_hash | text NOT NULL | bcrypt, cost 12 |
| full_name | varchar(120) NOT NULL | |
| role | UserRole NOT NULL | default `SUBSCRIBER` |
| is_active | boolean NOT NULL | default true |
| created_at / updated_at | timestamptz NOT NULL | |

**properties**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | varchar(160) UNIQUE NOT NULL | generated from title + short id |
| title | varchar(160) NOT NULL | |
| description | text | |
| property_type | PropertyType NOT NULL | |
| status | PropertyStatus NOT NULL | default `DRAFT` |
| price | numeric(14,2) NOT NULL | INR |
| price_is_negotiable | boolean | default false |
| area_value | numeric(12,2) NOT NULL | |
| area_unit | AreaUnit NOT NULL | |
| address_line | varchar(255) | |
| locality | varchar(120) | |
| city | varchar(120) NOT NULL | |
| district | varchar(120) | |
| state | varchar(120) NOT NULL | |
| pincode | varchar(10) | |
| latitude | double precision NOT NULL | |
| longitude | double precision NOT NULL | |
| location | `geography(Point,4326)` | maintained by trigger from lat/lng |
| boundary | `geography(Polygon,4326)` | nullable |
| survey_number | varchar(80) | |
| amenities | jsonb | default `[]`, array of strings |
| is_group_purchase | boolean NOT NULL | default false |
| group_target_amount | numeric(14,2) | nullable |
| group_min_ticket | numeric(14,2) | nullable |
| listed_by_agent_id | uuid FK → users.id | |
| view_count | integer NOT NULL | default 0 |
| published_at | timestamptz | nullable |
| created_at / updated_at | timestamptz NOT NULL | |

Indexes: `slug`, `status`, `city`, `property_type`, `price`, GIST on `location`, GIST on `boundary`, composite `(status, published_at DESC)`.

**property_media**

id uuid PK · property_id uuid FK CASCADE · type MediaType · storage_key text · url text · caption varchar(255) · sort_order int default 0 · is_cover boolean default false · created_at timestamptz

Constraint: at most one `is_cover = true` per property (partial unique index).

**enquiries**

id uuid PK · property_id uuid FK · user_id uuid FK nullable (guest enquiries allowed) · name varchar(120) · email citext · phone varchar(20) · message text · status EnquiryStatus default NEW · assigned_agent_id uuid FK nullable · agent_notes text · created_at · updated_at

**site_visits**

id uuid PK · property_id uuid FK · user_id uuid FK NOT NULL · preferred_date date NOT NULL · preferred_slot VisitSlot · contact_phone varchar(20) · status VisitStatus default REQUESTED · confirmed_at timestamptz · agent_notes text · created_at · updated_at

**saved_properties**

user_id uuid FK · property_id uuid FK · created_at — composite PK `(user_id, property_id)`

**interest_registrations**

id uuid PK · property_id uuid FK · user_id uuid FK NOT NULL · indicative_amount numeric(14,2) · notes text · status InterestStatus default NEW · agent_notes text · created_at · updated_at

Unique constraint on `(property_id, user_id)` — one open registration per person per property.

**ownerships**

id uuid PK · property_id uuid FK · owner_user_id uuid FK · share_percentage numeric(5,2) NOT NULL default 100.00 · registered_on date · document_ref varchar(120) · notes text · created_at · updated_at

Application-level check: total `share_percentage` per property must not exceed 100.

**management_logs**

id uuid PK · property_id uuid FK · agent_id uuid FK · log_type LogType · title varchar(160) · notes text · occurred_on date NOT NULL · is_visible_to_owner boolean default true · created_at · updated_at

**management_log_media**

id uuid PK · log_id uuid FK CASCADE · storage_key text · url text · caption varchar(255) · created_at

**plot_snapshots**

id uuid PK · property_id uuid FK · captured_at timestamptz NOT NULL · storage_key text · url text · source varchar(40) default `'MANUAL'` · created_at

Index on `(property_id, captured_at DESC)`. In the MVP these are uploaded manually by agents; the table is shaped so an automated camera feed can write to it later without migration.

**refresh_tokens**

id uuid PK · user_id uuid FK CASCADE · token_hash text NOT NULL · expires_at timestamptz NOT NULL · revoked_at timestamptz · created_at

### 4.3 Geo query reference

Radius search — agents must use this pattern rather than inventing their own:

```sql
SELECT id FROM properties
WHERE status = 'AVAILABLE'
  AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
ORDER BY location <-> ST_MakePoint($1, $2)::geography
LIMIT $4;
```

Bounding-box search for the map viewport:

```sql
SELECT id, title, latitude, longitude, price
FROM properties
WHERE status = 'AVAILABLE'
  AND location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography;
```

`location` is kept in sync with `latitude`/`longitude` by a database trigger created in WP0. Application code writes lat/lng only.

---

## 5. API contract

Base path `/api/v1`. JSON only. All timestamps ISO 8601 UTC.

### 5.1 Response envelope

Success:
```json
{ "data": { }, "meta": { } }
```

Paginated success:
```json
{ "data": [], "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 } }
```

Error — every non-2xx response, without exception:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, safe to display",
    "details": [{ "field": "email", "message": "Invalid email address" }]
  }
}
```

Error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

Never leak stack traces, SQL, or Prisma error text to the client. Log the detail server-side, return a generic message.

### 5.2 Endpoints

Auth (`/auth`) — public unless noted:

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create subscriber account, return tokens |
| POST | `/auth/login` | Return access + refresh tokens |
| POST | `/auth/refresh` | Exchange refresh token |
| POST | `/auth/logout` | Revoke refresh token (auth) |
| GET | `/auth/me` | Current user profile (auth) |
| PATCH | `/auth/me` | Update name/phone (auth) |

Properties (`/properties`):

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/properties` | public | Paginated, filtered list |
| GET | `/properties/map` | public | Lightweight pins for viewport |
| GET | `/properties/:slug` | public | Full detail, increments view count |
| POST | `/properties` | agent | Create (status DRAFT) |
| PATCH | `/properties/:id` | agent | Update |
| POST | `/properties/:id/publish` | agent | DRAFT → AVAILABLE, sets published_at |
| DELETE | `/properties/:id` | admin | Soft delete → WITHDRAWN |
| GET | `/properties/admin/list` | agent | All statuses, agent's own view |

`GET /properties` query parameters: `q`, `type`, `status`, `minPrice`, `maxPrice`, `minArea`, `maxArea`, `areaUnit`, `city`, `locality`, `groupPurchaseOnly`, `lat`, `lng`, `radiusKm`, `sort` (`newest`|`priceAsc`|`priceDesc`|`areaDesc`), `page`, `limit` (max 50).

Media:

| Method | Path | Access |
|---|---|---|
| POST | `/properties/:id/media` | agent — multipart, max 10 files, 10 MB each |
| PATCH | `/media/:id` | agent — caption, sort_order, is_cover |
| DELETE | `/media/:id` | agent |

Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `application/pdf`. Reject everything else with `VALIDATION_ERROR`.

Enquiries:

| Method | Path | Access |
|---|---|---|
| POST | `/properties/:id/enquiries` | public, rate-limited |
| GET | `/enquiries` | agent — filter by status, property |
| PATCH | `/enquiries/:id` | agent — status, assignment, notes |
| GET | `/me/enquiries` | auth |

Site visits:

| Method | Path | Access |
|---|---|---|
| POST | `/properties/:id/site-visits` | auth |
| GET | `/me/site-visits` | auth |
| PATCH | `/me/site-visits/:id/cancel` | auth (own only) |
| GET | `/site-visits` | agent |
| PATCH | `/site-visits/:id` | agent — confirm, complete, notes |

Saved properties:

| Method | Path | Access |
|---|---|---|
| GET | `/me/saved` | auth |
| POST | `/me/saved/:propertyId` | auth (idempotent) |
| DELETE | `/me/saved/:propertyId` | auth |

Interest registrations:

| Method | Path | Access |
|---|---|---|
| POST | `/properties/:id/interest` | auth — 409 if one already open |
| GET | `/me/interests` | auth |
| PATCH | `/me/interests/:id/withdraw` | auth (own only) |
| GET | `/interests` | agent |
| PATCH | `/interests/:id` | agent — status, notes |

Ownership and management:

| Method | Path | Access |
|---|---|---|
| GET | `/me/properties` | auth — properties the user owns |
| GET | `/me/properties/:id` | auth — detail + ownership record |
| GET | `/me/properties/:id/logs` | auth — visible logs only |
| GET | `/me/properties/:id/snapshots` | auth — paginated by date desc |
| POST | `/properties/:id/ownerships` | agent |
| PATCH | `/ownerships/:id` | agent |
| DELETE | `/ownerships/:id` | admin |
| POST | `/properties/:id/logs` | agent |
| PATCH | `/logs/:id` | agent |
| POST | `/logs/:id/media` | agent — multipart |
| POST | `/properties/:id/snapshots` | agent — multipart, sets captured_at |

Admin users:

| Method | Path | Access |
|---|---|---|
| GET | `/users` | admin |
| PATCH | `/users/:id` | admin — role, is_active |

### 5.3 Authorisation rules

- `SUBSCRIBER` — own records only. Any endpoint returning another user's data must 403, not 404-leak.
- `AGENT` — full read/write on properties, media, enquiries, visits, interests, ownerships, logs. Cannot change user roles or hard-delete.
- `ADMIN` — everything, plus user management.
- Ownership endpoints under `/me/` must verify the requesting user appears in `ownerships` for that property. Never trust a client-supplied user id.

---

## 6. Authentication

- Access token: JWT, 15-minute expiry, payload `{ sub, role, iat, exp }`, signed HS256 with `JWT_ACCESS_SECRET`.
- Refresh token: opaque random 64-byte hex, SHA-256 hashed in `refresh_tokens`, 30-day expiry, rotated on every use. Reuse of a revoked token revokes the entire family for that user.
- Passwords: bcrypt cost 12. Minimum 8 characters, must contain a letter and a number. No maximum length below 72 bytes.
- Frontend stores the access token in memory (React context) and the refresh token in an `httpOnly`, `secure`, `sameSite=strict` cookie. Do not put tokens in `localStorage`.
- Axios interceptor: on 401, attempt one refresh, retry the original request once, then redirect to `/login`. Never loop.
- Rate limits: `/auth/login` and `/auth/register` at 5 requests per 15 minutes per IP. Enquiry creation at 10 per hour per IP.

---

## 7. Frontend specification

### 7.1 Routes

| Path | Access | Description |
|---|---|---|
| `/` | public | Landing: hero, featured plots, how it works, group purchase teaser |
| `/properties` | public | Catalogue — filters sidebar, grid/map toggle, pagination |
| `/properties/:slug` | public | Detail — gallery, specs, map, enquiry form, visit booking CTA |
| `/group-purchase` | public | List of plots where `is_group_purchase` is true |
| `/group-purchase/:slug` | public | Offer detail + register-interest form |
| `/login`, `/register` | public | Auth forms |
| `/dashboard` | subscriber | Overview cards |
| `/dashboard/saved` | subscriber | Saved plots |
| `/dashboard/enquiries` | subscriber | Enquiry history |
| `/dashboard/visits` | subscriber | Site visit requests |
| `/dashboard/interests` | subscriber | Registered interests |
| `/dashboard/my-properties` | owner | Owned plots |
| `/dashboard/my-properties/:id` | owner | Ownership record, management log timeline, site photo gallery |
| `/admin` | agent | Queue counts and recent activity |
| `/admin/properties` | agent | Table with status filters |
| `/admin/properties/new` | agent | Create form |
| `/admin/properties/:id/edit` | agent | Edit + media manager |
| `/admin/enquiries` | agent | Queue with status transitions |
| `/admin/visits` | agent | Confirm/complete list |
| `/admin/interests` | agent | Interest queue |
| `/admin/users` | admin | Role management |

Route guards: `<RequireAuth>` and `<RequireRole roles={[...]}>`. Unauthenticated users hitting a guarded route land on `/login?next=<path>` and are returned after login.

### 7.2 Design direction

The audience is buying land, often at a distance, often as a considered family decision. The interface should feel like a serious record-keeping system rather than a marketing funnel — closer to a land registry than to a travel site. Restraint reads as trustworthy here.

**Tailwind v4 configuration.** There is no `tailwind.config.js` in v4. Configuration is CSS-first. `frontend/src/index.css` is the only place tokens are defined:

```css
@import "tailwindcss";

@theme {
  --color-ink: #1C1F1A;
  --color-ink-muted: #5A5F55;
  --color-parchment: #FBFAF7;
  --color-surface: #FFFFFF;
  --color-hairline: #E3E1DA;
  --color-moss: #3F6B4A;
  --color-moss-dark: #2C4C34;
  --color-clay: #A8562F;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --radius-card: 6px;
}
```

These generate utilities automatically: `bg-parchment`, `text-ink-muted`, `border-hairline`, `text-moss`, `font-mono`. Note the border token is named `hairline`, not `border`, because `--color-border` would collide with Tailwind's own `border` utility.

`vite.config.js` must register the plugin:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

No `content` globbing is needed — v4 detects template files automatically.

**Type:** one family, `Inter`, weights 400 and 600 only, plus `IBM Plex Mono` for the identity strip. Scale: 32 / 24 / 18 / 16 / 14 / 12. Sentence case everywhere including buttons and table headers.

**Structure:** 1px hairline borders, 6px radius on cards and controls, no shadows above `shadow-sm`, no gradients. Prices and areas are the loudest thing on a card — they get 18px semibold, everything else recedes.

**Signature element:** every plot card and detail page carries a compact "plot identity strip" — survey number, area in the local unit, and locality set in `font-mono` against a tinted band. It is the one piece of the design that looks like a document rather than a webpage, and it is what a buyer actually verifies against their paperwork.

**Copy rules:** buttons name their outcome ("Register interest", "Request site visit", "Save plot" — never "Submit"). Empty states instruct rather than apologise ("No saved plots yet. Browse the catalogue to save one."). Errors state what happened and what to do next.

**Quality floor:** responsive to 360px, visible keyboard focus rings, `prefers-reduced-motion` respected, all images have alt text, all form inputs have associated labels.

### 7.3 Google Maps cost control

Maps is projected to be the single largest recurring cost. These rules are mandatory:

- **Listing cards and grids use the Static Maps API**, not an interactive map instance. One static image per card, cached by URL.
- **Only one interactive map instance per page.** The catalogue map view and the detail page each get exactly one; unmount it when hidden.
- **Debounce viewport queries at 500ms.** Do not fire `/properties/map` on every pan tick.
- **Cache map results in React Query** with a 5-minute `staleTime` keyed on rounded bounding-box coordinates.
- **Restrict the API key** by HTTP referrer and enable only Maps JavaScript API, Static Maps API, and Geocoding API. Set a billing budget alert.
- Geocoding runs **server-side only**, at listing create/update time, and the result is persisted. Never geocode from the browser.
- The `VITE_GOOGLE_MAPS_API_KEY` used client-side must be a separate, referrer-restricted key from the server-side geocoding key.

---

## 8. Environment configuration

### 8.1 `backend/.env.example`

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://estate:estate@localhost:5432/estate_dev
JWT_ACCESS_SECRET=change-me-min-32-chars
JWT_REFRESH_SECRET=change-me-different-min-32-chars
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
CORS_ORIGIN=http://localhost:5173
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=./uploads
GCS_BUCKET=
GCS_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
GEOCODING_API_KEY=
LOG_LEVEL=debug
```

### 8.2 `frontend/.env.example`

```
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_GOOGLE_MAPS_API_KEY=
```

Env parsing happens once at boot in `backend/src/config/env.js` using zod. The process exits with a clear message if a required variable is missing. No `process.env` access anywhere else in the codebase.

### 8.3 `docker-compose.yml`

One service: `postgis/postgis:16-3.4`, port 5432, named volume, healthcheck, and an init script enabling `postgis`, `citext`, and `pgcrypto`.

---

## 9. Coding conventions

### 9.1 Both sides

- ES modules only. `import`/`export`, never `require`. No CommonJS.
- Named exports only, except React page components which use default export.
- File naming: `kebab-case.js` for modules, `PascalCase.jsx` for components.
- Because there is no compiler, **validate at every boundary**. Any function receiving external data (HTTP body, query string, file upload, third-party response) parses it through a zod schema before using it.
- Add JSDoc to every exported function — at minimum `@param` and `@returns`. This is the only type information a reader or a later agent will have.
  ```js
  /**
   * Find published properties within a radius.
   * @param {{ lat: number, lng: number, radiusKm: number, limit: number }} args
   * @returns {Promise<Array<{ id: string, title: string }>>}
   */
  ```
- Comments explain *why*, not *what*. Do not comment obvious code.
- No `console.log` in committed code. Use the pino logger on the backend; remove debug logging from the frontend before finishing.

### 9.2 Backend

- Controllers are thin: validate → call service → shape response. No business logic, no Prisma calls.
- Services own all data access and business rules. They receive plain arguments, never `req`/`res`.
- Every route validates its input with a contract schema via the `validate` middleware. No exceptions.
- Errors: throw `AppError` subclasses (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`); the central error middleware maps them to the envelope in 5.1.
- Async route handlers are wrapped in `asyncHandler` — no unhandled promise rejections.
- Money is `numeric(14,2)` in the database and handled as a **string** in JS. Never use a JS `number` for a price. Prisma returns `Decimal`; convert with `.toString()` at the service boundary.

### 9.3 Frontend

- One React Query hook per endpoint, in `src/api/`. Components never call axios directly.
- Query keys are structured arrays: `['properties', 'list', filters]`, `['properties', 'detail', slug]`.
- Mutations invalidate the narrowest possible key set.
- Forms: `react-hook-form` with `zodResolver`, using the schema imported from `src/contracts/`. Do not redefine validation rules locally — that is exactly the drift the contract exists to prevent.
- No inline Tailwind colour literals (`bg-[#3F6B4A]`) — use the theme tokens from 7.2.
- Every list has an explicit loading skeleton, empty state, and error state. A spinner alone is not acceptable.
- PropTypes are not required. Rely on JSDoc and the contract schemas.

### 9.4 Git

- Branch per work package: `wp/<number>-<slug>`, e.g. `wp/3-backend-properties`.
- Conventional commits: `feat(properties): add radius filter`.
- Never commit `.env`, `uploads/`, `node_modules`, or `frontend/src/contracts/` (it is generated — add it to `.gitignore` and generate on install via a `postinstall` script).

---

## 10. Seed data

`backend/prisma/seed.js` must create, idempotently:

- 1 admin (`admin@estate.test`), 2 agents, 5 subscribers — all password `Password123`
- 24 properties across Thiruvananthapuram, Kollam, and Alappuzha districts with realistic Kerala localities, plausible lat/lng, mixed types and statuses
- 6 of those flagged `is_group_purchase`
- 3–5 media rows per property using placeholder image URLs
- 2 properties owned by subscriber #1 (one solely, one at 40% share) with 4 management logs and 6 plot snapshots each
- ~15 enquiries, ~8 site visits, ~10 interest registrations spread across statuses

Realistic seed data is not optional — the owner dashboard and agent queues cannot be reviewed without it.

---

## 11. Testing and definition of done

### 11.1 Required tests

- **Backend unit tests** for every service method containing a business rule: share percentage cap, one-interest-per-property, role checks, refresh token rotation and family revocation, slug uniqueness.
- **Backend integration tests** via supertest for every endpoint: happy path plus its 401/403/404/409 cases. Every response body is parsed through its contract response schema (Section 2.4).
- **Frontend tests** for form validation and route guards. No requirement for full page snapshot tests.

### 11.2 A work package is done when

1. `npm run lint` passes with zero warnings in the affected package.
2. `npm test` passes.
3. `npm run contracts:check` passes (contracts in sync between packages).
4. New endpoints are documented in `docs/API.md` with request/response examples.
5. The feature works end to end against seeded data, verified manually.
6. No `TODO`, commented-out code, or `console.log` remains.
7. No files outside the package's owned paths were modified.

Note there is no typecheck step — this is the trade-off of the JavaScript stack. Items 2 and 3 carry that weight instead, which is why the contract assertions in tests are mandatory rather than optional.

---

## 12. Scripts

Root `package.json` (workspace-level convenience, npm workspaces not required):

| Script | Command |
|---|---|
| `dev` | run frontend and backend concurrently |
| `db:up` | `docker compose up -d` |
| `db:migrate` | `cd backend && npx prisma migrate dev` |
| `db:seed` | `cd backend && node prisma/seed.js` |
| `contracts:sync` | `node backend/scripts/sync-contracts.js` |
| `contracts:check` | `node backend/scripts/sync-contracts.js --check` |
| `lint` | lint both packages |
| `test` | test both packages |

---

## 13. Work packages and agent assignment

### WP0 — Contracts and foundation (**BLOCKING — one agent, run alone, not as a team**)

Nothing else may start until this is merged. Do not parallelise this.

Deliverables:
- `docker-compose.yml` with PostGIS and init scripts
- `backend/` project init: `package.json` with `"type": "module"`, eslint flat config, prettier, vitest config
- `backend/prisma/schema.prisma` implementing Section 4 in full
- Initial migration plus a raw-SQL migration adding the `location`/`boundary` geography columns, the lat/lng sync trigger, and all GIST indexes
- `backend/src/contracts/` — every schema and enum from Sections 4 and 5, per Section 2.4
- `backend/scripts/sync-contracts.js` with `--check` mode
- `backend/src/config/env.js` — zod-validated env loader
- `backend/src/middleware/` — `error-handler.js`, `validate.js`, `async-handler.js`, `auth.js` (JWT verification), `upload.js`
- `backend/src/utils/app-error.js` — the error class hierarchy
- `backend/src/services/storage.js` — adapter interface plus local driver
- `backend/src/app.js` and `server.js` booting with helmet, cors, pino, and a `/health` route
- `backend/prisma/seed.js` per Section 10
- `docs/API.md` skeleton with the envelope and error conventions filled in
- Root `package.json` scripts per Section 12
- `frontend/jsconfig.json`

Owned paths: everything above. Exclusive.

### WP0.5 — Frontend shell (**BLOCKING for frontend work — run after WP0, solo**)

Deliverables:
- `frontend/src/index.css` with the Tailwind v4 `@theme` block from 7.2
- `frontend/vite.config.js` updated with the Tailwind plugin
- `src/components/ui/` primitives: Button, Input, Select, Textarea, Checkbox, Card, Badge, Modal, Table, Pagination, Skeleton, EmptyState, ErrorState
- `src/components/layout/`: PublicShell (header/footer), DashboardShell (sidebar), AdminShell
- `src/api/client.js` — axios instance, interceptors, refresh logic
- `src/features/auth/AuthContext.jsx` — session state, login/logout/refresh
- `src/routes/` — router config, `RequireAuth`, `RequireRole`
- `src/lib/format.js` — currency (INR, lakh/crore aware), area units, dates
- The plot identity strip component from 7.2

Owned paths: `frontend/src/components/ui/**`, `frontend/src/components/layout/**`, `frontend/src/api/client.js`, `frontend/src/features/auth/AuthContext.jsx`, `frontend/src/routes/**`, `frontend/src/lib/**`, `frontend/src/index.css`, `frontend/vite.config.js`.

### Parallel wave 1 — backend (team of 4, after WP0)

| WP | Teammate name | Scope | Owned paths |
|---|---|---|---|
| **WP1** | `auth` | Register, login, refresh rotation, logout, me, role middleware completion | `backend/src/modules/auth/**` |
| **WP2** | `properties` | CRUD, publish, slug generation, filtering, radius + bbox search, view count, server-side geocoding | `backend/src/modules/properties/**` |
| **WP3** | `media` | Upload, validation, cover handling, ordering, delete; GCS driver for the storage adapter | `backend/src/modules/media/**`, `backend/src/services/storage-gcs.js` |
| **WP4** | `engagement` | Enquiries, site visits, saved properties, interest registrations | `backend/src/modules/enquiries/**`, `visits/**`, `saved/**`, `interests/**` |

### Parallel wave 2 — backend remainder + frontend start (team of 4)

| WP | Teammate name | Scope | Owned paths |
|---|---|---|---|
| **WP5** | `ownership` | Ownerships with share cap, management logs, log media, plot snapshots, `/me/properties` endpoints | `backend/src/modules/ownership/**`, `backend/src/modules/logs/**` |
| **WP6** | `auth-ui` | Login, register pages, guard wiring | `frontend/src/features/auth/pages/**` |
| **WP7** | `catalogue` | Landing, listing grid, filter sidebar, map view, detail page, gallery, static map cards | `frontend/src/features/catalogue/**`, `frontend/src/components/property/**` |
| **WP8** | `subscriber` | Dashboard, saved, enquiries, visits, interests, plus the enquiry/visit/interest forms | `frontend/src/features/subscriber/**` |

### Parallel wave 3 — frontend remainder (team of 3)

| WP | Teammate name | Scope | Owned paths |
|---|---|---|---|
| **WP9** | `owner-ui` | Owned plots, ownership detail, management log timeline, snapshot gallery | `frontend/src/features/owner/**` |
| **WP10** | `admin-ui` | Property table, create/edit forms, media manager, enquiry/visit/interest queues, user management | `frontend/src/features/admin/**` |
| **WP11** | `group-purchase` | Group purchase list, offer detail, register-interest form — Section 1.3 copy compliance is this teammate's primary responsibility | `frontend/src/features/catalogue/group-purchase/**` |

### Wave 4 — solo sessions

| WP | Scope |
|---|---|
| **WP12** | Deployment: Dockerfiles, Cloud Run service config, Cloud SQL connection notes, GCS bucket setup, CI workflow running lint/test/contracts:check |
| **WP13** | Hardening: rate limits verified, security headers, N+1 query audit, image lazy-loading, Lighthouse pass, accessibility audit |

### 13.1 Shared files

Two files are touched by more than one work package. They are the only permitted exceptions to exclusive ownership, and the permitted edit is strictly limited:

| File | Permitted edit |
|---|---|
| `backend/src/app.js` | One `import` line and one `app.use()` line per module. Nothing else. |
| `frontend/src/routes/index.jsx` | One `import` line and one route entry per feature. Nothing else. |

Any teammate that needs a larger change to these files stops and reports to the lead.

### 13.2 Dependency graph

```
WP0 (solo)
 └── WP0.5 (solo)
      │
      ├── Wave 1 team: WP1, WP2, WP3, WP4
      │
      ├── Wave 2 team: WP5, WP6, WP7, WP8
      │
      ├── Wave 3 team: WP9, WP10, WP11
      │
      └── Wave 4 solo: WP12, WP13
```

WP7 depends on WP2, WP8 depends on WP4, WP9 depends on WP5, WP10 depends on WP2 + WP3 + WP4. Waves are ordered so those dependencies are already merged.

---

## 14. Agent team operating procedure

Agent teams are experimental and disabled by default in Claude Code.

### 14.1 `.claude/settings.json`

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process",
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npm install:*)",
      "Bash(npx prisma:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ]
  }
}
```

`teammateMode` stays `in-process` because split-pane mode is not supported in the VS Code integrated terminal. Pre-approving the commands above prevents permission prompts from stacking up in the lead session during a wave.

### 14.2 `CLAUDE.md` requirements

Teammates load `CLAUDE.md` automatically but **do not inherit the lead's conversation history**. Every rule must therefore live in the file, not in chat. `CLAUDE.md` at the repo root must state:

1. That `docs/PROJECT_REQUIREMENTS.md` is authoritative and must be read before writing code.
2. The exclusive file ownership rule and the two shared-file exceptions from 13.1.
3. The stack constraint: JavaScript ESM, no TypeScript, no `require`.
4. The error envelope and `AppError` convention.
5. The contract rule: only WP0 edits `contracts/`; everyone else imports from it.
6. The money-as-string rule.
7. The Section 1.3 copy prohibition, verbatim.
8. That `npm run lint && npm test && npm run contracts:check` must pass before a task is marked complete.

### 14.3 Teammate role definitions

Define reusable roles in `.claude/agents/` as markdown with YAML frontmatter. A subagent definition referenced when spawning a teammate contributes its `tools` allowlist and `model`, and its body is appended to the teammate's system prompt. Note that the `skills` and `mcpServers` frontmatter fields are ignored when a definition runs as a teammate — anything you would have preloaded via `skills` belongs in `CLAUDE.md` instead.

Recommended roles:

- `backend-module-builder` — one Express module per teammate, per 9.2 (builder)
- `frontend-feature-builder` — one feature folder per teammate, per 9.3 (builder)
- `contract-guardian` — read-only reviewer that checks every response shape against its contract schema and flags drift
- `security-reviewer` — read-only security audit (auth, injection, uploads, secrets, leakage)
- `performance-reviewer` — read-only performance audit (queries, indexes, Maps cost, render cost)
- `code-quality-reviewer` — read-only audit of layering, conventions, test quality, and hygiene

The first two are builders. The last four are read-only reviewers, run as a parallel review team after each build wave.

### 14.4 Spawn prompt template

Teammates need task-specific detail in the spawn prompt because they start with no conversation history. Use this shape:

```
Read docs/PROJECT_REQUIREMENTS.md, sections 5, 9, and 13.

Spawn <N> teammates using the <role> agent type, one per work package.
Name them: <names from the wave table>.

For each teammate, include in the spawn prompt:
  - its work package number and scope sentence
  - its exact owned paths from the Section 13 table
  - the endpoints or routes it owns from Section 5.2 or 7.1
  - the reminder that app.js / routes/index.jsx allow only a single import
    line and a single registration line

Create the tasks before spawning so teammates can self-claim. Wait for all
teammates to report completion before reviewing. Do not implement any work
package yourself.
```

### 14.5 Operating rules

- **Team size 3–5 per wave.** Three focused teammates outperform five scattered ones, and 5–6 tasks per teammate keeps everyone busy without thrash.
- **Commit between waves.** `git init` and an initial commit before the first team run. Each wave ends with a reviewed, committed, passing tree.
- **Never run WP0 or WP0.5 as a team.** They are sequential and would only generate conflicts.
- **Watch for the lead implementing.** If the lead starts writing module code instead of coordinating, tell it to wait for its teammates.
- **Token cost is real.** A team run consumes several times a single session. Use teams for the implementation waves only; do the foundation, review, and small fixes in a single session.
- **No session resumption.** `/resume` does not restore in-process teammates. Treat each wave as one uninterrupted sitting.

---

## 15. Open decisions

Flag these to the project owner rather than deciding unilaterally:

1. **JavaScript over TypeScript** — chosen for MVP speed. The cost is no compile-time checking across the API boundary; the mitigation is the contract schemas in 2.4 plus the mandatory response-shape assertions in 11.1. If the project outlives the MVP, migrating to TypeScript will be substantially easier if the contract files stay the single source of truth.
2. **Phone OTP** — deferred. If required at launch, an SMS provider must be selected and WP1 reopened.
3. **Group purchase copy** — Section 1.3 is drafted conservatively. Have the final page copy reviewed by legal counsel before launch.
4. **Boundary polygons** — the schema supports them but no drawing tool is specified. If agents need to draw plot boundaries, that is an additional work package.
5. **Email delivery** — a mailer stub is specified. Transactional email (enquiry and visit confirmations) needs a provider decision.
