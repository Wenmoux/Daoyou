ALTER TABLE "wanjiedaoyou_fish_codex_entries" ADD COLUMN "best_bait_id" varchar(80);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fish_codex_entries" ADD COLUMN "best_weather" varchar(16);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fish_codex_entries" ADD COLUMN "best_moon_phase" varchar(16);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fish_codex_entries" ADD COLUMN "best_anomaly_id" varchar(80);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN "bait_id" varchar(80) DEFAULT 'spirit-worm' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN "weather" varchar(16) DEFAULT '晴' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN "time_phase" varchar(16) DEFAULT '白昼' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN "moon_phase" varchar(16) DEFAULT '上弦' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN "tide_id" varchar(80) DEFAULT 'still-water' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD COLUMN "anomaly_id" varchar(80);