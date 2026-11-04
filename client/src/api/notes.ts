/**
 * API 层（约束 #6：全部请求集中于此，组件不直接写 fetch/axios）
 * 走相对路径 /api/*，由 Vite 开发代理或生产环境静态托管转发到后端。
 */
import type { BackupInfo, NoteDetail, NoteMeta, TrashItem } from '../types'
export class ApiError extends Error {
  readonly kind: 'network' | 'http'
  readonly status?: number

  constructor(message: string, kind: 'network' | 'http', status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    // fetch 网络层异常（后端未启动、断连等）
    throw new ApiError('无法连接到本地服务（127.0.0.1:3001）', 'network')
  }
  if (!res.ok) {
    let msg = `请求失败（HTTP ${res.status}）`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') msg = body.error
    } catch {
      /* 非 JSON 错误体，保留默认消息 */
    }
    throw new ApiError(msg, 'http', res.status)
  }
  return (await res.json()) as T
}

export const notesApi = {
  /** 全部笔记元数据（无 content 全文） */
  list(): Promise<NoteMeta[]> {
    return request<NoteMeta[]>('/notes')
  },

  /** 单条完整笔记 */
  get(id: string): Promise<NoteDetail> {
    return request<NoteDetail>(`/notes/${encodeURIComponent(id)}`)
  },

  /** 新建，返回完整笔记（含 id 与时间戳） */
  create(data: Partial<Pick<NoteDetail, 'title' | 'content' | 'category' | 'tags'>> = {}): Promise<NoteDetail> {
    return request<NoteDetail>('/notes', { method: 'POST', body: JSON.stringify(data) })
  },

  /** 合并更新，返回更新后的完整笔记 */
  update(
    id: string,
    data: Partial<Pick<NoteDetail, 'title' | 'content' | 'category' | 'tags'>>
  ): Promise<NoteDetail> {
    return request<NoteDetail>(`/notes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  remove(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  toggleFavorite(id: string): Promise<NoteDetail> {
    return request<NoteDetail>(`/notes/${encodeURIComponent(id)}/favorite`, { method: 'PATCH' })
  },

  /** 分类聚合列表（也可直接由前端从笔记列表推导，这里保留与后端一致的通道） */
  categories(): Promise<string[]> {
    return request<string[]>('/categories')
  },

  /** 新建分类（后端仅校验与回显） */
  createCategory(name: string): Promise<{ ok: boolean; name: string; categories: string[] }> {
    return request<{ ok: boolean; name: string; categories: string[] }>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  // ── 回收站 ──────────────────────────────────────────

  trashList(): Promise<TrashItem[]> {
    return request<TrashItem[]>('/trash')
  },

  restoreFromTrash(id: string): Promise<NoteDetail> {
    return request<NoteDetail>(`/trash/${encodeURIComponent(id)}/restore`, { method: 'POST' })
  },

  purgeFromTrash(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/trash/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // ── 备份 ────────────────────────────────────────────

  backupInfo(): Promise<BackupInfo> {
    return request<BackupInfo>('/backup')
  },

  runBackup(): Promise<{ ok: boolean; dir: string; kept: number; removed: number }> {
    return request<{ ok: boolean; dir: string; kept: number; removed: number }>('/backup', {
      method: 'POST',
    })
  },

  // ── 图片资源 ────────────────────────────────────────

  /** 上传图片（dataURL），返回 Markdown 引用路径 assets/xxx.png */
  uploadAsset(dataUrl: string): Promise<{ url: string; name: string; bytes: number }> {
    return request<{ url: string; name: string; bytes: number }>('/assets', {
      method: 'POST',
      body: JSON.stringify({ image: dataUrl }),
    })
  },
}
