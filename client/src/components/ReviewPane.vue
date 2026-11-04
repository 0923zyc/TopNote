<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { useNotesStore } from '../stores/notes'
import { useTheme } from '../composables/theme'
import { notesApi } from '../api/notes'
import { formatDate } from '../utils/format'
import type { NoteDetail } from '../types'

const store = useNotesStore()
const { isDark } = useTheme()

const DECK_SIZE = 5

/** 抽卡牌堆（笔记元数据 id 列表）与当前张序号 */
const deck = ref<string[]>([])
const index = ref(0)
const loadingCard = ref(false)
/** 已拉取的详情缓存（本次回顾会话内复用） */
const detailCache = new Map<string, NoteDetail>()
const currentDetail = ref<NoteDetail | null>(null)

/** 回顾候选：优先"非今天"更新的旧笔记（对抗"记了就忘"），不够再补今天的 */
const eligible = computed(() => {
  const all = store.notes.filter((n) => !n.corrupt)
  const today = new Date().toDateString()
  const older = all.filter((n) => new Date(n.updatedAt).toDateString() !== today)
  return older.length > 0 ? older : all
})

function buildDeck() {
  const pool = [...eligible.value]
  // Fisher–Yates 洗牌后取前 N 张
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  deck.value = pool.slice(0, DECK_SIZE).map((n) => n.id)
  index.value = 0
  loadCurrent() // 牌堆重建后首张立即加载（index 可能不变，watch 不会触发）
}

const currentMeta = computed(() => {
  const id = deck.value[index.value]
  return id ? (store.notes.find((n) => n.id === id) ?? null) : null
})

async function loadCurrent() {
  const meta = currentMeta.value
  if (!meta) {
    currentDetail.value = null
    return
  }
  const cached = detailCache.get(meta.id)
  if (cached) {
    currentDetail.value = cached
    return
  }
  loadingCard.value = true
  currentDetail.value = null
  try {
    const detail = await notesApi.get(meta.id)
    detailCache.set(meta.id, detail)
    currentDetail.value = detail
  } catch {
    currentDetail.value = null
  } finally {
    loadingCard.value = false
  }
}

function nextCard() {
  index.value = (index.value + 1) % deck.value.length
}

function openInEditor() {
  if (currentMeta.value) store.selectNote(currentMeta.value.id)
}

onMounted(buildDeck)
watch(index, loadCurrent)
watch(
  () => store.notes.length,
  () => {
    if (deck.value.length === 0) buildDeck()
  }
)
</script>

<template>
  <div class="review">
    <header class="review-head">
      <div>
        <h1 class="review-head__title">每日回顾</h1>
        <p class="review-head__sub">随机重访写过的笔记，对抗"记了就忘"</p>
      </div>
      <div class="review-head__actions">
        <button class="review-btn" type="button" @click="buildDeck()">换一批</button>
        <button class="review-btn review-btn--ghost" type="button" @click="store.toggleReview(false)">退出回顾</button>
      </div>
    </header>

    <!-- 空状态 -->
    <div v-if="eligible.length === 0" class="review-empty">
      <p class="review-empty__title">还没有可回顾的笔记</p>
      <p class="review-empty__hint">先记几篇，明天回来重访它们</p>
      <button class="review-btn review-btn--primary" type="button" @click="store.createNote()">开始记录</button>
    </div>

    <!-- 卡片 -->
    <article v-else class="review-card">
      <div class="review-card__meta num">
        <span>{{ (index + 1) }} / {{ deck.length }}</span>
        <span v-if="currentMeta" class="review-card__date">{{ formatDate(currentDetail?.updatedAt ?? currentMeta.updatedAt) }}</span>
        <span v-if="currentMeta?.category" class="review-card__cat">{{ currentMeta.category }}</span>
      </div>

      <h2 class="review-card__title">{{ currentMeta?.title || '无标题笔记' }}</h2>

      <div v-if="loadingCard" class="review-card__loading">加载中…</div>
      <MdPreview
        v-else-if="currentDetail"
        class="review-card__body"
        :model-value="currentDetail.content || '（这篇笔记还没有内容）'"
        :theme="isDark ? 'dark' : 'light'"
        preview-theme="github"
        :footers="false"
      />
      <p v-else class="review-card__loading">内容加载失败</p>

      <div class="review-card__actions">
        <button class="review-btn review-btn--primary" type="button" @click="nextCard">换一张</button>
        <button class="review-btn" type="button" @click="openInEditor">在编辑器中打开</button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.review {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  background: var(--ground);
}

.review-head {
  width: 100%;
  max-width: 720px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
}

.review-head__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
}

.review-head__sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ink-faint);
}

.review-head__actions {
  flex: none;
  display: flex;
  gap: 8px;
}

.review-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.review-btn:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}

.review-btn--ghost {
  border-color: transparent;
  background: transparent;
}

.review-btn--primary {
  background: var(--btn-bg);
  border-color: var(--btn-bg);
  color: var(--btn-ink);
}

.review-btn--primary:hover {
  background: var(--accent-hover);
  color: var(--btn-ink);
}

.review-empty {
  margin-top: 12vh;
  text-align: center;
}

.review-empty__title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--ink-secondary);
}

.review-empty__hint {
  margin: 6px 0 18px;
  font-size: 13px;
  color: var(--ink-faint);
}

.review-card {
  width: 100%;
  max-width: 720px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  padding: 22px 26px 18px;
  display: flex;
  flex-direction: column;
  min-height: 380px;
}

.review-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--ink-faint);
}

.review-card__date {
  color: var(--ink-secondary);
}

.review-card__cat {
  padding: 2px 8px;
  border-radius: var(--radius-chip);
  background: var(--companion-soft);
  color: var(--companion-ink);
  font-size: 11px;
}

.review-card__title {
  margin: 10px 0 0;
  font-size: 19px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.45;
}

.review-card__body {
  flex: 1;
  margin-top: 8px;
  font-size: 14.5px;
  --md-bk-color: transparent !important;
}

.review-card__body :deep(.md-editor-preview-wrapper) {
  padding: 4px 0;
}

.review-card__body :deep(.md-editor-preview) {
  font-size: 14.5px;
  color: var(--ink);
  font-family: var(--font);
}

/* 卡片内图片不越界 */
.review-card__body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-control);
}

.review-card__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-faint);
  font-size: 13px;
}

.review-card__actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--rule);
}
</style>
