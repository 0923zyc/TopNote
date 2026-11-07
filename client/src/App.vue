<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import { useNotesStore } from './stores/notes'
import AppSidebar from './components/AppSidebar.vue'
import NoteList from './components/NoteList.vue'
import EditorPane from './components/EditorPane.vue'
import TrashDrawer from './components/TrashDrawer.vue'
import CommandPalette from './components/CommandPalette.vue'
import SplashScreen from './components/SplashScreen.vue'
import { useUiStore } from './stores/ui'

const store = useNotesStore()
const ui = useUiStore()

function onKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + K 命令面板
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    ui.toggleCommandPalette()
    return
  }
  // Ctrl/Cmd + N 新建笔记（浏览器可能拦截，仅尽力而为）
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault()
    store.createNote()
  }
}

onMounted(async () => {
  await store.fetchNotes()
  // 恢复上次编辑的笔记（UI 偏好，非笔记主存储）
  const last = localStorage.getItem('shizhi-last-note')
  if (last && store.notes.some((n) => n.id === last)) {
    store.selectNote(last)
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app-shell">
    <!-- 启动动画（Logo 描绘 → 后端就绪后淡出） -->
    <SplashScreen />

    <!-- 顶部错误条：后端未启动 / 数据目录不可写（文档 5.3） -->
    <div v-if="store.connectionError" class="error-bar" role="alert">
      <span class="error-bar__text">{{ store.connectionError }}</span>
      <button class="error-bar__retry" type="button" @click="store.fetchNotes()">
        <el-icon><RefreshRight /></el-icon>
        重试
      </button>
    </div>

    <div class="app-columns">
      <AppSidebar />
      <NoteList />
      <EditorPane />
    </div>

    <TrashDrawer />
    <CommandPalette />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--ground);
}

.error-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--error-bg);
  border-bottom: 1px solid var(--error-border);
  color: var(--error-ink);
  font-size: 13px;
}

.error-bar__text {
  flex: 1;
  min-width: 0;
}

.error-bar__retry {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--error-border);
  background: transparent;
  color: var(--error-ink);
  border-radius: var(--radius-control);
  padding: 3px 10px;
  font-size: 13px;
  cursor: pointer;
}

.error-bar__retry:hover {
  background: color-mix(in srgb, var(--error-ink) 8%, transparent);
}

.app-columns {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px 320px 1fr;
}
</style>
