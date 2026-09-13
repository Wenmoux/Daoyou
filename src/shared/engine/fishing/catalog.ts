/**
 * [INPUT]: 依赖垂钓领域类型与项目元素、境界枚举
 * [OUTPUT]: 提供首期水域和鱼种静态目录
 * [POS]: 垂钓内容的单一事实源，不承载玩家状态和随机判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ElementType, RealmType } from '@shared/types/constants';
import type { FishSpeciesDefinition, FishingLocationDefinition } from './types';

const fish = (
  definition: Omit<FishSpeciesDefinition, 'weight'> & { weight?: number },
): FishSpeciesDefinition => {
  const weightByTier = {
    凡种: 48,
    灵种: 28,
    玄种: 14,
    真种: 7,
    地脉种: 3,
    天脉种: 1.5,
    仙裔种: 0.5,
    神遗种: 0.08,
  } as const;
  return { weight: weightByTier[definition.tier], ...definition };
};

export const FISH_SPECIES: readonly FishSpeciesDefinition[] = [
  fish({ id: 'xiao-qingyu', name: '小青鱼', description: '水域中最常见的青鳞鱼，肉质鲜嫩，是许多垂钓者的第一份鱼获。', tier: '凡种', element: '水' as ElementType, behavior: 'calm', minRealm: '炼气' as RealmType, habitats: ['青溪浅湾', '凛月湖'], sizeRange: [0.3, 1.2], effectTags: ['食材'], alchemyTags: ['水', '滋养'], }),
  fish({ id: 'da-qingyu', name: '大青鱼', description: '体型更大的青鳞鱼，少刺而滋补，常被凡俗厨家视作湖中上品。', tier: '凡种', element: '水' as ElementType, behavior: 'fierce', minRealm: '炼气' as RealmType, habitats: ['凛月湖', '雷泽深潭'], sizeRange: [1.5, 12.0], effectTags: ['食材', '滋养'], alchemyTags: ['水', '滋阴'], }),
  fish({ id: 'qing-lingyu', name: '青灵鱼', description: '鳞片带有淡青灵光，可作为观赏灵鱼，也能缓慢汇聚周遭灵气。', tier: '灵种', element: '木' as ElementType, behavior: 'cunning', minRealm: '炼气' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [0.6, 2.4], effectTags: ['灵气', '观赏'], alchemyTags: ['木', '聚灵'], }),
  fish({ id: 'chixue-hongli', name: '赤血虹鲤', description: '赤鳞如虹，鱼血蕴有温热气血，是湖泊传说中最受追逐的灵鱼。', tier: '真种', element: '火' as ElementType, behavior: 'fierce', minRealm: '筑基' as RealmType, habitats: ['凛月湖', '雷泽深潭'], sizeRange: [2.0, 8.0], effectTags: ['气血', '炼体'], alchemyTags: ['火', '气血'], }),
  fish({ id: 'liuwen-jialongyu', name: '流纹假龙鱼', description: '鳞纹似龙而未成真龙，鱼血可引动风水二系灵机。', tier: '天脉种', element: '风' as ElementType, behavior: 'ancient', minRealm: '金丹' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [3.0, 14.0], effectTags: ['风水亲和', '假龙血脉'], alchemyTags: ['风', '水', '血脉'], }),
  fish({ id: 'da-caoyu', name: '大草鱼', description: '体型壮硕的凡俗鱼类，灵气不显，却是湖边宴席最可靠的收获。', tier: '凡种', element: '木' as ElementType, behavior: 'calm', minRealm: '炼气' as RealmType, habitats: ['青溪浅湾', '凛月湖'], sizeRange: [3.0, 30.0], effectTags: ['食材', '宴席'], alchemyTags: ['木', '滋养'], }),
  fish({ id: 'da-heiyu', name: '大黑鱼', description: '性情凶猛的深水鱼，受灵气滋养后可能发生不可预测的血脉变化。', tier: '玄种', element: '水' as ElementType, behavior: 'fierce', minRealm: '筑基' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [4.0, 36.0], effectTags: ['凶性', '血脉异变'], alchemyTags: ['水', '凶煞'], }),
  fish({ id: 'qingbo-lingji', name: '青波灵鲫', description: '溪光入鳞，鱼腹中常凝一缕清灵之气。', tier: '灵种', element: '水' as ElementType, behavior: 'calm', minRealm: '炼气' as RealmType, habitats: ['青溪浅湾'], sizeRange: [0.4, 1.8], effectTags: ['回气', '食材'], alchemyTags: ['水', '安神'], }),
  fish({ id: 'chitail-jinli', name: '赤尾金鲤', description: '赤尾如烛，凡人食之亦觉筋骨温热。', tier: '凡种', element: '火' as ElementType, behavior: 'swift', minRealm: '炼气' as RealmType, habitats: ['青溪浅湾'], sizeRange: [0.6, 2.4], effectTags: ['食材', '温养'], alchemyTags: ['火', '温养'], }),
  fish({ id: 'yuewen-lu', name: '月纹鲈', description: '月下鳞纹自明，适合炼制凝神类丹药。', tier: '灵种', element: '水' as ElementType, behavior: 'cunning', minRealm: '炼气' as RealmType, habitats: ['凛月湖'], sizeRange: [0.8, 3.2], effectTags: ['凝神', '安魂'], alchemyTags: ['水', '安魂'], }),
  fish({ id: 'xuanjia-chenli', name: '玄甲沉鲤', description: '鳞片厚重如甲，潜入湖底后极难再次咬钩。', tier: '玄种', element: '土' as ElementType, behavior: 'fierce', minRealm: '筑基' as RealmType, habitats: ['凛月湖'], sizeRange: [2.2, 8.6], effectTags: ['护体', '炼器'], alchemyTags: ['土', '护体'], }),
  fish({ id: 'wenyao-yueli', name: '文鳐月鲤', description: '鱼鳍似羽，出水时会在月光里短暂滑翔。', tier: '真种', element: '风' as ElementType, behavior: 'swift', minRealm: '筑基' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [1.8, 6.5], effectTags: ['身法', '风行'], alchemyTags: ['风', '身法'], }),
  fish({ id: 'leize-gui', name: '雷泽鳜', description: '雷雨将至时鳞下生光，钓线稍有不慎便会被震断。', tier: '玄种', element: '雷' as ElementType, behavior: 'fierce', minRealm: '筑基' as RealmType, habitats: ['雷泽深潭'], sizeRange: [1.4, 5.8], effectTags: ['淬体', '雷法'], alchemyTags: ['雷', '淬体'], }),
  fish({ id: 'chiru-yilin', name: '赤鱬遗鳞', description: '传说承有上古赤鱬血脉，鳞片离水仍带灼热灵光。', tier: '真种', element: '火' as ElementType, behavior: 'ancient', minRealm: '筑基' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [2.6, 9.8], effectTags: ['血脉', '炼体'], alchemyTags: ['火', '血脉'], }),
  fish({ id: 'goumang-muyu', name: '句芒木鱼', description: '背鳍如新叶，所过之处水草会提前一季返青。', tier: '地脉种', element: '木' as ElementType, behavior: 'calm', minRealm: '金丹' as RealmType, habitats: ['云梦秘泽'], sizeRange: [3.8, 12.0], effectTags: ['灵田', '生机'], alchemyTags: ['木', '生机'], }),
  fish({ id: 'taixu-yinli', name: '太虚银鳞', description: '鳞片映出并不存在的星河，夜钓时更容易现身。', tier: '天脉种', element: '金' as ElementType, behavior: 'cunning', minRealm: '金丹' as RealmType, habitats: ['云梦秘泽'], sizeRange: [4.2, 15.0], effectTags: ['悟性', '星象'], alchemyTags: ['金', '悟性'], }),
  fish({ id: 'taiyin-yuekun', name: '太阴月鲲', description: '幼体如鱼，吞吐月华后会在水面留下银色潮痕。', tier: '仙裔种', element: '水' as ElementType, behavior: 'ancient', minRealm: '元婴' as RealmType, habitats: ['云梦秘泽'], sizeRange: [8.0, 30.0], effectTags: ['月华', '突破'], alchemyTags: ['水', '突破'], }),
  fish({ id: 'xuanming-zuao', name: '玄冥祖鳌', description: '神遗水族，甲纹记录着一段无人能解的古老潮汐。', tier: '神遗种', element: '冰' as ElementType, behavior: 'ancient', minRealm: '化神' as RealmType, habitats: ['云梦秘泽'], sizeRange: [20.0, 88.0], effectTags: ['神遗', '世界事件'], alchemyTags: ['冰', '神遗'], }),
  fish({ id: 'xingling-yu', name: '星灵鱼', description: '鳞片像碎星一样在夜色中闪烁，只有水面无风时才会靠近钓台。', tier: '天脉种', element: '金' as ElementType, behavior: 'cunning', minRealm: '筑基' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [2.4, 8.0], effectTags: ['星象', '神识'], alchemyTags: ['金', '星辰'], }),
  fish({ id: 'xuelong-yu', name: '雪龙鱼', description: '雪白鱼鳞中藏着一缕龙息，出水时会在空气里结出薄霜。', tier: '真种', element: '冰' as ElementType, behavior: 'swift', minRealm: '筑基' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [2.0, 7.5], effectTags: ['寒髓', '龙息'], alchemyTags: ['冰', '血脉'], }),
  fish({ id: 'liuwen-jinlongyu', name: '流纹金龙鱼', description: '流纹假龙鱼蜕鳞后的稀有形态，金色鳞光能照出水下旧阵。', tier: '仙裔种', element: '金' as ElementType, behavior: 'ancient', minRealm: '元婴' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [7.0, 26.0], effectTags: ['龙血', '破阵'], alchemyTags: ['金', '血脉'], }),
  fish({ id: 'daliuwen-yu', name: '大流纹鱼', description: '流纹鱼族中的巨型凡种，游动时会把整片浅湾染成青色。', tier: '玄种', element: '水' as ElementType, behavior: 'fierce', minRealm: '筑基' as RealmType, habitats: ['凛月湖', '雷泽深潭'], sizeRange: [5.0, 28.0], effectTags: ['水势', '食材'], alchemyTags: ['水', '滋养'], }),
  fish({ id: 'longmen-jinyu', name: '龙门金鱼', description: '传说跃过三次瀑口便能换鳞，金鳞上留着细小的天门纹。', tier: '真种', element: '金' as ElementType, behavior: 'swift', minRealm: '筑基' as RealmType, habitats: ['青溪浅湾', '凛月湖'], sizeRange: [1.0, 4.8], effectTags: ['跃迁', '金鳞'], alchemyTags: ['金', '身法'], }),
  fish({ id: 'bifang-yanyu', name: '毕方炎鱼', description: '背鳍如一簇不熄的火，雨中出水时会留下赤色水汽。', tier: '真种', element: '火' as ElementType, behavior: 'fierce', minRealm: '筑基' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [2.2, 9.0], effectTags: ['炎息', '淬体'], alchemyTags: ['火', '气血'], }),
  fish({ id: 'xuanwu-guiyu', name: '玄武龟鱼', description: '鱼首龟甲，沉在水底时与岩层无异，只有潮声变化才能唤醒它。', tier: '地脉种', element: '土' as ElementType, behavior: 'ancient', minRealm: '金丹' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [6.0, 22.0], effectTags: ['玄甲', '护体'], alchemyTags: ['土', '护体'], }),
  fish({ id: 'yinglong-yuyu', name: '应龙雨鱼', description: '鳞缝会聚集细小雷云，咬钩后水面会落下一阵逆向雨。', tier: '仙裔种', element: '雷' as ElementType, behavior: 'ancient', minRealm: '元婴' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [8.0, 32.0], effectTags: ['雷雨', '龙脉'], alchemyTags: ['雷', '水'], }),
  fish({ id: 'feilian-fengyu', name: '飞廉风鱼', description: '鱼鳍如两柄小扇，顺着水面游动时能卷起一圈细风。', tier: '地脉种', element: '风' as ElementType, behavior: 'swift', minRealm: '金丹' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [2.5, 10.0], effectTags: ['风行', '身法'], alchemyTags: ['风', '身法'], }),
  fish({ id: 'yusheng-yu', name: '羽生鱼', description: '鱼鳍边缘生着细羽，月光下会短暂离水滑行。', tier: '灵种', element: '风' as ElementType, behavior: 'cunning', minRealm: '炼气' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [0.8, 3.8], effectTags: ['轻身', '观赏'], alchemyTags: ['风', '安神'], }),
  fish({ id: 'zhuyin-yu', name: '烛阴鱼', description: '一睁眼便照亮半面水泽，一闭眼则连鱼线都像沉入黑夜。', tier: '天脉种', element: '火' as ElementType, behavior: 'ancient', minRealm: '金丹' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [5.0, 18.0], effectTags: ['昼夜', '瞳火'], alchemyTags: ['火', '神识'], }),
  fish({ id: 'kunpeng-youyu', name: '鲲鹏幼鱼', description: '幼体尚未分化，鱼身吞水，鱼鳍一展便能掀起小型潮汐。', tier: '神遗种', element: '水' as ElementType, behavior: 'ancient', minRealm: '化神' as RealmType, habitats: ['云梦秘泽'], sizeRange: [18.0, 70.0], effectTags: ['吞海', '神遗'], alchemyTags: ['水', '突破'], }),
  fish({ id: 'chishui-jiaoyu', name: '赤水蛟鱼', description: '赤水蛟族遗下的鱼形血脉，尾鳍划过水面便有细小血焰。', tier: '天脉种', element: '水' as ElementType, behavior: 'fierce', minRealm: '金丹' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [4.0, 16.0], effectTags: ['蛟血', '水遁'], alchemyTags: ['水', '血脉'], }),
  fish({ id: 'baize-lingyu', name: '白泽灵鱼', description: '额前生一枚白纹，传说能避开水域中的恶煞与错误鱼讯。', tier: '仙裔种', element: '金' as ElementType, behavior: 'cunning', minRealm: '元婴' as RealmType, habitats: ['云梦秘泽'], sizeRange: [5.0, 20.0], effectTags: ['辟邪', '辨识'], alchemyTags: ['金', '神识'], }),
  fish({ id: 'taotie-tunyu', name: '饕餮吞鱼', description: '腹中似有无底洞，钓上岸后仍会追着灵气最浓的鱼饵咬。', tier: '神遗种', element: '土' as ElementType, behavior: 'fierce', minRealm: '化神' as RealmType, habitats: ['云梦秘泽'], sizeRange: [15.0, 60.0], effectTags: ['吞噬', '凶煞'], alchemyTags: ['土', '凶煞'], }),
  fish({ id: 'jiuying-linyu', name: '九婴鳞鱼', description: '鳞片上有九道婴火纹，咬钩时会连续吐出九次细小火星。', tier: '仙裔种', element: '火' as ElementType, behavior: 'fierce', minRealm: '元婴' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [7.0, 24.0], effectTags: ['九火', '凶性'], alchemyTags: ['火', '凶煞'], }),
  fish({ id: 'heishui-xuanyu', name: '黑水玄鱼', description: '通体不反光，只有鱼眼像两点沉在水底的寒星。', tier: '玄种', element: '冰' as ElementType, behavior: 'cunning', minRealm: '筑基' as RealmType, habitats: ['雷泽深潭', '云梦秘泽'], sizeRange: [3.0, 14.0], effectTags: ['黑水', '潜行'], alchemyTags: ['冰', '阴寒'], }),
  fish({ id: 'qinglong-linyu', name: '青龙鳞鱼', description: '每一片青鳞都像缩小的龙鳞，木水灵气旺盛时会主动追饵。', tier: '神遗种', element: '木' as ElementType, behavior: 'ancient', minRealm: '化神' as RealmType, habitats: ['云梦秘泽'], sizeRange: [16.0, 66.0], effectTags: ['青龙', '生机'], alchemyTags: ['木', '血脉'], }),
  fish({ id: 'xuanfeng-ciyu', name: '玄蜂刺鱼', description: '尾鳍如蜂刺，受惊时会把灵气凝成细针射向水面。', tier: '玄种', element: '风' as ElementType, behavior: 'swift', minRealm: '筑基' as RealmType, habitats: ['青溪浅湾', '雷泽深潭'], sizeRange: [0.9, 4.0], effectTags: ['风针', '迅疾'], alchemyTags: ['风', '淬体'], }),
  fish({ id: 'yinyue-youli', name: '阴月幽鲤', description: '只在月影最薄处游动，鱼鳞触碰灯火便会化作一缕幽光。', tier: '真种', element: '冰' as ElementType, behavior: 'cunning', minRealm: '筑基' as RealmType, habitats: ['凛月湖', '云梦秘泽'], sizeRange: [1.8, 7.0], effectTags: ['阴月', '安魂'], alchemyTags: ['冰', '安魂'], }),
  fish({ id: 'wanxiang-bianyu', name: '万象变鱼', description: '鳞片会映出垂钓者心中最想见到的鱼形，真假难辨。', tier: '天脉种', element: '金' as ElementType, behavior: 'cunning', minRealm: '金丹' as RealmType, habitats: ['云梦秘泽'], sizeRange: [3.5, 13.0], effectTags: ['幻化', '万象'], alchemyTags: ['金', '神识'], }),
];

export const FISHING_LOCATIONS: readonly FishingLocationDefinition[] = [
  { id: 'qingxi-shallow', name: '青溪浅湾', description: '山脚溪湾，水声清浅，是初次试竿的地方。', minRealm: '炼气', speciesIds: ['xiao-qingyu', 'qingbo-lingji', 'chitail-jinli', 'da-caoyu', 'longmen-jinyu', 'yusheng-yu', 'xuanfeng-ciyu'], qualityBonus: 0 },
  { id: 'lingyue-lake', name: '凛月湖', description: '环山而成的冷月湖泊，月升之后常有灵鱼出水。', minRealm: '炼气', speciesIds: ['xiao-qingyu', 'da-qingyu', 'qing-lingyu', 'yuewen-lu', 'xuanjia-chenli', 'wenyao-yueli', 'chixue-hongli', 'xingling-yu', 'xuelong-yu', 'feilian-fengyu', 'yusheng-yu', 'yinyue-youli'], qualityBonus: 0.04 },
  { id: 'leize-deep', name: '雷泽深潭', description: '雷云常驻的深潭，鱼线与雷光一样难以捉摸。', minRealm: '筑基', speciesIds: ['da-qingyu', 'leize-gui', 'chiru-yilin', 'da-heiyu', 'liuwen-jialongyu', 'daliuwen-yu', 'bifang-yanyu', 'xuanwu-guiyu', 'yinglong-yuyu', 'zhuyin-yu', 'chishui-jiaoyu', 'jiuying-linyu', 'heishui-xuanyu', 'xuanfeng-ciyu'], qualityBonus: 0.08 },
  { id: 'yunmeng-secret', name: '云梦秘泽', description: '水雾连天的古泽，偶尔会有不属于此世的鳞光浮起。', minRealm: '金丹', speciesIds: ['qing-lingyu', 'goumang-muyu', 'taixu-yinli', 'liuwen-jialongyu', 'taiyin-yuekun', 'xuanming-zuao', 'xingling-yu', 'xuelong-yu', 'liuwen-jinlongyu', 'daliuwen-yu', 'bifang-yanyu', 'xuanwu-guiyu', 'yinglong-yuyu', 'feilian-fengyu', 'zhuyin-yu', 'kunpeng-youyu', 'chishui-jiaoyu', 'baize-lingyu', 'taotie-tunyu', 'jiuying-linyu', 'heishui-xuanyu', 'qinglong-linyu', 'yinyue-youli', 'wanxiang-bianyu'], qualityBonus: 0.14 },
];

export const FISH_SPECIES_BY_ID = Object.fromEntries(FISH_SPECIES.map((species) => [species.id, species])) as Record<string, FishSpeciesDefinition>;
export const FISHING_LOCATIONS_BY_ID = Object.fromEntries(FISHING_LOCATIONS.map((location) => [location.id, location])) as Record<string, FishingLocationDefinition>;
