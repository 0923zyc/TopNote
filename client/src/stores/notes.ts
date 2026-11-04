/**
 * 笔记仓库：列表、当前视图（全部/收藏/分类）、搜索、排序、自动保存状态。
 * 前端状态仅作内存缓存（约束 #2），一切以磁盘数据为准。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notesApi, ApiError } from '../api/notes'
import type { BackupInfo, NoteDetail, NoteMeta, SaveState, SortBy, TrashItem, ViewKind } from '../types'

/** 上次编辑笔记的 UI 偏好键（非笔记主存储，符合约束 #2） */
const LAST_NOTE_KEY = 'shizhi-last-note'

export const useNotesStore = defineStore('notes', () => {
  // ── 状态 ──────────────────────────────────────────────
  const notes = ref<NoteMeta[]>([])
  const initialized = ref(false)
  const loading = ref(false)
  /** 顶部错误条文案；null 表示连接正常 */
  const connectionError = ref<string | null>(null)

  const viewKind = ref<ViewKind>('all')
  const activeCategory = ref<string | null>(null)
  const searchQuery = ref('')
  const sortBy = ref<SortBy>('updatedAt')

  const currentId = ref<string | null>(null)
  const currentDetail = ref<NoteDetail | null>(null)
  const saveState = ref<SaveState>('idle')
  /** 最近一次保存的错误信息（编辑器内展示） */
  const saveError = ref<string | null>(null)

  // ── 回收站 / 备份状态（Phase 8）────────────────────
  const trashItems = ref<TrashItem[]>([])
  const trashLoading = ref(false)
  const backupInfo = ref<BackupInfo | null>(null)
  const backupRunning = ref(false)

  // ── 每日回顾（Phase 10）────────────────────────────
  /** 回顾模式激活时，右栏显示回顾卡片流（选择笔记/新建会自动退出） */
  const reviewActive = ref(false)

  function toggleReview(on?: boolean) {
    reviewActive.value = on ?? !reviewActive.value
  }

  // ── 派生 ──────────────────────────────────────────────
  /** 所有出现过的分类（聚合自笔记列表） */
  const categories = computed(() => {
    const set = new Set<string>()
    for (const n of notes.value) {
      if (!n.corrupt && n.category) set.add(n.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  })

  const categoryCounts = computed(() => {
    const map = new Map<string, number>()
    for (const n of notes.value) {
      if (!n.corrupt && n.category) map.set(n.category, (map.get(n.category) ?? 0) + 1)
    }
    return map
  })

  const favoriteCount = computed(() => notes.value.filter((n) => n.favorited && !n.corrupt).length)

  /** 当前视图 + 搜索 + 排序叠加后的中栏列表（文档 5.2：搜索时筛选条件叠加生效） */
  const visibleNotes = computed(() => {
    let list = notes.value.slice()
    if (viewKind.value === 'favorites') list = list.filter((n) => n.favorited)
    if (viewKind.value === 'category' && activeCategory.value) {
      list = list.filter((n) => n.category === activeCategory.value)
    }
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    const key = sortBy.value
    list.sort((a, b) => String(b[key]).localeCompare(String(a[key])))
    return list
  })

  const currentNote = computed(
    () => notes.value.find((n) => n.id === currentId.value) ?? null
  )

  // ── 动作 ──────────────────────────────────────────────
  function applyConnectionError(err: unknown) {
    if (err instanceof ApiError && err.kind === 'network') {
      connectionError.value = '无法连接到本地服务，请确认后端已在 3001 端口运行（可双击项目根目录的 start.bat 启动）'
    } else if (err instanceof ApiError) {
      connectionError.value = `服务返回错误：${err.message}`
    } else {
      connectionError.value = `发生未知错误：${err instanceof Error ? err.message : String(err)}`
    }
  }

  /** 拉取全部笔记（启动 / 刷新 / 断线重试） */
  async function fetchNotes() {
    loading.value = true
    try {
      notes.value = await notesApi.list()
      connectionError.value = null
      initialized.value = true
      // 当前选中的笔记若已不存在（被外部删除等），清空选择
      if (currentId.value && !notes.value.some((n) => n.id === currentId.value)) {
        currentId.value = null
        currentDetail.value = null
      }
    } catch (err) {
      applyConnectionError(err)
    } finally {
      loading.value = false
    }
  }

  /** 选中笔记：拉取全文详情（进入回顾卡片时退出回顾模式） */
  async function selectNote(id: string) {
    reviewActive.value = false
    if (currentId.value === id && currentDetail.value) return
    currentId.value = id
    currentDetail.value = null
    saveState.value = 'idle'
    saveError.value = null
    try {
      currentDetail.value = await notesApi.get(id)
      connectionError.value = null
      localStorage.setItem(LAST_NOTE_KEY, id) // UI 偏好：下次启动恢复上次编辑
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'http' && err.status === 404) {
        // 列表有但详情 404（外部已删）：刷新列表兜底
        await fetchNotes()
      } else {
        applyConnectionError(err)
      }
    }
  }

  /** 新建笔记：立即落盘并选中，进入编辑态 */
  async function createNote(preset: Partial<Pick<NoteDetail, 'title' | 'category' | 'tags'>> = {}) {
    try {
      const note = await notesApi.create({ content: '', ...preset })
      notes.value.unshift({ ...note, summary: '' })
      connectionError.value = null
      reviewActive.value = false
      currentId.value = note.id
      currentDetail.value = note
      saveState.value = 'idle'
      saveError.value = null
      localStorage.setItem(LAST_NOTE_KEY, note.id)
      return note
    } catch (err) {
      applyConnectionError(err)
      return null
    }
  }

  /** 自动保存：PUT 合并更新，并用响应同步列表元数据。id 可显式传入（切换笔记时补写旧笔记） */
  async function saveCurrent(
    patch: Partial<Pick<NoteDetail, 'title' | 'content' | 'category' | 'tags'>>,
    explicitId?: string
  ) {
    const id = explicitId ?? currentId.value
    if (!id) return
    saveState.value = 'saving'
    saveError.value = null
    try {
      const saved = await notesApi.update(id, patch)
      if (currentId.value !== id) return // 保存期间用户已切走：仅同步列表
      currentDetail.value = saved
      const idx = notes.value.findIndex((n) => n.id === id)
      if (idx >= 0) {
        notes.value[idx] = {
          ...notes.value[idx],
          title: saved.title,
          summary: saved.content.replace(/\s+/g, ' ').trim().slice(0, 80),
          category: saved.category,
          tags: saved.tags,
          favorited: saved.favorited,
          updatedAt: saved.updatedAt,
        }
      }
      saveState.value = 'saved'
      connectionError.value = null
    } catch (err) {
      saveState.value = 'error'
      saveError.value = err instanceof ApiError ? err.message : String(err)
      if (err instanceof ApiError && err.kind === 'network') {
        connectionError.value = '无法连接到本地服务，请确认后端已在 3001 端口运行（可双击项目根目录的 start.bat 启动）'
      }
    }
  }

  /** 收藏翻转：即时更新本地 + 落盘 */
  async function toggleFavorite(id: string) {
    const idx = notes.value.findIndex((n) => n.id === id)
    if (idx < 0) return
    const optimistic = !notes.value[idx].favorited
    notes.value[idx] = { ...notes.value[idx], favorited: optimistic } // 先行翻转，星标即时反馈
    if (currentId.value === id && currentDetail.value) {
      currentDetail.value = { ...currentDetail.value, favorited: optimistic }
    }
    try {
      const saved = await notesApi.toggleFavorite(id)
      const i = notes.value.findIndex((n) => n.id === id)
      if (i >= 0) notes.value[i] = { ...notes.value[i], favorited: saved.favorited, updatedAt: saved.updatedAt }
      if (currentId.value === id && currentDetail.value) {
        currentDetail.value = { ...currentDetail.value, favorited: saved.favorited }
      }
      connectionError.value = null
    } catch (err) {
      // 回滚乐观更新
      const i = notes.value.findIndex((n) => n.id === id)
      if (i >= 0) notes.value[i] = { ...notes.value[i], favorited: !optimistic }
      applyConnectionError(err)
    }
  }

  /** 删除笔记 = 移入回收站（调用方负责二次确认；可在回收站恢复） */
  async function removeNote(id: string) {
    try {
      await notesApi.remove(id)
      notes.value = notes.value.filter((n) => n.id !== id)
      if (currentId.value === id) {
        currentId.value = null
        currentDetail.value = null
        localStorage.removeItem(LAST_NOTE_KEY)
      }
      connectionError.value = null
      return true
    } catch (err) {
      applyConnectionError(err)
      return false
    }
  }

  // ── 回收站 / 备份动作（Phase 8）────────────────────
  async function loadTrash() {
    trashLoading.value = true
    try {
      trashItems.value = await notesApi.trashList()
    } catch (err) {
      applyConnectionError(err)
    } finally {
      trashLoading.value = false
    }
  }

  /** 从回收站恢复笔记：落盘后刷新列表并选中 */
  async function restoreFromTrash(id: string) {
    try {
      const restored = await notesApi.restoreFromTrash(id)
      trashItems.value = trashItems.value.filter((t) => t.id !== id)
      await fetchNotes()
      if (restored && 'id' in restored && restored.id) {
        await selectNote(restored.id)
      }
      connectionError.value = null
      return true
    } catch (err) {
      applyConnectionError(err)
      return false
    }
  }

  /** 彻底删除回收站中的笔记（不可恢复，调用方负责确认） */
  async function purgeFromTrash(id: string) {
    try {
      await notesApi.purgeFromTrash(id)
      trashItems.value = trashItems.value.filter((t) => t.id !== id)
      connectionError.value = null
      return true
    } catch (err) {
      applyConnectionError(err)
      return false
    }
  }

  async function loadBackupInfo() {
    try {
      backupInfo.value = await notesApi.backupInfo()
    } catch {
      /* 备份信息加载失败不打扰用户 */
    }
  }

  async function triggerBackup() {
    backupRunning.value = true
    try {
      await notesApi.runBackup()
      await loadBackupInfo()
      connectionError.value = null
      return true
    } catch (err) {
      applyConnectionError(err)
      return false
    } finally {
      backupRunning.value = false
    }
  }

  /** 连续记录天数：有笔记更新活动的连续自然日（截至今天或昨天） */
  const streakDays = computed(() => {
    const days = new Set(
      notes.value
        .filter((n) => !n.corrupt)
        .map((n) => {
          const d = new Date(n.updatedAt)
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        })
    )
    if (days.size === 0) return 0
    const key = (dt: Date) => `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`
    const cursor = new Date()
    if (!days.has(key(cursor))) {
      cursor.setDate(cursor.getDate() - 1) // 今天还没记，从昨天起算
      if (!days.has(key(cursor))) return 0
    }
    let streak = 0
    while (days.has(key(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  })

  function setView(kind: ViewKind, category: string | null = null) {
    viewKind.value = kind
    activeCategory.value = kind === 'category' ? category : null
  }

  return {
    // 状态
    notes,
    initialized,
    loading,
    connectionError,
    viewKind,
    activeCategory,
    searchQuery,
    sortBy,
    currentId,
    currentDetail,
    saveState,
    saveError,
    trashItems,
    trashLoading,
    backupInfo,
    backupRunning,
    reviewActive,
    // 派生
    categories,
    categoryCounts,
    favoriteCount,
    visibleNotes,
    currentNote,
    streakDays,
    // 动作
    fetchNotes,
    selectNote,
    createNote,
    saveCurrent,
    toggleFavorite,
    removeNote,
    setView,
    loadTrash,
    restoreFromTrash,
    purgeFromTrash,
    loadBackupInfo,
    triggerBackup,
    toggleReview,
  }
})
