-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUBSCRIBER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PLOT', 'HOUSE', 'APARTMENT', 'COMMERCIAL', 'FARMLAND');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'UNDER_OFFER', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AreaUnit" AS ENUM ('SQFT', 'SQM', 'CENT', 'ACRE', 'HECTARE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'TOUR_360');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WITHDRAWN', 'CLOSED');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('INSPECTION', 'MAINTENANCE', 'TAX', 'LEGAL', 'BOUNDARY', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SUBSCRIBER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "property_type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(14,2) NOT NULL,
    "price_is_negotiable" BOOLEAN NOT NULL DEFAULT false,
    "area_value" DECIMAL(12,2) NOT NULL,
    "area_unit" "AreaUnit" NOT NULL,
    "address_line" VARCHAR(255),
    "locality" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL,
    "district" VARCHAR(120),
    "state" VARCHAR(120) NOT NULL,
    "pincode" VARCHAR(10),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "boundary" geography(Polygon, 4326),
    "survey_number" VARCHAR(80),
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "is_group_purchase" BOOLEAN NOT NULL DEFAULT false,
    "group_target_amount" DECIMAL(14,2),
    "group_min_ticket" DECIMAL(14,2),
    "listed_by_agent_id" UUID,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "type" "MediaType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(20),
    "message" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assigned_agent_id" UUID,
    "agent_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preferred_date" DATE NOT NULL,
    "preferred_slot" "VisitSlot" NOT NULL,
    "contact_phone" VARCHAR(20),
    "status" "VisitStatus" NOT NULL DEFAULT 'REQUESTED',
    "confirmed_at" TIMESTAMPTZ(6),
    "agent_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_properties" (
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_properties_pkey" PRIMARY KEY ("user_id","property_id")
);

-- CreateTable
CREATE TABLE "interest_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "indicative_amount" DECIMAL(14,2),
    "notes" TEXT,
    "status" "InterestStatus" NOT NULL DEFAULT 'NEW',
    "agent_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interest_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownerships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "share_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "registered_on" DATE,
    "document_ref" VARCHAR(120),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "log_type" "LogType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "notes" TEXT,
    "occurred_on" DATE NOT NULL,
    "is_visible_to_owner" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "management_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_log_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "log_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "management_log_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plot_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_property_type_idx" ON "properties"("property_type");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_is_group_purchase_idx" ON "properties"("is_group_purchase");

-- CreateIndex
CREATE INDEX "properties_listed_by_agent_id_idx" ON "properties"("listed_by_agent_id");

-- CreateIndex
CREATE INDEX "properties_status_published_at_idx" ON "properties"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "property_media_property_id_sort_order_idx" ON "property_media"("property_id", "sort_order");

-- CreateIndex
CREATE INDEX "enquiries_property_id_idx" ON "enquiries"("property_id");

-- CreateIndex
CREATE INDEX "enquiries_user_id_idx" ON "enquiries"("user_id");

-- CreateIndex
CREATE INDEX "enquiries_status_created_at_idx" ON "enquiries"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "site_visits_property_id_idx" ON "site_visits"("property_id");

-- CreateIndex
CREATE INDEX "site_visits_user_id_idx" ON "site_visits"("user_id");

-- CreateIndex
CREATE INDEX "site_visits_status_preferred_date_idx" ON "site_visits"("status", "preferred_date");

-- CreateIndex
CREATE INDEX "saved_properties_property_id_idx" ON "saved_properties"("property_id");

-- CreateIndex
CREATE INDEX "interest_registrations_user_id_idx" ON "interest_registrations"("user_id");

-- CreateIndex
CREATE INDEX "interest_registrations_status_created_at_idx" ON "interest_registrations"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "interest_registrations_property_id_user_id_key" ON "interest_registrations"("property_id", "user_id");

-- CreateIndex
CREATE INDEX "ownerships_owner_user_id_idx" ON "ownerships"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ownerships_property_id_owner_user_id_key" ON "ownerships"("property_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "management_logs_property_id_occurred_on_idx" ON "management_logs"("property_id", "occurred_on" DESC);

-- CreateIndex
CREATE INDEX "management_logs_agent_id_idx" ON "management_logs"("agent_id");

-- CreateIndex
CREATE INDEX "management_log_media_log_id_idx" ON "management_log_media"("log_id");

-- CreateIndex
CREATE INDEX "plot_snapshots_property_id_captured_at_idx" ON "plot_snapshots"("property_id", "captured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_listed_by_agent_id_fkey" FOREIGN KEY ("listed_by_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_registrations" ADD CONSTRAINT "interest_registrations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_registrations" ADD CONSTRAINT "interest_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_logs" ADD CONSTRAINT "management_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_logs" ADD CONSTRAINT "management_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_log_media" ADD CONSTRAINT "management_log_media_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "management_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_snapshots" ADD CONSTRAINT "plot_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

