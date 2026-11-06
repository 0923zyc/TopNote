/** 笔记数据模型（与后端 JSON 结构一致） */

export interface NoteMeta {
  id: string
  title: string
  summary: string
  category: string | null
  tags: string[]
  favorited: boolean
  /** 置顶（列表优先显示） */
  pinned?: boolean
  createdAt: string
  updatedAt: string
  /** 损坏文件占位条目 */
  corrupt?: boolean
}

export interface NoteDetail extends NoteMeta {
  content: string
}

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export type SortBy = 'updatedAt' | 'createdAt'

export type ViewKind = 'all' | 'favorites' | 'category'

/** 回收站条目 */
export interface TrashItem {
  id: string
  title: string
  corrupt: boolean
  category: string | null
  tags: string[]
  favorited: boolean
  deletedAt: string
}

/** 备份信息 */
export interface BackupInfo {
  count: number
  last: string | null
  lastAt: string | null
  dir: string
}
