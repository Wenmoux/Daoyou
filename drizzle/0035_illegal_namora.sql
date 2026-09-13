CREATE TABLE "wanjiedaoyou_fishing_profiles" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"total_casts" integer DEFAULT 0 NOT NULL,
	"successful_catches" integer DEFAULT 0 NOT NULL,
	"escaped_fish" integer DEFAULT 0 NOT NULL,
	"largest_weight" double precision DEFAULT 0 NOT NULL,
	"unlocked_water_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_fishing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"location_id" varchar(80) NOT NULL,
	"map_node_id" varchar(80),
	"state" varchar(24) NOT NULL,
	"cast_at" timestamp NOT NULL,
	"bite_at" timestamp NOT NULL,
	"bite_deadline_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_profiles" ADD CONSTRAINT "wanjiedaoyou_fishing_profiles_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fishing_sessions" ADD CONSTRAINT "wanjiedaoyou_fishing_sessions_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fishing_profiles_updated_idx" ON "wanjiedaoyou_fishing_profiles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "fishing_sessions_cultivator_state_idx" ON "wanjiedaoyou_fishing_sessions" USING btree ("cultivator_id","state");--> statement-breakpoint
CREATE INDEX "fishing_sessions_bite_deadline_idx" ON "wanjiedaoyou_fishing_sessions" USING btree ("bite_deadline_at");