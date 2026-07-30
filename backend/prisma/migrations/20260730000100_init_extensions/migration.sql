-- Extensions the rest of the schema depends on. This must be the first
-- migration: the `properties` table declares geography columns, `users.email`
-- and `enquiries.email` are citext, and every primary key defaults to
-- gen_random_uuid().
--
-- docker/init/01-extensions.sql does the same for a freshly created data
-- volume; repeating it here means CI databases and the Prisma shadow database
-- are set up correctly too.

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
