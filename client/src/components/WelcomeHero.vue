<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore } from '../stores/notes'
import { getDailyQuote } from '../config/quotes'
import { greetingByHour } from '../utils/format'

const store = useNotesStore()

const dailyQuote = getDailyQuote()

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
