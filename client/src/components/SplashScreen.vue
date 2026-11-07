<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useNotesStore } from '../stores/notes'

const store = useNotesStore()

/** 最短展示时长（让动画完整播完） */
const MIN_MS = 1700
/** 淡出动画时长 */
const FADE_MS = 500

const minDone = ref(false)
const leaving = ref(false)
const gone = ref(false)

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
      <!-- Logo：圆角方框描绘 → 填充 → 拾 字浮现（仿 Z 启动时刻） -->
      <svg class="splash__logo" viewBox="0 0 32 32" width="84" height="84">
        <rect
          class="splash__logo-frame"
          x="2"
          y="2"
          width="28"
          height="28"
          rx="8"
          fill="var(--btn-bg)"
          stroke="#ffffff"
          stroke-width="1.6"
          pathLength="100"
        />
        <text
          class="splash__logo-glyph"
          x="16"
          y="17"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="16"
          font-weight="600"
          font-family="inherit"
          fill="var(--btn-bg)"
        >
          拾
        </text>
      </svg>

      <div class="splash__name">
        <span class="splash__name-cn">拾知笔记</span>
        <span class="splash__name-en num">TopNote</span>
      </div>

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
  background: var(--btn-bg);
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
}

/* Logo 动画：描边 → 填充 → 字浮现 */
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
    fill: #ffffff;
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
  color: #ffffff;
}

.splash__name-en {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: color-mix(in srgb, #ffffff 65%, transparent);
}

@keyframes splash-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.splash__bar {
  margin-top: 26px;
  width: 120px;
  height: 2px;
  border-radius: 1px;
  background: color-mix(in srgb, #ffffff 25%, transparent);
  overflow: hidden;
}

.splash__bar-fill {
  display: block;
  height: 100%;
  width: 100%;
  border-radius: 1px;
  background: #ffffff;
  transform-origin: left;
  animation: splash-load 1.6s ease-in-out forwards;
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
  max-width: 420px;
  text-align: center;
  animation: splash-rise 0.4s ease-out;
}

.splash__error p {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #ffffff;
  opacity: 0.9;
}

.splash__retry {
  height: 32px;
  padding: 0 22px;
  border: 1px solid #ffffff;
  border-radius: var(--radius-control);
  background: transparent;
  color: #ffffff;
  font-size: 13px;
  cursor: pointer;
}

.splash__retry:hover {
  background: color-mix(in srgb, #ffffff 15%, transparent);
}

/* 动效减弱：跳过编排，只保留快速淡出 */
@media (prefers-reduced-motion: reduce) {
  .splash__logo-frame,
  .splash__logo-glyph,
  .splash__name,
  .splash__bar-fill {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
}
</style>
