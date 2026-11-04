/**
 * 首次启动种子数据：数据目录为空时写入两篇欢迎笔记。
 * 目的：让 git 克隆（data/ 目录不入库）后的首次启动也有完整引导体验。
 * 只在"从未有过笔记"时执行一次，绝不覆盖任何已有数据。
 */
import { DATA_DIR, listNotes, createNote } from './store.js'
import fs from 'node:fs/promises'
import path from 'node:path'

/** 判断数据目录是否从未使用过（空目录或不存在） */
async function isFreshInstall() {
  try {
    const entries = await fs.readdir(DATA_DIR)
    return entries.filter((n) => n.toLowerCase().endsWith('.json')).length === 0
  } catch {
    return true // 目录不存在 = 全新安装
  }
}

export async function seedIfFresh() {
  if (!(await isFreshInstall())) return false
  // 双重保险：回收站也必须为空，避免误判（用户把笔记全部删空的场景不种子化——
  // 但回收站有内容说明用过，跳过）
  const trashDir = path.join(path.dirname(DATA_DIR), 'trash')
  try {
    const trash = await fs.readdir(trashDir)
    if (trash.some((n) => n.toLowerCase().endsWith('.json'))) return false
  } catch {
    /* 回收站不存在 = 全新 */
  }

  await createNote({
    title: '欢迎使用拾知笔记',
    favorited: true,
    content: `欢迎使用 **拾知笔记** —— 一个只属于你的本地学习笔记应用。

## 30 秒上手

1. 点左上角「新建笔记」或按 \`Ctrl + N\`
2. 输入标题，正文支持完整的 Markdown 语法
3. 停止输入 0.8 秒后**自动保存**，右上角会显示保存状态
4. 用星标收藏常看的笔记，左侧「收藏」一键回看

## 管理知识

- **分类**（单选）：在编辑器顶部的下拉框选择，或直接输入新分类名
- **标签**（多选）：在分类旁的「+ 标签」输入，回车添加
- **搜索**：中栏顶部的搜索框，可搜标题、内容和标签
- **配色**：左下角「配色」可切换六套高级配色（克莱因蓝×驼棕、水墨×朱砂等）

## 数据安全

所有笔记以 JSON 文件存在项目的 \`data/notebook/\` 目录，换电脑或备份时复制这个文件夹即可。删除的笔记会先进入回收站（30 天可恢复），且每 24 小时自动备份一次。

> 学习的本质是把新知识挂到已有的知识树上。愿你在这里长出一棵自己的树。`,
    category: '指南',
    tags: ['入门', 'Markdown'],
  })

  await createNote({
    title: '示例：费曼学习法的笔记模板',
    content: `费曼学习法：**如果你不能简单地解释它，说明你还没有真正理解它。**

## 四步模板

| 步骤 | 做什么 | 笔记里怎么写 |
|---|---|---|
| 1 选择概念 | 确定今天要学的知识点 | 标题写清概念名 |
| 2 教给别人 | 用最简单的话解释 | 正文像讲故事一样写 |
| 3 发现卡壳 | 解释不顺的地方 | 用 \`> 引用块\` 标记疑问 |
| 4 简化类比 | 打比方、画结构 | 用列表和表格重述 |

## 记一条试试

\`\`\`text
今天学了：HTTP 缓存
一句话解释：浏览器把网页资源存一份副本，下次不用重新下载
卡壳的地方：强缓存和协商缓存的触发条件
类比：像冰箱里囤菜 —— 先看冰箱（强缓存），没了才问超市打折没（协商缓存）
\`\`\`

把这段删掉，开始记你自己的吧。`,
    category: '示例',
    tags: ['学习方法', '费曼'],
  })

  console.log('[seed] 全新安装：已写入两篇欢迎笔记')
  return true
}

/** 供启动日志确认笔记数（与 index.js 的 listNotes 复用同一缓存） */
export async function countNotes() {
  return (await listNotes()).length
}
