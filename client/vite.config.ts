import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT_FILE = path.resolve(__dirname, '..', 'server', '.port')

/** 读取后端实际监听端口（server 启动时写入 .port），读不到则回退 3001 */
function readBackendPort(): number {
  try {
    const p = Number(fs.readFileSync(PORT_FILE, 'utf8').trim())
    return Number.isFinite(p) && p > 0 ? p : 3001
  } catch {
    return 3001
  }
}

/**
 * /api 动态代理：后端端口可探测漂移（3001-3010），
 * 每个请求实时读 .port 转发，前端代码完全不感知端口。
 */
function apiProxy(): Plugin {
  return {
    name: 'dynamic-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const port = readBackendPort()
        const proxyReq = http.request(
          {
            host: '127.0.0.1',
            port,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: `127.0.0.1:${port}` },
          },
          (pRes) => {
            res.writeHead(pRes.statusCode ?? 502, pRes.headers)
            pRes.pipe(res)
          }
        )
        proxyReq.on('error', () => {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: `无法连接后端 127.0.0.1:${port}` }))
        })
        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), apiProxy()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
})
