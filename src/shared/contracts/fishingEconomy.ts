/**
 * [INPUT]: Zod
 * [OUTPUT]: 鱼贸兑换与垂钓增益兑换请求契约
 * [POS]: 垂钓经济 API 边界校验
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from 'zod';
export const FishingTradeRequestSchema = z.object({ offerId: z.string().trim().min(3).max(160), quantity: z.number().int().min(1).max(99), requestId: z.string().trim().min(8).max(128) });
export const FishingBuffRequestSchema = z.object({ type: z.enum(['legendary_rate', 'double_catch']), cost: z.number().int().min(10).max(5000).optional(), requestId: z.string().trim().min(8).max(128) });
export type FishingTradeRequest = z.infer<typeof FishingTradeRequestSchema>;
export type FishingBuffRequest = z.infer<typeof FishingBuffRequestSchema>;
