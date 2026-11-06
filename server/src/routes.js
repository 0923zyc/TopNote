import { Router } from 'express'
import * as store from './store.js'
import { saveAsset } from './assets.js'
import { streamExportZip, importFiles } from './exporter.js'

const router = Router()

/** 统一包装 async 路由，异常落到错误中间件 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** 健康检查：前端用它判断后端是否在线（文档 5.3 错误提示条） */
router.get('/health', (req, res) => {
  res.json({ ok: true, dataDir: store.DATA_DIR, time: new Date().toISOString() })
})

// GET /api/notes —— 全部笔记列表（元数据 + 80 字摘要，不含 content 全文）
router.get(
  '/notes',
  wrap(async (req, res) => {
    const notes = await store.listNotes()
    res.json(notes)
  })
)

// GET /api/notes/:id —— 单条完整笔记
router.get(
  '/notes/:id',
  wrap(async (req, res) => {
    const note = await store.getNote(req.params.id)
    if (!note) return res.status(404).json({ error: `笔记不存在: ${req.params.id}` })
    res.json(note)
  })
)

// POST /api/notes —— 新建（后端生成 id 和时间戳）
router.post(
  '/notes',
  wrap(async (req, res) => {
    if (req.body && typeof req.body !== 'object') {
      return res.status(400).json({ error: '请求体必须是 JSON 对象' })
    }
    const note = await store.createNote(req.body || {})
    res.status(201).json(note)
  })
)

// PUT /api/notes/:id —— 合并更新，刷新 updatedAt
router.put(
  '/notes/:id',
  wrap(async (req, res) => {
    if (req.body && typeof req.body !== 'object') {
      return res.status(400).json({ error: '请求体必须是 JSON 对象' })
    }
    if ('id' in (req.body || {}) && req.body.id !== req.params.id) {
      return res.status(400).json({ error: '不允许修改笔记 id' })
    }
    if ('createdAt' in (req.body || {})) {
      return res.status(400).json({ error: '不允许修改创建时间' })
    }
    const note = await store.updateNote(req.params.id, req.body || {})
    if (!note) return res.status(404).json({ error: `笔记不存在: ${req.params.id}` })
    res.json(note)
  })
)

// DELETE /api/notes/:id —— 移入回收站（可恢复；数据安全优先于立即销毁）
router.delete(
  '/notes/:id',
  wrap(async (req, res) => {
    const ok = await store.moveNoteToTrash(req.params.id)
    if (!ok) return res.status(404).json({ error: `笔记不存在: ${req.params.id}` })
    res.json({ ok: true, trashed: true })
  })
)

// PATCH /api/notes/:id/favorite —— 翻转收藏状态
router.patch(
  '/notes/:id/favorite',
  wrap(async (req, res) => {
    const note = await store.toggleFavorite(req.params.id)
    if (!note) return res.status(404).json({ error: `笔记不存在: ${req.params.id}` })
    res.json(note)
  })
)

// PATCH /api/notes/:id/pin —— 翻转置顶状态
router.patch(
  '/notes/:id/pin',
  wrap(async (req, res) => {
    const note = await store.togglePinned(req.params.id)
    if (!note) return res.status(404).json({ error: `笔记不存在: ${req.params.id}` })
    res.json(note)
  })
)

// GET /api/categories —— 扫描聚合去重的分类名
router.get(
  '/categories',
  wrap(async (req, res) => {
    res.json(await store.listCategories())
  })
)

// POST /api/categories —— 新建分类（无独立实体，仅校验并回显）
router.post(
  '/categories',
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 60)
    if (!name) return res.status(400).json({ error: '分类名不能为空' })
    const existing = await store.listCategories()
    if (!existing.includes(name)) existing.push(name)
    res.status(201).json({ ok: true, name, categories: existing.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')) })
  })
)

// ── 回收站 ───────────────────────────────────────────

// GET /api/trash —— 回收站列表
router.get(
  '/trash',
  wrap(async (req, res) => {
    res.json(await store.listTrash())
  })
)

// POST /api/trash/:id/restore —— 恢复到笔记列表
router.post(
  '/trash/:id/restore',
  wrap(async (req, res) => {
    const restored = await store.restoreFromTrash(req.params.id)
    if (!restored) return res.status(404).json({ error: `回收站中不存在: ${req.params.id}` })
    res.json(restored)
  })
)

// DELETE /api/trash/:id —— 彻底删除（不可恢复）
router.delete(
  '/trash/:id',
  wrap(async (req, res) => {
    const ok = await store.purgeFromTrash(req.params.id)
    if (!ok) return res.status(404).json({ error: `回收站中不存在: ${req.params.id}` })
    res.json({ ok: true })
  })
)

// ── 备份 ─────────────────────────────────────────────

// GET /api/backup —— 备份信息（份数/最近时间/目录）
router.get(
  '/backup',
  wrap(async (req, res) => {
    res.json(await store.backupInfo())
  })
)

// POST /api/backup —— 立即执行一次备份
router.post(
  '/backup',
  wrap(async (req, res) => {
    res.json(await store.runBackup())
  })
)

// ── 图片资源 ─────────────────────────────────────────

// POST /api/assets —— 上传图片（dataURL），返回 Markdown 引用路径
router.post(
  '/assets',
  wrap(async (req, res) => {
    try {
      const result = await saveAsset(req.body?.image)
      res.status(201).json(result)
    } catch (err) {
      const status = err?.status ?? 500
      if (status === 500) console.error('[assets] 保存失败:', err)
      res.status(status).json({ error: err.message })
    }
  })
)

// GET /api/stats —— 全库统计（总字数等需要全文聚合的指标）
router.get(
  '/stats',
  wrap(async (req, res) => {
    const notes = await store.listFull()
    res.json({
      noteCount: notes.length,
      totalChars: notes.reduce((s, n) => s + String(n.content ?? '').length, 0),
    })
  })
)

// ── 导出 / 导入 ──────────────────────────────────────

// GET /api/export/zip —— 整库导出为 zip（.md + frontmatter + assets）
router.get(
  '/export/zip',
  wrap(async (req, res) => {
    const count = await streamExportZip(res)
    console.log(`[export] 已导出 ${count} 篇笔记`)
  })
)

// POST /api/import —— 导入 Markdown 文件（含可选 frontmatter）
router.post(
  '/import',
  wrap(async (req, res) => {
    const result = await importFiles(req.body?.files)
    res.json(result)
  })
)

export default router
