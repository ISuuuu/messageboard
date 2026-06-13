#!/bin/bash

# 遇到任何错误立即停止执行
set -e

# 服务器上项目的根目录绝对路径
PROJECT_DIR="/home/ikim/Code/messageboard"

echo "=================================================="
echo "🚀 开始自动化部署 MessageBoard 留言板项目..."
echo "=================================================="

# 1. 进入项目目录
cd "$PROJECT_DIR"
echo "📂 当前工作目录: $(pwd)"

# 2. 拉取最新代码
echo "📥 正在从 Git 仓库拉取最新代码..."
git pull

# 3. 安装依赖（防范 package.json 变更引起编译失败）
echo "📦 正在更新安装项目依赖..."
pnpm install

# 4. 编译前端客户端 (client)
echo "🎨 正在编译前端代码 (client)..."
pnpm --filter client build

# 5. 编译后端服务 (server)
# (这步会自动触发 prebuild 并安全检查/下载敏感词词库)
echo "🖥️ 正在编译后端服务代码 (server)..."
pnpm --filter server build

# 6. 重启 PM2 进程
echo "🔄 正在重启 PM2 进程: messageboard-api..."
pm2 restart messageboard-api

# 7. 重新加载 Nginx 配置
echo "🌐 正在重新加载 Nginx 配置..."
sudo nginx -s reload

echo "=================================================="
echo "🎉 一键部署成功！新版服务与敏词库已全部就绪并重新加载。"
echo "=================================================="
