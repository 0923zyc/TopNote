/**
 * 高级配色方案（Phase 9）
 *
 * 每套色板是一个有出处的"搭配"而非孤立颜色：主色（accent）负责动作、
 * 链接与选中态；副色（companion）负责分类徽标、引用块等次级色彩层次。
 * 星标金色是全应用固定的情感色，不随色板变化。
 *
 * 对比度约束：accent-ink / companion-ink 在浅色表面 ≥ 4.5:1；
 * btn-bg 与白字 ≥ 4.5:1；深色模式全部按暗表面重新调校。
 */

export interface Palette {
  id: string
  /** 展示名 */
  name: string
  /** 一句话说明搭配思路 */
  desc: string
  /** 选择器里的两个展示圆点（取浅色模式值） */
  dot: [string, string]
}

export const PALETTES: Palette[] = [
  {
    id: 'indigo',
    name: '靛蓝',
    desc: '默认 · 克制的靛蓝，学习工具的安静底色',
    dot: ['#5b6abf', '#c7901c'],
  },
  {
    id: 'klein',
    name: '克莱因蓝 × 驼棕',
    desc: '国际克莱因蓝 IKB 携手驼棕，艺术画廊式的高对比',
    dot: ['#002fa7', '#8c5a2b'],
  },
  {
    id: 'forest',
    name: '森绿 × 亚麻',
    desc: '深林绿与亚麻米金，老图书馆与纸质书的沉稳',
    dot: ['#2f6b4f', '#8a6f35'],
  },
  {
    id: 'burgundy',
    name: '勃艮第 × 鎏金',
    desc: '酒庄丝绒红配鎏金，古典而浓烈',
    dot: ['#8c2f4a', '#a0741f'],
  },
  {
    id: 'ink',
    name: '水墨 × 朱砂',
    desc: '墨色为主、朱砂印章为伴，文人书房气质',
    dot: ['#26282d', '#b03a2e'],
  },
  {
    id: 'celadon',
    name: '青瓷 × 赭石',
    desc: '青瓷绿与赭石暖棕，东方器物的温润',
    dot: ['#2e7d6c', '#a06a28'],
  },
]

export const DEFAULT_PALETTE = 'indigo'

/** 非默认色板通过 html[data-palette] 属性切换；默认色板不设属性 */
export function isDefaultPalette(id: string): boolean {
  return id === DEFAULT_PALETTE
}
