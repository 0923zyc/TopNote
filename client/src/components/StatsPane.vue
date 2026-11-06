<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNotesStore } from '../stores/notes'

const store = useNotesStore()

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const HEAT_WEEKS = 15

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 总览数字 ─────────────────────────────────────────
onMounted(() => store.loadStats())

const noteCount = computed(() => store.notes.filter((n) => !n.corrupt).length)
const stats = computed(() => [
  { label: '笔记', value: `${noteCount.value} 篇` },
  { label: '总字数', value: store.totalChars.toLocaleString() },
  { label: '连续记录', value: `${store.streakDays} 天` },
  { label: '收藏', value: `${store.favoriteCount} 条` },
])

// ── 活跃热力图（最近 15 周，周一开头）────────────────
/** level 0..4 → 颜色档位 */
function levelOf(count: number | undefined): number {
  const c = count ?? 0
  if (c <= 0) return 0
  if (c === 1) return 1
  if (c <= 3) return 2
  if (c <= 6) return 3
  return 4
}

const heatCells = computed(() => {
  const cells: Array<{ key: string; count: number; level: number; future: boolean; label: string }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // 本周周一（weekStart = 今天 - (getDay()+6)%7 天）
  const end = new Date(today)
  end.setDate(end.getDate() - ((end.getDay() + 6) % 7) + 6) // 本周日
  const start = new Date(end)
  start.setDate(start.getDate() - (HEAT_WEEKS * 7 - 1))
  const cursor = new Date(start)
  for (let i = 0; i < HEAT_WEEKS * 7; i++) {
    const key = dayKey(cursor)
    const count = store.dailyCounts.get(key) ?? 0
    cells.push({
      key,
      count,
      level: levelOf(count),
      future: cursor > today,
      label: `${cursor.getMonth() + 1}月${cursor.getDate()}日：${count} 篇更新`,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return cells
})

const heatMonths = computed(() => {
  // 每列（周）顶部的月份标记：该周一所在月份变化时显示
  const marks: Array<{ col: number; text: string }> = []
  let last = -1
  heatCells.value.forEach((c, i) => {
    if (i % 7 !== 0) return
    const col = i / 7
    const d = new Date(c.key)
    if (d.getMonth() !== last) {
      marks.push({ col, text: `${d.getMonth() + 1}月` })
      last = d.getMonth()
    }
  })
  return marks
})

// ── 月历（可翻月，点日期筛选）────────────────────────
const monthOffset = ref(0) // 0 = 本月

const calendar = computed(() => {
  const base = new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() + monthOffset.value)
  const year = base.getFullYear()
  const month = base.getMonth()
  const title = `${year} 年 ${month + 1} 月`
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // 周一开头的前置空格数
  const lead = (first.getDay() + 6) % 7
  const days: Array<{ day: number; key: string; count: number; isToday: boolean } | null> = []
  for (let i = 0; i < lead; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dayKey(new Date(year, month, d))
    days.push({ day: d, key, count: store.dailyCounts.get(key) ?? 0, isToday: key === dayKey(new Date()) })
  }
  return { title, days }
})

function shiftMonth(delta: number) {
  monthOffset.value += delta
}

function pickDay(key: string) {
  store.setDateFilter(store.dateFilter === key ? null : key)
}
</script>

<template>
  <div class="stats">
    <header class="stats-head">
      <div>
        <h1 class="stats-head__title">统计</h1>
        <p class="stats-head__sub">你的学习足迹（按笔记更新时间统计）</p>
      </div>
      <button class="stats-btn stats-btn--ghost" type="button" @click="store.toggleStats(false)">退出</button>
    </header>

    <!-- 总览：一个容器按 1px 分隔（app-screen 规范，不做图标卡片） -->
    <div class="stats-strip num">
      <div v-for="(s, i) in stats" :key="s.label" class="stats-strip__cell" :class="{ 'is-first': i === 0 }">
        <span class="stats-strip__value">{{ s.value }}</span>
        <span class="stats-strip__label">{{ s.label }}</span>
      </div>
    </div>

    <!-- 热力图 -->
    <section class="block">
      <h2 class="block__title">活跃热力图</h2>
      <div class="heat">
        <div class="heat__labels">
          <span v-for="w in WEEK_LABELS" :key="w" class="heat__wlabel">{{ w }}</span>
        </div>
        <div class="heat__scroll">
          <div class="heat__monthmarks">
            <span
              v-for="m in heatMonths"
              :key="m.col"
              class="heat__mmark"
              :style="{ left: `${m.col * 16}px` }"
              >{{ m.text }}</span
            >
          </div>
          <div class="heat__grid">
            <template v-for="(cell, i) in heatCells" :key="cell.key">
              <button
                class="heat__cell"
                :class="[`lv-${cell.level}`, { 'is-future': cell.future, 'is-active': store.dateFilter === cell.key }]"
                type="button"
                :title="cell.label"
                :aria-label="cell.label"
                :disabled="cell.future"
                :style="{ gridRow: (i % 7) + 1, gridColumn: Math.floor(i / 7) + 1 }"
                @click="pickDay(cell.key)"
              ></button>
            </template>
          </div>
        </div>
        <div class="heat__legend">
          <span>少</span>
          <i v-for="lv in 5" :key="lv" class="heat__cell" :class="`lv-${lv - 1}`"></i>
          <span>多</span>
          <span class="heat__legend-hint">点击方块可查看当天的笔记</span>
        </div>
      </div>
    </section>

    <!-- 月历 -->
    <section class="block">
      <div class="cal-head">
        <h2 class="block__title">月历</h2>
        <div class="cal-nav">
          <button class="stats-btn" type="button" aria-label="上个月" @click="shiftMonth(-1)">‹</button>
          <span class="cal-nav__title num">{{ calendar.title }}</span>
          <button class="stats-btn" type="button" aria-label="下个月" :disabled="monthOffset >= 0" @click="shiftMonth(1)">›</button>
        </div>
      </div>
      <div class="cal">
        <span v-for="w in WEEK_LABELS" :key="w" class="cal__wlabel">{{ w }}</span>
        <template v-for="(cell, i) in calendar.days" :key="i">
          <span v-if="!cell" class="cal__day is-empty"></span>
          <button
            v-else
            class="cal__day"
            :class="{
              'is-today': cell.isToday,
              'is-has': cell.count > 0,
              'is-active': store.dateFilter === cell.key,
            }"
            type="button"
            :title="`${cell.day}日：${cell.count} 篇更新`"
            @click="pickDay(cell.key)"
          >
            <span class="cal__daynum num">{{ cell.day }}</span>
            <span v-if="cell.count > 0" class="cal__dot" :class="`lv-${levelOf(cell.count)}`"></span>
          </button>
        </template>
      </div>
      <p v-if="store.dateFilter" class="cal-filter num">
        正在查看 {{ store.dateFilter }} 更新的笔记
        <button class="cal-filter__x" type="button" @click="store.setDateFilter(null)">清除</button>
      </p>
    </section>
  </div>
</template>

<style scoped>
.stats {
  height: 100%;
  overflow-y: auto;
  padding: 32px 40px;
  background: var(--ground);
}

.stats-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  max-width: 720px;
  margin: 0 auto 22px;
}

.stats-head__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
}

.stats-head__sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ink-faint);
}

.stats-btn {
  height: 30px;
  min-width: 30px;
  padding: 0 10px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-secondary);
  font-size: 14px;
  cursor: pointer;
}

.stats-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-ink);
}

.stats-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.stats-btn--ghost {
  border-color: transparent;
  background: transparent;
}

.stats-strip {
  max-width: 720px;
  margin: 0 auto 26px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.stats-strip__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 8px;
}

.stats-strip__cell + .stats-strip__cell {
  border-left: 1px solid var(--rule);
}

.stats-strip__value {
  font-size: 20px;
  font-weight: 600;
  color: var(--ink);
}

.stats-strip__label {
  font-size: 12px;
  color: var(--ink-faint);
}

.block {
  max-width: 720px;
  margin: 0 auto 28px;
}

.block__title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

/* ── 热力图 ── */
.heat__scroll {
  overflow-x: auto;
  padding-top: 16px;
}

.heat__monthmarks {
  position: relative;
  height: 14px;
  margin-left: 22px;
}

.heat__mmark {
  position: absolute;
  font-size: 11px;
  color: var(--ink-faint);
  white-space: nowrap;
}

.heat {
  display: flex;
  gap: 6px;
}

.heat__labels {
  display: grid;
  grid-template-rows: repeat(7, 14px);
  gap: 3px;
  margin-top: 16px;
}

.heat__wlabel {
  font-size: 10.5px;
  line-height: 14px;
  color: var(--ink-faint);
}

.heat__grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 14px);
  grid-auto-columns: 14px;
  gap: 3px;
}

.heat__cell {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 3px;
  background: var(--rule);
  cursor: pointer;
  padding: 0;
}

.heat__cell.lv-1 {
  background: color-mix(in srgb, var(--accent) 30%, var(--surface));
}
.heat__cell.lv-2 {
  background: color-mix(in srgb, var(--accent) 55%, var(--surface));
}
.heat__cell.lv-3 {
  background: color-mix(in srgb, var(--accent) 80%, var(--surface));
}
.heat__cell.lv-4 {
  background: var(--accent);
}

.heat__cell.is-future {
  background: transparent;
  cursor: default;
}

.heat__cell.is-active {
  outline: 2px solid var(--accent-ink);
  outline-offset: 1px;
}

.heat__legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--ink-faint);
}

.heat__legend .heat__cell {
  width: 11px;
  height: 11px;
  cursor: default;
}

.heat__legend-hint {
  margin-left: 10px;
}

/* ── 月历 ── */
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-nav__title {
  font-size: 13px;
  color: var(--ink-secondary);
}

.cal {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal__wlabel {
  text-align: center;
  font-size: 11.5px;
  color: var(--ink-faint);
  padding: 4px 0;
}

.cal__day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 46px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.cal__day:hover:not(.is-empty) {
  background: var(--rule);
}

.cal__day.is-empty {
  cursor: default;
}

.cal__day.is-has {
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-weight: 500;
}

.cal__day.is-today {
  outline: 1.5px solid var(--accent);
  outline-offset: -1.5px;
}

.cal__day.is-active {
  outline: 2px solid var(--accent-ink);
  outline-offset: -2px;
}

.cal__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
}

.cal__dot.lv-2 {
  background: var(--accent-hover);
}

.cal__dot.lv-3,
.cal__dot.lv-4 {
  background: var(--accent-ink);
}

.cal-filter {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: var(--accent-ink);
}

.cal-filter__x {
  margin-left: 8px;
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.cal-filter__x:hover {
  color: var(--negative);
}
</style>
