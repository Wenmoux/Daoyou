ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN "daily_casts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN "daily_reset_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN "unlocked_bait_ids" jsonb DEFAULT '["spirit-worm"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD COLUMN "unlocked_reward_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;