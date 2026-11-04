<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import type { ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useNotesStore } from '../stores/notes'
import { useTheme } from '../composables/theme'
import { notesApi } from '../api/notes'
import { formatFull } from '../utils/format'
import type { SaveState } from '../types'
import WelcomeHero from './WelcomeHero.vue'

const store = useNotesStore()
const { isDark } = useTheme()

// ── 编辑器配置 ────────────────────────────────────────
const toolbars: ToolbarNames[] = [
  'bold',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'codeRow',
  'code',
  'link',
  'table',
  '-',
  'catalog', // 大纲目录（长笔记导航）
  'revoke',
  'next',
  '=',
  'pageFullscreen', // 专注模式
  'preview',
]

// ── 本地编辑态 ────────────────────────────────────────
const titleInput = ref<HTMLInputElement | null>(null)
const title = ref('')
const content = ref('')
const tagInput = ref('')
/** 已填充到编辑器的笔记 id（防止保存回写触发重新填充） */
const populatedId = ref<string | null>(null)
/** 填充期间抑制自动保存 */
const suppressWatch = ref(false)

/** 待保存补丁（归属到具体笔记 id，切换笔记时补写） */
const pending = ref<{ id: string; patch: { title: string; content: string } } | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (!store.currentId) return
  pending.value = { id: store.currentId, patch: { title: title.value, content: content.value } }
  saveStateLocal.value = 'pending'
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(flushSave, 800)
}

async function flushSave() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const p = pending.value
  pending.value = null
  if (!p) return
  await store.saveCurrent(p.patch, p.id)
}

const saveStateLocal = ref<SaveState>('idle')
// 编辑器内的保存状态直接反映 store（保存动作最终由 store 执行）
watch(
  () => store.saveState,
  (s) => {
    saveStateLocal.value = s
  }
)

// ── 笔记切换时填充编辑器 ──────────────────────────────
watch(
  () => [store.currentId, store.currentDetail] as const,
  async ([id, detail]) => {
    // 有未落盘的旧内容：先立即补写到旧笔记
    if (pending.value && pending.value.id !== id) {
      await flushSave()
    }
    if (!id) {
      populatedId.value = null
      return
    }
    // 详情未加载完成 → 显示加载态，不填充
    if (!detail || detail.id !== id) return
    if (populatedId.value === id) return // 保存回写不重新填充
    suppressWatch.value = true
    populatedId.value = id
    title.value = detail.title
    content.value = detail.content
    saveStateLocal.value = 'idle'
    await nextTick()
    suppressWatch.value = false
    // 新建的空笔记：自动聚焦标题并全选，便于直接输入
    if (detail.title === '无标题笔记' && detail.content === '') {
      titleInput.value?.focus()
      titleInput.value?.select()
    }
  },
  { immediate: true, deep: false }
)

// ── 自动保存（防抖 800ms，文档 5.2）──────────────────
watch([title, content], () => {
  if (suppressWatch.value) return
  if (!store.currentId) return
  scheduleSave()
})

// Ctrl/Cmd + S 立即保存
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    flushSave()
  }
}
// 页面关闭前尽力补写
function onBeforeUnload() {
  if (pending.value) {
    const p = pending.value
    const body = JSON.stringify(p.patch)
    navigator.sendBeacon?.(`/api/notes/${encodeURIComponent(p.id)}`, new Blob([body], { type: 'application/json' }))
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  flushSave()
})

// ── 分类 ──────────────────────────────────────────────
async function onCategoryChange(cat: string | null) {
  if (!store.currentDetail) return
  if (cat && !store.categories.includes(cat)) {
    // 新分类：先到后端登记（校验），再随笔记保存
    try {
      await notesApi.createCategory(cat)
    } catch {
      /* 登记失败不阻塞保存，分类仍随笔记落盘 */
    }
  }
  await store.saveCurrent({ category: cat })
}

// ── 标签 ──────────────────────────────────────────────
async function addTag() {
  const t = tagInput.value.trim().slice(0, 60)
  if (!t || !store.currentDetail) return
  if (store.currentDetail.tags.includes(t)) {
    tagInput.value = ''
    return
  }
  tagInput.value = ''
  await store.saveCurrent({ tags: [...store.currentDetail.tags, t] })
}

async function removeTag(tag: string) {
  if (!store.currentDetail) return
  await store.saveCurrent({ tags: store.currentDetail.tags.filter((x) => x !== tag) })
}

// ── 收藏 / 删除 / 导出 ────────────────────────────────
function toggleFav() {
  if (store.currentId) store.toggleFavorite(store.currentId)
}

/** 导出当前笔记为 .md 文件（带走数据） */
function exportMarkdown() {
  const d = store.currentDetail
  if (!d) return
  const safeName = (d.title || '无标题笔记').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  const blob = new Blob([d.content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.md`
  a.click()
  URL.revokeObjectURL(url)
}

async function deleteCurrent() {
  const note = store.currentNote
  if (!note || !store.currentId) return
  try {
    await ElMessageBox.confirm(
      note.corrupt ? '该文件无法解析，将移入回收站（30 天后自动清理）。' : `「${note.title || '无标题笔记'}」将移入回收站，30 天内可随时恢复。`,
      '删除笔记',
      {
        confirmButtonText: '移入回收站',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return // 用户取消
  }
  const ok = await store.removeNote(store.currentId)
  if (ok) ElMessage.success({ message: '已移入回收站，可在侧栏「回收站」中恢复', grouping: true })
}
</script>

<template>
  <section class="editor-pane">
    <!-- 未选中：欢迎引导（文档 5.1 空状态引导） -->
    <WelcomeHero v-if="!store.currentId" />

    <template v-else>
      <!-- 详情加载中 -->
      <div v-if="!store.currentDetail" class="editor-loading">
        <span class="editor-loading__spinner" aria-hidden="true"></span>
        <p>正在加载笔记…</p>
      </div>

      <template v-else>
        <!-- 编辑器头部：标题 + 元信息 + 保存状态 -->
        <header class="editor-head">
          <div class="editor-head__row">
            <input
              ref="titleInput"
              v-model="title"
              class="title-input"
              type="text"
              placeholder="给这篇笔记起个标题"
              aria-label="笔记标题"
            />
            <div class="head-actions">
              <span
                v-if="saveStateLocal !== 'idle'"
                class="save-state"
                :class="`is-${saveStateLocal}`"
                :title="store.saveError ?? ''"
              >
                <span class="save-state__dot" aria-hidden="true"></span>
                <template v-if="saveStateLocal === 'pending'">编辑中</template>
                <template v-else-if="saveStateLocal === 'saving'">保存中…</template>
                <template v-else-if="saveStateLocal === 'saved'">已保存</template>
                <template v-else-if="saveStateLocal === 'error'">保存失败</template>
              </span>
              <button
                class="icon-btn"
                :class="{ 'is-on': store.currentDetail.favorited }"
                type="button"
                :title="store.currentDetail.favorited ? '取消收藏' : '收藏'"
                :aria-label="store.currentDetail.favorited ? '取消收藏' : '收藏'"
                @click="toggleFav"
              >
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path
                    d="M8 2.2 9.7 5.8l4 .5-2.9 2.7.8 3.9L8 11l-3.6 1.9.8-3.9L2.3 6.3l4-.5L8 2.2Z"
                    :fill="store.currentDetail.favorited ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="icon-btn"
                type="button"
                title="导出为 .md 文件"
                aria-label="导出为 Markdown 文件"
                @click="exportMarkdown"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <path
                    d="M8 2.5v7.2m0 0 2.8-2.8M8 9.7 5.2 6.9M3 11.5v1c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-1"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                title="移入回收站"
                aria-label="删除笔记"
                @click="deleteCurrent"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <path
                    d="M3 4.5h10M6.5 4.5V3.4c0-.5.4-.9.9-.9h1.2c.5 0 .9.4.9.9v1.1M4.5 4.5l.6 8.2c0 .5.4.8.9.8h4c.5 0 .9-.3.9-.8l.6-8.2"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div class="editor-head__meta">
            <el-select
              :model-value="store.currentDetail.category"
              class="category-select"
              placeholder="选择或输入分类"
              size="small"
              clearable
              filterable
              allow-create
              default-first-option
              :teleported="false"
              @change="onCategoryChange"
            >
              <el-option v-for="cat in store.categories" :key="cat" :label="cat" :value="cat" />
            </el-select>

            <div class="tag-editor">
              <span v-for="tag in store.currentDetail.tags" :key="tag" class="tag">
                {{ tag }}
                <button type="button" class="tag__x" :aria-label="`移除标签 ${tag}`" @click="removeTag(tag)">×</button>
              </span>
              <input
                v-model="tagInput"
                class="tag-input"
                type="text"
                placeholder="+ 标签"
                aria-label="添加标签，回车确认"
                @keydown.enter.prevent="addTag"
                @blur="addTag"
              />
            </div>

            <time class="editor-head__time num" :datetime="store.currentDetail.updatedAt" :title="'创建于 ' + formatFull(store.currentDetail.createdAt)">
              {{ formatFull(store.currentDetail.updatedAt) }}
            </time>
          </div>
        </header>

        <!-- Markdown 编辑器（分屏预览） -->
        <div class="editor-body">
          <MdEditor
            v-model="content"
            class="md-editor"
            :theme="isDark ? 'dark' : 'light'"
            preview-theme="github"
            :toolbars="toolbars"
            :footers="['markdownTotal']"
            placeholder="从这里开始记录…"
            no-upload-img
            @blur="flushSave"
          />
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.editor-pane {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--ground);
}

.editor-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ink-faint);
  font-size: 13px;
}

.editor-loading__spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--rule);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.editor-head {
  flex: none;
  padding: 14px 24px 10px;
  border-bottom: 1px solid var(--rule);
  background: var(--ground);
}

.editor-head__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-title);
  font-weight: 600;
  color: var(--ink);
  padding: 2px 0;
}

.title-input::placeholder {
  color: var(--ink-faint);
  font-weight: 400;
}

.head-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-faint);
  white-space: nowrap;
}

.save-state__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink-faint);
  opacity: 0.5;
}

.save-state.is-saved .save-state__dot {
  background: var(--positive);
  opacity: 1;
}

.save-state.is-saved {
  color: var(--positive);
}

.save-state.is-saving .save-state__dot,
.save-state.is-pending .save-state__dot {
  background: var(--accent);
  opacity: 1;
  animation: pulse 1s ease-in-out infinite;
}

.save-state.is-saving,
.save-state.is-pending {
  color: var(--accent-ink);
}

.save-state.is-error {
  color: var(--negative);
}

.save-state.is-error .save-state__dot {
  background: var(--negative);
  opacity: 1;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease;
}

.icon-btn:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink-secondary);
}

.icon-btn.is-on {
  color: var(--gold);
  animation: star-pop 0.28s ease;
}

.icon-btn.is-on:hover {
  color: var(--gold-hover);
}

.icon-btn--danger:hover {
  color: var(--negative);
}

@keyframes star-pop {
  0% {
    transform: scale(0.72);
  }
  60% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}

.editor-head__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  min-height: 26px;
}

.category-select {
  width: 150px;
  flex: none;
}

.tag-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  line-height: 1;
  padding: 3px 4px 3px 8px;
  border-radius: var(--radius-chip);
  background: var(--rule);
  color: var(--ink-secondary);
}

.tag__x {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  opacity: 0.6;
}

.tag__x:hover {
  opacity: 1;
}

.tag-input {
  width: 64px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--ink);
}

.tag-input::placeholder {
  color: var(--ink-faint);
}

.editor-head__time {
  flex: none;
  font-size: 12px;
  color: var(--ink-faint);
}

.editor-body {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  padding: 14px 16px 16px;
}

/* 内容行宽约束（文档 6.4：右栏内容区最大宽度约 720px 并居中） */
.md-editor {
  width: 100%;
  max-width: 780px;
  min-height: 0;
  height: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: none;
  --md-bk-color: var(--surface) !important;
}

/* 专注模式（页面全屏）时解除行宽与圆角限制，铺满整个窗口 */
.md-editor.md-editor-fullscreen {
  max-width: none;
  border: none;
  border-radius: 0;
}

/* Markdown 渲染细节（文档 6.5）：引用左色条、表格斑马纹、标题层级间距 */
.md-editor :deep(.md-editor-preview-wrapper) {
  padding: 8px 20px;
}

.md-editor :deep(.md-editor-preview) {
  font-size: 15px;
  line-height: 1.75;
  color: var(--ink);
  font-family: var(--font);
}

.md-editor :deep(.md-editor-preview blockquote) {
  border-left: 3px solid var(--companion);
  background: var(--companion-soft);
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  padding: 6px 14px;
  margin: 12px 0;
  color: var(--ink-secondary);
}

.md-editor :deep(.md-editor-preview blockquote p) {
  margin: 4px 0;
}

.md-editor :deep(.md-editor-preview table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
}

.md-editor :deep(.md-editor-preview th) {
  font-weight: 600;
  color: var(--ink);
}

.md-editor :deep(.md-editor-preview th),
.md-editor :deep(.md-editor-preview td) {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}

.md-editor :deep(.md-editor-preview tr:nth-child(2n) td) {
  background: var(--rule); /* 表格斑马纹 */
}

.md-editor :deep(.md-editor-preview h1),
.md-editor :deep(.md-editor-preview h2) {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 8px;
  margin-top: 28px;
}

.md-editor :deep(.md-editor-preview h1) {
  font-size: 26px;
}

.md-editor :deep(.md-editor-preview h2) {
  font-size: 21px;
}

.md-editor :deep(.md-editor-preview h3) {
  font-size: 18px;
}

.md-editor :deep(.md-editor-preview ul),
.md-editor :deep(.md-editor-preview ol) {
  padding-left: 22px;
}

.md-editor :deep(.md-editor-preview li) {
  margin: 4px 0;
}
</style>
