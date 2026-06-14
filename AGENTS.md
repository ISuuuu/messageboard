# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

3D 留言墙 Web 应用 — 用户提交留言后经内容审核，审核通过的留言以 Fibonacci 螺旋分布在三维球体上旋转展示。

## 技术栈

- **前端**：Vue 3（Composition API + `<script setup>`）+ Vite 8 + TypeScript 6
- **后端**：Express 5 + TypeScript（编译目标 ES2022, module node16）
- **数据库**：SQLite3（WAL 模式），文件位于 `server/database.db`
- **包管理**：pnpm workspace monorepo（`client/` 和 `server/` 两个成员）
- **生产部署**：Nginx（静态文件 + `/api/` 反向代理到 4001 端口）+ PM2 进程管理

## 常用命令

```bash
# 安装依赖（需要先安装 pnpm，sqlite3 通过 .npmrc 自动编译原生模块）
pnpm install

# 开发模式（同时启动前端 5173 和后端 4001）
pnpm dev
pnpm dev:client          # 仅前端
pnpm dev:server          # 仅后端

# 构建
pnpm build:client        # vue-tsc 类型检查 + vite build -> client/dist/
pnpm build:server        # tsc -> server/dist/（prebuild 会同步敏感词库）

# 生产运行
node server/dist/index.js
# 或通过 PM2
pm2 start dist/index.js --name "messageboard-api"
```

项目没有配置测试框架。

## 架构要点

### 客户端

入口：`client/src/main.ts` → `App.vue`

- `App.vue`：主组件，负责 API 调用和全局状态管理
- `ThreeDMessageBall.vue`：核心 3D 渲染，使用 Fibonacci 螺旋将留言点均匀分布在球面上，通过矩阵旋转（X/Y 轴）、深度透视（透明度/缩放/模糊）、滚轮物理（摩擦系数 0.95）实现交互式旋转
- `MessageForm.vue`：抽屉式留言提交表单
- `MessageDetail.vue`：留言详情弹窗

开发环境 API 地址：`http://localhost:4001/api`；生产环境：`/api`（由 Nginx 代理）

### 服务端

入口：`server/src/index.ts`

仅两个 API 路由：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/messages` | 获取所有审核通过的留言（ID 经黄金比例哈希混淆） |
| POST | `/api/messages` | 提交新留言，触发内容审核管线 |

### 内容审核管线（两层架构）

定义在 `server/src/services/` 下，通过 `AUDIT_PROVIDER` 环境变量配置：

1. **本地层**（始终执行）：`LocalAuditProvider.ts` — Trie 树 DFA 敏感词匹配，词库来自 `server/sensitive_words.txt`
2. **外部层**（可选，二选一）：
   - `aliyun` — 阿里云内容安全（HMAC-SHA1 RPC 签名）
   - `baidu` — 百度云内容审核（AccessToken 认证，自动刷新）
   - `llm` — LLM 语义审核（兼容 OpenAI 的 Chat Completions API，默认 DeepSeek）
   - `local` — 不调用外部服务

外部审核失败时自动降级为本地审核结果。审核不通过的留言仍会入库，但内容中的敏感词会被替换为 `***`。

### 数据库

单表 `messages`，关键字段：`id`、`content`（可能被脱敏）、`originalContent`（原始内容）、`nickname`、`color`、`size`、`status`（pending/approved/rejected）、`rejectReason`、`createdAt`。

`getApprovedMessages()` 查询 `status='approved'` 的记录，并过滤掉 `rejectReason` 超过 1 天的记录。

### 环境变量

参见 `server/.env.example`，关键配置：
- `PORT`：服务端口（默认 4001）
- `AUDIT_PROVIDER`：审核供应商（local/aliyun/baidu/llm）
- `BAIDU_API_KEY` / `BAIDU_SECRET_KEY`：百度云凭证
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`：阿里云凭证
- `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`：LLM 审核配置

## 部署

`deploy.sh` 自动化部署流程：`git pull` → `pnpm install` → 构建前端 → 构建后端（触发敏感词同步）→ `pm2 restart` → `nginx -s reload`

生产目录：`/home/ikim/Code/messageboard`
