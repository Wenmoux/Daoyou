/**
 * [INPUT]: 服务端垂钓快照、地图节点上下文、InkUI 与玩家状态变更封装
 * [OUTPUT]: 像素线稿水域场景、抛竿、等待鱼讯、提竿结算和图鉴入口
 * [POS]: 垂钓场景交互层，仅提交抛竿与提竿动作，不生成随机结果或奖励
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

type Environment = {
  weather: string;
  timePhase: string;
  moonPhase: string;
  tideId: string;
  tideName: string;
  anomalyId: string | null;
  anomalyName: string | null;
};

type FishingSession = {
  id: string;
  locationId: string;
  locationName: string;
  state: 'waiting_bite' | 'biting' | 'landed' | 'escaped' | 'timeout';
  castAt: string;
  biteAt: string;
  biteDeadlineAt: string;
  now: string;
  baitId: string;
  environment: Environment;
};

type Bait = {
  id: string;
  name: string;
  description: string;
  requiredFishingLevel: number;
  unlocked: boolean;
  stock: number;
};

type Location = { id: string; name: string; description: string; unlocked: boolean };

type Snapshot = {
  player: { realm: string };
  profile: {
    level: number;
    experience: number;
    experienceToNextLevel: number;
    remainingCasts: number;
    dailyLimit: number;
    fishPoints: number;
    fishingBuffs: Array<{ type: 'legendary_rate' | 'double_catch'; expiresAt: string }>;
    merchantAvailableUntil: string | null;
  };
  selectedLocationId: string | null;
  selectedLocationUnlocked: boolean;
  selectedLocationRequiredLevel: number | null;
  environment: Environment | null;
  baits: Bait[];
  activeSession: FishingSession | null;
  locations: Location[];
};

type FishCatchView = {
  speciesName: string;
  tier: string;
  quality: string;
  element: string;
  weight: number;
  description: string;
};

type StrikeResult =
  | { outcome: 'early' | 'late'; message: string }
  | {
      outcome: 'hooked';
      catch: FishCatchView;
      experienceGained: number;
      firstDiscovery: boolean;
      rewardUnlocked: boolean;
      cultivationExpGained: number;
      attributeReward?: { attribute: string; amount: number };
      newlyUnlockedBaitIds: string[];
      catchQuantity: number;
      merchantAvailableUntil: string | null;
      merchantEncountered: boolean;
    };

type Envelope<T> = { success: boolean; data?: T; error?: string };
type SessionResult = { session: FishingSession };

const ATTRIBUTE_LABELS: Record<string, string> = {
  vitality: '体魄', strength: '力量', spirit: '灵力', endurance: '根骨', speed: '身法', willpower: '神识',
};

function requestId(prefix: string) {
  return `fishing:${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

async function readSnapshot(mapNodeId?: string, pondVisitId?: string): Promise<Snapshot> {
  const params = new URLSearchParams();
  if (mapNodeId) params.set('mapNodeId', mapNodeId);
  if (pondVisitId) params.set('pondVisitId', pondVisitId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/fishing${query}`, { cache: 'no-store' });
  const payload = (await response.json()) as Envelope<Snapshot>;
  if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? '垂钓水域暂时无法查看');
  return payload.data;
}

function FishingScene({ locationName, environment, session, biting }: {
  locationName: string;
  environment: Environment | null;
  session: FishingSession | null;
  biting: boolean;
}) {
  const label = biting ? '鱼讯 · 立即提竿' : session ? '静候鱼讯' : '水面静止';
  return (
    <div className="relative h-56 overflow-hidden border border-ink/20 bg-[#dce7e2] font-mono text-xs text-[#203e3c] sm:h-64" aria-label={`${locationName}，${label}`} aria-live="polite">
      <style>{`
        @keyframes fishing-water { 50% { transform: translateX(12px); opacity: 1; } }
        @keyframes fishing-float { 50% { transform: translateY(4px); } }
        @keyframes fishing-bite { 35% { transform: translateY(12px) scale(1.1); } 70% { transform: translateY(-3px); } }
        @media (prefers-reduced-motion: reduce) { .fishing-motion { animation: none !important; } }
      `}</style>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#dce7e2_0%,#dce7e2_48%,#78aaa1_48%,#78aaa1_100%)]" />
      <div className="absolute left-6 top-6 h-8 w-8 border-2 border-[#b06a3a] bg-[#f2c46d] shadow-[4px_4px_0_#b06a3a]" />
      <div className="absolute bottom-[45%] left-0 h-20 w-full bg-[#527873]/70" style={{ clipPath: 'polygon(0 100%,0 55%,15% 30%,27% 52%,43% 10%,58% 48%,72% 18%,88% 50%,100% 32%,100% 100%)' }} />
      {[62, 70, 78, 86, 94].map((top, index) => (
        <div key={top} className="fishing-motion absolute left-[8%] h-px bg-[#d7eee4]/80" style={{ top: `${top}%`, width: `${22 + index * 8}%`, animation: 'fishing-water 1.8s steps(2,end) infinite', animationDelay: `${index * 150}ms` }} />
      ))}
      <div className="absolute bottom-[34%] left-1/2 h-16 w-px bg-[#314f4c]" />
      <div className={`fishing-motion absolute bottom-[32%] left-[calc(50%-4px)] h-3 w-2 border border-[#314f4c] shadow-[2px_2px_0_#314f4c] ${biting ? 'bg-[#b94f3d]' : 'bg-[#f2c46d]'}`} style={{ animation: biting ? 'fishing-bite .48s steps(2,end) infinite' : 'fishing-float 2.4s ease-in-out infinite' }} />
      <div className="absolute right-4 top-4 border border-[#315c57]/40 bg-[#dce7e2]/80 px-2 py-1">
        <p>{locationName}</p><p className={biting ? 'font-bold text-crimson' : ''}>{label}</p>
      </div>
      <div className="absolute bottom-3 left-4 flex gap-3 text-[#315c57]">
        <span>{environment?.weather ?? '晴'}</span><span>{environment?.timePhase ?? '白昼'}</span><span>{environment?.moonPhase ?? '上弦'}</span>
        {environment?.anomalyName ? <span className="font-bold text-crimson">异象·{environment.anomalyName}</span> : null}
      </div>
    </div>
  );
}

export default function FishingPage() {
  const [searchParams] = useSearchParams();
  const mapNodeId = searchParams.get('mapNodeId') ?? undefined;
  const pondVisitId = searchParams.get('pondVisitId') ?? undefined;
  const { mutate } = useResourceMutation();
  const { pushToast, openDialog } = useInkUI();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [session, setSession] = useState<FishingSession | null>(null);
  const [baitId, setBaitId] = useState('spirit-worm');
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback((next: Snapshot) => {
    setSnapshot(next);
    setSession(next.activeSession);
    setBaitId((current) => next.baits.some((bait) => bait.id === current) ? current : (next.baits[0]?.id ?? 'spirit-worm'));
    const serverNow = next.activeSession ? Date.parse(next.activeSession.now) : NaN;
    setClockOffset(Number.isFinite(serverNow) ? serverNow - Date.now() : 0);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    try { applySnapshot(await readSnapshot(mapNodeId, pondVisitId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '垂钓水域暂时无法查看'); }
    finally { setLoading(false); }
  }, [applySnapshot, mapNodeId, pondVisitId]);

  useEffect(() => {
    let active = true;
    void readSnapshot(mapNodeId, pondVisitId)
      .then((next) => { if (active) applySnapshot(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '垂钓水域暂时无法查看'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applySnapshot, mapNodeId, pondVisitId]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [session]);

  const location = useMemo(() => snapshot?.locations.find((item) => item.id === snapshot.selectedLocationId), [snapshot]);
  const serverNow = now + clockOffset;
  const biting = Boolean(session && (session.state === 'biting' || (serverNow >= Date.parse(session.biteAt) && serverNow <= Date.parse(session.biteDeadlineAt))));

  const showCatch = (result: Extract<StrikeResult, { outcome: 'hooked' }>) => openDialog({
    title: `${result.catch.speciesName} · ${result.catch.quality}`,
    content: <div className="space-y-2 text-sm leading-7">
      <p>{result.catch.description}</p>
      <p>{result.catch.tier} · {result.catch.element} · {result.catch.weight.toFixed(2)} 斤</p>
      <p className="text-ink-secondary">垂钓经验 +{result.experienceGained}{result.firstDiscovery ? ' · 首次发现' : ''}</p>
      {result.catchQuantity > 1 ? <p className="text-crimson">鱼运相助，本次获得 {result.catchQuantity} 条同品质鱼获。</p> : null}
      {result.rewardUnlocked ? <p className="text-crimson">品阶奖励：修为 +{result.cultivationExpGained}，{ATTRIBUTE_LABELS[result.attributeReward?.attribute ?? ''] ?? result.attributeReward?.attribute} +{result.attributeReward?.amount}</p> : null}
      {result.newlyUnlockedBaitIds.length ? <p className="text-crimson">新鱼饵解锁：{result.newlyUnlockedBaitIds.join('、')}</p> : null}
      {result.merchantEncountered ? <div className="border border-crimson/25 p-3"><p className="text-crimson">水雾里泊来一叶商舟，鱼贸商人现身了。</p><Link className="font-medium text-crimson underline" to="/game/fishing/merchant">趁他离开前前往交易 →</Link></div> : null}
    </div>,
    confirmLabel: '收下鱼获', onConfirm: async () => undefined,
  });

  const cast = async () => {
    if (!snapshot?.selectedLocationId) return;
    setBusy(true);
    try {
      const result = await mutate<SessionResult>(fetch('/api/fishing/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: snapshot.selectedLocationId, mapNodeId, pondVisitId, baitId, requestId: requestId('cast') }) }));
      setSession(result.session);
      setClockOffset(Date.parse(result.session.now) - Date.now());
      setNow(Date.now());
    } catch (reason) { pushToast({ message: reason instanceof Error ? reason.message : '鱼竿入水失败', tone: 'danger' }); }
    finally { setBusy(false); }
  };

  const strike = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await mutate<StrikeResult>(fetch('/api/fishing/strike', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, requestId: requestId('strike') }) }));
      setSession(null);
      if (result.outcome === 'hooked') showCatch(result);
      else pushToast({ message: result.message, tone: 'warning' });
      await refresh();
    } catch (reason) { pushToast({ message: reason instanceof Error ? reason.message : '提竿结算失败', tone: 'danger' }); }
    finally { setBusy(false); }
  };

  if (loading) return <GameSceneLoading message="水面起雾，正在寻找可垂钓的水域……" />;
  if (!snapshot) return <GameSceneFrame variant="workflow"><InkNotice tone="warning">{error}</InkNotice><InkButton onClick={() => void refresh()}>再看一眼</InkButton></GameSceneFrame>;
  const progress = Math.min(100, Math.round(snapshot.profile.experience / Math.max(1, snapshot.profile.experience + snapshot.profile.experienceToNextLevel) * 100));

  return (
    <GameSceneFrame variant="workflow" headerMeta={<div className="flex flex-wrap gap-x-5 text-sm text-ink-secondary"><span>境界：{snapshot.player.realm}</span><span>垂钓 Lv.{snapshot.profile.level}</span><span>今日鱼讯：{snapshot.profile.remainingCasts}/{snapshot.profile.dailyLimit}</span><Link className="text-crimson hover:underline" to="/game/fishing/codex">打开鱼图鉴</Link></div>}>
      {error ? <InkNotice tone="warning">{error}</InkNotice> : null}
      <InkCard padding="lg" className="space-y-5">
        <div className="flex items-end justify-between gap-3"><div><p className="text-lg font-medium">水面无言，先听鱼讯</p><p className="mt-1 text-sm text-ink-secondary">抛竿后等待浮标下沉，在鱼讯窗口内提竿。</p><div className="mt-2 flex gap-3 text-xs">{snapshot.profile.merchantAvailableUntil && Date.parse(snapshot.profile.merchantAvailableUntil) > Date.now() ? <Link className="font-medium text-crimson hover:underline" to="/game/fishing/merchant">鱼贸商舟已靠岸</Link> : <span className="text-ink-secondary">鱼贸商人尚未现身</span>}<Link className="text-crimson hover:underline" to="/game/spirit-pond">洞府灵池</Link></div></div><div className="min-w-48 text-right text-sm text-ink-secondary"><p>经验 {snapshot.profile.experience}</p><div className="mt-1 h-1.5 bg-ink/10"><div className="h-full bg-crimson" style={{ width: `${progress}%` }} /></div></div></div>
        <FishingScene locationName={session?.locationName ?? location?.name ?? '未选择水域'} environment={session?.environment ?? snapshot.environment} session={session} biting={biting} />
        <div className="sticky top-2 z-10 border border-crimson/35 bg-[#f4eee3]/95 px-4 py-3 shadow-[3px_3px_0_rgba(163,69,50,.18)]">
          <div className="flex items-center justify-between gap-3"><div className="text-sm"><p className="font-medium">{session ? `正在垂钓：${session.locationName}` : location?.name ?? '请从地图选择水域'}</p><p className={biting ? 'font-medium text-crimson' : 'text-ink-secondary'}>{session ? (biting ? '鱼讯出现，立即提竿！' : '浮标尚未下沉，静候鱼讯……') : '选好鱼饵后抛竿。'}</p></div>
            {session ? <InkButton variant={biting ? 'primary' : 'secondary'} disabled={busy} onClick={() => void strike()}>{biting ? '提竿' : '现在提竿'}</InkButton> : <InkButton variant="primary" disabled={busy || (!mapNodeId && !pondVisitId) || !snapshot.selectedLocationUnlocked || snapshot.profile.remainingCasts <= 0} onClick={() => void cast()}>{busy ? '鱼竿入水中……' : '抛竿'}</InkButton>}
          </div>
        </div>
        {!mapNodeId && !pondVisitId ? <div className="border border-ink/15 p-4 text-sm text-ink-secondary">垂钓水域由地图节点决定。<Link className="ml-2 text-crimson hover:underline" to="/game/map">前往地图 →</Link></div> : !snapshot.selectedLocationUnlocked ? <InkNotice tone="warning">垂钓等级达到 {snapshot.selectedLocationRequiredLevel} 级后才能进入此水域。</InkNotice> : null}
        <div className="grid gap-3 sm:grid-cols-2">{snapshot.baits.map((bait) => <button key={bait.id} type="button" disabled={Boolean(session) || busy || !bait.unlocked || bait.stock <= 0} onClick={() => setBaitId(bait.id)} className={`border p-3 text-left ${baitId === bait.id ? 'border-crimson bg-crimson/5' : 'border-ink/15'} ${!bait.unlocked || bait.stock <= 0 ? 'opacity-50' : ''}`}><div className="flex justify-between"><span className="font-medium">{bait.name}</span><span className="text-xs text-ink-secondary">{bait.unlocked ? `库存 ${bait.stock}` : `Lv.${bait.requiredFishingLevel} 解锁`}</span></div><p className="mt-1 text-xs text-ink-secondary">{bait.description}</p></button>)}</div>
      </InkCard>
    </GameSceneFrame>
  );
}
