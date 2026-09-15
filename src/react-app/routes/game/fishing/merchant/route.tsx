/**
 * [INPUT]: 鱼贸经济快照与兑换 API
 * [OUTPUT]: 鱼贸商人状态、鱼获兑换与鱼货积分展示
 * [POS]: 垂钓场景的经济分支，交易按钮仅在服务端判定商人出现时可用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useEffect, useState } from 'react';

type Snapshot = {
  merchantAvailable: boolean;
  merchantAvailableUntil: string | null;
  points: number;
  inventory: Array<{ speciesId: string; speciesName: string; quality: string; quantity: number }>;
  offers: Array<{ id: string; kind: string; speciesId: string; quality: string; inputQuantity: number; output: Record<string, unknown> }>;
};

export default function FishingMerchantPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    const response = await fetch('/api/fishing-economy', { cache: 'no-store' });
    const payload = await response.json() as { success: boolean; data?: Snapshot; error?: string };
    if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? '鱼贸暂不可用');
    setSnapshot(payload.data);
  };
  useEffect(() => { void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : '鱼贸暂不可用')); }, []);
  const trade = async (offerId: string, quantity: number) => {
    const response = await fetch('/api/fishing-economy/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId, quantity, requestId: `fish-trade-${Date.now()}-${Math.random()}` }) });
    const payload = await response.json() as { success: boolean; error?: string };
    if (!response.ok || !payload.success) throw new Error(payload.error ?? '兑换失败');
    await refresh();
  };
  const redeem = async (type: 'legendary_rate' | 'double_catch', cost: number) => {
    const response = await fetch('/api/fishing-economy/buff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, cost, requestId: `fish-buff-${Date.now()}-${Math.random()}` }) });
    const payload = await response.json() as { success: boolean; error?: string };
    if (!response.ok || !payload.success) throw new Error(payload.error ?? '增益兑换失败');
    await refresh();
  };
  return (
    <GameSceneFrame title="鱼贸商人" headerMeta={<span>鱼货积分：{snapshot?.points ?? 0}</span>}>
      <InkCard padding="lg" className="space-y-4">
        {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
        {snapshot && !snapshot.merchantAvailable ? <InkNotice tone="warning">鱼贸商人暂未现身。每次成功垂钓都有机会遇到云游鱼贸商人。</InkNotice> : null}
        <p className="text-sm text-ink-secondary">鱼贸商人收购鱼获，也能把相邻品阶的鱼重新炼成更高品阶。</p>
        {snapshot?.inventory.length ? <div className="space-y-2">{snapshot.inventory.map((item) => <div key={`${item.speciesId}-${item.quality}`} className="flex justify-between border-b border-ink/10 pb-2 text-sm"><span>{item.speciesName} · {item.quality}</span><span>×{item.quantity}</span></div>)}</div> : <InkNotice>背包中暂无可交易鱼获。</InkNotice>}
        <div className="flex flex-wrap gap-2"><InkButton disabled={!snapshot?.merchantAvailable || (snapshot?.points ?? 0) < 120} onClick={() => void redeem('legendary_rate', 120)}>传说鱼概率提升 · 120 积分</InkButton><InkButton disabled={!snapshot?.merchantAvailable || (snapshot?.points ?? 0) < 160} onClick={() => void redeem('double_catch', 160)}>双倍鱼获 · 160 积分</InkButton></div>
        <div className="flex flex-wrap gap-2">{snapshot?.offers.filter((offer) => offer.kind === 'item').map((offer) => <InkButton key={offer.id} disabled={!snapshot.merchantAvailable || snapshot.points < offer.inputQuantity} onClick={() => void trade(offer.id, 1)}>{String(offer.output.item)} · {offer.inputQuantity} 积分</InkButton>)}</div>
        <div className="grid gap-2 sm:grid-cols-2">{snapshot?.offers.filter((offer) => offer.kind !== 'item').slice(0, 32).map((offer) => <InkButton key={offer.id} disabled={!snapshot.merchantAvailable || !snapshot.inventory.some((item) => item.speciesId === offer.speciesId && item.quality === offer.quality && item.quantity >= offer.inputQuantity)} onClick={() => void trade(offer.id, 1)}>{offer.kind === 'upgrade' ? `${offer.quality} 升阶（需 ${offer.inputQuantity} 条）` : offer.kind === 'mission_legendary' ? `${offer.quality} 鱼贸委托：珍稀鱼运（需 ${offer.inputQuantity} 条）` : offer.kind === 'mission_double' ? `${offer.quality} 鱼贸委托：双倍鱼获（需 ${offer.inputQuantity} 条）` : offer.kind === 'stones' ? `${offer.quality} 换灵石` : `${offer.quality} 换积分`}</InkButton>)}</div>
      </InkCard>
    </GameSceneFrame>
  );
}
