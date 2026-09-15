CREATE TABLE IF NOT EXISTS "wanjiedaoyou_spirit_ponds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_cultivator_id" uuid NOT NULL REFERENCES "wanjiedaoyou_cultivators"("id") ON DELETE CASCADE,
  "access_mode" varchar(20) DEFAULT 'private' NOT NULL,
  "entry_fee" integer DEFAULT 0 NOT NULL,
  "native_seed" varchar(80) DEFAULT 'xiao-qingyu' NOT NULL,
  "last_breed_at" timestamp DEFAULT now() NOT NULL,
  "next_breed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "spirit_ponds_owner_uidx" ON "wanjiedaoyou_spirit_ponds" ("owner_cultivator_id");
CREATE TABLE IF NOT EXISTS "wanjiedaoyou_spirit_pond_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pond_id" uuid NOT NULL REFERENCES "wanjiedaoyou_spirit_ponds"("id") ON DELETE CASCADE,
  "slot" integer NOT NULL,
  "species_id" varchar(80) NOT NULL,
  "domestication" integer DEFAULT 0 NOT NULL,
  "fish_count" integer DEFAULT 0 NOT NULL,
  "fry_count" integer DEFAULT 0 NOT NULL,
  "fish_quality_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "fry_quality_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "spirit_pond_slots_pond_slot_uidx" ON "wanjiedaoyou_spirit_pond_slots" ("pond_id", "slot");
CREATE UNIQUE INDEX IF NOT EXISTS "spirit_pond_slots_pond_species_uidx" ON "wanjiedaoyou_spirit_pond_slots" ("pond_id", "species_id");
CREATE TABLE IF NOT EXISTS "wanjiedaoyou_spirit_pond_visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pond_id" uuid NOT NULL REFERENCES "wanjiedaoyou_spirit_ponds"("id") ON DELETE CASCADE,
  "visitor_cultivator_id" uuid NOT NULL REFERENCES "wanjiedaoyou_cultivators"("id") ON DELETE CASCADE,
  "valid_until" timestamp NOT NULL,
  "request_id" varchar(128) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "spirit_pond_visits_request_uidx" ON "wanjiedaoyou_spirit_pond_visits" ("visitor_cultivator_id", "request_id");
CREATE INDEX IF NOT EXISTS "spirit_pond_visits_active_idx" ON "wanjiedaoyou_spirit_pond_visits" ("pond_id", "visitor_cultivator_id", "valid_until");
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN IF NOT EXISTS "fish_points" integer DEFAULT 0 NOT NULL;
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN IF NOT EXISTS "fishing_buffs" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN IF NOT EXISTS "merchant_available_until" timestamp;
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN IF NOT EXISTS "pond_id" uuid;
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN IF NOT EXISTS "pond_visit_id" uuid;
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN IF NOT EXISTS "pond_species_weights" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "wanjiedaoyou_spirit_ponds" ADD COLUMN IF NOT EXISTS "location_id" varchar(80) DEFAULT 'qingxi-shallow' NOT NULL;
ALTER TABLE "wanjiedaoyou_spirit_pond_slots" ADD COLUMN IF NOT EXISTS "fish_quality_counts" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "wanjiedaoyou_spirit_pond_slots" ADD COLUMN IF NOT EXISTS "fry_quality_counts" jsonb DEFAULT '{}'::jsonb NOT NULL;
