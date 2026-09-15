/**
 * [INPUT]: Zod
 * [OUTPUT]: 灵池快照、喂养、繁殖、访问权限请求契约
 * [POS]: 洞府灵池 API 的共享边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from 'zod';
export const SpiritPondFeedRequestSchema = z.object({ slot: z.number().int().min(1).max(2), speciesId: z.string().trim().min(1).max(80), quality: z.string().trim().min(1).max(10), quantity: z.number().int().min(1).max(500), requestId: z.string().trim().min(8).max(128) });
export const SpiritPondBreedRequestSchema = z.object({ requestId: z.string().trim().min(8).max(128) });
export const SpiritPondAccessRequestSchema = z.object({ accessMode: z.enum(['private', 'friends_free', 'friends_ticket']), entryFee: z.number().int().min(0).max(100000).default(0), requestId: z.string().trim().min(8).max(128) });
export const SpiritPondVisitRequestSchema = z.object({ ownerCultivatorId: z.string().uuid(), requestId: z.string().trim().min(8).max(128) });
export const SpiritPondFryTransferRequestSchema = z.object({ targetCultivatorId: z.string().uuid(), slot: z.number().int().min(1).max(2), quantity: z.number().int().min(1).max(1000), requestId: z.string().trim().min(8).max(128) });
export type SpiritPondFeedRequest = z.infer<typeof SpiritPondFeedRequestSchema>;
export type SpiritPondBreedRequest = z.infer<typeof SpiritPondBreedRequestSchema>;
export type SpiritPondAccessRequest = z.infer<typeof SpiritPondAccessRequestSchema>;
export type SpiritPondVisitRequest = z.infer<typeof SpiritPondVisitRequestSchema>;
export type SpiritPondFryTransferRequest = z.infer<typeof SpiritPondFryTransferRequestSchema>;
