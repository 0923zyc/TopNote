/** 学习主题金句（欢迎页与启动屏共用，按日期轮换，同一天同一句） */

export interface DailyQuote {
  text: string
  author: string
}

export const QUOTES: DailyQuote[] = [
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '温故而知新，可以为师矣。', author: '孔子' },
  { text: '学然后知不足，教然后知困。', author: '《礼记》' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
  { text: '问渠那得清如许？为有源头活水来。', author: '朱熹' },
  { text: '读书之法，在循序而渐进，熟读而精思。', author: '朱熹' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈' },
  { text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子' },
  { text: '锲而不舍，金石可镂。', author: '荀子' },
  { text: '吾生也有涯，而知也无涯。', author: '庄子' },
  { text: '教育不是灌满一桶水，而是点燃一团火。', author: '叶芝' },
  { text: '我唯一知道的就是我一无所知。', author: '苏格拉底' },
  { text: '知识就是力量。', author: '培根' },
  { text: '天才就是百分之一的灵感加百分之九十九的汗水。', author: '爱迪生' },
  { text: '学而不厌，诲人不倦。', author: '孔子' },
  { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原' },
  { text: '少壮不努力，老大徒伤悲。', author: '《长歌行》' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '《警世贤文》' },
  { text: '旧书不厌百回读，熟读深思子自知。', author: '苏轼' },
  { text: '博观而约取，厚积而薄发。', author: '苏轼' },
  { text: '从来没有人读书，只有人在书中读自己。', author: '赫尔曼·黑塞' },
]

export function getDailyQuote(now: Date = new Date()): DailyQuote {
  const day = Math.floor(now.getTime() / 86_400_000)
  return QUOTES[day % QUOTES.length]
}
