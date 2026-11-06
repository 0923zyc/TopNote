<script setup lang="ts">
import { useNotesStore } from '../stores/notes'
import type { SortBy } from '../types'
import { formatRelative } from '../utils/format'

const store = useNotesStore()

function setSort(next: SortBy) {
  store.sortBy = next
}

async function onDeleteCorrupt(id: string) {
  await store.removeNote(id)
}
</script>

<template>
  <section class="list-pane">
    <!-- 搜索 + 排序 -->
    <div class="list-tools">
      <div class="search-box">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <input
          v-model="store.searchQuery"
          class="search-box__input"
          type="search"
          placeholder="搜索标题、内容、标签"
          aria-label="搜索笔记"
        />
        <button
          v-if="store.searchQuery"
          class="search-box__clear"
          type="button"
          aria-label="清空搜索"
          @click="store.searchQuery = ''"
        >
          ×
        </button>
      </div>
      <div class="sort-switch" role="group" aria-label="排序方式">
        <button
          type="button"
          :class="{ 'is-on': store.sortBy === 'updatedAt' }"
          @click="setSort('updatedAt')"
        >
          更新时间
        </button>
        <button
          type="button"
          :class="{ 'is-on': store.sortBy === 'createdAt' }"
          @click="setSort('createdAt')"
        >
          创建时间
        </button>
      </div>
    </div>

    <!-- 视图说明行 -->
    <div class="list-context">
      <template v-if="store.viewKind === 'favorites'">收藏</template>
      <template v-else-if="store.viewKind === 'category'">{{ store.activeCategory }}</template>
      <template v-else>全部笔记</template>
      <span class="list-context__count num">{{ store.visibleNotes.length }}</span>
      <span v-if="store.dateFilter" class="list-context__date num" :title="'仅显示 ' + store.dateFilter + ' 更新的笔记'">
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3" />
          <path d="M2.5 6.5h11M5.5 2v2M10.5 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        {{ store.dateFilter }}
        <button type="button" class="list-context__clear" aria-label="清除日期筛选" @click="store.setDateFilter(null)">×</button>
      </span>
    </div>

    <!-- 列表 -->
    <div class="note-list" role="list">
      <article
        v-for="note in store.visibleNotes"
        :key="note.id"
        class="note-item"
        :class="{ 'is-selected': store.currentId === note.id, 'is-corrupt': note.corrupt }"
        role="listitem"
        :tabindex="0"
        @click="store.selectNote(note.id)"
        @keydown.enter="store.selectNote(note.id)"
      >
        <div class="note-item__head">
          <svg
            v-if="note.pinned"
            class="note-item__pin"
            viewBox="0 0 16 16"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path
              d="M9.6 2.2l4.2 4.2-2.4 1-1.3 3.2-2-2-4.5 4.5-.7-.7 4.5-4.5-2-2 3.2-1.3 1-2.4z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1"
              stroke-linejoin="round"
            />
          </svg>
          <h3 class="note-item__title ellipsis">{{ note.corrupt ? '⚠ 文件损坏' : note.title || '无标题笔记' }}</h3>
          <button
            v-if="!note.corrupt"
            class="star-btn"
            :class="{ 'is-on': note.favorited }"
            type="button"
            :aria-label="note.favorited ? '取消收藏' : '收藏'"
            :title="note.favorited ? '取消收藏' : '收藏'"
            @click.stop="store.toggleFavorite(note.id)"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M8 2.2 9.7 5.8l4 .5-2.9 2.7.8 3.9L8 11l-3.6 1.9.8-3.9L2.3 6.3l4-.5L8 2.2Z"
                :fill="note.favorited ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            v-else
            class="corrupt-del"
            type="button"
            title="删除损坏文件"
            @click.stop="onDeleteCorrupt(note.id)"
          >
            删除
          </button>
        </div>

        <p v-if="!note.corrupt && note.summary" class="note-item__summary">{{ note.summary }}</p>
        <p v-else-if="!note.corrupt" class="note-item__summary note-item__summary--empty">暂无内容</p>
        <p v-else class="note-item__summary note-item__summary--empty">该笔记文件无法解析，可移入回收站</p>

        <div v-if="!note.corrupt" class="note-item__meta">
          <span v-if="note.category" class="chip chip--category">{{ note.category }}</span>
          <button
            v-for="tag in note.tags.slice(0, 3)"
            :key="tag"
            class="chip chip--tag"
            type="button"
            :title="`筛选标签「${tag}」`"
            @click.stop="store.searchQuery = tag"
          >
            {{ tag }}
          </button>
          <time class="note-item__time num" :datetime="note.updatedAt" :title="note.updatedAt">
            {{ formatRelative(note.updatedAt) }}
          </time>
        </div>
      </article>

      <!-- 空状态（按视图区分文案，文档 5.3） -->
      <div v-if="store.visibleNotes.length === 0" class="list-empty">
        <template v-if="store.searchQuery">
          <p class="list-empty__title">没有匹配「{{ store.searchQuery }}」的笔记</p>
          <p class="list-empty__hint">换个关键词试试，或清空搜索查看全部</p>
        </template>
        <template v-else-if="store.viewKind === 'favorites'">
          <p class="list-empty__title">还没有收藏的笔记</p>
          <p class="list-empty__hint">点击列表项上的星标，把常看的笔记收进来</p>
        </template>
        <template v-else-if="store.viewKind === 'category'">
          <p class="list-empty__title">「{{ store.activeCategory }}」下还没有笔记</p>
          <p class="list-empty__hint">在编辑器里把笔记归到这个分类即可</p>
        </template>
        <template v-else>
          <p class="list-empty__title">还没有笔记</p>
          <p class="list-empty__hint">点击左侧「新建笔记」，从第一行开始记录</p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--ground);
  border-right: 1px solid var(--border);
  min-height: 0;
}

.list-tools {
  flex: none;
  padding: 12px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-faint);
  transition: border-color 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
}

.search-box__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--ink);
}

.search-box__input::placeholder {
  color: var(--ink-faint);
}

.search-box__input::-webkit-search-cancel-button {
  display: none;
}

.search-box__clear {
  flex: none;
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.search-box__clear:hover {
  color: var(--ink);
}

.sort-switch {
  display: flex;
  gap: 2px;
}

.sort-switch button {
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--radius-chip);
  cursor: pointer;
}

.sort-switch button:hover {
  color: var(--ink-secondary);
}

.sort-switch button.is-on {
  background: var(--rule);
  color: var(--ink);
  font-weight: 500;
}

.list-context {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 2px 14px 8px;
  font-size: 12px;
  color: var(--ink-faint);
  border-bottom: 1px solid var(--rule);
}

.list-context__count {
  color: var(--ink-secondary);
}

.list-context__date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: var(--radius-chip);
  background: var(--accent-soft);
  color: var(--accent-ink);
}

.list-context__clear {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 0 1px;
}

.list-context__clear:hover {
  color: var(--negative);
}

.note-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px 16px;
}

.note-item {
  padding: 10px 10px 9px;
  border-radius: var(--radius-card);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s ease;
}

.note-item:hover {
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}

.note-item.is-selected {
  background: var(--surface);
  border-color: var(--border);
}

.note-item.is-corrupt {
  background: color-mix(in srgb, var(--negative) 5%, transparent);
}

.note-item__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.note-item__pin {
  flex: none;
  color: var(--accent);
  transform: rotate(0deg);
}

.note-item__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--ink);
}

.star-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, color 0.12s ease;
}

.note-item:hover .star-btn,
.star-btn.is-on {
  opacity: 1;
}

.star-btn:hover {
  color: var(--gold-hover);
}

.star-btn.is-on {
  color: var(--gold);
  animation: star-pop 0.28s ease;
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

.corrupt-del {
  flex: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--negative);
  font-size: 12px;
  border-radius: var(--radius-chip);
  padding: 1px 8px;
  cursor: pointer;
}

.note-item__summary {
  margin: 3px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink-faint);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-item__summary--empty {
  font-style: normal;
  opacity: 0.75;
}

.note-item__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 7px;
  min-height: 18px;
}

.chip {
  flex: none;
  max-width: 84px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: var(--radius-chip);
  background: var(--rule);
  color: var(--ink-secondary);
}

.chip--category {
  background: var(--companion-soft);
  color: var(--companion-ink);
}

.chip--tag {
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s ease, color 0.12s ease;
}

.chip--tag:hover {
  background: var(--accent-soft);
  color: var(--accent-ink);
}

.note-item__time {
  margin-left: auto;
  flex: none;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.list-empty {
  padding: 48px 24px;
  text-align: center;
}

.list-empty__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-secondary);
}

.list-empty__hint {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--ink-faint);
}
</style>
