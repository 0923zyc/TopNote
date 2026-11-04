import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 数据目录解析（约束 #1：一律 path.join 构造，绝不硬编码盘符拼接）：
 * - 优先取环境变量 NOTES_DATA_DIR
 * - 默认为项目根目录下的 data/notebook（D:\notebookProject\data\notebook）
 */
export const DATA_DIR = process.env.NOTES_DATA_DIR
  ? path.resolve(process.env.NOTES_DATA_DIR)
  : path.join(__dirname, '..', '..', 'data', 'notebook')

/** 回收站目录：与数据目录同级（data\trash），不会被笔记扫描器读取 */
export const TRASH_DIR = path.join(path.dirname(DATA_DIR), 'trash')
/** 备份目录：与数据目录同级（data\backups） */
export const BACKUP_DIR = path.join(path.dirname(DATA_DIR), 'backups')

/** 文件名格式：{创建时间毫秒}_{短id}.json，可排序且不冲突 */
const FILE_PATTERN = /^(\d+)_([A-Za-z0-9_-]+)\.json$/

/** 摘要长度（列表接口不返回 content 全文，约束 #4） */
const SUMMARY_LENGTH = 80

/** 启动时确保数据目录存在（文档 5.3 / 验收清单：首次运行自动创建） */
export async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  return DATA_DIR
}

/** 生成短随机 id（nanoid 风格，url-safe） */
function shortId(len = 10) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len)
}

/**
 * 内存缓存：id -> { id, file, note, corrupt, mtimeMs, size }
 * mtimeMs/size 用于增量刷新：外部（用户/其他进程）改动磁盘文件后，
 * 页面刷新即可看到最新状态（验收清单：手动改坏文件后刷新列表可见"⚠ 文件损坏"）。
 * 我们自己写入的条目 mtimeMs 置 null，下次刷新时重读一次并记录真实 stat。
 */
const cache = new Map()
/** 是否已做过首次全量加载 */
let loaded = false
/** 每文件写入队列：串行化对同一 id 的并发写入（约束 #5） */
const writeQueues = new Map()

function enqueueWrite(id, task) {
  const prev = writeQueues.get(id) || Promise.resolve()
  const next = prev.then(task, task) // 前一个失败也不阻塞后续写入
  writeQueues.set(id, next.catch(() => {}))
  return next
}

/**
 * 原子写入：先写 .tmp 再 rename 覆盖（文档第四节写入安全）。
 * Windows 下 rename 可能因杀毒/索引等短暂占用抛 EPERM/EACCES/EBUSY，
 * 这里做小退避重试（总时长 < 250ms），仍失败才向上抛错。
 */
async function atomicWriteFile(file, payload) {
  await ensureDataDir()
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, payload, 'utf8')
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, file)
      return
    } catch (err) {
      const retryable =
        (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EBUSY') && attempt < 5
      if (!retryable) throw err
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)))
    }
  }
}

/** 规范化笔记字段，任何来源（磁盘/请求体）统一走这里 */
function normalize(input, { partial = false } = {}) {
  const out = {}
  if (!partial || 'title' in input) out.title = String(input.title ?? '').slice(0, 300)
  if (!partial || 'content' in input) out.content = String(input.content ?? '')
  if (!partial || 'category' in input) {
    const c = input.category
    out.category = c == null || c === '' ? null : String(c).slice(0, 60)
  }
  if (!partial || 'tags' in input) {
    out.tags = Array.isArray(input.tags)
      ? input.tags.map((t) => String(t).slice(0, 60)).filter(Boolean).slice(0, 20)
      : []
  }
  if (!partial || 'favorited' in input) out.favorited = Boolean(input.favorited)
  return out
}

function fileFor(id) {
  return path.join(DATA_DIR, `${id}.json`)
}

/** 从文件名反解 id；不符合命名规则的文件用 basename 兜底 */
function idFromFilename(name) {
  const m = FILE_PATTERN.exec(name)
  return m ? m[2] : name.replace(/\.json$/i, '')
}

/** 读取单个笔记文件，返回条目；损坏时返回 corrupt 条目 */
async function readFileEntry(name, stat) {
  const file = path.join(DATA_DIR, name)
  const id = idFromFilename(name)
  const meta = { mtimeMs: stat.mtimeMs, size: stat.size }
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed == null) throw new Error('not an object')
    const base = normalize(parsed)
    const noteId = typeof parsed.id === 'string' && parsed.id ? parsed.id : id
    return {
      id: noteId,
      file,
      ...meta,
      note: {
        ...base,
        id: noteId,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : stat.mtime.toISOString(),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : stat.mtime.toISOString(),
      },
    }
  } catch (err) {
    // 文档 5.3 / 约束：损坏文件不阻塞整体加载，控制台告警 + 占位条目
    console.warn(`[store] 无法解析的笔记文件已跳过: ${name} (${err.message})`)
    return {
      id,
      file,
      corrupt: true,
      ...meta,
      note: {
        id,
        corrupt: true,
        title: '⚠ 文件损坏',
        summary: '',
        category: null,
        tags: [],
        favorited: false,
        createdAt: stat.mtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      },
    }
  }
}

/** 全量扫描数据目录并刷新缓存 */
export async function loadAll() {
  await refreshFromDisk(true)
  loaded = true
  return listSummaries()
}

/** 增量刷新：只重读新增/修改过的文件，清除已消失文件的缓存 */
async function refreshFromDisk(force = false) {
  await ensureDataDir()
  const names = (await fs.readdir(DATA_DIR)).filter((n) => n.toLowerCase().endsWith('.json'))
  const seenFiles = new Set()
  for (const name of names) {
    const file = path.join(DATA_DIR, name)
    let stat
    try {
      stat = await fs.stat(file)
    } catch {
      continue
    }
    seenFiles.add(file)
    const cached = [...cache.values()].find((e) => e.file === file)
    const unchanged =
      cached && !force && cached.mtimeMs != null && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size
    if (unchanged) continue
    const entry = await readFileEntry(name, stat)
    // 同一 id 换了文件名（如损坏文件被外部替换）：清掉旧映射
    if (cached && cached.file !== entry.file) cache.delete(cached.id)
    cache.set(entry.id, entry)
  }
  for (const e of [...cache.values()]) {
    if (!seenFiles.has(e.file)) cache.delete(e.id)
  }
}

function summaryOf(note) {
  return String(note.content ?? '').replace(/\s+/g, ' ').trim().slice(0, SUMMARY_LENGTH)
}

/** 列表视图（无 content 全文，约束 #4） */
function listSummaries() {
  const items = [...cache.values()].map((e) => {
    const n = e.note
    return e.corrupt
      ? { ...n }
      : {
          id: n.id,
          title: n.title,
          summary: summaryOf(n),
          category: n.category,
          tags: n.tags,
          favorited: n.favorited,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }
  })
  // 默认按 updatedAt 降序（文档 5.2），列表接口统一排序，前端可改
  items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return items
}

/** 惰性加载 + 增量刷新：首次访问全量读盘，之后每次列表请求做 stat 级增量感知 */
async function ensureFresh() {
  if (!loaded) await loadAll()
  else await refreshFromDisk()
}

export async function listNotes() {
  await ensureFresh()
  return listSummaries()
}

export async function getNote(id) {
  await ensureFresh()
  const e = cache.get(id)
  if (!e) return null
  return e.corrupt ? { ...e.note } : { ...e.note, content: e.note.content }
}

export async function createNote(input = {}) {
  await ensureFresh()
  const now = new Date()
  const ms = now.getTime()
  let id = shortId()
  while (cache.has(id)) id = shortId() // 极小概率撞 id，重试
  const fields = normalize(input)
  if (!fields.title) fields.title = '无标题笔记' // 文档 5.2：新建即出现"无标题笔记"
  const note = {
    ...fields,
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  const file = path.join(DATA_DIR, `${ms}_${id}.json`)
  const payload = JSON.stringify(note, null, 2)
  await enqueueWrite(id, async () => {
    await atomicWriteFile(file, payload)
  })
  cache.set(id, { id, file, note, mtimeMs: null, size: null })
  return { ...note }
}

export async function updateNote(id, input = {}) {
  await ensureFresh()
  const e = cache.get(id)
  if (!e) return null
  if (e.corrupt) {
    // 损坏文件允许通过 id 定位后直接覆盖修复
    const now = new Date()
    const fields = normalize(input)
    const note = { ...fields, id, createdAt: now.toISOString(), updatedAt: now.toISOString() }
    return persist(id, note)
  }
  const fields = normalize(input, { partial: true })
  const note = { ...e.note, ...fields, id, updatedAt: new Date().toISOString() }
  return persist(id, note)
}

async function persist(id, note) {
  const prevEntry = cache.get(id)
  // 损坏文件修复：写回后要清掉原损坏文件，避免同名重复条目
  const staleFile = prevEntry?.corrupt ? prevEntry.file : null
  const file = prevEntry?.file && !prevEntry.corrupt ? prevEntry.file : fileFor(id)
  const payload = JSON.stringify(note, null, 2)
  await enqueueWrite(id, async () => {
    if (staleFile && staleFile !== file) {
      await fs.unlink(staleFile).catch(() => {})
    }
    await atomicWriteFile(file, payload)
  })
  cache.set(id, { id, file, note, mtimeMs: null, size: null })
  return { ...note }
}

export async function toggleFavorite(id) {
  await ensureFresh()
  const e = cache.get(id)
  if (!e) return null
  if (e.corrupt) return { ...e.note }
  const note = { ...e.note, favorited: !e.note.favorited, updatedAt: new Date().toISOString() }
  return persist(id, note)
}

export async function listCategories() {
  await ensureFresh()
  const set = new Set()
  for (const e of cache.values()) {
    if (!e.corrupt && e.note.category) set.add(e.note.category)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

// ═══════════════════════════════════════════════════════
// 回收站（Phase 8.1）：删除 = 移入回收站，可恢复/彻底删除
// ═══════════════════════════════════════════════════════

async function ensureTrashDir() {
  await fs.mkdir(TRASH_DIR, { recursive: true })
  return TRASH_DIR
}

/** 把文件移入回收站（同盘 rename；EPERM 等短暂占用走退避重试） */
async function moveToTrash(file) {
  await ensureTrashDir()
  const dest = path.join(TRASH_DIR, path.basename(file))
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(file, dest)
      return dest
    } catch (err) {
      const retryable =
        (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EBUSY') && attempt < 5
      if (!retryable) throw err
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)))
    }
  }
}

/** 删除笔记 = 移入回收站（数据安全：可随时恢复） */
export async function moveNoteToTrash(id) {
  await ensureFresh()
  const e = cache.get(id)
  if (!e) return null
  await enqueueWrite(id, async () => {
    await moveToTrash(e.file)
  })
  cache.delete(id)
  return { ok: true }
}

/** 回收站列表（含损坏文件占位），按删除时间降序 */
export async function listTrash() {
  await ensureTrashDir()
  const names = (await fs.readdir(TRASH_DIR)).filter((n) => n.toLowerCase().endsWith('.json'))
  const items = await Promise.all(
    names.map(async (name) => {
      const file = path.join(TRASH_DIR, name)
      try {
        const stat = await fs.stat(file)
        let id = idFromFilename(name)
        let title = null
        let corrupt = false
        let category = null
        let tags = []
        let favorited = false
        try {
          const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
          if (typeof parsed.id === 'string' && parsed.id) id = parsed.id
          title = typeof parsed.title === 'string' ? parsed.title : null
          category = typeof parsed.category === 'string' ? parsed.category : null
          tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 20) : []
          favorited = Boolean(parsed.favorited)
        } catch {
          corrupt = true
        }
        return {
          id,
          title: corrupt ? '⚠ 文件损坏' : title || '无标题笔记',
          corrupt,
          category,
          tags,
          favorited,
          deletedAt: stat.mtime.toISOString(),
        }
      } catch {
        return null
      }
    })
  )
  return items
    .filter(Boolean)
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)))
}

/** 在回收站中按 id 定位文件 */
async function findTrashFile(id) {
  await ensureTrashDir()
  const names = await fs.readdir(TRASH_DIR)
  const hit = names.find((n) => n.toLowerCase().endsWith('.json') && idFromFilename(n) === id)
  return hit ? path.join(TRASH_DIR, hit) : null
}

/** 从回收站恢复笔记到数据目录 */
export async function restoreFromTrash(id) {
  const src = await findTrashFile(id)
  if (!src) return null
  await ensureDataDir()
  let dest = path.join(DATA_DIR, path.basename(src))
  // 极小概率目标同名已存在（恢复后又删除前重命名过）：换个文件名避免覆盖
  try {
    await fs.access(dest)
    dest = path.join(DATA_DIR, `${Date.now()}_${id}.json`)
  } catch {
    /* 目标可用 */
  }
  await fs.rename(src, dest)
  await refreshFromDisk(true)
  const e = cache.get(id)
  return e ? { ...e.note } : { ok: true }
}

/** 彻底删除回收站中的笔记（不可恢复） */
export async function purgeFromTrash(id) {
  const src = await findTrashFile(id)
  if (!src) return null
  await fs.unlink(src)
  return { ok: true }
}

/** 清理回收站中超龄（默认 30 天）的文件，返回清理数量 */
export async function cleanTrash(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  await ensureTrashDir()
  const names = (await fs.readdir(TRASH_DIR)).filter((n) => n.toLowerCase().endsWith('.json'))
  const cutoff = Date.now() - maxAgeMs
  let removed = 0
  for (const name of names) {
    try {
      const stat = await fs.stat(path.join(TRASH_DIR, name))
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(path.join(TRASH_DIR, name))
        removed++
      }
    } catch {
      /* 单个失败不阻塞 */
    }
  }
  return removed
}

// ═══════════════════════════════════════════════════════
// 自动备份（Phase 8.2）：全量快照，保留最近 10 份
// ═══════════════════════════════════════════════════════

const MAX_BACKUPS = 10

/** 执行一次全量备份到 data\backups\backup-{时间戳}\ */
export async function runBackup() {
  await ensureDataDir()
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  const dest = path.join(BACKUP_DIR, `backup-${stamp}`)
  await fs.mkdir(dest, { recursive: true })
  await fs.cp(DATA_DIR, dest, { recursive: true })
  // 只保留最近 MAX_BACKUPS 份
  const dirs = (await fs.readdir(BACKUP_DIR)).filter((n) => n.startsWith('backup-')).sort()
  let removed = 0
  while (dirs.length > MAX_BACKUPS) {
    const oldest = dirs.shift()
    await fs.rm(path.join(BACKUP_DIR, oldest), { recursive: true, force: true })
    removed++
  }
  return { ok: true, dir: dest, kept: dirs.length, removed }
}

/** 备份信息：份数、最近一次备份时间 */
export async function backupInfo() {
  try {
    const dirs = (await fs.readdir(BACKUP_DIR)).filter((n) => n.startsWith('backup-')).sort()
    const last = dirs[dirs.length - 1] ?? null
    let lastAt = null
    if (last) {
      const stat = await fs.stat(path.join(BACKUP_DIR, last))
      lastAt = stat.mtime.toISOString()
    }
    return { count: dirs.length, last, lastAt, dir: BACKUP_DIR }
  } catch {
    return { count: 0, last: null, lastAt: null, dir: BACKUP_DIR }
  }
}
