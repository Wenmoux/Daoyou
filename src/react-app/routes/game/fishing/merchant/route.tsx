/**
 * [INPUT]: 依赖鱼贸经济快照、兑换 API 与玩家选择的鱼获堆栈
 * [OUTPUT]: 对外提供限时商人、鱼换鱼/物品/灵石、鱼货积分商店和委托增益页面
 * [POS]: 垂钓场景的经济分支；页面筛选报价，服务端重新校验商人、库存与价格
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useEffect, useMemo, useState } from 'react';

type FishStack = { speciesId: string; speciesName: string; quality: string; quantity: number };
type Offer = {
  id: string;
  kind: string;
  speciesId: string;
  speciesName: string;
  quality: string;
  inputQuantity: number;
  output: Record<string, unknown>;
};
type Snapshot = {
  merchantAvailable: boolean;
  merchantAvailableUntil: string | null;
  points: number;
  inventory: FishStack[];
  offers: Offer[];
};
type Envelope<T> = { success: boolean; data?: T; error?: string };

function requestId(prefix: string) {
  return `fish-merchant:${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function offerLabel(offer: Offer) {
  if (offer.kind === 'upgrade') return `炼成更高品阶 · 需 ${offer.inputQuantity} 条`;
  if (offer.kind === 'mission_legendary') return `委托：珍稀鱼运一小时 · 需 ${offer.inputQuantity} 条`;
  if (offer.kind === 'mission_double') return `委托：双倍鱼获一小时 · 需 ${offer.inputQuantity} 条`;
  if (offer.kind === 'stones') return `换 ${String(offer.output.spiritStones)} 灵石/条`;
  if (offer.kind === 'fish_item') return `换 ${String(offer.output.item)} ×${String(offer.output.quantity)} · 需 ${offer.inputQuantity} 条`;
  return `换 ${String(offer.output.points)} 鱼货积分/条`;
}

export default function FishingMerchantPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedStack, setSelectedStack] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    const response = await fetch('/api/fishing-economy', { cache: 'no-store' });
    const payload = await response.json() as Envelope<Snapshot>;
    if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? '鱼贸暂不可用');
    setSnapshot(payload.data);
    setSelectedStack((current) => {
      if (payload.data?.inventory.some((stack) => `${stack.speciesId}:${stack.quality}` === current)) return current;
      const first = payload.data?.inventory[0];
      return first ? `${first.speciesId}:${first.quality}` : '';
    });
  };

  useEffect(() => { void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : '鱼贸暂不可用')); }, []);

  const selectedOffers = useMemo(() => {
    const [speciesId, quality] = selectedStack.split(':');
    return snapshot?.offers.filter((offer) => offer.kind !== 'item' && offer.speciesId === speciesId && offer.quality === quality) ?? [];
  }, [selectedStack, snapshot]);

  const post = async (path: string, body: Record<string, unknown>) => {
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/fishing-economy/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json() as Envelope<{ message?: string }>;
    if (!response.ok || !payload.success) throw new Error(payload.error ?? '兑换失败');
    setNotice(payload.data?.message ?? '交易完成');
    await refresh();
  };

  const trade = (offerId: string, quantity = 1) => post('trade', { offerId, quantity, requestId: requestId('trade') }).catch((reason) => setError(reason instanceof Error ? reason.message : '兑换失败'));
  const redeem = (type: 'legendary_rate' | 'double_catch', cost: number) => post('buff', { type, cost, requestId: requestId('buff') }).catch((reason) => setError(reason instanceof Error ? reason.message : '增益兑换失败'));

  return (
    <GameSceneFrame title="鱼贸商人" headerMeta={<span>鱼货积分：{snapshot?.points ?? 0}</span>}>
      <InkCard padding="lg" className="space-y-4">
        {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
        {notice ? <InkNotice tone="info">{notice}</InkNotice> : null}
        {snapshot && !snapshot.merchantAvailable ? <InkNotice tone="warning">鱼贸商舟已经离岸。成功收竿时仍有机会在水雾里遇见他。</InkNotice> : null}
        <div><h2 className="text-lg font-medium">以鱼易物</h2><p className="mt-1 text-sm text-ink-secondary">低阶鱼可以炼成同种高阶鱼，也能直接换鱼饵、灵石或鱼货积分。</p></div>
        <select className="w-full border border-ink/20 bg-transparent p-2" value={selectedStack} onChange={(event) => setSelectedStack(event.target.value)}>
          <option value="">选择鱼获</option>
          {snapshot?.inventory.map((stack) => <option key={`${stack.speciesId}-${stack.quality}`} value={`${stack.speciesId}:${stack.quality}`}>{stack.speciesName} · {stack.quality} ×{stack.quantity}</option>)}
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          {selectedOffers.map((offer) => <InkButton key={offer.id} disabled={!snapshot?.merchantAvailable || !snapshot.inventory.some((stack) => stack.speciesId === offer.speciesId && stack.quality === offer.quality && stack.quantity >= offer.inputQuantity)} onClick={() => void trade(offer.id)}>{offerLabel(offer)}</InkButton>)}
          {!selectedOffers.length ? <p className="text-sm text-ink-secondary">背包里暂时没有可报价的鱼获。</p> : null}
        </div>
        <div className="border-t border-ink/15 pt-4"><h2 className="font-medium">鱼货积分铺</h2></div>
        <div className="flex flex-wrap gap-2">
          <InkButton disabled={!snapshot?.merchantAvailable || (snapshot?.points ?? 0) < 120} onClick={() => void redeem('legendary_rate', 120)}>珍稀鱼运一小时 · 120 分</InkButton>
          <InkButton disabled={!snapshot?.merchantAvailable || (snapshot?.points ?? 0) < 160} onClick={() => void redeem('double_catch', 160)}>双倍鱼获一小时 · 160 分</InkButton>
          {snapshot?.offers.filter((offer) => offer.kind === 'item').map((offer) => <InkButton key={offer.id} disabled={!snapshot.merchantAvailable || snapshot.points < offer.inputQuantity} onClick={() => void trade(offer.id)}>{String(offer.output.item)} · {offer.inputQuantity} 分</InkButton>)}
        </div>
      </InkCard>
    </GameSceneFrame>
  );
}
