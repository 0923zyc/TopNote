# 拾知笔记 (TopNote) · 本地学习笔记应用

一个**纯本机运行**的学习笔记应用：每天把学到的知识整理成 Markdown 笔记，按分类归档，收藏高频回看的条目。无登录、无云同步，数据 100% 在你自己的硬盘上。

![技术栈](https://img.shields.io/badge/Vue%203-Element%20Plus-5B6ABF) ![后端](https://img.shields.io/badge/Express-JSON%20%E6%96%87%E4%BB%B6%E5%AD%98%E5%82%A8-blue) ![配色](https://img.shields.io/badge/%E9%85%8D%E8%89%B2%E6%96%B9%E6%A1%88-6%20%E5%A5%97-002FA7)

## 快速开始

**方式一（推荐）**：双击项目根目录的 [`start.bat`](start.bat) —— 自动启动前后端并打开浏览器（`http://localhost:5173`）。

**方式二**：命令行启动

```bash
npm install        # 首次使用先安装依赖（根目录、server、client 各装一次即可）
npm run dev        # 同时启动后端(3001)与前端(5173)
```

> 依赖便携版 Node.js：`C:\Users\10405\nodejs-portable\node-v22.23.4-win-x64\`（start.bat 已内置路径）。若换机器，请安装 Node.js ≥ 20 并将其加入 PATH。

## 功能

- **三栏布局**：分类导航 / 笔记列表 / Markdown 编辑器（分屏实时预览）
- **自动保存**：停止输入 800ms 后自动落盘，顶栏实时显示「编辑中 / 保存中 / 已保存」；`Ctrl+S` 立即保存
- **新建即写**：点「新建笔记」或 `Ctrl+N`，标题自动聚焦
- **分类**：单选互斥，下拉选择或直接输入新分类名创建；左侧导航树按分类过滤
- **标签**：多选扁平，回车添加，点击列表项上的标签即筛选
- **收藏**：星标即时切换（带缩放动画），左侧「收藏」只看收藏的笔记
- **搜索**：对标题 + 内容 + 标签前端过滤，与分类/收藏筛选叠加生效
- **排序**：更新时间 / 创建时间一键切换
- **大纲目录**：编辑器工具栏一键展开笔记标题结构，长笔记导航
- **专注模式**：编辑器页面级全屏，沉浸写作
- **图片本地化**：截图直接粘贴或拖入编辑器，落盘 `data/notebook/assets/`，Markdown 以 `assets/xxx.png` 相对路径引用（随备份打包）
- **每日回顾**：随机抽 5 张旧笔记做成卡片流，换一张/换一批/一键打开，对抗"记了就忘"
- **置顶笔记**：图钉一键置顶，列表优先显示（不改动时间序）
- **标签面板**：侧栏标签聚合 + 计数，点击即筛选
- **全量导出**：整库打包 zip（Markdown + YAML frontmatter + assets 图片），可直接拖进 Obsidian
- **Markdown 导入**：批量导入 .md（自动解析 frontmatter），只新增不覆盖
- **导出**：一键把当前笔记下载为 `.md` 文件
- **回收站**：删除先进回收站（保留 30 天），随时恢复或彻底删除
- **自动备份**：启动与每 24 小时全量快照到 `data\backups\`，保留最近 10 份，可手动立即备份
- **学习激励**：欢迎页显示「已连续记录 N 天」；下次打开自动回到上次编辑的笔记
- **六套高级配色**：左下角「配色」随时切换 —— 靛蓝（默认）/ **克莱因蓝×驼棕** / 森绿×亚麻 / 勃艮第×鎏金 / **水墨×朱砂** / 青瓷×赭石，每套均含浅色+深色双模式，主色管动作、副色管徽标与引用
- **双主题**：浅色/深色跟随系统，可手动切换
- **数据安全**：
  - 每条笔记一个独立 JSON 文件，先写 `.tmp` 再原子重命名（含 Windows 占用重试），进程中断不会损坏数据
  - 同一笔记并发写入自动串行化，只保留最后一次完整内容
  - 删除先进回收站，个别文件损坏不影响其余笔记加载，损坏条目可定位移入回收站
  - 外部修改数据目录（换电脑、手动备份）后刷新页面即可看到最新状态

## 数据存哪里？

默认目录：`data\notebook\`（项目内），每条笔记一个 `{创建时间戳}_{id}.json`：

```json
{
  "id": "a1B2c3D4e5",
  "title": "笔记标题",
  "content": "Markdown 原文",
  "category": "分类",
  "tags": ["标签"],
  "favorited": false,
  "createdAt": "2026-11-04T00:00:00.000Z",
  "updatedAt": "2026-11-04T00:00:00.000Z"
}
```

- **备份**：`data\backups\`（自动，保留 10 份）；**回收站**：`data\trash\`（保留 30 天）
- 迁移/备份 = 复制 `data` 文件夹。如需改存放位置，设置环境变量 `NOTES_DATA_DIR` 后启动（回收站与备份目录自动跟随）。

## 后端接口（本机 `127.0.0.1:3001`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/notes` | 全部笔记元数据（不含正文全文） |
| GET | `/api/notes/:id` | 单条完整笔记 |
| POST | `/api/notes` | 新建 |
| PUT | `/api/notes/:id` | 合并更新 |
| DELETE | `/api/notes/:id` | 移入回收站 |
| PATCH | `/api/notes/:id/favorite` | 翻转收藏 |
| GET/POST | `/api/categories` | 分类聚合 / 校验新分类 |
| GET | `/api/trash` | 回收站列表 |
| POST | `/api/trash/:id/restore` | 从回收站恢复 |
| DELETE | `/api/trash/:id` | 彻底删除（不可恢复） |
| GET/POST | `/api/backup` | 备份信息 / 立即备份 |
| POST | `/api/assets` | 上传图片（dataURL） |
| PATCH | `/api/notes/:id/pin` | 翻转置顶 |
| GET | `/api/export/zip` | 整库导出 zip（Obsidian 兼容） |
| POST | `/api/import` | 批量导入 Markdown |

端口被占时自动向后探测至 3010，实际端口写入 `server/.port`。

## 项目结构

```
├── start.bat            # 双击一键启动
├── data/                # 本地运行数据（不入库，克隆后自动创建）
│   ├── notebook/        # 笔记数据（每条一个 JSON）
│   ├── trash/           # 回收站（保留 30 天）
│   └── backups/         # 自动备份（保留 10 份）
├── server/              # Express 后端（原生 ESM JS，无数据库）
│   └── src/index.js / store.js / routes.js / seed.js
└── client/              # Vue 3 + Vite + TS + Pinia + Element Plus + md-editor-v3
    └── src/api|stores|components|composables|config|styles
```

## 开发

```bash
npm install            # 根目录 + server + client（或用 npm workspaces 方式）
npm run dev            # 双进程开发
npm run build          # 前端生产构建（vue-tsc + vite build）
```

克隆后首次启动会自动创建 `data/` 并写入两篇欢迎笔记（仅全新安装时）。
