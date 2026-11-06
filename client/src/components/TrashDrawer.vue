<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, RefreshLeft, Upload } from '@element-plus/icons-vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { notesApi } from '../api/notes'
import { formatRelative } from '../utils/format'

const store = useNotesStore()
const ui = useUiStore()
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

/** 导出全部笔记为 zip（后端附件下载） */
function onExport() {
  const a = document.createElement('a')
  a.href = notesApi.EXPORT_ZIP_URL
  a.download = ''
  a.click()
}

/** 导入 .md 文件（前端读取文本后批量提交） */
async function onImportFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // 允许重复选择同一文件
  if (files.length === 0 || importing.value) return
  importing.value = true
  try {
    const payload = await Promise.all(
      files.map(async (f) => ({ name: f.name, content: await f.text() }))
    )
    const result = await notesApi.importFiles(payload)
    await store.fetchNotes()
    if (result.imported > 0) {
      ElMessage.success(`已导入 ${result.imported} 篇笔记${result.failed ? `，${result.failed} 篇失败` : ''}`)
    } else if (result.failed > 0) {
      ElMessage.error(`导入失败 ${result.failed} 篇`)
    } else {
      ElMessage.warning('没有可导入的文件')
    }
  } catch (err) {
    ElMessage.error(`导入失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    importing.value = false
  }
}

// 每次打开抽屉都重新拉取（删除/恢复后数据可能已变化）
watch(
  () => ui.trashDrawerOpen,
  (open) => {
    if (open) {
      store.loadTrash()
      store.loadBackupInfo()
    }
  }
)

onMounted(() => {
  store.loadBackupInfo()
})

async function onRestore(id: string) {
  const ok = await store.restoreFromTrash(id)
  if (ok) ElMessage.success({ message: '已恢复到笔记列表', grouping: true })
}

async function onPurge(id: string, title: string) {
  try {
    await ElMessageBox.confirm(
      `「${title}」将被永久删除，此操作不可恢复。`,
      '彻底删除',
      { confirmButtonText: '彻底删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  const ok = await store.purgeFromTrash(id)
  if (ok) ElMessage.success({ message: '已彻底删除', grouping: true })
}

async function onBackup() {
  const ok = await store.triggerBackup()
  if (ok) ElMessage.success({ message: '备份完成', grouping: true })
}

function clearDrawer() {
  ui.closeTrashDrawer()
}
</script>

<template>
  <el-drawer
    :model-value="ui.trashDrawerOpen"
    title="回收站"
    direction="rtl"
    size="380px"
    :append-to-body="true"
    @close="clearDrawer"
  >
    <div class="drawer-body">
      <!-- 备份与导出/导入 -->
      <section class="backup-card">
        <div class="backup-card__row">
          <div class="backup-card__text">
            <p class="backup-card__title">自动备份</p>
            <p class="backup-card__desc">
              <template v-if="store.backupInfo?.lastAt">
                最近备份 {{ formatRelative(store.backupInfo.lastAt) }} · 共
                {{ store.backupInfo.count }} 份
              </template>
              <template v-else>尚未生成备份</template>
            </p>
          </div>
          <el-button size="small" :icon="Upload" :loading="store.backupRunning" @click="onBackup">
            立即备份
          </el-button>
        </div>
        <p class="backup-card__hint">每 24 小时自动备份全部笔记到 data\backups\，保留最近 10 份</p>
        <div class="backup-card__io">
          <button class="io-btn" type="button" title="导出全部笔记为 zip（Markdown + frontmatter + 图片）" @click="onExport">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M8 2.5v7.2m0 0 2.8-2.8M8 9.7 5.2 6.9M3 11.5v1c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            导出全部 (.zip)
          </button>
          <button class="io-btn" type="button" title="从 .md 文件导入（支持 frontmatter）" @click="fileInput?.click()">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M8 9.7V2.5m0 0L5.2 5.3M8 2.5l2.8 2.8M3 11.5v1c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            导入 Markdown
          </button>
          <input
            ref="fileInput"
            class="io-input"
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            @change="onImportFiles"
          />
        </div>
        <p class="backup-card__hint">导出的 zip 可直接拖进 Obsidian；导入会新建笔记，不会覆盖已有内容</p>
      </section>

      <!-- 回收站列表 -->
      <p class="section-label">已删除的笔记（保留 30 天）</p>

      <div v-if="store.trashLoading" class="trash-empty">加载中…</div>
      <div v-else-if="store.trashItems.length === 0" class="trash-empty">
        <p class="trash-empty__title">回收站是空的</p>
        <p class="trash-empty__hint">删除的笔记会在这里保留 30 天，可随时恢复</p>
      </div>

      <article v-for="item in store.trashItems" :key="item.id" class="trash-item">
        <div class="trash-item__main">
          <h4 class="trash-item__title ellipsis">{{ item.title }}</h4>
          <p class="trash-item__meta">
            <span v-if="item.category" class="trash-item__cat">{{ item.category }}</span>
            <span>删除于 {{ formatRelative(item.deletedAt) }}</span>
          </p>
        </div>
        <div class="trash-item__actions">
          <el-button size="small" :icon="RefreshLeft" type="primary" plain @click="onRestore(item.id)">
            恢复
          </el-button>
          <el-button size="small" :icon="Delete" type="danger" plain @click="onPurge(item.id, item.title)">
            彻底删除
          </el-button>
        </div>
      </article>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.backup-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 12px 14px;
  background: var(--rule);
}

.backup-card__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.backup-card__text {
  flex: 1;
  min-width: 0;
}

.backup-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.backup-card__desc {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--ink-secondary);
}

.backup-card__hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-faint);
}

.backup-card__io {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.io-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.io-btn:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}

.io-input {
  display: none;
}

.section-label {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
}

.trash-empty {
  padding: 36px 12px;
  text-align: center;
}

.trash-empty__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-secondary);
}

.trash-empty__hint {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.trash-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
}

.trash-item__main {
  flex: 1;
  min-width: 0;
}

.trash-item__title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
}

.trash-item__meta {
  margin: 3px 0 0;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--ink-faint);
}

.trash-item__cat {
  padding: 1px 6px;
  border-radius: var(--radius-chip);
  background: var(--companion-soft);
  color: var(--companion-ink);
  font-size: 11px;
}

.trash-item__actions {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trash-item__actions .el-button {
  margin-left: 0;
  width: 96px;
}
</style>
