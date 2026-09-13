/**
 * [INPUT]: 静态世界地图 JSON、境界与市场类型
 * [OUTPUT]: 地图节点查询、历练配置解析与可进入垂钓水域配置
 * [POS]: 世界地图领域适配层，被地图页面、地图动作和垂钓入口共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { RealmStage } from '@shared/types/constants';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import type { MarketLayer, RegionProfileKey } from '@shared/types/market';
import { getFishingLocation, resolveFishingEnvironment } from '@shared/engine/fishing';
import type { FishingEnvironmentSnapshot } from '@shared/engine/fishing';
import mapData from '../../data/map.json';

export type DungeonDifficultyTier =
  'easy' | 'normal' | 'hard' | 'elite' | 'boss';

export interface NodeMarketConfig {
  enabled: boolean;
  allowed_layers: MarketLayer[];
  region_profile: RegionProfileKey;
  /** 各层灵种货架占比；未配置的坊市不固定注入灵种。 */
  seed_ratio?: Partial<Record<MarketLayer, number>>;
}

export interface DungeonMapConfig {
  difficulty: DungeonDifficultyTier;
}

export interface FishingMapConfig {
  water_id: string;
  water_type: 'river' | 'lake' | 'marsh' | 'sea' | 'spirit_pool';
  fishing_level_required: number;
  habitat_tags: string[];
  available_weather?: string[];
  available_time_buckets?: string[];
  special_event_pool?: string[];
}

export interface FishingMapSummary {
  waterId: string;
  waterName: string;
  requiredFishingLevel: number;
  habitatTags: string[];
  availableWeather: string[];
  activeTimeBuckets: string[];
  specialEventPool: string[];
  environment: FishingEnvironmentSnapshot;
}

export interface ResolvedDungeonMapConfig {
  realmRequirement: RealmType;
  difficultyTier: DungeonDifficultyTier;
  difficultyLabel: string;
  enemyDifficulty: number;
  allowedEnemyRealmStages: RealmStage[];
  allowBossLoadout: boolean;
  rewardBonus: number;
}

const DUNGEON_DIFFICULTY_PRESETS: Record<
  DungeonDifficultyTier,
  Pick<
    ResolvedDungeonMapConfig,
    | 'difficultyLabel'
    | 'allowedEnemyRealmStages'
    | 'allowBossLoadout'
    | 'rewardBonus'
  >
> = {
  easy: {
    difficultyLabel: '低危',
    allowedEnemyRealmStages: ['初期'],
    allowBossLoadout: false,
    rewardBonus: 1,
  },
  normal: {
    difficultyLabel: '普通',
    allowedEnemyRealmStages: ['初期', '中期'],
    allowBossLoadout: false,
    rewardBonus: 1.1,
  },
  hard: {
    difficultyLabel: '险地',
    allowedEnemyRealmStages: ['中期', '后期'],
    allowBossLoadout: false,
    rewardBonus: 1.2,
  },
  elite: {
    difficultyLabel: '凶险',
    allowedEnemyRealmStages: ['后期', '圆满'],
    allowBossLoadout: true,
    rewardBonus: 1.3,
  },
  boss: {
    difficultyLabel: '绝境',
    allowedEnemyRealmStages: ['圆满'],
    allowBossLoadout: true,
    rewardBonus: 1.5,
  },
};

export const DUNGEON_ENEMY_DIFFICULTY_TABLE: Record<
  RealmType,
  Record<DungeonDifficultyTier, number>
> = {
  炼气: { easy: 10, normal: 20, hard: 35, elite: 55, boss: 75 },
  筑基: { easy: 12, normal: 24, hard: 40, elite: 60, boss: 80 },
  金丹: { easy: 15, normal: 28, hard: 45, elite: 65, boss: 85 },
  元婴: { easy: 18, normal: 32, hard: 50, elite: 70, boss: 88 },
  化神: { easy: 20, normal: 36, hard: 55, elite: 74, boss: 90 },
  炼虚: { easy: 22, normal: 38, hard: 58, elite: 76, boss: 92 },
  合体: { easy: 24, normal: 40, hard: 60, elite: 78, boss: 94 },
  大乘: { easy: 26, normal: 42, hard: 62, elite: 80, boss: 95 },
  渡劫: { easy: 28, normal: 45, hard: 65, elite: 82, boss: 96 },
};

export interface MapNode {
  id: string;
  name: string;
  region: string;
  realm_requirement: RealmType;
  tags: string[];
  description: string;
  connections: string[];
  x: number;
  y: number;
  market_config?: NodeMarketConfig;
  dungeon_config?: DungeonMapConfig;
  fishing_config?: FishingMapConfig;
}

export interface SatelliteNode {
  id: string;
  name: string;
  parent_id: string;
  type: string;
  tags: string[];
  description: string;
  connections: string[];
  x: number;
  y: number;
  realm_requirement: RealmType;
  environmental_status?:
    | 'scorching'
    | 'freezing'
    | 'toxic_air'
    | 'formation_suppressed'
    | 'abundant_qi'
    | null; // 环境状态（可选）
  dungeon_config?: DungeonMapConfig;
  fishing_config?: FishingMapConfig;
}

export interface SectLandmark {
  id: string;
  kind: 'sect';
  sect_id: string;
  parent_id: string;
  name: string;
  description: string;
  tags: string[];
  x: number;
  y: number;
}

export interface MapData {
  world_name: string;
  map_nodes: MapNode[];
  sect_landmarks: SectLandmark[];
  satellite_nodes: SatelliteNode[];
}

// Load typed data
const worldData: MapData = mapData as MapData;

export type MapNodeInfo = MapNode | SatelliteNode;

export function getAllMapNodes(): MapNode[] {
  return worldData.map_nodes;
}

export function getAllSatelliteNodes(): SatelliteNode[] {
  return worldData.satellite_nodes;
}

export function getAllSectLandmarks(): SectLandmark[] {
  return worldData.sect_landmarks;
}

export function getSectLandmark(id: string): SectLandmark | undefined {
  return worldData.sect_landmarks.find((landmark) => landmark.id === id);
}

export function getSectLandmarkBySectId(
  sectId: string,
): SectLandmark | undefined {
  return worldData.sect_landmarks.find(
    (landmark) => landmark.sect_id === sectId,
  );
}

export function getMapNode(id: string): MapNode | SatelliteNode | undefined {
  const mainNode = worldData.map_nodes.find((n) => n.id === id);
  if (mainNode) return mainNode;
  return worldData.satellite_nodes.find((n) => n.id === id);
}

export function isSatelliteNode(id: string): boolean {
  return worldData.satellite_nodes.some((n) => n.id === id);
}

export type WorldMapLocation = MapNodeInfo | SectLandmark;

export function getWorldMapLocation(id: string): WorldMapLocation | undefined {
  return getMapNode(id) ?? getSectLandmark(id);
}

export function getNodesByRegion(region: string): MapNode[] {
  return worldData.map_nodes.filter((n) => n.region === region);
}

export function getSatellitesForNode(parentId: string): SatelliteNode[] {
  return worldData.satellite_nodes.filter((n) => n.parent_id === parentId);
}

export function getMarketEnabledNodes(): MapNode[] {
  return worldData.map_nodes.filter((node) => node.market_config?.enabled);
}

export function getFishingEnabledNodes(): MapNodeInfo[] {
  return [...worldData.map_nodes, ...worldData.satellite_nodes].filter(
    (node) => Boolean(node.fishing_config),
  );
}

export function getFishingMapConfig(
  nodeId: string,
): FishingMapConfig | undefined {
  const location = getWorldMapLocation(nodeId);
  return location && 'fishing_config' in location
    ? location.fishing_config
    : undefined;
}

export function resolveFishingMapSummary(
  nodeId: string,
  now: Date = new Date(),
): FishingMapSummary | null {
  const config = getFishingMapConfig(nodeId);
  if (!config) return null;
  const location = getFishingLocation(config.water_id);
  if (!location) return null;
  return {
    waterId: config.water_id,
    waterName: location.name,
    requiredFishingLevel: config.fishing_level_required,
    habitatTags: config.habitat_tags,
    availableWeather: config.available_weather ?? [],
    activeTimeBuckets: config.available_time_buckets ?? [],
    specialEventPool: config.special_event_pool ?? [],
    environment: resolveFishingEnvironment({ locationId: config.water_id, now }),
  };
}

export function resolveDungeonMapConfig(
  node: MapNodeInfo,
): ResolvedDungeonMapConfig {
  const configuredTier = node.dungeon_config?.difficulty;
  const difficultyTier =
    configuredTier && configuredTier in DUNGEON_DIFFICULTY_PRESETS
      ? configuredTier
      : 'normal';
  const preset = DUNGEON_DIFFICULTY_PRESETS[difficultyTier];

  return {
    realmRequirement: node.realm_requirement,
    difficultyTier,
    enemyDifficulty: resolveDungeonEnemyDifficulty(
      node.realm_requirement,
      difficultyTier,
    ),
    ...preset,
  };
}

export function resolveDungeonEnemyDifficulty(
  realm: RealmType,
  tier: DungeonDifficultyTier,
): number {
  return DUNGEON_ENEMY_DIFFICULTY_TABLE[realm]?.[tier] ?? 24;
}

export function canChallengeDungeonRealm(
  playerRealm: RealmType,
  dungeonRealm: RealmType,
): boolean {
  return REALM_ORDER[playerRealm] >= REALM_ORDER[dungeonRealm];
}

export function clampDungeonEnemyRealmStage(
  realmStage: RealmStage,
  config: ResolvedDungeonMapConfig,
): RealmStage {
  if (config.allowedEnemyRealmStages.includes(realmStage)) {
    return realmStage;
  }

  if (realmStage === '初期' || realmStage === '中期') {
    return config.allowedEnemyRealmStages[0] ?? '初期';
  }

  return (
    config.allowedEnemyRealmStages[config.allowedEnemyRealmStages.length - 1] ??
    '初期'
  );
}

export function getDungeonRewardBonus(
  tier: DungeonDifficultyTier | undefined,
): number {
  const difficultyTier =
    tier && tier in DUNGEON_DIFFICULTY_PRESETS ? tier : 'easy';
  return DUNGEON_DIFFICULTY_PRESETS[difficultyTier].rewardBonus;
}
