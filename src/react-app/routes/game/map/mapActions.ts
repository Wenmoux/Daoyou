/**
 * [INPUT]: 当前地图节点、场景意图与导航回调
 * [OUTPUT]: 地图详情抽屉的历练、坊市和垂钓动作
 * [POS]: 地图场景的动作策略层，不承载具体页面状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { MapNodeDetailAction } from '@app/components/feature/map';

export type MapIntent = 'market' | 'dungeon' | 'sect';

export interface NodeActionContext {
  selectedNodeId: string;
  isMainNode: boolean;
  marketEnabled: boolean;
  fishingWaterId?: string;
}

export function resolveMapIntent(value: string | null): MapIntent {
  if (value === 'market' || value === 'sect') return value;
  return 'dungeon';
}

export function buildNodeActions(
  intent: MapIntent,
  ctx: NodeActionContext,
  navigate: (path: string) => void,
): MapNodeDetailAction[] {
  if (intent === 'sect') return [];

  const fishingAction: MapNodeDetailAction[] = ctx.fishingWaterId
    ? [
        {
          key: 'enter-fishing',
          label: '进入垂钓',
          variant: 'primary',
          onClick: () =>
            navigate(
              `/game/fishing?mapNodeId=${encodeURIComponent(ctx.selectedNodeId)}`,
            ),
        },
      ]
    : [];

  if (intent === 'dungeon') {
    return [
      ...fishingAction,
      ...(ctx.isMainNode
        ? []
        : [
            {
              key: 'enter-dungeon',
              label: '前往历练',
              variant: 'secondary' as const,
              onClick: () =>
                navigate(`/game/dungeon?nodeId=${ctx.selectedNodeId}`),
            },
          ]),
    ];
  }

  const actions: MapNodeDetailAction[] = [...fishingAction];
  if (!ctx.isMainNode) {
    actions.push({
      key: 'enter-dungeon',
      label: '前往历练',
      variant: 'secondary',
      onClick: () => navigate(`/game/dungeon?nodeId=${ctx.selectedNodeId}`),
    });
  }
  if (ctx.isMainNode && ctx.marketEnabled) {
    actions.unshift({
      key: 'enter-market',
      label: '进入坊市',
      variant: 'primary',
      onClick: () =>
        navigate(`/game/market?nodeId=${ctx.selectedNodeId}&layer=common`),
    });
  }
  return actions;
}

export function buildSectLandmarkActions(
  sectId: string,
  activeSectId: string | null,
  navigate: (path: string) => void,
): MapNodeDetailAction[] {
  if (sectId === activeSectId) {
    return [
      {
        key: 'enter-sect',
        label: '进入宗门',
        variant: 'primary',
        onClick: () => navigate('/game/sect'),
      },
    ];
  }

  return [
    {
      key: 'view-sect-introduction',
      label: '查看介绍',
      variant: 'secondary',
      onClick: () =>
        navigate(`/game/sect/onboarding?sectId=${encodeURIComponent(sectId)}`),
    },
    {
      key: 'visit-sect-gate',
      label: '拜访山门',
      variant: 'primary',
      onClick: () => navigate(`/game/sect/${encodeURIComponent(sectId)}/visit`),
    },
  ];
}
