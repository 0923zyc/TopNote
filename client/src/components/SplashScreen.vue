<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useNotesStore } from '../stores/notes'
import { getDailyQuote } from '../config/quotes'

const store = useNotesStore()

/** 最短展示时长（让动画与今日名言完整呈现） */
const MIN_MS = 2900
/** 淡出动画时长 */
const FADE_MS = 500

const minDone = ref(false)
const leaving = ref(false)
const gone = ref(false)

const dailyQuote = getDailyQuote()

onMounted(() => {
  setTimeout(() => {
    minDone.value = true
  }, MIN_MS)
})

// 后端就绪 + 最短展示时间到 → 淡出；后端异常则停留并给出重试
watch([() => store.initialized, () => store.connectionError, minDone], () => {
  if (minDone.value && store.initialized && !store.connectionError && !leaving.value) {
    leaving.value = true
    setTimeout(() => {
      gone.value = true
    }, FADE_MS)
  }
})
</script>

<template>
  <div v-if="!gone" class="splash" :class="{ 'is-leaving': leaving }">
    <div class="splash__stage">
      <!-- Logo：主色描边 → 主色填充 → 底色 TN 字标浮现 -->
      <svg class="splash__logo" viewBox="0 0 32 32" width="84" height="84">
        <rect
          class="splash__logo-frame"
          x="2"
          y="2"
          width="28"
          height="28"
          rx="8"
          fill="var(--btn-bg)"
          stroke="var(--accent)"
          stroke-width="1.6"
          pathLength="100"
        />
        <text
          class="splash__logo-glyph"
          x="16"
          y="17"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="11.5"
          font-weight="800"
          letter-spacing="-0.5"
          font-family="inherit"
          fill="var(--ground)"
        >
          TN
        </text>
      </svg>

      <div class="splash__name">
        <span class="splash__name-cn">TopNote</span>
        <span class="splash__name-en num">本地学习笔记</span>
      </div>

      <!-- 今日名言（与欢迎页同源，按日期轮换） -->
      <figure class="splash__quote">
        <blockquote>{{ dailyQuote.text }}</blockquote>
        <figcaption>—— {{ dailyQuote.author }}</figcaption>
      </figure>

      <!-- 进度细线 -->
      <div class="splash__bar">
        <i class="splash__bar-fill"></i>
      </div>

      <!-- 后端异常：停留并重试 -->
      <div v-if="store.connectionError" class="splash__error">
        <p>{{ store.connectionError }}</p>
        <button class="splash__retry" type="button" @click="store.fetchNotes()">重试</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 背景跟随主题主色：浅色主题=暖白，深色主题=暖黑 */
  background: var(--ground);
  transition: opacity 0.5s ease, visibility 0.5s ease;
}

.splash.is-leaving {
  opacity: 0;
  visibility: hidden;
}

.splash__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
}

/* Logo 动画：主色描边 → 主色填充 → 底色 TN 字标浮现 */
.splash__logo-frame {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: splash-draw 0.7s ease-out forwards, splash-fill 0.45s ease-out 0.75s forwards;
}

@keyframes splash-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes splash-fill {
  to {
    fill: var(--btn-bg);
  }
}

.splash__logo-glyph {
  opacity: 0;
  transform: scale(0.6);
  transform-origin: 16px 17px;
  animation: splash-glyph 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 1s forwards;
}

@keyframes splash-glyph {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.splash__name {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transform: translateY(10px);
  animation: splash-rise 0.5s ease-out 1.25s forwards;
}

.splash__name-cn {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--ink);
}

.splash__name-en {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--ink-faint);
}

@keyframes splash-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 今日名言（副色小标线 + 名句 + 作者） */
.splash__quote {
  margin: 30px 0 0;
  text-align: center;
  opacity: 0;
  transform: translateY(8px);
  animation: splash-rise 0.55s ease-out 1.75s forwards;
}

.splash__quote::before {
  content: '';
  display: block;
  width: 26px;
  height: 2px;
  margin: 0 auto 14px;
  background: var(--companion);
  border-radius: 1px;
}

.splash__quote blockquote {
  margin: 0;
  max-width: 460px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--ink-secondary);
}

.splash__quote figcaption {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--ink-faint);
}

/* 进度细线 */
.splash__bar {
  margin-top: 30px;
  width: 120px;
  height: 2px;
  border-radius: 1px;
  background: var(--rule);
  overflow: hidden;
}

.splash__bar-fill {
  display: block;
  height: 100%;
  width: 100%;
  border-radius: 1px;
  background: var(--accent);
  transform-origin: left;
  animation: splash-load 2.7s ease-in-out forwards;
}

@keyframes splash-load {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.splash__error {
  margin-top: 22px;
  max-width: 460px;
  text-align: center;
  animation: splash-rise 0.4s ease-out;
}

.splash__error p {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--negative);
}

.splash__retry {
  height: 32px;
  padding: 0 22px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--accent-ink);
  font-size: 13px;
  cursor: pointer;
}

.splash__retry:hover {
  background: var(--accent-soft);
}

/* 动效减弱：跳过编排，只保留快速淡出 */
@media (prefers-reduced-motion: reduce) {
  .splash__logo-frame,
  .splash__logo-glyph,
  .splash__name,
  .splash__quote,
  .splash__bar-fill {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
}
</style>
