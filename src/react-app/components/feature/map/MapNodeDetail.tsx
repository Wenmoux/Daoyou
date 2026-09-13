/**
 * [INPUT]: 地图节点、节点动作与垂钓环境摘要
 * [OUTPUT]: 地图节点详情抽屉，展示节点玩法入口和当前垂钓环境
 * [POS]: 地图场景的详情投影；不承载垂钓会话或权限判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  dungeonDifficultyColorMap,
  tierColorMap,
} from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTag } from '@app/components/ui/InkTag';
import { cn } from '@shared/lib/cn';
import {
  resolveDungeonMapConfig,
  resolveFishingMapSummary,
  type MapNodeInfo,
} from '@shared/lib/game/mapSystem';
import type { ComponentProps } from 'react';

type InkButtonVariant = ComponentProps<typeof InkButton>['variant'];

export interface MapNodeDetailAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: InkButtonVariant;
}

export interface MapNodeDetailProps {
  node: MapNodeInfo;
  onClose: () => void;
  actions: MapNodeDetailAction[];
}

function formatRewardBonus(multiplier: number): string {
  const percent = Math.round((multiplier - 1) * 100);
  return `奖励加成 +${Math.max(0, percent)}%`;
}

/**
 * 地图节点详情面板组件
 */
export function MapNodeDetail({ node, onClose, actions }: MapNodeDetailProps) {
  const dungeonConfig = resolveDungeonMapConfig(node);
  const fishingSummary = resolveFishingMapSummary(node.id);

  return (
    <InkDetailDrawer
      isOpen
      onClose={onClose}
      title={node.name}
      description={node.description}
      size="sm"
      footer={
        actions.length > 0 ? (
          <div className="flex gap-2">
            {actions.map((action) => (
              <InkButton
                key={action.key}
                variant={action.variant || 'secondary'}
                className="w-full justify-center"
                onClick={action.onClick}
              >
                {action.label}
              </InkButton>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="text-ink-secondary mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>
          推荐境界：
          <span
            className={cn(
              'font-semibold',
              tierColorMap[node.realm_requirement],
            )}
          >
            {node.realm_requirement}
          </span>
        </span>
        <span>
          难度：
          <span
            className={cn(
              'font-semibold',
              dungeonDifficultyColorMap[dungeonConfig.difficultyTier],
            )}
          >
            {dungeonConfig.difficultyLabel}
          </span>
        </span>
        {node.dungeon_config?.difficulty ? (
          <span className="border-crimson/70 bg-crimson/5 text-crimson inline-flex items-center border border-double px-1.5 py-0.5 text-[11px] leading-none font-bold">
            {formatRewardBonus(dungeonConfig.rewardBonus)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {node.tags.map((tag) => (
          <InkTag
            key={tag}
            tone="neutral"
            variant="outline"
            className="text-xs"
          >
            {tag}
          </InkTag>
        ))}
      </div>

      {fishingSummary ? (
        <div className="border-ink/15 bg-ink/[0.03] mt-4 space-y-2 border p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">🎣 {fishingSummary.waterName}</span>
            <span className="text-crimson">垂钓 Lv.{fishingSummary.requiredFishingLevel}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-ink-secondary">
            <span>天气：{fishingSummary.environment.weather}</span>
            <span>时辰：{fishingSummary.environment.timePhase}</span>
            <span>月相：{fishingSummary.environment.moonPhase}</span>
            <span>鱼潮：{fishingSummary.environment.tideName}</span>
          </div>
          {fishingSummary.environment.anomalyName ? (
            <p className="text-crimson">稀有异象：{fishingSummary.environment.anomalyName}</p>
          ) : null}
          {fishingSummary.activeTimeBuckets.length > 0 ? (
            <p className="text-ink-secondary">活跃时段：{fishingSummary.activeTimeBuckets.join('、')}</p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {fishingSummary.habitatTags.map((tag) => (
              <span key={tag} className="border-ink/15 border px-1.5 py-0.5 text-[11px]">{tag}</span>
            ))}
          </div>
        </div>
      ) : null}
    </InkDetailDrawer>
  );
}
