/** 时间与文本格式化工具 */

/** 相对时间：刚刚 / n 分钟前 / n 小时前 / 昨天 / n 天前 / 具体日期 */
export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour

  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(iso)
}

/** 紧凑日期：同年 M/D，跨年 YYYY/M/D */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 完整时间戳：YYYY-MM-DD HH:mm */
export function formatFull(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 按时段问候 */
export function greetingByHour(h = new Date().getHours()): { greet: string; hint: string } {
  if (h < 5) return { greet: '夜深了', hint: '灵感常在安静时造访，记下此刻的想法' }
  if (h < 11) return { greet: '早上好', hint: '一日之计在于晨，把今天要学的东西先写下' }
  if (h < 14) return { greet: '中午好', hint: '午后小憩前后，正是整理上午所得的时候' }
  if (h < 18) return { greet: '下午好', hint: '学过的东西趁热记下来，才真正属于你' }
  if (h < 23) return { greet: '晚上好', hint: '一天所学，值得在今晚好好归档' }
  return { greet: '夜深了', hint: '灵感常在安静时造访，记下此刻的想法' }
}
