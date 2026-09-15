/**
 * [INPUT]: 依赖灵池、好友开放目录、鱼苗集市与玩家状态变更 API
 * [OUTPUT]: 对外提供两槽驯养、繁殖、门票配置、好友拜访和鱼苗买卖页面
 * [POS]: 洞府灵池的玩家工作台；只提交意图，库存、灵石和访问权限均由服务端裁决
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

type Stage = { threshold: number; probability: number } | null;
type Slot = {
  slot: number;
  speciesId: string;
  speciesName: string;
  domestication: number;
  fishCount: number;
  fryCount: number;
  fishQualityCounts: Record<string, number>;
  fryQualityCounts: Record<string, number>;
  probability: number;
  nextStage: Stage;
};
type Fish = { speciesId: string; speciesName: string; quality: string; quantity: number };
type FriendPond = {
  ownerCultivatorId: string;
  ownerName: string;
  accessMode: 'friends_free' | 'friends_ticket';
  entryFee: number;
};
type FryListing = {
  id: string;
  sellerName: string;
  isOwner: boolean;
  speciesName: string;
  quality: string;
  remainingQuantity: number;
  unitPrice: number;
};
type Snapshot = {
  pond: {
    id: string;
    ownerCultivatorId: string;
    isOwner: boolean;
    accessMode: string;
    entryFee: number;
    nextBreedAt: string;
  };
  slots: Slot[];
  inventory: Fish[];
};
type Envelope<T> = { success: boolean; data?: T; error?: string };

function requestId(prefix: string) {
  return `pond:${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json() as Envelope<T>;
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? '灵池暂不可用');
  }
  return payload.data;
}

export default function SpiritPondPage() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [friendPonds, setFriendPonds] = useState<FriendPond[]>([]);
  const [listings, setListings] = useState<FryListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedStack, setSelectedStack] = useState('');
  const [feedQuantity, setFeedQuantity] = useState(1);
  const [entryFee, setEntryFee] = useState(10);
  const [selectedFry, setSelectedFry] = useState('');
  const [listingQuantity, setListingQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(5);

  const fryOptions = useMemo(() => snapshot?.slots.flatMap((slot) =>
    Object.entries(slot.fryQualityCounts)
      .filter(([, count]) => count > 0)
      .map(([quality, count]) => ({ slot: slot.slot, quality, count, speciesName: slot.speciesName })),
  ) ?? [], [snapshot]);

  const refresh = async () => {
    const [pond, ponds, market] = await Promise.all([
      readJson<Snapshot>('/api/spirit-pond'),
      readJson<FriendPond[]>('/api/spirit-pond/friends'),
      readJson<FryListing[]>('/api/spirit-pond/market'),
    ]);
    setSnapshot(pond);
    setFriendPonds(ponds);
    setListings(market);
    setEntryFee(pond.pond.entryFee || 10);
    setSelectedStack((current) => current || (pond.inventory[0] ? `${pond.inventory[0].speciesId}:${pond.inventory[0].quality}` : ''));
    const firstFry = pond.slots.flatMap((slot) => Object.entries(slot.fryQualityCounts).filter(([, count]) => count > 0).map(([quality]) => `${slot.slot}:${quality}`))[0];
    setSelectedFry((current) => current || firstFry || '');
    setError(null);
  };

  useEffect(() => {
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : '灵池暂不可用'));
  }, []);

  const post = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/spirit-pond/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, requestId: requestId(path) }),
    });
    const payload = await response.json() as Envelope<T>;
    if (!response.ok || !payload.success) throw new Error(payload.error ?? '操作失败');
    return payload.data as T;
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    }
  };

  const feed = (slot: number) => run(async () => {
    const [speciesId, quality] = selectedStack.split(':');
    if (!speciesId || !quality) throw new Error('请先选择鱼获');
    await post('feed', { slot, speciesId, quality, quantity: feedQuantity });
  }, '鱼获已经投入灵池');

  const visit = async (ownerCultivatorId: string) => {
    try {
      const result = await post<{ visitId?: string }>('visit', { ownerCultivatorId });
      if (!result?.visitId) throw new Error('灵池访问票据生成失败');
      navigate(`/game/fishing?pondVisitId=${result.visitId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '进入灵池失败');
    }
  };

  const setAccess = (accessMode: string) => run(
    () => post('access', { accessMode, entryFee: accessMode === 'friends_ticket' ? entryFee : 0 }),
    accessMode === 'private' ? '灵池已经关闭' : '好友开放规则已经更新',
  );

  const createListing = () => run(async () => {
    const [slot, quality] = selectedFry.split(':');
    if (!slot || !quality) throw new Error('当前没有可挂牌的鱼苗');
    await post('market/list', { slot: Number(slot), quality, quantity: listingQuantity, unitPrice });
  }, '鱼苗已经放入集市托管');

  const buyListing = (listingId: string) => run(
    () => post('market/buy', { listingId, quantity: 1 }),
    '鱼苗已放入对应喂养槽',
  );

  const cancelListing = (listingId: string) => run(
    () => post('market/cancel', { listingId }),
    '剩余鱼苗已经收回',
  );

  return (
    <GameSceneFrame title="洞府灵池" headerMeta={<span>{snapshot?.pond.accessMode === 'private' ? '闭门' : '已向好友开放'}</span>}>
      <div className="space-y-4">
        {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
        {notice ? <InkNotice tone="info">{notice}</InkNotice> : null}

        <InkCard padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">灵池驯养</h2>
            <p className="mt-1 text-sm text-ink-secondary">最多驯养两种目标鱼，两槽合计最高占六成鱼讯，其余仍是灵沼原生鱼。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <InkButton variant="primary" disabled={!snapshot} onClick={() => snapshot && void visit(snapshot.pond.ownerCultivatorId)}>进入自己的灵池垂钓</InkButton>
            <InkButton onClick={() => void run(() => post('breed', {}), '本轮繁殖已经结算')} disabled={!snapshot?.pond.isOwner}>结算繁殖</InkButton>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((index) => {
              const slot = snapshot?.slots.find((item) => item.slot === index);
              return (
                <div key={index} className="border border-ink/15 p-3">
                  <p className="font-medium">喂养槽 {index}</p>
                  {slot ? <>
                    <p className="mt-2">{slot.speciesName}</p>
                    <p className="text-sm text-ink-secondary">目标鱼讯 {slot.probability}% · 驯养值 {slot.domestication}</p>
                    <p className="text-sm text-ink-secondary">亲鱼 {slot.fishCount} · 鱼苗 {slot.fryCount}</p>
                    <p className="text-xs text-ink-secondary">{slot.nextStage ? `距 ${slot.nextStage.probability}% 还差 ${slot.nextStage.threshold - slot.domestication} 驯养值` : '已达满阶，目标鱼传说权重翻倍'}</p>
                  </> : <p className="mt-2 text-sm text-ink-secondary">尚未投放鱼种</p>}
                  <InkButton className="mt-3" disabled={!snapshot?.pond.isOwner || !selectedStack} onClick={() => void feed(index)}>投放选中鱼获</InkButton>
                </div>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <select className="border border-ink/20 bg-transparent p-2" value={selectedStack} onChange={(event) => setSelectedStack(event.target.value)}>
              <option value="">选择鱼获</option>
              {snapshot?.inventory.map((fish) => <option key={`${fish.speciesId}-${fish.quality}`} value={`${fish.speciesId}:${fish.quality}`}>{fish.speciesName} · {fish.quality} ×{fish.quantity}</option>)}
            </select>
            <input className="border border-ink/20 bg-transparent p-2" type="number" min={1} max={500} value={feedQuantity} onChange={(event) => setFeedQuantity(Math.max(1, Number(event.target.value) || 1))} />
          </div>
          <p className="text-xs text-ink-secondary">下次繁殖：{snapshot ? new Date(snapshot.pond.nextBreedAt).toLocaleString() : '—'}</p>
        </InkCard>

        <InkCard padding="lg" className="space-y-3">
          <div><h2 className="text-lg font-medium">开放洞府</h2><p className="mt-1 text-sm text-ink-secondary">只有好友能进入；收费模式下，每张访问票据有效一小时。</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <InkButton onClick={() => void setAccess('friends_free')}>好友免费</InkButton>
            <input aria-label="门票灵石" className="w-28 border border-ink/20 bg-transparent p-2" type="number" min={1} max={100000} value={entryFee} onChange={(event) => setEntryFee(Math.max(1, Number(event.target.value) || 1))} />
            <InkButton onClick={() => void setAccess('friends_ticket')}>按此价格收费</InkButton>
            <InkButton onClick={() => void setAccess('private')}>关闭灵池</InkButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {friendPonds.length ? friendPonds.map((pond) => (
              <InkButton key={pond.ownerCultivatorId} onClick={() => void visit(pond.ownerCultivatorId)}>
                拜访 {pond.ownerName}{pond.entryFee > 0 ? ` · ${pond.entryFee} 灵石` : ' · 免费'}
              </InkButton>
            )) : <p className="text-sm text-ink-secondary">暂时没有向你开放的好友灵池。</p>}
          </div>
        </InkCard>

        <InkCard padding="lg" className="space-y-3">
          <div><h2 className="text-lg font-medium">鱼苗集市</h2><p className="mt-1 text-sm text-ink-secondary">挂牌后鱼苗进入托管；成交灵石直接进入卖家，买到的鱼苗自动进入同鱼种槽位。</p></div>
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]">
            <select className="border border-ink/20 bg-transparent p-2" value={selectedFry} onChange={(event) => setSelectedFry(event.target.value)}>
              <option value="">选择鱼苗</option>
              {fryOptions.map((fry) => <option key={`${fry.slot}-${fry.quality}`} value={`${fry.slot}:${fry.quality}`}>{fry.speciesName} · {fry.quality} ×{fry.count}</option>)}
            </select>
            <input aria-label="挂牌数量" className="border border-ink/20 bg-transparent p-2" type="number" min={1} value={listingQuantity} onChange={(event) => setListingQuantity(Math.max(1, Number(event.target.value) || 1))} />
            <input aria-label="鱼苗单价" className="border border-ink/20 bg-transparent p-2" type="number" min={1} value={unitPrice} onChange={(event) => setUnitPrice(Math.max(1, Number(event.target.value) || 1))} />
            <InkButton disabled={!selectedFry} onClick={() => void createListing()}>挂牌</InkButton>
          </div>
          <div className="divide-y divide-ink/10 border border-ink/15">
            {listings.length ? listings.map((listing) => (
              <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div><p>{listing.speciesName} · {listing.quality}</p><p className="text-xs text-ink-secondary">{listing.sellerName} · 尚余 {listing.remainingQuantity} 尾 · {listing.unitPrice} 灵石/尾</p></div>
                {listing.isOwner
                  ? <InkButton onClick={() => void cancelListing(listing.id)}>撤回</InkButton>
                  : <InkButton onClick={() => void buyListing(listing.id)}>购买 1 尾</InkButton>}
              </div>
            )) : <p className="p-3 text-sm text-ink-secondary">集市尚无鱼苗挂牌。</p>}
          </div>
        </InkCard>
      </div>
    </GameSceneFrame>
  );
}
