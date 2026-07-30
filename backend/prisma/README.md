# Prisma notes

## Raw-SQL objects Prisma does not know about

`migrations/20260730000300_geo_trigger_and_indexes` creates database objects
that have no representation in `schema.prisma`:

| Object                                                                                                     | Kind                 | Prisma aware?                             |
| ---------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------- |
| `properties_sync_location()` + `properties_sync_location_trg`                                              | function + trigger   | no — Prisma never diffs these, safe       |
| `properties_location_gist_idx`                                                                             | GIST index           | **no — Prisma will try to drop it**       |
| `properties_boundary_gist_idx`                                                                             | GIST index           | **no — Prisma will try to drop it**       |
| `property_media_one_cover_per_property_idx`                                                                | partial unique index | no — Prisma ignores partial indexes, safe |
| `properties_latitude_range_chk`, `properties_longitude_range_chk`, `ownerships_share_percentage_range_chk` | check constraints    | no — Prisma never diffs these, safe       |

Prisma models plain indexes but cannot express a GIST index over an
`Unsupported()` column, so it treats the two GIST indexes as unwanted. Measured
with:

```
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://estate:estate@localhost:5433/estate_shadow_probe" \
  --script
```

which currently outputs exactly:

```sql
-- DropIndex
DROP INDEX "properties_boundary_gist_idx";

-- DropIndex
DROP INDEX "properties_location_gist_idx";
```

**Rule: read every generated migration before applying it and delete any
`DROP INDEX` that targets `properties_location_gist_idx` or
`properties_boundary_gist_idx`.** If a drop slips through, re-create them by
copying the relevant block out of
`20260730000300_geo_trigger_and_indexes/migration.sql`. Run the `migrate diff`
command above at any time to see the current expected noise — anything beyond
those two `DROP INDEX` lines is a real schema change.

## Why the geography columns are in the generated migration

Section 13 describes "a raw-SQL migration adding the `location`/`boundary`
geography columns". They are instead declared in `schema.prisma` as
`Unsupported("geography(Point, 4326)")?` and created by the generated `_init`
migration. The reason is drift: a column that exists in the database but not in
`schema.prisma` makes Prisma emit `ALTER TABLE ... DROP COLUMN` on the next
`migrate dev`, which would silently destroy the geospatial data. Declaring them
as `Unsupported` keeps Prisma aware of them while still keeping them out of
Prisma Client — so application code cannot read or write them directly and must
go through `$queryRaw`, which is exactly the intended constraint.

## Migration order

1. `20260730000100_init_extensions` — postgis, citext, pgcrypto. Must run first;
   the tables in step 2 depend on all three.
2. `20260730000200_init` — enums, tables, standard indexes, foreign keys.
   Generated with `prisma migrate diff --from-empty --to-schema-datamodel`.
3. `20260730000300_geo_trigger_and_indexes` — the objects listed above.

## Seeding

There is no `prisma.seed` entry in `package.json`: Prisma 7 replaces it with
`prisma.config.ts`, and this project allows no TypeScript files (Section 2.1).
Seed explicitly instead:

```
npm run db:seed          # from the repo root
node prisma/seed.js      # from backend/
```

`prisma migrate reset` therefore drops and migrates but does **not** re-seed.
Run `npm run db:seed` afterwards.
