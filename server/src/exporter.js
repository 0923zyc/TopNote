/**
 * 全量导出 / 导入（Phase 11 · 功能 #8）
 *
 * 导出：整库打包为 zip —— 每篇笔记一个 .md（带 YAML frontmatter，Obsidian 可直接打开），
 *       assets/ 图片一并打包；文件名冲突时追加短 id。
 * 导入：解析 .md 的 frontmatter（可选），批量新建笔记；无 frontmatter 也能导入纯 Markdown。
 */
import archiver from 'archiver'
import * as store from './store.js'
import { ASSETS_DIR } from './assets.js'
import fs from 'node:fs/promises'

/** Windows/跨平台非法文件名字符 */
function sanitizeFilename(name, fallback) {
  const clean = String(name ?? '')
    .replace(/[\\/:*?"<>|\r\n]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return clean || fallback
}

function frontmatterOf(note) {
  const lines = [
    '---',
    `id: ${note.id}`,
    `title: ${JSON.stringify(note.title ?? '')}`,
    `category: ${note.category ? JSON.stringify(note.category) : 'null'}`,
    `tags: [${(note.tags ?? []).map((t) => JSON.stringify(t)).join(', ')}]`,
    `favorited: ${Boolean(note.favorited)}`,
    `pinned: ${Boolean(note.pinned)}`,
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
    '---',
    '',
  ]
  return lines.join('\n')
}

/** 把整库写入 res（zip 流）。返回写入的笔记数。 */
export async function streamExportZip(res) {
  const notes = await store.listFull()
  const stamp = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="TopNote-export-${stamp}.zip"`)

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', (err) => {
    console.error('[export] 打包失败:', err)
    res.destroy(err)
  })
  archive.pipe(res)

  // 文件名去重：重名笔记追加短 id
  const used = new Set()
  for (const note of notes) {
    let base = sanitizeFilename(note.title, '无标题笔记')
    let name = `${base}.md`
    let i = 2
    while (used.has(name.toLowerCase())) {
      name = `${base}(${i}).md`
      i++
    }
    used.add(name.toLowerCase())
    const body = frontmatterOf(note) + (note.content ?? '')
    archive.append(body, { name })
  }

  // 图片资源目录（不存在时跳过）
  try {
    await fs.access(ASSETS_DIR)
    archive.directory(ASSETS_DIR, 'assets')
  } catch {
    /* 无图片资源 */
  }

  await archive.finalize()
  return notes.length
}

/** 解析 Markdown 文件的 YAML frontmatter（仅取我们用到的平铺字段，不追求完整 YAML） */
export function parseFrontmatter(raw) {
  const text = String(raw ?? '')
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { fields: null, content: text }
  const fields = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.trim())
    if (!kv) continue
    const [, key, rawVal] = kv
    let val = rawVal.trim()
    try {
      val = JSON.parse(val) // 我们的导出用 JSON.stringify 编码字符串/数组/布尔
    } catch {
      /* 非 JSON 值保留原文（第三方 frontmatter 容错） */
    }
    fields[key] = val
  }
  return { fields, content: text.slice(m[0].length) }
}

/** 导入一批 Markdown 文件，返回统计 */
export async function importFiles(files) {
  if (!Array.isArray(files)) {
    throw Object.assign(new Error('请求体必须是 { files: [{name, content}] }'), { status: 400 })
  }
  let imported = 0
  const errors = []
  for (const f of files.slice(0, 500)) {
    try {
      const { fields, content } = parseFrontmatter(f?.content)
      await store.createNote({
        title: typeof fields?.title === 'string' && fields.title ? fields.title : String(f?.name ?? '导入笔记').replace(/\.md$/i, ''),
        content,
        category: typeof fields?.category === 'string' && fields.category ? fields.category : null,
        tags: Array.isArray(fields?.tags) ? fields.tags.map(String) : [],
        favorited: Boolean(fields?.favorited),
      })
      imported++
    } catch (err) {
      errors.push({ name: f?.name ?? '?', error: String(err?.message ?? err) })
    }
  }
  return { imported, failed: errors.length, errors: errors.slice(0, 10) }
}
