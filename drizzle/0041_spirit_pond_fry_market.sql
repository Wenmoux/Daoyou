-- [INPUT]: 依赖角色主表与 0040 洞府灵池聚合
-- [OUTPUT]: 提供鱼苗托管挂牌、剩余库存、单价和成交状态持久化
-- [POS]: 鱼苗玩家交易的账本边界，挂牌资产与灵池在库鱼苗互斥
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
CREATE TABLE IF NOT EXISTS "wanjiedaoyou_spirit_pond_fry_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_cultivator_id" uuid NOT NULL REFERENCES "wanjiedaoyou_cultivators"("id") ON DELETE CASCADE,
  "species_id" varchar(80) NOT NULL,
  "quality" varchar(16) NOT NULL,
  "quantity" integer NOT NULL,
  "remaining_quantity" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "spirit_pond_fry_listings_active_idx" ON "wanjiedaoyou_spirit_pond_fry_listings" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "spirit_pond_fry_listings_seller_idx" ON "wanjiedaoyou_spirit_pond_fry_listings" ("seller_cultivator_id", "status");
