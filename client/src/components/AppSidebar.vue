<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useTheme } from '../composables/theme'
import { useUiStore } from '../stores/ui'
import { PALETTES } from '../config/palettes'

const store = useNotesStore()
const ui = useUiStore()
const { isDark, cycle, palette, setPalette } = useTheme()

const totalCount = computed(() => store.notes.filter((n) => !n.corrupt).length)
</script>

<template>
  <aside class="sidebar">
    <!-- 产品标识（house rule：产品要有名字和标识） -->
    <div class="brand">
      <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)" />
        <text
          x="16"
          y="17"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="16"
          font-weight="600"
          font-family="inherit"
          fill="var(--ground)"
        >
          拾
        </text>
      </svg>
      <div class="brand__name">拾知笔记</div>
    </div>

    <!-- 主行动：新建 -->
    <button class="new-btn" type="button" @click="store.createNote()">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      新建笔记
    </button>

    <nav class="nav" aria-label="笔记导航">
      <button
        class="nav__item"
        :class="{ 'is-active': store.viewKind === 'all' }"
        type="button"
        @click="store.setView('all')"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M3.5 2.5h6.6L13 5.4v8.1a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
          <path d="M5.8 8.2h4.4M5.8 11h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        <span class="nav__label">全部笔记</span>
        <span class="nav__count num">{{ totalCount }}</span>
      </button>

      <button
        class="nav__item"
        :class="{ 'is-active': store.viewKind === 'favorites' }"
        type="button"
        @click="store.setView('favorites')"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M8 2.2 9.7 5.8l4 .5-2.9 2.7.8 3.9L8 11l-3.6 1.9.8-3.9L2.3 6.3l4-.5L8 2.2Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
        </svg>
        <span class="nav__label">收藏</span>
        <span class="nav__count num">{{ store.favoriteCount }}</span>
      </button>

      <button
        class="nav__item"
        :class="{ 'is-active': store.reviewActive }"
        type="button"
        @click="store.toggleReview()"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M2.5 4.5h7.2M12.8 4.5h.7M2.5 8h1.2M6.3 8h7.2M2.5 11.5h4.6M10 11.5h3.5"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
          <circle cx="11.4" cy="4.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
          <circle cx="4.7" cy="8" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
          <circle cx="8.4" cy="11.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
        </svg>
        <span class="nav__label">每日回顾</span>
      </button>

      <div class="nav__group">分类</div>

      <template v-if="store.categories.length">
        <button
          v-for="cat in store.categories"
          :key="cat"
          class="nav__item"
          :class="{ 'is-active': store.viewKind === 'category' && store.activeCategory === cat }"
          type="button"
          @click="store.setView('category', cat)"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path
              d="M2.5 4.5c0-.6.4-1 1-1h2.6l1.2 1.4h5.2c.6 0 1 .4 1 1v6.1c0 .6-.4 1-1 1h-9c-.6 0-1-.4-1-1V4.5Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            />
          </svg>
          <span class="nav__label ellipsis">{{ cat }}</span>
          <span class="nav__count num">{{ store.categoryCounts.get(cat) ?? 0 }}</span>
        </button>
      </template>
      <div v-else class="nav__empty">尚无分类，编辑笔记时可新建</div>

      <template v-if="store.tagCounts.length">
        <div class="nav__group">标签</div>
        <button
          v-for="[tag, count] in store.tagCounts.slice(0, 15)"
          :key="tag"
          class="nav__item"
          :class="{ 'is-active': store.searchQuery === tag }"
          type="button"
          :title="`筛选标签「${tag}」`"
          @click="store.searchQuery = store.searchQuery === tag ? '' : tag"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path
              d="m8.6 2.5 4.9 4.9a1.2 1.2 0 0 1 0 1.7l-4.4 4.4a1.2 1.2 0 0 1-1.7 0L2.5 8.6V3.7c0-.7.5-1.2 1.2-1.2h4.9Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            />
            <circle cx="5.6" cy="5.6" r="0.9" fill="currentColor" />
          </svg>
          <span class="nav__label ellipsis">{{ tag }}</span>
          <span class="nav__count num">{{ count }}</span>
        </button>
      </template>
    </nav>

    <div class="sidebar__foot">
      <el-popover placement="top-start" :width="252" trigger="click" popper-class="palette-popper">
        <template #reference>
          <button class="foot-btn" type="button" title="选择配色方案">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3" />
              <circle cx="5.6" cy="6" r="1.15" fill="currentColor" />
              <circle cx="10.4" cy="6" r="1.15" fill="currentColor" />
              <circle cx="8" cy="10.6" r="1.15" fill="currentColor" />
            </svg>
            配色
          </button>
        </template>
        <div class="palette-menu" role="listbox" aria-label="配色方案">
          <button
            v-for="p in PALETTES"
            :key="p.id"
            class="palette-option"
            :class="{ 'is-active': palette === p.id }"
            type="button"
            role="option"
            :aria-selected="palette === p.id"
            @click="setPalette(p.id)"
          >
            <span class="palette-option__dots" aria-hidden="true">
              <i :style="{ background: p.dot[0] }"></i>
              <i :style="{ background: p.dot[1] }"></i>
            </span>
            <span class="palette-option__text">
              <span class="palette-option__name">{{ p.name }}</span>
              <span class="palette-option__desc ellipsis">{{ p.desc }}</span>
            </span>
            <svg v-if="palette === p.id" class="palette-option__check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </el-popover>
      <button class="foot-btn" type="button" title="回收站与备份" @click="ui.openTrashDrawer()">
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
        回收站
      </button>
      <button class="foot-btn" type="button" :title="isDark ? '切换到浅色' : '切换到深色'" @click="cycle">
        <svg v-if="isDark" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3" />
          <path
            d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M13.4 9.7A5.6 5.6 0 0 1 6.3 2.6a5.6 5.6 0 1 0 7.1 7.1Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
        </svg>
        {{ isDark ? '深色' : '浅色' }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  padding: 14px 10px 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 2px 8px 14px;
}

.brand__mark {
  width: 26px;
  height: 26px;
  flex: none;
}

.brand__name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 34px;
  border: none;
  border-radius: var(--radius-control);
  background: var(--btn-bg);
  color: var(--btn-ink);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.new-btn:hover {
  background: var(--accent-hover);
}

.new-btn:active {
  transform: translateY(0.5px);
}

.nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-secondary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease, color 0.12s ease;
}

.nav__item:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}

.nav__item.is-active {
  background: var(--surface);
  color: var(--ink);
  font-weight: 500;
}

.nav__item svg {
  flex: none;
  color: var(--ink-faint);
}

.nav__item.is-active svg {
  color: var(--accent);
}

.nav__label {
  flex: 1;
  min-width: 0;
}

.nav__count {
  flex: none;
  font-size: 12px;
  color: var(--ink-faint);
}

.nav__group {
  margin: 16px 8px 4px;
  font-size: 12px;
  color: var(--ink-faint);
}

.nav__empty {
  padding: 2px 8px;
  font-size: 12px;
  color: var(--ink-faint);
  line-height: 1.5;
}

.sidebar__foot {
  flex: none;
  border-top: 1px solid var(--rule);
  padding-top: 8px;
}

.foot-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px;
  width: 100%;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-faint);
  font-size: 13px;
  cursor: pointer;
}

.foot-btn:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink-secondary);
}

/* ── 配色选择面板 ────────────────────────────────────── */
.palette-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.palette-option:hover {
  background: var(--rule);
}

.palette-option.is-active {
  background: var(--accent-soft);
}

.palette-option__dots {
  flex: none;
  display: flex;
}

.palette-option__dots i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  box-sizing: content-box;
}

.palette-option__dots i + i {
  margin-left: -6px;
}

.palette-option__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.palette-option__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.4;
}

.palette-option.is-active .palette-option__name {
  color: var(--accent-ink);
}

.palette-option__desc {
  font-size: 11.5px;
  color: var(--ink-faint);
  line-height: 1.4;
}

.palette-option__check {
  flex: none;
  color: var(--accent);
}
</style>
