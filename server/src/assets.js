/**
 * 图片等静态资源存储（Phase 10 · 图片本地化）
 * - 存放于数据目录内 assets/ 子目录（备份时随 fs.cp 一并打包，数据安全不漏图）
 * - 文件名 {毫秒时间戳}_{短id}.{ext}，URL 引用形式 assets/{文件名}（Obsidian 风格相对路径）
 * - 开发期由 Vite 代理 /assets → 后端；生产期由 Express 静态托管
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { DATA_DIR } from './store.js'

export const ASSETS_DIR = path.join(DATA_DIR, 'assets')

/** 允许的图片类型 → 扩展名与 MIME */
const ALLOWED = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
])

/** 单图上限（字节）：与前端提示一致 */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024

export async function ensureAssetsDir() {
  await fs.mkdir(ASSETS_DIR, { recursive: true })
  return ASSETS_DIR
}

function shortId(len = 8) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len)
}

/**
 * 保存 dataURL 图片，返回可写入 Markdown 的相对引用路径 assets/xxx.ext
 * 抛出带中文 message 的 Error 由路由转 4xx/5xx。
 */
export async function saveAsset(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw Object.assign(new Error('图片数据必须是 dataURL 格式'), { status: 400 })
  }
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) {
    throw Object.assign(new Error('dataURL 格式不合法'), { status: 400 })
  }
  const mime = match[1].toLowerCase()
  const ext = ALLOWED.get(mime)
  if (!ext) {
    throw Object.assign(new Error(`不支持的图片类型: ${mime}（仅支持 PNG/JPG/GIF/WebP/SVG）`), { status: 400 })
  }
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length === 0) {
    throw Object.assign(new Error('图片内容为空'), { status: 400 })
  }
  if (buffer.length > MAX_ASSET_BYTES) {
    throw Object.assign(new Error('图片超过 8MB 上限'), { status: 413 })
  }
  await ensureAssetsDir()
  const name = `${Date.now()}_${shortId()}.${ext}`
  const dest = path.join(ASSETS_DIR, name)
  await fs.writeFile(dest, buffer)
  return { url: `assets/${name}`, name, bytes: buffer.length }
}

/** 供静态服务校验文件名，杜绝路径穿越 */
export function isSafeAssetName(name) {
  return /^[\w-]+\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name)
}

export async function readAsset(name) {
  if (!isSafeAssetName(name)) return null
  try {
    const file = path.join(ASSETS_DIR, name)
    const data = await fs.readFile(file)
    const ext = path.extname(name).toLowerCase().slice(1)
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return { data, contentType: `image/${mime}` }
  } catch {
    return null
  }
}
