/**
 * [INPUT]: 依赖 Zod 与共享垂钓目录
 * [OUTPUT]: 提供抛竿与提竿动作的 API 请求契约
 * [POS]: 前后端共同使用的边界校验，防止客户端伪造水域或幂等请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from 'zod';

export const FishingCastRequestSchema = z.object({
  locationId: z.string().trim().min(1).max(80),
  mapNodeId: z.string().trim().min(1).max(80).optional(),
  baitId: z.string().trim().min(1).max(80).default('spirit-worm'),
  requestId: z.string().trim().min(8).max(128),
});

export type FishingCastRequest = z.infer<typeof FishingCastRequestSchema>;

export const FishingSessionRequestSchema = z.object({
  locationId: z.string().trim().min(1).max(80),
  mapNodeId: z.string().trim().min(1).max(80).optional(),
  pondVisitId: z.string().uuid().optional(),
  baitId: z.string().trim().min(1).max(80).default('spirit-worm'),
  requestId: z.string().trim().min(8).max(128),
});

export type FishingSessionRequest = z.infer<typeof FishingSessionRequestSchema>;

export const FishingStrikeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  requestId: z.string().trim().min(8).max(128),
});

export type FishingStrikeRequest = z.infer<typeof FishingStrikeRequestSchema>;
