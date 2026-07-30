-- Database objects Prisma cannot express (Section 13, WP0).
--
-- 1. properties.location is derived from latitude/longitude by a trigger, so
--    application code writes lat/lng only (Section 4.3).
-- 2. GIST indexes on the two geography columns, required by the ST_DWithin
--    radius search and the && bounding-box search.
-- 3. A partial unique index enforcing at most one cover image per property
--    (Section 4.2, property_media).
-- 4. Per-row sanity checks on coordinates and share percentage.
--
-- WARNING: Prisma models indexes but not triggers, functions or check
-- constraints. A future `prisma migrate dev` will try to DROP the three indexes
-- created below because they do not appear in schema.prisma. Review every
-- generated migration and delete those DROP statements. See prisma/README.md.

-- 1. lat/lng -> location sync ------------------------------------------------

CREATE OR REPLACE FUNCTION properties_sync_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- ST_MakePoint takes longitude first.
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_sync_location_trg ON "properties";

CREATE TRIGGER properties_sync_location_trg
BEFORE INSERT OR UPDATE OF "latitude", "longitude"
ON "properties"
FOR EACH ROW
EXECUTE FUNCTION properties_sync_location();

-- Backfill any row that predates the trigger.
UPDATE "properties"
SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
WHERE "location" IS NULL;

-- 2. Geospatial indexes -----------------------------------------------------

CREATE INDEX IF NOT EXISTS "properties_location_gist_idx"
  ON "properties" USING GIST ("location");

CREATE INDEX IF NOT EXISTS "properties_boundary_gist_idx"
  ON "properties" USING GIST ("boundary");

-- 3. At most one cover image per property ------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "property_media_one_cover_per_property_idx"
  ON "property_media" ("property_id")
  WHERE "is_cover";

-- 4. Row-level sanity checks -------------------------------------------------

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_latitude_range_chk"
  CHECK ("latitude" >= -90 AND "latitude" <= 90);

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_longitude_range_chk"
  CHECK ("longitude" >= -180 AND "longitude" <= 180);

ALTER TABLE "ownerships"
  ADD CONSTRAINT "ownerships_share_percentage_range_chk"
  CHECK ("share_percentage" > 0 AND "share_percentage" <= 100);
