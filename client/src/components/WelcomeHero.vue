<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore } from '../stores/notes'
import { greetingByHour } from '../utils/format'

const store = useNotesStore()

/** 学习主题金句（按日期轮换，每天一句） */
const QUOTES: Array<{ text: string; author: string }> = [
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

/** 按当天日期确定金句（同一天始终同一句） */
const dailyQuote = computed(() => {
  const day = Math.floor(Date.now() / 86_400_000)
  return QUOTES[day % QUOTES.length]
})

const greeting = computed(() => greetingByHour())

const statText = computed(() => {
  const total = store.notes.filter((n) => !n.corrupt).length
  const streak = store.streakDays
  const streakPart = streak > 0 ? `已连续记录 ${streak} 天 · ` : ''
  return `${streakPart}共 ${total} 篇笔记 · ${store.categories.length} 个分类 · ${store.favoriteCount} 条收藏`
})
</script>

<template>
  <div class="hero">
    <div class="hero__inner">
      <p class="hero__date num">
        {{
          new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
        }}
      </p>
      <h1 class="hero__greet">{{ greeting.greet }}</h1>
      <p class="hero__hint">{{ greeting.hint }}</p>

      <button class="hero__cta" type="button" @click="store.createNote()">
        开始记录今天
      </button>
      <p class="hero__kbd">或按 <kbd>Ctrl</kbd> + <kbd>N</kbd> 随时新建</p>

      <figure class="hero__quote">
        <blockquote>{{ dailyQuote.text }}</blockquote>
        <figcaption>—— {{ dailyQuote.author }}</figcaption>
      </figure>

      <p v-if="store.initialized" class="hero__stats num">{{ statText }}</p>
    </div>
  </div>
</template>

<style scoped>
.hero {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  background: var(--ground);
}

.hero__inner {
  max-width: 520px;
  padding: 48px 40px;
  text-align: center;
}

.hero__date {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 0.02em;
}

.hero__greet {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
  line-height: 1.2;
}

.hero__hint {
  margin: 12px 0 0;
  font-size: 15px;
  color: var(--ink-secondary);
  line-height: 1.7;
}

.hero__cta {
  margin-top: 34px;
  height: 44px;
  padding: 0 34px;
  border: none;
  border-radius: var(--radius-control);
  background: var(--btn-bg);
  color: var(--btn-ink);
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
}

.hero__cta:hover {
  background: var(--accent-hover);
}

.hero__cta:active {
  transform: scale(0.985);
}

.hero__kbd {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
}

.hero__kbd kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid var(--control-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--surface);
  font-family: inherit;
  font-size: 11px;
  color: var(--ink-secondary);
}

.hero__quote {
  margin: 52px 0 0;
}

/* 金句上方的副色小标线（随配色方案变化） */
.hero__quote::before {
  content: '';
  display: block;
  width: 26px;
  height: 2px;
  margin: 0 auto 16px;
  background: var(--companion);
  border-radius: 1px;
}

.hero__quote blockquote {
  margin: 0;
  padding: 0 8px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--ink-secondary);
}

.hero__quote figcaption {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.hero__stats {
  margin: 40px 0 0;
  font-size: 12.5px;
  color: var(--ink-faint);
}
</style>
