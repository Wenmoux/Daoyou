/**
 * [INPUT]: 灵池快照、鱼获库存与灵池操作 API
 * [OUTPUT]: 两个喂养槽、繁殖、开放设置及进入灵池垂钓的交互
 * [POS]: 洞府灵池页面；服务端负责鱼获扣除、好友权限与访问票据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

type Slot = { slot: number; speciesId: string; speciesName: string; domestication: number; fishCount: number; fryCount: number; probability: number };
type Fish = { speciesId: string; speciesName: string; quality: string; quantity: number };
type Friend = { id: string; name: string };
type Snapshot = { pond: { id: string; ownerCultivatorId: string; isOwner: boolean; accessMode: string; entryFee: number; nextBreedAt: string }; slots: Slot[]; inventory: Fish[] };

export default function SpiritPondPage() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStack, setSelectedStack] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [friends, setFriends] = useState<Friend[]>([]);
  const refresh = async () => {
    const response = await fetch('/api/spirit-pond', { cache: 'no-store' });
    const payload = await response.json() as { success: boolean; data?: Snapshot; error?: string };
    if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? '灵池暂不可用');
    setSnapshot(payload.data);
    setSelectedStack((current) => current || (payload.data?.inventory[0] ? `${payload.data.inventory[0].speciesId}:${payload.data.inventory[0].quality}` : ''));
  };
  useEffect(() => { void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : '灵池暂不可用')); }, []);
  useEffect(() => { void fetch('/api/friends').then((response) => response.json() as Promise<{ friends?: Friend[] }>).then((payload) => setFriends(payload.friends ?? [])).catch(() => undefined); }, []);
  const post = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/spirit-pond/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, requestId: `pond-${path}-${Date.now()}-${Math.random()}` }) });
    const payload = await response.json() as { success: boolean; data?: { visitId?: string }; error?: string };
    if (!response.ok || !payload.success) throw new Error(payload.error ?? '操作失败');
    return payload.data;
  };
  const feed = async (slot: number) => { const [speciesId, quality] = selectedStack.split(':'); if (!speciesId || !quality) return; try { await post('feed', { slot, speciesId, quality, quantity }); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : '喂养失败'); } };
  const visit = async () => { try { const result = await post('visit', { ownerCultivatorId: snapshot?.pond.ownerCultivatorId }); if (result?.visitId) navigate(`/game/fishing?pondVisitId=${result.visitId}`); } catch (reason) { setError(reason instanceof Error ? reason.message : '进入灵池失败'); } };
  const visitFriend = async (ownerCultivatorId: string) => { try { const response = await fetch('/api/spirit-pond/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerCultivatorId, requestId: `pond-friend-${Date.now()}-${Math.random()}` }) }); const payload = await response.json() as { success: boolean; data?: { visitId?: string }; error?: string }; if (!response.ok || !payload.success || !payload.data?.visitId) throw new Error(payload.error ?? '访问失败'); navigate(`/game/fishing?pondVisitId=${payload.data.visitId}`); } catch (reason) { setError(reason instanceof Error ? reason.message : '访问好友灵池失败'); } };
  const breed = async () => { try { await post('breed', {}); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : '繁殖失败'); } };
  const setAccess = async (accessMode: string) => { try { await post('access', { accessMode, entryFee: accessMode === 'friends_ticket' ? 10 : 0 }); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : '设置失败'); } };
  return <GameSceneFrame title="洞府灵池" headerMeta={<span>{snapshot?.pond.accessMode === 'private' ? '闭门' : '已对好友开放'}</span>}>
    <InkCard padding="lg" className="space-y-4">
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
      <p className="text-sm text-ink-secondary">把钓来的鱼投进灵池，养成亲鱼与鱼苗；喂养槽会改变灵池垂钓时的鱼种权重。</p>
      <div className="flex flex-wrap gap-2"><InkButton variant="primary" disabled={!snapshot} onClick={() => void visit()}>进入灵池垂钓</InkButton>{snapshot?.pond.isOwner ? <><InkButton onClick={() => void setAccess('friends_free')}>好友免费</InkButton><InkButton onClick={() => void setAccess('friends_ticket')}>好友门票 10 灵石</InkButton><InkButton onClick={() => void setAccess('private')}>关闭灵池</InkButton></> : null}</div>
      {friends.length ? <div className="border border-ink/15 p-3"><p className="text-sm font-medium">好友灵池</p><div className="mt-2 flex flex-wrap gap-2">{friends.map((friend) => <InkButton key={friend.id} onClick={() => void visitFriend(friend.id)}>拜访 {friend.name}</InkButton>)}</div></div> : null}
      <div className="grid gap-3 sm:grid-cols-2">{[1, 2].map((index) => { const slot = snapshot?.slots.find((item) => item.slot === index); return <div key={index} className="border border-ink/15 p-3"><p className="font-medium">喂养槽 {index}</p>{slot ? <><p className="mt-2">{slot.speciesName}</p><p className="text-sm text-ink-secondary">驯养值 {slot.domestication} · 目标鱼概率 {slot.probability}%</p><p className="text-sm text-ink-secondary">亲鱼 {slot.fishCount} · 鱼苗 {slot.fryCount}</p></> : <p className="mt-2 text-sm text-ink-secondary">尚未投放鱼种</p>}<InkButton className="mt-3" disabled={!snapshot?.pond.isOwner || !selectedStack} onClick={() => void feed(index)}>投放选中鱼获</InkButton></div>; })}</div>
      <div className="grid gap-2 sm:grid-cols-2"><select className="border border-ink/20 bg-transparent p-2" value={selectedStack} onChange={(event) => setSelectedStack(event.target.value)}><option value="">选择鱼获</option>{snapshot?.inventory.map((fish) => <option key={`${fish.speciesId}-${fish.quality}`} value={`${fish.speciesId}:${fish.quality}`}>{fish.speciesName} · {fish.quality} ×{fish.quantity}</option>)}</select><input className="border border-ink/20 bg-transparent p-2" type="number" min={1} max={500} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></div>
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-ink-secondary">下次繁殖：{snapshot ? new Date(snapshot.pond.nextBreedAt).toLocaleString() : '—'}</span><InkButton onClick={() => void breed()} disabled={!snapshot?.pond.isOwner}>结算繁殖</InkButton></div>
    </InkCard>
  </GameSceneFrame>;
}
