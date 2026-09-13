CREATE TABLE "wanjiedaoyou_telegram_bind_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_telegram_bind_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_telegram_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"telegram_username" text,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"world_push_enabled" boolean DEFAULT false NOT NULL,
	"bound_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_telegram_bindings_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wanjiedaoyou_telegram_bindings_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_telegram_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telegram_bind_tokens_user_idx" ON "wanjiedaoyou_telegram_bind_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "telegram_bindings_status_idx" ON "wanjiedaoyou_telegram_bindings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "telegram_bindings_chat_idx" ON "wanjiedaoyou_telegram_bindings" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "telegram_updates_received_idx" ON "wanjiedaoyou_telegram_updates" USING btree ("received_at");