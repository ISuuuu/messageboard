# Cyber Sphere // 3D 滚动留言空间

这是一个集成了**高级 3D 交互动效**与**多服务商文本内容审核**的前后端分离留言板系统。前端基于 Vite + Vue3 提供沉浸式 3D 悬浮球体验，后端基于 Node.js + Express + SQLite 提供高性能数据持久化及敏感词智能过滤。

---

## 🪐 项目特性

1. **手写 3D 球体滚动引擎**：基于球面坐标系与斐波那契螺旋面分布算法，纯数学矩阵运算，未使用 Three.js 等重型库，极轻量、高性能。
2. **拟真 3D 景深渲染**：留言气泡的透明度 (`opacity`)、字号缩放 (`scale`)、层级 (`z-index`) 以及高斯模糊 (`blur`) 随 Z 轴深度动态递变，空间感强。
3. **物理滚轮冲量交互**：支持鼠标滚轮拨动球体，注入转动速度（Impulse），并结合 `0.95` 的摩擦力阻尼平滑滑行减速，手感丝滑。
4. **一屏自适应响应式**：强制锁定 `100vh` 单屏零滚动条布局。3D 球体半径随窗口缩放动态重新计算，小巧的加号按钮固定悬浮在右上角。
5. **时区自适应转换**：SQLite 数据库统一存储 UTC 时间，接口输出标准 ISO-8601 格式，前端浏览器根据用户所在国家/电脑时区自动换算展示。
6. **4合1 可配置审核服务**：采用策略模式设计的审核模块，支持随时通过配置文件切换本地过滤、大模型、百度智能云与阿里云审核：
   - `local` (默认)：本地轻量敏感词词库匹配。
   - `aliyun`：自研 RPC HMAC-SHA1 签名直连接口，免去官方 SDK 的编译干扰，极速调用。
   - `baidu`：集成 AccessToken 自动刷新和文本内容审核。
   - `llm`：通过 JSON 结构化 Prompt，利用大模型（如 DeepSeek/OpenAI）对隐晦违规或谐音梗进行智能语义阻断。

---

## 🛠️ 技术栈说明

* **工作区**：pnpm Workspace Monorepo
* **前端 (Client)**：Vite + Vue 3 + TypeScript + CSS3D (无 Tailwind 依赖)
* **后端 (Server)**：Node.js + Express + TypeScript + SQLite3 (使用 `sqlite` + `sqlite3` 驱动)
* **数据库优化**：默认开启 **WAL (Write-Ahead Logging)** 预写日志模式，实现高并发下读写不阻塞。

---

## 📂 目录结构

```text
messageboard/
├── package.json            # 根目录工作区脚本配置
├── pnpm-workspace.yaml     # 定义子项目 (client & server)
├── .npmrc                  # 允许编译并配置 sqlite3 构建脚本
├── nginx.conf              # 生产环境 Nginx 反代与托管配置文件示例
├── client/                 # 前端 Vue3 项目
│   ├── src/
│   │   ├── components/     # 3D球体、留言表单抽屉、留言详情模态框
│   │   ├── App.vue         # 页面拼装与 API 调用
│   │   └── style.css       # 样式重置
│   └── vite.config.ts
└── server/                 # 后端 Express 项目
    ├── src/
    │   ├── config/         # 环境变量与配置读取
    │   ├── database/       # SQLite 建表与连接 (开启 WAL)
    │   ├── services/       # 统一 AuditManager 与 4 大审核驱动器
    │   └── index.ts        # 入口服务与 API 路由
    ├── .env                # 本地环境配置文件
    └── tsconfig.json
```

---

## 🚀 本地开发指南

### 1. 准备工作
确保本地安装了 [Node.js](https://nodejs.org/) (建议 v18+) 以及 [pnpm](https://pnpm.io/)。

### 2. 安装项目依赖
在项目**根目录**下执行：
```bash
pnpm install
```
> 系统已在 `.npmrc` 中配置了 `only-built-dependencies` 编译白名单，`sqlite3` 驱动的 C++ 构建脚本将在此步骤中自动进行免交互编译。

### 3. 配置后端环境变量
进入 `server` 目录，将 `.env.example` 复制一份并重命名为 `.env`：
```bash
cp server/.env.example server/.env
```
默认情况下 `AUDIT_PROVIDER=local`，不需要任何凭证配置即可启动本地敏感词过滤。

### 4. 启动开发服务器
在项目**根目录**下执行：
```bash
pnpm dev
```
此命令将**并行并发启动**前后端：
* **前端控制台**：http://localhost:5173
* **后端服务端口**：http://localhost:4001

---

## 🌐 生产部署指南 (Nginx + PM2)

项目在生产环境建议采用 **Nginx 托管前端 + PM2 守护后端** 的前后端分离反代方案。

### 1. 编译构建
在项目**根目录**下运行：
```bash
# 编译前端静态包 (产物在 client/dist)
pnpm --filter client build

# 编译后端 TS 代码 (产物在 server/dist)
pnpm --filter server build
```

### 2. 部署前端 (Nginx)
将本地 `client/dist` 文件夹上传到服务器的指定路径（如 `/var/www/messageboard/client/dist`）。

在您服务器的 Nginx 配置中（如 `/etc/nginx/conf.d/messageboard.conf`），加入以下关键配置（已内置静态资源缓存与 API 反代）：

```nginx
server {
    listen 80;
    server_name localhost; # 或者是您的域名 (例如 example.com)

     # 启用 Gzip 压缩以极大降低前端 JS/CSS 在传输中的网络消耗
    gzip on;
    gzip_min_length 1k;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_vary on;

    # 限制上传内容大小 (留言最长 500 字，接口包极小，限制为 1M 足够)
    client_max_body_size 1m;
    
    # 1. 托管前端静态页面 (Vite 编译输出在 client/dist 目录下)
    location / {
        root /var/www/messageboard/client/dist; # 替换为前端代码在服务器上的绝对路径
        index index.html;
        try_files $uri $uri/ /index.html; # 支持 Vue-Router 单页面路由防 404

        # 针对打包后的 JS/CSS 等静态资源设置 7 天强缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 7d;
            add_header Cache-Control "public, no-transform";
        }
    }

    # 2. 反向代理后端 API 接口，解决跨域并隐藏真实端口
    location /api/ {
        proxy_pass http://127.0.0.1:4001; # 代理到本地运行的 Express 端口
        proxy_http_version 1.1;
        
        # 传递客户端真实 IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

完整的配置文件与 Gzip 优化建议可直接参考根目录下的 [nginx.conf](file:///e:/Code/messageboard/nginx.conf) 模板。

### 3. 部署后端 (PM2 进程守护)
1. 将 `server/dist`、`server/package.json` 以及 `.env` 文件上传到服务器的后端工作区。
2. 在服务器上，进入后端部署目录，运行依赖安装（仅生产依赖）：
   ```bash
   pnpm install --prod
   ```
3. 使用 **PM2** 启动并守护 Node.js 进程：
   ```bash
   # 全局安装 pm2 (若未安装)
   npm install -g pm2
   
   # 启动后端服务
   pm2 start dist/index.js --name "messageboard-api"
   
   # 配置开机自动启动
   pm2 save
   pm2 startup
   ```

此时，用户访问您的域名或服务器 IP 的 80 端口，即可完美体验一屏自适应的 3D 留言板系统。
