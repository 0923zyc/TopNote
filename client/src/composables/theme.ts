/**
 * 主题跟随系统（文档 6.1）+ 手动切换开关 + 配色方案选择（Phase 9）。
 * 仅主题/配色偏好存 localStorage（UI 偏好，非笔记数据；笔记主存储仍在磁盘，符合约束 #2）。
 */
import { ref, watchEffect } from 'vue'
import { DEFAULT_PALETTE, PALETTES } from '../config/palettes'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'shizhi-theme-mode'
const PALETTE_KEY = 'shizhi-palette'

function readStoredMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function readStoredPalette(): string {
  const v = localStorage.getItem(PALETTE_KEY)
  return PALETTES.some((p) => p.id === v) ? (v as string) : DEFAULT_PALETTE
}

const mode = ref<ThemeMode>(readStoredMode())
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  systemDark.value = e.matches
})

const isDark = ref(false)

watchEffect(() => {
  isDark.value = mode.value === 'system' ? systemDark.value : mode.value === 'dark'
  const cls = document.documentElement.classList
  cls.toggle('dark', isDark.value)
  cls.toggle('light', !isDark.value)
})

// ── 配色方案 ──────────────────────────────────────────
const palette = ref<string>(readStoredPalette())

watchEffect(() => {
  const root = document.documentElement
  if (palette.value === DEFAULT_PALETTE) {
    delete root.dataset.palette // 默认色板用 :root 基准值
  } else {
    root.dataset.palette = palette.value
  }
})

export function useTheme() {
  function setMode(next: ThemeMode) {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
  }
  function cycle() {
    setMode(isDark.value ? 'light' : 'dark')
  }
  function setPalette(id: string) {
    if (!PALETTES.some((p) => p.id === id)) return
    palette.value = id
    localStorage.setItem(PALETTE_KEY, id)
  }
  return { mode, isDark, setMode, cycle, palette, setPalette }
}
