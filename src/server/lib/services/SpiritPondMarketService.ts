/**
 * [INPUT]: 依赖灵池鱼苗账本、角色灵石与玩家命令事务
 * [OUTPUT]: 对外提供鱼苗挂牌、购买、撤单与公开行情查询
 * [POS]: 洞府灵池的交易边界；挂牌鱼苗先进入托管，成交时原子结算灵石和买家鱼苗
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getExecutor } from '@server/lib/drizzle/db';
import {
  cultivators,
  spiritPondFryListings,
  spiritPondSlots,
} from '@server/lib/drizzle/schema';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { ensureSpiritPond } from '@server/lib/services/SpiritPondService';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import type {
  SpiritPondFryListingBuyRequest,
  SpiritPondFryListingCancelRequest,
  SpiritPondFryListingCreateRequest,
} from '@shared/contracts/spiritPond';
import { FISH_SPECIES_BY_ID, normalizeFishQualityCounts } from '@shared/engine/fishing';
import { and, desc, eq, gt, sql } from 'drizzle-orm';

export type SpiritPondMarketActor = { userId: string; cultivatorId: string };

export class SpiritPondMarketError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 = 400) {
    super(message);
  }
}

function changeQualityCount(
  counts: Record<string, number>,
  quality: string,
  delta: number,
) {
  const next = { ...counts, [quality]: (counts[quality] ?? 0) + delta };
  if (next[quality] === 0) delete next[quality];
  return next;
}

function viewListing(
  row: typeof spiritPondFryListings.$inferSelect,
  sellerName: string,
  actorCultivatorId: string,
) {
  return {
    id: row.id,
    sellerCultivatorId: row.sellerCultivatorId,
    sellerName,
    isOwner: row.sellerCultivatorId === actorCultivatorId,
    speciesId: row.speciesId,
    speciesName: FISH_SPECIES_BY_ID[row.speciesId]?.name ?? row.speciesId,
    quality: row.quality,
    quantity: row.quantity,
    remainingQuantity: row.remainingQuantity,
    unitPrice: row.unitPrice,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSpiritPondFryListings(actor: SpiritPondMarketActor) {
  const rows = await getExecutor()
    .select({ listing: spiritPondFryListings, sellerName: cultivators.name })
    .from(spiritPondFryListings)
    .innerJoin(cultivators, eq(cultivators.id, spiritPondFryListings.sellerCultivatorId))
    .where(and(eq(spiritPondFryListings.status, 'active'), gt(spiritPondFryListings.remainingQuantity, 0)))
    .orderBy(desc(spiritPondFryListings.createdAt))
    .limit(100);
  return rows.map(({ listing, sellerName }) => viewListing(listing, sellerName, actor.cultivatorId));
}

export async function createSpiritPondFryListing(
  actor: SpiritPondMarketActor,
  input: SpiritPondFryListingCreateRequest,
) {
  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_pond_fry_list',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      const pond = await ensureSpiritPond(actor.cultivatorId, tx);
      const [slot] = await tx
        .select()
        .from(spiritPondSlots)
        .where(and(eq(spiritPondSlots.pondId, pond.id), eq(spiritPondSlots.slot, input.slot)))
        .for('update')
        .limit(1);
      if (!slot) throw new SpiritPondMarketError('该喂养槽还没有鱼苗', 404);
      const currentFryQualityCounts = normalizeFishQualityCounts(slot.fryQualityCounts ?? {}, slot.fryCount);
      if ((currentFryQualityCounts[input.quality] ?? 0) < input.quantity) {
        throw new SpiritPondMarketError(`该品质鱼苗不足 ${input.quantity} 尾`, 409);
      }
      const fryQualityCounts = changeQualityCount(
        currentFryQualityCounts,
        input.quality,
        -input.quantity,
      );
      await tx
        .update(spiritPondSlots)
        .set({
          fryCount: sql`${spiritPondSlots.fryCount} - ${input.quantity}`,
          fryQualityCounts,
        })
        .where(eq(spiritPondSlots.id, slot.id));
      const [listing] = await tx
        .insert(spiritPondFryListings)
        .values({
          sellerCultivatorId: actor.cultivatorId,
          speciesId: slot.speciesId,
          quality: input.quality,
          quantity: input.quantity,
          remainingQuantity: input.quantity,
          unitPrice: input.unitPrice,
        })
        .returning();
      return {
        result: { listingId: listing.id, message: '鱼苗已放入集市托管' },
        resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.fry-listed', operation: 'invalidate' as const }],
      };
    },
  });
}

export async function buySpiritPondFryListing(
  actor: SpiritPondMarketActor,
  input: SpiritPondFryListingBuyRequest,
) {
  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_pond_fry_buy',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      const [listing] = await tx
        .select()
        .from(spiritPondFryListings)
        .where(eq(spiritPondFryListings.id, input.listingId))
        .for('update')
        .limit(1);
      if (!listing || listing.status !== 'active') throw new SpiritPondMarketError('鱼苗挂牌已失效', 404);
      if (listing.sellerCultivatorId === actor.cultivatorId) throw new SpiritPondMarketError('不能购买自己的鱼苗', 409);
      if (listing.remainingQuantity < input.quantity) throw new SpiritPondMarketError('挂牌剩余鱼苗不足', 409);
      const [seller] = await tx
        .select({ userId: cultivators.userId })
        .from(cultivators)
        .where(and(eq(cultivators.id, listing.sellerCultivatorId), eq(cultivators.status, 'active')))
        .limit(1);
      if (!seller) throw new SpiritPondMarketError('卖家角色已失效', 409);

      const pond = await ensureSpiritPond(actor.cultivatorId, tx);
      const slots = await tx.select().from(spiritPondSlots).where(eq(spiritPondSlots.pondId, pond.id));
      const target = slots.find((slot) => slot.speciesId === listing.speciesId);
      const freeSlot = [1, 2].find((slotNumber) => !slots.some((slot) => slot.slot === slotNumber));
      if (!target && !freeSlot) throw new SpiritPondMarketError('灵池两个喂养槽都已被其他鱼种占用', 409);

      const totalPrice = listing.unitPrice * input.quantity;
      if (totalPrice > 10_000_000) throw new SpiritPondMarketError('单笔鱼苗交易不能超过一千万灵石', 409);
      await updateSpiritStones(actor.userId, actor.cultivatorId, -totalPrice, tx);
      await updateSpiritStones(seller.userId, listing.sellerCultivatorId, totalPrice, tx);

      if (target) {
        const fryQualityCounts = normalizeFishQualityCounts(target.fryQualityCounts ?? {}, target.fryCount);
        await tx
          .update(spiritPondSlots)
          .set({
            fryCount: sql`${spiritPondSlots.fryCount} + ${input.quantity}`,
            fryQualityCounts: changeQualityCount(fryQualityCounts, listing.quality, input.quantity),
          })
          .where(eq(spiritPondSlots.id, target.id));
      } else {
        await tx.insert(spiritPondSlots).values({
          pondId: pond.id,
          slot: freeSlot!,
          speciesId: listing.speciesId,
          fryCount: input.quantity,
          fryQualityCounts: { [listing.quality]: input.quantity },
        });
      }

      const remainingQuantity = listing.remainingQuantity - input.quantity;
      await tx
        .update(spiritPondFryListings)
        .set({ remainingQuantity, status: remainingQuantity === 0 ? 'sold_out' : 'active' })
        .where(eq(spiritPondFryListings.id, listing.id));
      return {
        result: { message: `购得鱼苗 ${input.quantity} 尾`, totalPrice },
        resourceChanges: [
          { resourceTopic: 'player.profile' as const, eventType: 'spirit-pond.fry-bought', operation: 'invalidate' as const },
          { resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.fry-stocked', operation: 'invalidate' as const },
          { scope: { kind: 'cultivator' as const, id: listing.sellerCultivatorId }, resourceTopic: 'player.profile' as const, eventType: 'spirit-pond.fry-sold', operation: 'invalidate' as const },
        ],
      };
    },
  });
}

export async function cancelSpiritPondFryListing(
  actor: SpiritPondMarketActor,
  input: SpiritPondFryListingCancelRequest,
) {
  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_pond_fry_cancel',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      const [listing] = await tx
        .select()
        .from(spiritPondFryListings)
        .where(eq(spiritPondFryListings.id, input.listingId))
        .for('update')
        .limit(1);
      if (!listing || listing.sellerCultivatorId !== actor.cultivatorId) {
        throw new SpiritPondMarketError('没有找到你的鱼苗挂牌', 404);
      }
      if (listing.status !== 'active' || listing.remainingQuantity <= 0) {
        throw new SpiritPondMarketError('该挂牌已经结束', 409);
      }
      const pond = await ensureSpiritPond(actor.cultivatorId, tx);
      const slots = await tx.select().from(spiritPondSlots).where(eq(spiritPondSlots.pondId, pond.id));
      const target = slots.find((slot) => slot.speciesId === listing.speciesId);
      const freeSlot = [1, 2].find((slotNumber) => !slots.some((slot) => slot.slot === slotNumber));
      if (!target && !freeSlot) throw new SpiritPondMarketError('灵池没有空槽可以收回鱼苗', 409);
      if (target) {
        const fryQualityCounts = normalizeFishQualityCounts(target.fryQualityCounts ?? {}, target.fryCount);
        await tx
          .update(spiritPondSlots)
          .set({
            fryCount: sql`${spiritPondSlots.fryCount} + ${listing.remainingQuantity}`,
            fryQualityCounts: changeQualityCount(fryQualityCounts, listing.quality, listing.remainingQuantity),
          })
          .where(eq(spiritPondSlots.id, target.id));
      } else {
        await tx.insert(spiritPondSlots).values({
          pondId: pond.id,
          slot: freeSlot!,
          speciesId: listing.speciesId,
          fryCount: listing.remainingQuantity,
          fryQualityCounts: { [listing.quality]: listing.remainingQuantity },
        });
      }
      await tx
        .update(spiritPondFryListings)
        .set({ remainingQuantity: 0, status: 'cancelled' })
        .where(eq(spiritPondFryListings.id, listing.id));
      return {
        result: { message: '剩余鱼苗已收回灵池' },
        resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.fry-cancelled', operation: 'invalidate' as const }],
      };
    },
  });
}
