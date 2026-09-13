CREATE TABLE "wanjiedaoyou_fish_codex_entries" (
	"cultivator_id" uuid NOT NULL,
	"species_id" varchar(80) NOT NULL,
	"caught_count" integer DEFAULT 0 NOT NULL,
	"highest_quality" varchar(10) NOT NULL,
	"largest_weight" double precision DEFAULT 0 NOT NULL,
	"first_caught_at" timestamp DEFAULT now() NOT NULL,
	"last_caught_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_fish_codex_entries_cultivator_id_species_id_pk" PRIMARY KEY("cultivator_id","species_id")
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_fish_codex_entries" ADD CONSTRAINT "wanjiedaoyou_fish_codex_entries_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fish_codex_cultivator_idx" ON "wanjiedaoyou_fish_codex_entries" USING btree ("cultivator_id");