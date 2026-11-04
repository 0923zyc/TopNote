import express from 'express'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import apiRouter from './routes.js'
import { ensureDataDir, listNotes, cleanTrash, runBackup, DATA_DIR, TRASH_DIR, BACKUP_DIR } from './store.js'
import { seedIfFresh } from './seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT_FILE = path.join(__dirname, '..', '.port')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '10mb' }))

app.use('/api', apiRouter)

// 生产预览：若前端已构建（client/dist 存在）则直接托管，双击 start.bat 也能跑完整应用
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
app.use(express.static(clientDist))

// JSON 404 与错误兜底
app.use((req, res) => {
  res.status(404).json({ error: `接口不存在: ${req.method} ${req.path}` })
})
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法 JSON' })
  }
  console.error('[server] 未处理错误:', err)
  res.status(500).json({ error: '服务器内部错误', detail: String(err?.message || err) })
})

/** 探测可用端口：首选 3001，被占则向上探测至 3010（文档第二节） */
function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1')
    server.once('listening', () => resolve(server))
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') return reject(Object.assign(err, { portBusy: true }))
      reject(err)
    })
  })
}

async function probePort() {
  for (let port = 3001; port <= 3010; port++) {
    // 先用 net 探测再真正绑定，避免半开 server
    const free = await new Promise((resolve) => {
      const s = net.createServer()
      s.once('error', () => resolve(false))
      s.once('listening', () => s.close(() => resolve(true)))
      s.listen(port, '127.0.0.1')
    })
    if (free) return port
  }
  throw new Error('3001-3010 端口均被占用')
}

async function main() {
  const dir = await ensureDataDir()
  await seedIfFresh() // 全新安装时写入欢迎笔记（绝不覆盖已有数据）
  const port = await probePort()
  await tryListen(port)
  await fs.writeFile(PORT_FILE, String(port), 'utf8') // 供 Vite 代理动态读取
  const count = (await listNotes()).length

  // 启动维护任务：清理超龄回收项 + 全量备份（不阻塞服务）
  const maintenance = async () => {
    try {
      const cleaned = await cleanTrash()
      const backup = await runBackup()
      if (cleaned > 0) console.log(`[维护] 回收站清理 ${cleaned} 个超龄文件`)
      console.log(`[维护] 备份完成 → ${backup.dir}`)
    } catch (err) {
      console.warn('[维护] 任务失败（不影响服务）:', err.message)
    }
  }
  maintenance()
  const DAY_MS = 24 * 60 * 60 * 1000
  const maintenanceTimer = setInterval(maintenance, DAY_MS)
  maintenanceTimer.unref?.()

  console.log('──────────────────────────────────────────────')
  console.log('  拾知笔记后端已启动')
  console.log(`  地址:     http://127.0.0.1:${port}`)
  console.log(`  数据目录: ${dir}`)
  console.log(`  回收站:   ${TRASH_DIR}`)
  console.log(`  备份目录: ${BACKUP_DIR}（每 24 小时自动备份，保留 10 份）`)
  console.log(`  已加载笔记: ${count} 条`)
  console.log('──────────────────────────────────────────────')
}

main().catch((err) => {
  console.error('[server] 启动失败:', err.message)
  process.exit(1)
})
