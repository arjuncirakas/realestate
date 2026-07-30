# Estate Platform API

Base path `/api/v1`. JSON only. All timestamps ISO 8601 UTC.

This file is the running record of what the API actually does. Each work package
documents its own endpoints here as they land — item 4 of the definition of done
(Section 11.2). The conventions below are fixed by WP0 and apply to every
endpoint without exception; do not restate them per endpoint, just follow them.

---

## 1. Response envelope

Every 2xx response is wrapped. There is no bare-array or bare-object response
anywhere in the API.

**Single resource**

```json
{
  "data": { "id": "4f6c…", "title": "Ten cent plot near Technopark" },
  "meta": {}
}
```

**Paginated collection**

```json
{
  "data": [{ "id": "4f6c…" }, { "id": "9b21…" }],
  "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
}
```

`totalPages` is `ceil(total / limit)`, so an empty result set reports `0`, not `1`.

**Error — every non-2xx response, without exception**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some of the details provided are not valid.",
    "details": [{ "field": "email", "message": "Enter a valid email address" }]
  }
}
```

`details` is present only when there is field-level information. A cross-field
rule with no single owning field reports under the field name `_`.

## 2. Error codes

| Code               | Status | Used when                                                                      |
| ------------------ | ------ | ------------------------------------------------------------------------------ |
| `VALIDATION_ERROR` | 400    | Request failed a contract schema, a bad upload, malformed JSON, oversized body |
| `UNAUTHENTICATED`  | 401    | Missing, malformed or expired access token                                     |
| `FORBIDDEN`        | 403    | Authenticated but not permitted — including another user's records             |
| `NOT_FOUND`        | 404    | No such record, or no such route                                               |
| `CONFLICT`         | 409    | Duplicate, or a state transition that is not allowed                           |
| `RATE_LIMITED`     | 429    | Over the limits in section 6 below                                             |
| `INTERNAL_ERROR`   | 500    | Anything unexpected                                                            |

Two rules that matter more than they look:

- **Nothing internal is ever returned.** Prisma messages quote SQL and column
  names, raw Zod issues expose the schema, and stack traces expose paths. All
  three are logged server-side and replaced with a safe message.
- **A subscriber requesting another user's record gets 403, not 404**
  (Section 5.3). A 404 would double as a probe for whether that record exists.

## 3. Data conventions

These are enforced by the contract schemas in `backend/src/contracts/`, and the
mandatory response-shape assertion in every integration test is what keeps them
true:

```js
expect(SomeResponseSchema.safeParse(res.body.data).success).toBe(true);
```

| Kind                    | Wire format          | Example                      | Why                                                           |
| ----------------------- | -------------------- | ---------------------------- | ------------------------------------------------------------- |
| Money (`numeric(14,2)`) | **string**           | `"5800000"`, `"5800000.50"`  | A JS number cannot hold rupee amounts exactly (Section 9.2)   |
| Area, share (`numeric`) | **string**           | `"10"`, `"40.5"`             | Same reason — every `Decimal` is `.toString()`-ed             |
| `timestamptz`           | ISO 8601             | `"2026-07-30T09:00:00.000Z"` |                                                               |
| `date`                  | **`YYYY-MM-DD`**     | `"2026-08-08"`               | A date-only column must not gain a spurious time and timezone |
| ids                     | UUID v4 string       | `"4f6c…"`                    |                                                               |
| Enums                   | Uppercase snake case | `"UNDER_OFFER"`              | Identical to the Prisma enums                                 |

**Decimals are not zero-padded to the column scale.** Prisma's
`Decimal#toString()` emits `"5800000"`, not `"5800000.00"`, for a whole-number
`numeric(14,2)`. Format for display on the frontend; never assume two decimal
places are present when parsing.

Fields that are **never** in a response: `password_hash`, `token_hash`, and
`storage_key` (clients get `url`). `boundary` is also absent — the column exists
but the MVP ships no drawing tool (Section 15, open decision 4).

`agentNotes` and the assigned agent are **agent-facing only**. The `/me/*` list
endpoints use the narrower `My*WithPropertySchema` rows, which omit them: a
subscriber may read their own records, which is not the same as reading the
agency's internal annotations on those records (Section 5.3).

## 4. Pagination and filtering

Every **paginated** list endpoint accepts `page` (default 1) and `limit`
(default 20, **maximum 50**), and returns the pagination block in `meta`. A
cleared filter may be sent as an empty string — `?minPrice=` is treated as
absent, so the frontend does not have to strip empty form fields.

Booleans in query strings are `true`/`false`/`1`/`0`.

**One endpoint is deliberately outside that rule.** `GET /properties/map` is a
viewport query, not a paginated list: it takes no `page`, returns `meta: {}`,
and caps `limit` at 500 with a default of 200 (`PropertyMapQuerySchema`). A map
viewport legitimately needs more pins than a page of cards, and the reference
SQL in Section 4.3 has no `LIMIT` at all — so the cap tightens that query rather
than evading the rule above. The response carries seven thin scalar columns per
pin, so 500 rows is a small payload. Any _other_ endpoint returning a list must
paginate and obey the 50 cap.

## 5. Authentication

- **Access token** — JWT, HS256, 15-minute expiry, payload `{ sub, role, iat, exp }`.
  Sent as `Authorization: Bearer <token>`.
- **Refresh token** — opaque 64-byte hex, SHA-256 hashed at rest, 30-day expiry,
  rotated on every use. Reuse of a revoked token revokes the whole family for
  that user.
- The refresh token is delivered as an `httpOnly`, `secure`, `sameSite=strict`
  cookie and is **not** in any response body. Login, register and refresh return
  `{ user, accessToken, accessTokenExpiresIn }`.
- Passwords: bcrypt cost 12; minimum 8 characters containing a letter and a
  number; no maximum below 72 bytes.

Access-token verification does not query the database, so a deactivated account
stays usable until its token expires — at most 15 minutes. An endpoint that must
react immediately re-checks `isActive` in its service.

## 6. Rate limits

| Endpoint                                  | Limit                   |
| ----------------------------------------- | ----------------------- |
| `POST /auth/login`, `POST /auth/register` | 5 per 15 minutes per IP |
| `POST /properties/:id/enquiries`          | 10 per hour per IP      |

Exceeding a limit returns `RATE_LIMITED` in the standard envelope, with
`draft-7` rate-limit headers.

## 7. Uploads

Multipart. At most **10 files, 10 MB each**. Field name `files` for media,
`file` for a single plot snapshot.

Accepted MIME types — everything else is rejected with `VALIDATION_ERROR`:

`image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `application/pdf`

The stored filename is generated server-side and the extension is chosen from the
MIME type, never from the uploaded filename.

## 8. Non-versioned routes

| Method | Path         | Purpose                                                                                                                |
| ------ | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`    | Liveness. Does **not** touch the database, so a failure means the process is wedged rather than that Postgres is busy. |
| GET    | `/uploads/*` | Locally stored uploads, development only. In production the GCS bucket serves these.                                   |

`GET /health` response:

```json
{
  "data": {
    "status": "ok",
    "uptimeSeconds": 12.481,
    "timestamp": "2026-07-30T12:26:29.273Z"
  },
  "meta": {}
}
```

---

## 9. Endpoints

Each work package fills in its own section with a request and response example
per endpoint. The tables below are the agreed surface from Section 5.2 — the
contract schema each endpoint validates against is named so there is no ambiguity
about the shape.

### 9.1 Auth — `/auth`, `/users` (WP1)

| Method | Path             | Access               | Request schema          | Response schema                      |
| ------ | ---------------- | -------------------- | ----------------------- | ------------------------------------ |
| POST   | `/auth/register` | public, rate-limited | `RegisterSchema`        | `AuthResponseSchema`                 |
| POST   | `/auth/login`    | public, rate-limited | `LoginSchema`           | `AuthResponseSchema`                 |
| POST   | `/auth/refresh`  | public (cookie)      | `RefreshRequestSchema`  | `AuthResponseSchema`                 |
| POST   | `/auth/logout`   | auth                 | `LogoutRequestSchema`   | —                                    |
| GET    | `/auth/me`       | auth                 | —                       | `MeResponseSchema`                   |
| PATCH  | `/auth/me`       | auth                 | `MeUpdateSchema`        | `MeResponseSchema`                   |
| GET    | `/users`         | admin                | `UserListQuerySchema`   | `UserListResponseSchema` (paginated) |
| PATCH  | `/users/:id`     | admin                | `AdminUserUpdateSchema` | `UserResponseSchema`                 |

Notes:

- The refresh token is delivered as an `httpOnly`, `sameSite=strict` cookie
  named `refreshToken`, scoped to the `/api/v1/auth` path, and is never present
  in a response body. It is marked `secure` in production only — a `secure`
  cookie is dropped by every browser over plain http, which is how this
  project's own dev server talks to the API (`CORS_ORIGIN=http://localhost:5173`,
  Section 8.1).
- `POST /auth/register` always creates a `SUBSCRIBER` account. There is no way
  to self-register as `AGENT` or `ADMIN`.
- Reuse of a refresh token that has already been rotated once revokes every
  other currently-active token for that user, not just the one reused — the
  schema has no per-lineage "family" column, so "the entire family for that
  user" (Section 6) is every session currently open for that user.
- `PATCH /users/:id` setting `isActive: false` also revokes every refresh
  token the user currently holds, so the deactivation takes effect within one
  access-token lifetime (at most 15 minutes) instead of up to the full 30-day
  refresh window.
- Login and register give a wrong password and an unknown email the identical
  error message and comparable response time, so the endpoint cannot be used
  to enumerate registered emails.

**POST /auth/register** — `201 Created`

```json
// Request
{
  "email": "meera@example.test",
  "password": "Password123",
  "fullName": "Meera Nair",
  "phone": "+91 98765 43210"
}
```

```json
// Response — data
{
  "user": {
    "id": "5b1e2b9e-2b7a-4a2d-9b0a-0e1f2a3b4c5d",
    "email": "meera@example.test",
    "phone": "+91 98765 43210",
    "fullName": "Meera Nair",
    "role": "SUBSCRIBER",
    "isActive": true,
    "createdAt": "2026-07-30T09:00:00.000Z",
    "updatedAt": "2026-07-30T09:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "accessTokenExpiresIn": 900
}
```

**POST /auth/login** — `200 OK` — same response shape as register.

**POST /auth/refresh** — `200 OK` — same response shape as register; reads the
`refreshToken` cookie (or `{ "refreshToken": "..." }` in the body for a
non-browser client) and sets a new cookie in its place.

**POST /auth/logout** — `200 OK`

```json
{ "data": null, "meta": {} }
```

**GET /auth/me** — `200 OK` — data is the `user` object shown above.

**PATCH /auth/me** — `200 OK`

```json
// Request
{ "fullName": "Meera S. Nair" }
```

Response: the updated `user` object.

**GET /users** — `200 OK` — `?page=1&limit=20&q=meera&role=SUBSCRIBER&isActive=true`

```json
{
  "data": [
    {
      "id": "...",
      "email": "meera@example.test",
      "role": "SUBSCRIBER",
      "isActive": true,
      "...": "..."
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

**PATCH /users/:id** — `200 OK`

```json
// Request
{ "isActive": false }
```

Response: the updated `user` object.

### 9.2 Properties — `/properties` (WP2)

| Method | Path                      | Access | Request schema                 | Response schema                          |
| ------ | ------------------------- | ------ | ------------------------------ | ---------------------------------------- |
| GET    | `/properties`             | public | `PropertyListQuerySchema`      | `PropertyListResponseSchema` (paginated) |
| GET    | `/properties/map`         | public | `PropertyMapQuerySchema`       | `PropertyMapResponseSchema`              |
| GET    | `/properties/:slug`       | public | `SlugParamSchema`              | `PropertyResponseSchema`                 |
| POST   | `/properties`             | agent  | `PropertyCreateSchema`         | `PropertyResponseSchema`                 |
| PATCH  | `/properties/:id`         | agent  | `PropertyUpdateSchema`         | `PropertyResponseSchema`                 |
| POST   | `/properties/:id/publish` | agent  | —                              | `PropertyResponseSchema`                 |
| DELETE | `/properties/:id`         | admin  | —                              | `PropertyResponseSchema`                 |
| GET    | `/properties/admin/list`  | agent  | `PropertyAdminListQuerySchema` | `PropertyListResponseSchema` (paginated) |

Notes for WP2: `latitude`/`longitude` are optional on create and update — supply
both to pin the plot, or neither to have the address geocoded server-side and
persisted (Section 7.3). Never geocode from the browser. `location` is maintained
by a database trigger; write lat/lng only. Use the exact radius and bounding-box
SQL from Section 4.3.

**`GET /properties`** — public. Always restricted to `PUBLIC_PROPERTY_STATUSES`
(`AVAILABLE`, `UNDER_OFFER`, `SOLD`) regardless of the `status` filter; a status
outside that set returns an empty page rather than an error. Supplying `lat`,
`lng` and `radiusKm` together switches to the Section 4.3 radius query and
results are ordered by distance — `sort` is ignored in that case. Otherwise
`sort` controls ordering (`newest` is `publishedAt desc`, matching the schema's
only composite index, `@@index([status, publishedAt(sort: Desc)])`).

The radius branch reports `meta.total` as the true number of matches (via an
id-only pass over every candidate the geo predicate returns, capped at a
generous 5000-row ceiling — a floor rather than a page-sized truncation), and
only hydrates the requested page with the heavier cover-media include.

```
GET /properties?city=Kollam&type=PLOT&minPrice=3000000&maxPrice=7000000&page=1&limit=20
```

```json
{
  "data": [
    {
      "id": "b6e2b7b0-2f6a-4b8e-9a3d-4b1a8c6f2e10",
      "slug": "kottiyam-junction-8-cent-a1b2c3d4",
      "title": "Eight cent plot near Kottiyam junction",
      "propertyType": "PLOT",
      "status": "AVAILABLE",
      "price": "3900000",
      "priceIsNegotiable": true,
      "areaValue": "8",
      "areaUnit": "CENT",
      "locality": "Kottiyam",
      "city": "Kollam",
      "district": "Kollam",
      "state": "Kerala",
      "surveyNumber": "64/3",
      "latitude": 8.848,
      "longitude": 76.706,
      "isGroupPurchase": false,
      "coverImageUrl": "http://localhost:4000/uploads/property-media/9f1c….jpg",
      "publishedAt": "2026-01-12T00:00:00.000Z",
      "createdAt": "2026-01-05T09:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**`GET /properties/map`** — public. Fixed to `status = 'AVAILABLE'` per the
Section 4.3 bounding-box pattern (a `LIMIT`, bound to the query's `limit`, is
the only addition to that pattern — Section 7.3's cost-control rule against
returning the whole table on a zoomed-out viewport).

```
GET /properties/map?minLng=76.4&minLat=8.7&maxLng=77.0&maxLat=9.1&limit=200
```

```json
{
  "data": [
    {
      "id": "b6e2b7b0-2f6a-4b8e-9a3d-4b1a8c6f2e10",
      "slug": "kottiyam-junction-8-cent-a1b2c3d4",
      "title": "Eight cent plot near Kottiyam junction",
      "latitude": 8.848,
      "longitude": 76.706,
      "price": "3900000",
      "isGroupPurchase": false
    }
  ],
  "meta": {}
}
```

**`GET /properties/:slug`** — public, `optionalAuthenticate`. Increments
`viewCount` atomically, subject to a 60-second per-caller debounce (keyed on
IP address) — this route is public and otherwise unthrottled, so an
unconditional increment on every hit is a trivial way to inflate a listing's
count and a needless write on every request. A repeat hit from the same caller
inside that window returns the same `viewCount` rather than incrementing it
again. An agent or admin token unlocks preview of a `DRAFT` or `WITHDRAWN`
listing; anyone else gets `NOT_FOUND` for those statuses rather than a
response that would confirm the slug exists.

```json
{
  "data": {
    "id": "b6e2b7b0-2f6a-4b8e-9a3d-4b1a8c6f2e10",
    "slug": "kottiyam-junction-8-cent-a1b2c3d4",
    "title": "Eight cent plot near Kottiyam junction",
    "propertyType": "PLOT",
    "status": "AVAILABLE",
    "price": "3900000",
    "priceIsNegotiable": true,
    "areaValue": "8",
    "areaUnit": "CENT",
    "locality": "Kottiyam",
    "city": "Kollam",
    "district": "Kollam",
    "state": "Kerala",
    "surveyNumber": "64/3",
    "latitude": 8.848,
    "longitude": 76.706,
    "isGroupPurchase": false,
    "coverImageUrl": "http://localhost:4000/uploads/property-media/9f1c….jpg",
    "publishedAt": "2026-01-12T00:00:00.000Z",
    "createdAt": "2026-01-05T09:00:00.000Z",
    "description": "Road-facing plot with a working well.",
    "addressLine": null,
    "pincode": "691571",
    "amenities": ["Road frontage", "Well"],
    "groupTargetAmount": null,
    "groupMinTicket": null,
    "listedByAgentId": "6e5c9b2a-1f3d-4a7e-8b6c-2d9f0a1e3c4b",
    "listedByAgent": {
      "id": "6e5c9b2a-1f3d-4a7e-8b6c-2d9f0a1e3c4b",
      "fullName": "Divya Raveendran"
    },
    "viewCount": 42,
    "media": [
      {
        "id": "3c1a9f2e-7b4d-4e5a-9c8f-1d2e3f4a5b6c",
        "propertyId": "b6e2b7b0-2f6a-4b8e-9a3d-4b1a8c6f2e10",
        "type": "IMAGE",
        "url": "http://localhost:4000/uploads/property-media/9f1c….jpg",
        "caption": null,
        "sortOrder": 0,
        "isCover": true,
        "createdAt": "2026-01-05T09:05:00.000Z"
      }
    ],
    "updatedAt": "2026-01-12T00:00:00.000Z"
  },
  "meta": {}
}
```

**`POST /properties`** — agent. Creates a `DRAFT`; `listedByAgentId` is always
the caller. When `latitude`/`longitude` are omitted the address is geocoded
server-side (Section 7.3) — with `GEOCODING_API_KEY` unset in development,
that path returns `VALIDATION_ERROR` asking the agent to supply coordinates
directly, rather than storing a default or zero coordinate.

```json
{
  "title": "Ten cent plot near Technopark",
  "propertyType": "PLOT",
  "price": "5800000",
  "areaValue": "10",
  "areaUnit": "CENT",
  "city": "Thiruvananthapuram",
  "state": "Kerala",
  "latitude": 8.5565,
  "longitude": 76.8811
}
```

Response — `201`, `PropertyResponseSchema`, `status: "DRAFT"`.

**`PATCH /properties/:id`** — agent, any agent or admin may edit any listing.
Two behaviours the contract leaves to this service:

- Setting `isGroupPurchase: false` clears `groupTargetAmount`/`groupMinTicket`
  unless the same patch also sets them (rejected as `VALIDATION_ERROR` if it
  tries to set a non-null amount while `isGroupPurchase` is, or is becoming,
  `false`).
- A patch that touches an address field without supplying both coordinates
  re-geocodes and persists the result; a patch that touches neither leaves the
  stored coordinates untouched.

**`POST /properties/:id/publish`** — agent. `DRAFT → AVAILABLE`, sets
`publishedAt`. `CONFLICT` if the listing is not currently a draft.

**`DELETE /properties/:id`** — admin. Soft delete to `WITHDRAWN`. `CONFLICT`
if it is already withdrawn. Returns the updated `PropertyResponseSchema`, not
an empty body.

**`GET /properties/admin/list`** — agent or admin, every status. `mine=true`
narrows to the caller's own `listedByAgentId`.

### 9.3 Media — `/properties/:id/media`, `/media` (WP3)

| Method | Path                    | Access | Request schema                        | Response schema                   |
| ------ | ----------------------- | ------ | ------------------------------------- | --------------------------------- |
| POST   | `/properties/:id/media` | agent  | multipart + `MediaUploadFieldsSchema` | `PropertyMediaListResponseSchema` |
| PATCH  | `/media/:id`            | agent  | `MediaUpdateSchema`                   | `PropertyMediaResponseSchema`     |
| DELETE | `/media/:id`            | agent  | —                                     | —                                 |

A partial unique index enforces at most one cover image per property, so setting
`isCover` must clear the flag on the property's other media in the same
transaction or the write will fail with `CONFLICT`.

**`POST /properties/:id/media`** — multipart, up to 10 files at 10 MB each,
field name `files`. Optional text fields `caption` and `sortOrder` apply to
every file in the batch and, if omitted, `sortOrder` continues from the
property's current highest value. When the property has no cover yet, the
first uploaded **image** in the batch (never a video or document) becomes the
cover automatically; use `PATCH` to change it afterwards. 404s when the
property does not exist.

Response `201`:

```json
{
  "data": [
    {
      "id": "2c9b7e9e-9c0e-4d9a-8a2e-8a4a2f6a9a11",
      "propertyId": "9f1c3d2a-1b2c-4e5f-8a6b-7c8d9e0f1a2b",
      "type": "IMAGE",
      "url": "http://localhost:4000/uploads/property-media/6f1e….jpg",
      "caption": null,
      "sortOrder": 0,
      "isCover": true,
      "createdAt": "2026-07-30T09:00:00.000Z"
    }
  ],
  "meta": {}
}
```

**`PATCH /media/:id`** — body is `MediaUpdateSchema` (`caption`, `sortOrder`,
`isCover`; at least one field required). Setting `isCover: true` clears the
flag on the property's other media in the same transaction.

Response `200`:

```json
{
  "data": {
    "id": "2c9b7e9e-9c0e-4d9a-8a2e-8a4a2f6a9a11",
    "propertyId": "9f1c3d2a-1b2c-4e5f-8a6b-7c8d9e0f1a2b",
    "type": "IMAGE",
    "url": "http://localhost:4000/uploads/property-media/6f1e….jpg",
    "caption": "Front view from the road",
    "sortOrder": 3,
    "isCover": true,
    "createdAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

**`DELETE /media/:id`** — `204 No Content`. The stored object is removed
before the database row, so a delete that fails partway through can always be
retried: `storage.remove` tolerates an object that is already gone, and the
row stays in place to retry against until its own delete succeeds.

_Documented — WP3._

### 9.4 Enquiries, visits, saved, interests (WP4)

| Method | Path                          | Access                            | Request schema             | Response schema                                 |
| ------ | ----------------------------- | --------------------------------- | -------------------------- | ----------------------------------------------- |
| POST   | `/properties/:id/enquiries`   | public, rate-limited (10/hour/IP) | `EnquiryCreateSchema`      | `EnquiryResponseSchema`                         |
| GET    | `/enquiries`                  | agent                             | `EnquiryListQuerySchema`   | `EnquiryWithPropertySchema[]` (paginated)       |
| PATCH  | `/enquiries/:id`              | agent                             | `EnquiryUpdateSchema`      | `EnquiryResponseSchema`                         |
| GET    | `/me/enquiries`               | auth                              | `EnquiryListQuerySchema`   | `MyEnquiryWithPropertySchema[]` (paginated)     |
| POST   | `/properties/:id/site-visits` | auth                              | `SiteVisitCreateSchema`    | `SiteVisitResponseSchema`                       |
| GET    | `/me/site-visits`             | auth                              | `SiteVisitListQuerySchema` | `MySiteVisitWithPropertySchema[]` (paginated)   |
| PATCH  | `/me/site-visits/:id/cancel`  | auth (own only)                   | —                          | `SiteVisitResponseSchema`                       |
| GET    | `/site-visits`                | agent                             | `SiteVisitListQuerySchema` | `SiteVisitWithPropertySchema[]` (paginated)     |
| PATCH  | `/site-visits/:id`            | agent                             | `SiteVisitUpdateSchema`    | `SiteVisitResponseSchema`                       |
| GET    | `/me/saved`                   | auth                              | `PaginationQuerySchema`    | `SavedPropertyWithPropertySchema[]` (paginated) |
| POST   | `/me/saved/:propertyId`       | auth (idempotent)                 | —                          | `SavedPropertyResponseSchema`                   |
| DELETE | `/me/saved/:propertyId`       | auth                              | —                          | `SavedPropertyResponseSchema` (the removed row) |
| POST   | `/properties/:id/interest`    | auth                              | `InterestCreateSchema`     | `InterestResponseSchema`                        |
| GET    | `/me/interests`               | auth                              | `InterestListQuerySchema`  | `MyInterestWithPropertySchema[]` (paginated)    |
| PATCH  | `/me/interests/:id/withdraw`  | auth (own only)                   | —                          | `InterestResponseSchema`                        |
| GET    | `/interests`                  | agent                             | `InterestListQuerySchema`  | `InterestWithPropertySchema[]` (paginated)      |
| PATCH  | `/interests/:id`              | agent                             | `InterestUpdateSchema`     | `InterestResponseSchema`                        |

Every list row that is not itself a single-property response embeds a
`PropertySummarySchema` under `property` (id, slug, title, status, price,
areaValue, areaUnit, locality, city, surveyNumber, coverImageUrl) — the plain
create/update responses do not, since the caller already has the property id.

**`POST /properties/:id/enquiries`** — public and rate-limited. `enquiries.user_id`
is nullable: a guest may enquire with just name, email, phone (optional) and a
message. `optionalAuthenticate` attributes the enquiry to `req.user.id` when the
caller happens to be signed in, but never requires it. 404s when the property
does not exist.

Response `201`:

```json
{
  "data": {
    "id": "5b1e2c3a-9f4a-4b2e-8c3a-1a2b3c4d5e6f",
    "propertyId": "9f1c3d2a-1b2c-4e5f-8a6b-7c8d9e0f1a2b",
    "userId": null,
    "name": "Rahul Varma",
    "email": "rahul.varma@example.test",
    "phone": "+91 90370 44112",
    "message": "Please share the exact frontage measurement.",
    "status": "NEW",
    "assignedAgentId": null,
    "assignedAgent": null,
    "agentNotes": null,
    "createdAt": "2026-07-30T09:00:00.000Z",
    "updatedAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

**`GET /enquiries`** / **`GET /me/enquiries`** — both accept `status`,
`propertyId`, `page`, `limit`; the agent queue additionally accepts
`assignedAgentId` and a free-text `q` matched against name, email and message.
`/me/enquiries` is always scoped to `req.user.id` — never a client-supplied id
(Section 5.3). Its rows are `MyEnquiryWithPropertySchema`, not
`EnquiryWithPropertySchema`: `assignedAgentId`, `assignedAgent` and
`agentNotes` are omitted, because those are the agency's internal triage
record about the enquirer, not something "own records" (Section 5.3) extends
to.

**`PATCH /enquiries/:id`** — agent triage: any of `status`, `assignedAgentId`
(nullable, to unassign), `agentNotes` (nullable). At least one field is
required. 404s when the enquiry does not exist.

**`POST /properties/:id/site-visits`** — books a request, starting as
`REQUESTED`. Body is `preferredDate` (`YYYY-MM-DD`), `preferredSlot`
(`MORNING`/`AFTERNOON`/`EVENING`), optional `contactPhone`. **A preferred date
before today (server UTC) is rejected with `VALIDATION_ERROR`** — this is a
service-level rule, not a contract rule, because "today" is timezone-dependent
and a zod schema cannot express it. 404s when the property does not exist.

**`PATCH /me/site-visits/:id/cancel`** — own-record-only: a visit belonging to
someone else returns **403**, never 404 (Section 5.3). Sets `status` to
`CANCELLED`; a visit that is already `CANCELLED` or `COMPLETED` returns
**409**.

**`GET /site-visits`** / **`PATCH /site-visits/:id`** — agent queue, filterable
by `status`, `propertyId`, and a `preferredDate` range (`from`/`to`). The
update accepts `status`, `preferredDate`, `preferredSlot`, `agentNotes`; setting
`status: "CONFIRMED"` stamps `confirmedAt` the first time only. A rescheduled
`preferredDate` is checked against the same not-in-the-past rule.
`GET /me/site-visits` rows are `MySiteVisitWithPropertySchema`: `confirmedAt`
stays (the visitor needs to know their slot was confirmed) but `agentNotes` is
omitted, the same "own records is not staff annotations" reasoning as
enquiries.

**`GET /me/saved`** — the caller's shortlist, most recently saved first,
paginated like every other list endpoint (`page`, `limit`, max 50).

**`POST /me/saved/:propertyId`** — no body. **Idempotent**: saving an
already-saved plot returns `200` with the existing row rather than conflicting,
backed by an `upsert` against the composite primary key `(user_id, property_id)`
(Section 5.2). 404s when the property does not exist.

Response `200`:

```json
{
  "data": {
    "userId": "b2c3d4e5-6f70-4a1b-9c2d-3e4f5a6b7c8d",
    "propertyId": "9f1c3d2a-1b2c-4e5f-8a6b-7c8d9e0f1a2b",
    "createdAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

**`DELETE /me/saved/:propertyId`** — no body. Scoped by the composite key, so
it can never touch another user's row; if the plot was never saved by this
user, `NOT_FOUND`.

**`POST /properties/:id/interest`** — registers an expression of interest.
Body is optional `indicativeAmount` (a positive money string) and `notes`. This
is an enquiry mechanism only (Section 1.3): it creates no commitment and moves
no money, and the agency follows up individually. **One *open* registration
per person per property** (Section 5.2) — a unique index on
`(property_id, user_id)` backs it, so there is never more than one row for a
given pair. While that row is `NEW`, `CONTACTED` or `QUALIFIED`, a second
attempt returns **409 CONFLICT** with the message "You have already
registered interest in this property." Once it is `WITHDRAWN` or `CLOSED`,
registering again **reopens the same row** as `NEW` with the newly supplied
`indicativeAmount` and `notes` (response is `201`, same `id` as before) —
withdrawing is not a permanent lock-out. 404s when the property does not
exist.

Response `201`:

```json
{
  "data": {
    "id": "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "propertyId": "9f1c3d2a-1b2c-4e5f-8a6b-7c8d9e0f1a2b",
    "userId": "b2c3d4e5-6f70-4a1b-9c2d-3e4f5a6b7c8d",
    "indicativeAmount": "1200000",
    "notes": "Would like to join with two family members.",
    "status": "NEW",
    "agentNotes": null,
    "createdAt": "2026-07-30T09:00:00.000Z",
    "updatedAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

**`PATCH /me/interests/:id/withdraw`** — own-record-only: a registration
belonging to someone else returns **403**, never 404 (Section 5.3). Sets
`status` to `WITHDRAWN`; a registration that is already `WITHDRAWN` returns
**409**.

**`GET /interests`** / **`PATCH /interests/:id`** — agent follow-up queue,
filterable by `status` and `propertyId`. The update accepts `status` and
`agentNotes`. `GET /me/interests` rows are `MyInterestWithPropertySchema`:
`agentNotes` is omitted, the same "own records is not staff annotations"
reasoning as enquiries and site visits.

Notes for WP4:

- `POST /properties/:id/interest` returns **409** only while the caller's
  existing registration on that property is *open* (`NEW`/`CONTACTED`/
  `QUALIFIED`) — checked explicitly in the service so the conflict message
  stays in Section 1.3's approved vocabulary rather than a generic
  Prisma-mapped one. A `WITHDRAWN`/`CLOSED` registration is reopened instead,
  because the unique index means that row is the only one that pair can ever
  have.
- The "preferred date must not be in the past" rule belongs to the visits
  service, not the contract: it is timezone-dependent and the contract validates
  format only.
- Own-record-only routes (`PATCH /me/site-visits/:id/cancel`,
  `PATCH /me/interests/:id/withdraw`) always compare against `req.user.id`,
  never a client-supplied id, and return 403 rather than 404 for a record that
  belongs to someone else (Section 5.3).
- Section 1.3 governs every string in the interest flow. It records an
  expression of interest and nothing else — no stated return, yield or ROI
  figure, none of the vocabulary Section 1.3 prohibits, no funding-progress or
  urgency device.

_Documented — WP4._

### 9.5 Ownership, logs, snapshots (WP5)

| Method | Path                           | Access | Request schema                                     | Response schema                               |
| ------ | ------------------------------ | ------ | -------------------------------------------------- | --------------------------------------------- |
| GET    | `/me/properties`               | auth   | `PaginationQuerySchema`                            | `OwnedPropertyListResponseSchema` (paginated) |
| GET    | `/me/properties/:id`           | auth   | `IdParamSchema`                                    | `OwnedPropertyDetailSchema`                   |
| GET    | `/me/properties/:id/logs`      | auth   | `ManagementLogListQuerySchema`                     | `ManagementLogListResponseSchema` (paginated) |
| GET    | `/me/properties/:id/snapshots` | auth   | `PlotSnapshotListQuerySchema`                      | `PlotSnapshotListResponseSchema` (paginated)  |
| POST   | `/properties/:id/ownerships`   | agent  | `OwnershipCreateSchema`                            | `OwnershipResponseSchema`                     |
| PATCH  | `/ownerships/:id`              | agent  | `OwnershipUpdateSchema`                            | `OwnershipResponseSchema`                     |
| DELETE | `/ownerships/:id`              | admin  | —                                                  | —                                             |
| POST   | `/properties/:id/logs`         | agent  | `ManagementLogCreateSchema`                        | `ManagementLogResponseSchema`                 |
| PATCH  | `/logs/:id`                    | agent  | `ManagementLogUpdateSchema`                        | `ManagementLogResponseSchema`                 |
| POST   | `/logs/:id/media`              | agent  | multipart + `ManagementLogMediaUploadFieldsSchema` | `ManagementLogResponseSchema`                 |
| POST   | `/properties/:id/snapshots`    | agent  | multipart + `PlotSnapshotCreateSchema`             | `PlotSnapshotResponseSchema`                  |

Every `OwnedPropertyListItemSchema` row embeds a `PropertySummarySchema` under
`property` (id, slug, title, status, price, areaValue, areaUnit, locality,
city, surveyNumber, coverImageUrl) alongside the caller's own `ownership` row.

**`GET /me/properties`** — the caller's own holdings, most recently registered
first, paginated like every other list endpoint (`page`, `limit`, max 50).
Always scoped to `req.user.id` — never a client-supplied id (Section 5.3).

Response `200`:

```json
{
  "data": [
    {
      "property": {
        "id": "652ac0e3-bddf-5d2f-9ad2-a3f07accac53",
        "slug": "kovalam-beach-road-12-cent",
        "title": "12 cent plot on Kovalam Beach Road",
        "status": "AVAILABLE",
        "price": "8500000",
        "areaValue": "12",
        "areaUnit": "CENT",
        "locality": "Kovalam",
        "city": "Thiruvananthapuram",
        "surveyNumber": "412/3",
        "coverImageUrl": "http://localhost:4000/uploads/property-media/….jpg"
      },
      "ownership": {
        "id": "d3b5e9c1-2a4f-4b8e-9c1d-7a2b3c4d5e6f",
        "propertyId": "652ac0e3-bddf-5d2f-9ad2-a3f07accac53",
        "ownerUserId": "c46a6963-e004-5d31-a331-452954832f85",
        "ownerUser": { "id": "c46a6963-e004-5d31-a331-452954832f85", "fullName": "Meera Nair" },
        "sharePercentage": "100",
        "registeredOn": "2024-03-12",
        "documentRef": "DEED-2024-0312",
        "notes": null,
        "createdAt": "2026-07-30T09:00:00.000Z",
        "updatedAt": "2026-07-30T09:00:00.000Z"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

**`GET /me/properties/:id`** — full property detail (`PropertyResponseSchema`)
plus the caller's own `ownership` row and `ownerships`, every share on the
plot, so a co-owner can see how the 100% splits. **403**, not 404, when the
caller does not appear in `ownerships` for this property (Section 5.3); 404
when the property itself does not exist.

**`GET /me/properties/:id/logs`** — visible logs only, unconditionally
(Section 5.2), newest `occurredOn` first, filterable by `logType` and an
`occurredOn` range (`from`/`to`). A row with `isVisibleToOwner: false` is
**never** returned here, no matter who is asking — there is no agent-facing
log list in the spec, so this route behaves identically for every caller who
passes the ownership check, including an agent or admin who also happens to
be recorded as an owner. Same 403-not-404 ownership check as every
`/me/properties*` route.

**`GET /me/properties/:id/snapshots`** — the site-photo timeline, newest
`capturedAt` first, filterable by a `capturedAt` date range (`from`/`to`).
Same ownership check.

**`POST /properties/:id/ownerships`** — agent records a share. Body:
`ownerUserId` (required), `sharePercentage` (optional, defaults to `"100.00"`
— matching the column default, meaning "omit it for sole ownership"),
optional `registeredOn`, `documentRef`, `notes`. **409** when this person is
already recorded as an owner of the property (the `@@unique([propertyId,
ownerUserId])` index is the backstop), or when the resulting total
`share_percentage` for the property would exceed 100%. 404 when the property
does not exist.

Response `201`:

```json
{
  "data": {
    "id": "f1a2b3c4-5d6e-4f7a-8b9c-0d1e2f3a4b5c",
    "propertyId": "8a7da484-36d2-54f1-87f8-2fd4a962f19e",
    "ownerUserId": "d15a135b-7425-5600-a52b-52634ce66147",
    "ownerUser": { "id": "d15a135b-7425-5600-a52b-52634ce66147", "fullName": "Joseph Thomas" },
    "sharePercentage": "60",
    "registeredOn": "2024-05-01",
    "documentRef": "DEED-2024-0501",
    "notes": null,
    "createdAt": "2026-07-30T09:00:00.000Z",
    "updatedAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

**`PATCH /ownerships/:id`** — agent edit; at least one field. Changing
`sharePercentage` re-checks the cap against every *other* row on the same
property (the row being updated is excluded from its own sum). Changing
`ownerUserId` re-checks the one-owner-per-property uniqueness against the new
owner. Both violations are **409**. 404 when the record does not exist.

**`DELETE /ownerships/:id`** — admin only. `204`, no body. 404 when the record
does not exist.

**`POST /properties/:id/logs`** — agent records work done on the land. Body:
`logType`, `title`, `occurredOn`, optional `notes`, optional
`isVisibleToOwner` (defaults `true`). 404 when the property does not exist.

**`PATCH /logs/:id`** — agent edit; at least one field, including flipping
`isVisibleToOwner`. 404 when the log does not exist.

**`POST /logs/:id/media`** — multipart, up to 10 files on the `files` field,
optional `caption` form field applied to the whole batch. Returns the **whole
log** (`ManagementLogResponseSchema`), not a bare media array — there is no
separate list schema for log media in the contract, and the log's own `media`
array is the freshest state after the upload. Written to storage under
`STORAGE_PREFIX.logMedia`; a transaction failure after some files were stored
removes every object written during that call (Section "Reuse, do not
rebuild" — mirrors the property-media upload in WP3). 404 when the log does
not exist.

Response `201` (log with two prior media rows plus the new one):

```json
{
  "data": {
    "id": "1e2d3c4b-5a6f-4e7d-8c9b-0a1f2e3d4c5b",
    "propertyId": "652ac0e3-bddf-5d2f-9ad2-a3f07accac53",
    "agentId": "9c8b7a6f-5e4d-4c3b-8a2f-1e0d9c8b7a6f",
    "agent": { "id": "9c8b7a6f-5e4d-4c3b-8a2f-1e0d9c8b7a6f", "fullName": "Agent Priya" },
    "logType": "BOUNDARY",
    "title": "Boundary marker photographed",
    "notes": null,
    "occurredOn": "2026-06-15",
    "isVisibleToOwner": true,
    "media": [
      {
        "id": "2a3b4c5d-6e7f-4a1b-9c2d-3e4f5a6b7c8d",
        "logId": "1e2d3c4b-5a6f-4e7d-8c9b-0a1f2e3d4c5b",
        "url": "http://localhost:4000/uploads/log-media/….jpg",
        "caption": "South-east boundary marker",
        "createdAt": "2026-07-30T09:00:00.000Z"
      }
    ],
    "createdAt": "2026-06-15T09:00:00.000Z",
    "updatedAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

**`POST /properties/:id/snapshots`** — multipart, a single file on the `file`
field, optional `capturedAt` form field (defaults to upload time). `source` is
always `"MANUAL"` in the MVP — the column exists so an automated camera feed
can write rows later without a migration. Written to storage under
`STORAGE_PREFIX.snapshots`; a failed create removes the stored object. 404
when the property does not exist.

Response `201`:

```json
{
  "data": {
    "id": "3b4c5d6e-7f8a-4b1c-9d2e-3f4a5b6c7d8e",
    "propertyId": "652ac0e3-bddf-5d2f-9ad2-a3f07accac53",
    "capturedAt": "2026-07-30T09:00:00.000Z",
    "url": "http://localhost:4000/uploads/plot-snapshots/….jpg",
    "source": "MANUAL",
    "createdAt": "2026-07-30T09:00:00.000Z"
  },
  "meta": {}
}
```

Notes for WP5:

- Every `/me/properties*` endpoint must verify the caller appears in
  `ownerships` for that property, and must **403** otherwise (Section 5.3).
  Never trust a client-supplied user id. A missing property is still a
  genuine **404** — that check runs first.
- Total `share_percentage` per property must not exceed 100. A check
  constraint enforces the per-row range `(0, 100]`; the cross-row sum is the
  service's responsibility, checked on both create and update (excluding the
  row being updated from its own sum), returning `CONFLICT`.
- The same person can never be recorded twice on one property
  (`@@unique([propertyId, ownerUserId])`); checked explicitly for a specific
  message, with the unique index as the race-condition backstop.
- `GET /me/properties/:id/logs` returns visible logs only, unconditionally
  (Section 5.2 line 488) — a row with `isVisibleToOwner: false` is never
  returned, regardless of the caller's role. There is no agent-facing log
  list endpoint in the spec, so `ManagementLogListQuerySchema` deliberately
  carries no `includeHidden` flag for a role carve-out to key off.

_Documented — WP5._
