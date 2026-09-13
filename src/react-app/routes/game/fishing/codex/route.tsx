/**
 * [INPUT]: 垂钓服务端快照中的鱼种目录、发现记录与奖励 key
 * [OUTPUT]: 独立鱼图鉴页面，展示探索进度与鱼种条件
 * [POS]: 垂钓模块的只读档案场景；水域选择和垂钓操作由地图与 fishing 页面负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { InkCard, InkNotice } from '@app/components/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

type Species = {
  id: string;
  name: string;
  description: string;
  tier: string;
  element: string;
  discovered: boolean;
};
type CodexEntry = {
  speciesId: string;
  caughtCount: number;
  highestQuality: string;
  largestWeight: number;
  bestBaitId: string | null;
  bestWeather: string | null;
  bestMoonPhase: string | null;
  bestAnomalyId: string | null;
};
type Bait = { id: string; name: string };
type Snapshot = {
  species: Species[];
  codex: CodexEntry[];
  baits: Bait[];
  profile: { unlockedRewardKeys: string[] };
};
type Envelope<T> = { success: boolean; data?: T; error?: string };

export default function FishingCodexPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/fishing', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as Envelope<Snapshot>;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? '鱼图鉴暂时无法打开');
        }
        if (active) setSnapshot(payload.data);
      })
      .catch((next: unknown) => {
        if (active) setError(next instanceof Error ? next.message : '鱼图鉴暂时无法打开');
      });
    return () => {
      active = false;
    };
  }, []);

  if (!snapshot && !error) return <GameSceneLoading message="正在展开万鱼图鉴……" />;
  if (!snapshot) {
    return <GameSceneFrame variant="workflow"><InkNotice tone="warning">{error}</InkNotice></GameSceneFrame>;
  }

  const entries = new Map(snapshot.codex.map((entry) => [entry.speciesId, entry]));
  const discoveredCount = snapshot.species.filter((species) => species.discovered).length;
  return (
    <GameSceneFrame
      variant="workflow"
      headerMeta={<div className="flex gap-4 text-sm text-ink-secondary"><span>已发现 {discoveredCount}/{snapshot.species.length}</span><Link className="text-crimson underline-offset-2 hover:underline" to="/game/fishing">返回垂钓</Link></div>}
    >
      <InkCard padding="lg" className="space-y-5">
        <div>
          <p className="text-lg font-medium">万鱼图鉴</p>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">记录鱼种、最高品阶、最大体重与发现时的环境。品阶奖励按“鱼种 + 品阶”独立解锁。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.species.map((species) => {
            const entry = entries.get(species.id);
            const rewardCount = snapshot.profile.unlockedRewardKeys.filter((key) => key.startsWith(`${species.id}:`)).length;
            return (
              <article key={species.id} className={`border p-4 ${species.discovered ? 'border-ink/20' : 'border-ink/10 opacity-60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{species.discovered ? species.name : '？？？'}</span>
                  <span className="text-xs text-ink-secondary">{species.discovered ? species.tier : '未发现'}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-secondary">{species.discovered ? species.description : '前往地图水域寻找它的踪迹。'}</p>
                {entry ? (
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="text-crimson">{species.element} · 最高 {entry.highestQuality} · {entry.caughtCount} 次</p>
                    <p>最大体重：{entry.largestWeight.toFixed(2)} 斤</p>
                    <p>最佳环境：{entry.bestWeather ?? '未知'} · {entry.bestMoonPhase ?? '未知'}</p>
                    <p>最佳鱼饵：{snapshot.baits.find((bait) => bait.id === entry.bestBaitId)?.name ?? entry.bestBaitId ?? '未知'}</p>
                    <p className="text-ink-secondary">已解锁品阶奖励：{rewardCount} 项</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </InkCard>
    </GameSceneFrame>
  );
}
