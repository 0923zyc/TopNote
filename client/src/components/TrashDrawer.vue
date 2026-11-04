<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, RefreshLeft, Upload } from '@element-plus/icons-vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { formatRelative } from '../utils/format'

const store = useNotesStore()
const ui = useUiStore()

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
      <!-- 备份区 -->
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
          <el-button
            size="small"
            :icon="Upload"
            :loading="store.backupRunning"
            @click="onBackup"
          >
            立即备份
          </el-button>
        </div>
        <p class="backup-card__hint">每 24 小时自动备份全部笔记到 data\backups\，保留最近 10 份</p>
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
