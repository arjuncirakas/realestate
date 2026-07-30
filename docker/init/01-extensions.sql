-- Enables the extensions the schema depends on.
--
-- postgis   : geography(Point|Polygon, 4326) columns and the ST_* functions
--             used by the radius and bounding-box searches.
-- citext    : case-insensitive email columns on users and enquiries.
-- pgcrypto  : gen_random_uuid() defaults on every primary key.
--
-- This script runs only when the data volume is empty. The first Prisma
-- migration repeats these statements so that CI databases, the Prisma shadow
-- database, and existing volumes all end up in the same state.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
