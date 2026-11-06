<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { useTheme } from '../composables/theme'

const store = useNotesStore()
const ui = useUiStore()
const { cycle } = useTheme()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const selectedIndex = ref(0)

interface Command {
  id: string
  label: string
  hint?: string
  keywords: string
  run: () => void | Promise<void>
}

/** 静态命令 */
const staticCommands = computed<Command[]>(() => [
  {
    id: 'new',
    label: '新建笔记',
    hint: 'Ctrl+N',
    keywords: 'new create 新建 创建',
    run: () => store.createNote(),
  },
  {
    id: 'daily',
    label: '打开今日日记',
    hint: '日记',
    keywords: 'daily 日记 今天 today',
    run: () => store.openDailyNote(),
  },
  {
    id: 'review',
    label: '每日回顾',
    hint: '随机重温旧笔记',
    keywords: 'review 回顾 复习',
    run: () => store.toggleReview(true),
  },
  {
    id: 'stats',
    label: '查看统计（热力图）',
    hint: '足迹',
    keywords: 'stats 统计 热力图 足迹 heatmap',
    run: () => store.toggleStats(true),
  },
  {
    id: 'all',
    label: '查看全部笔记',
    keywords: 'all 全部 列表',
    run: () => store.setView('all'),
  },
  {
    id: 'fav',
    label: '查看收藏',
    keywords: 'fav favorite 收藏 星标',
    run: () => store.setView('favorites'),
  },
  {
    id: 'trash',
    label: '打开回收站与备份',
    keywords: 'trash 回收站 备份 删除 backup',
    run: () => ui.openTrashDrawer(),
  },
  {
    id: 'export',
    label: '导出全部笔记 (.zip)',
    keywords: 'export 导出 备份 zip obsidian',
    run: () => window.open('/api/export/zip'),
  },
  {
    id: 'theme',
    label: '切换深色 / 浅色主题',
    keywords: 'theme 主题 深色 浅色 dark light',
    run: () => cycle(),
  },
])

/** 动态项：笔记（按标题跳转） */
const noteCommands = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return store.notes
    .filter((n) => !n.corrupt && n.title.toLowerCase().includes(q))
    .slice(0, 6)
    .map((n) => ({
      id: `note-${n.id}`,
      label: n.title || '无标题笔记',
      hint: n.category ?? '笔记',
      keywords: n.tags.join(' '),
      run: () => store.selectNote(n.id),
    }))
})

/** 动态项：分类与标签筛选 */
const filterCommands = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase()
  const cats: Command[] = store.categories
    .filter((c) => !q || c.toLowerCase().includes(q))
    .slice(0, 3)
    .map((c) => ({
      id: `cat-${c}`,
      label: `筛选分类「${c}」`,
      keywords: 'category 分类',
      run: () => store.setView('category', c),
    }))
  const tags: Command[] = store.tagCounts
    .filter(([t]) => !q || t.toLowerCase().includes(q))
    .slice(0, 3)
    .map(([t]) => ({
      id: `tag-${t}`,
      label: `筛选标签「${t}」`,
      keywords: 'tag 标签',
      run: () => {
        store.searchQuery = t
      },
    }))
  return [...cats, ...tags]
})

const allCommands = computed(() => [...staticCommands.value, ...noteCommands.value, ...filterCommands.value])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allCommands.value.filter((c) => !c.id.startsWith('note-') && !c.id.startsWith('cat-') && !c.id.startsWith('tag-'))
  return allCommands.value.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q)
  )
})

function resetSelection() {
  selectedIndex.value = 0
}

watch(query, resetSelection)
watch(
  () => ui.commandOpen,
  async (open) => {
    if (open) {
      query.value = ''
      resetSelection()
      await nextTick()
      inputEl.value?.focus()
    }
  }
)

function move(delta: number) {
  if (filtered.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + delta + filtered.value.length) % filtered.value.length
}

async function execute(cmd?: Command) {
  const target = cmd ?? filtered.value[selectedIndex.value]
  if (!target) return
  ui.closeCommandPalette()
  await target.run()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    ui.closeCommandPalette()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    execute()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.commandOpen" class="cmdk-backdrop" @click.self="ui.closeCommandPalette()">
      <div class="cmdk" role="dialog" aria-label="命令面板">
        <input
          ref="inputEl"
          v-model="query"
          class="cmdk__input"
          type="text"
          placeholder="搜索笔记，或输入命令…（↑↓ 选择，回车执行）"
          aria-label="命令面板输入"
          @keydown="onKeydown"
        />
        <div class="cmdk__list" role="listbox">
          <button
            v-for="(cmd, i) in filtered.slice(0, 12)"
            :key="cmd.id"
            class="cmdk__item"
            :class="{ 'is-selected': i === selectedIndex }"
            type="button"
            role="option"
            :aria-selected="i === selectedIndex"
            @mouseenter="selectedIndex = i"
            @click="execute(cmd)"
          >
            <span class="cmdk__label ellipsis">{{ cmd.label }}</span>
            <span v-if="cmd.hint" class="cmdk__hint ellipsis">{{ cmd.hint }}</span>
          </button>
          <div v-if="filtered.length === 0" class="cmdk__empty">没有匹配的命令或笔记</div>
        </div>
        <footer class="cmdk__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cmdk-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: color-mix(in srgb, var(--ink) 32%, transparent);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 14vh;
}

.cmdk {
  width: min(560px, calc(100vw - 48px));
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-popover);
  overflow: hidden;
}

.cmdk__input {
  border: none;
  outline: none;
  background: transparent;
  padding: 15px 18px;
  font-size: 15px;
  color: var(--ink);
  border-bottom: 1px solid var(--rule);
}

.cmdk__input::placeholder {
  color: var(--ink-faint);
}

.cmdk__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

.cmdk__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.cmdk__item.is-selected {
  background: var(--accent-soft);
}

.cmdk__label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--ink);
}

.cmdk__item.is-selected .cmdk__label {
  color: var(--accent-ink);
}

.cmdk__hint {
  flex: none;
  max-width: 40%;
  font-size: 12px;
  color: var(--ink-faint);
}

.cmdk__empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-faint);
}

.cmdk__foot {
  display: flex;
  gap: 14px;
  padding: 8px 14px;
  border-top: 1px solid var(--rule);
  font-size: 11.5px;
  color: var(--ink-faint);
}

.cmdk__foot kbd {
  display: inline-block;
  margin-right: 3px;
  padding: 0 4px;
  border: 1px solid var(--control-border);
  border-radius: 3px;
  background: var(--rule);
  font-family: inherit;
  font-size: 10.5px;
  color: var(--ink-secondary);
}
</style>
