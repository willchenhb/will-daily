#!/bin/bash
set -e

# ============================================================
# Will Daily 一键部署脚本
#
# 用法：
#   1. 在阿里云买好 ECS（Ubuntu 22.04, 2核2G）
#   2. SSH 登录服务器
#   3. 运行：curl -fsSL https://raw.githubusercontent.com/你的用户名/will-daily/main/deploy.sh | bash
#      或者把这个脚本 scp 上去执行：bash deploy.sh
#
# 需要的信息（脚本会交互式询问）：
#   - Kimi API Key
#   - 域名（可选，没有就用 IP 访问）
# ============================================================

APP_DIR="/opt/will-daily"
BACKUP_DIR="/opt/backups/will-daily"

echo ""
echo "🎋 Will Daily 一键部署"
echo "================================"
echo ""

# ---- 检测系统 ----
if ! command -v apt &>/dev/null; then
  echo "❌ 仅支持 Ubuntu/Debian 系统"
  exit 1
fi

# ---- 收集配置 ----
read -rp "请输入 Kimi API Key (sk-...): " KIMI_KEY
read -rp "请输入域名 (没有直接回车，用 IP 访问): " DOMAIN
DOMAIN=${DOMAIN:-_}

echo ""
echo "📦 开始安装..."
echo ""

# ---- 1. 安装 Docker ----
if ! command -v docker &>/dev/null; then
  echo "▶ 安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker 已安装"
else
  echo "✅ Docker 已存在"
fi

# ---- 2. 安装 Nginx ----
if ! command -v nginx &>/dev/null; then
  echo "▶ 安装 Nginx..."
  apt update -qq
  apt install -y -qq nginx certbot python3-certbot-nginx >/dev/null 2>&1
  systemctl enable nginx
  echo "✅ Nginx 已安装"
else
  echo "✅ Nginx 已存在"
fi

# ---- 3. 创建目录 ----
mkdir -p "$APP_DIR" "$BACKUP_DIR"
cd "$APP_DIR"

# ---- 4. 检查代码 ----
if [ ! -f "Dockerfile" ]; then
  echo ""
  echo "⚠️  代码还没上传到 $APP_DIR"
  echo ""
  echo "请用以下方式之一上传代码，然后重新运行此脚本："
  echo ""
  echo "  方式A (Git):"
  echo "    cd $APP_DIR"
  echo "    git clone https://github.com/你的用户名/will-daily.git ."
  echo ""
  echo "  方式B (SCP, 在本地执行):"
  echo "    scp -r /path/to/will-daily/* root@服务器IP:$APP_DIR/"
  echo ""

  # 写入环境变量文件供后续使用
  cat > "$APP_DIR/.env.local" << EOF
DATABASE_URL="file:./data/daily.db"
AUTH_ENABLED=true
KIMI_API_KEY=${KIMI_KEY}
EOF
  echo "✅ 环境变量已写入 $APP_DIR/.env.local"
  exit 0
fi

# ---- 5. 写入环境变量 ----
cat > .env.local << EOF
DATABASE_URL="file:./data/daily.db"
AUTH_ENABLED=true
KIMI_API_KEY=${KIMI_KEY}
EOF

# Docker Compose 需要 .env 文件给环境变量
cat > .env << EOF
KIMI_API_KEY=${KIMI_KEY}
EOF

echo "✅ 环境变量已配置"

# ---- 6. 构建和启动 ----
echo "▶ 构建 Docker 镜像 (首次约 2-3 分钟)..."
docker compose down 2>/dev/null || true
docker compose up -d --build

echo "▶ 等待服务启动..."
sleep 8

# 检查健康
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ 服务已启动"
    break
  fi
  if [ "$i" = "5" ]; then
    echo "⚠️  服务可能还在启动中，请稍后检查: curl http://localhost:3000/api/health"
  fi
  sleep 3
done

# ---- 7. 配置 Nginx ----
if [ "$DOMAIN" = "_" ]; then
  SERVER_NAME="_"
  echo "▶ 配置 Nginx (IP 直接访问)..."
else
  SERVER_NAME="$DOMAIN"
  echo "▶ 配置 Nginx (域名: $DOMAIN)..."
fi

cat > /etc/nginx/sites-available/will-daily << EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/will-daily /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
echo "✅ Nginx 已配置"

# ---- 8. HTTPS (如果有域名) ----
if [ "$DOMAIN" != "_" ]; then
  echo "▶ 申请 SSL 证书..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "⚠️  SSL 证书申请失败，可能域名还没解析到此服务器"
    echo "  请确认 DNS 解析后运行: certbot --nginx -d $DOMAIN"
  }
fi

# ---- 9. 定时备份 ----
CRON_CMD="0 3 * * * docker cp will-daily-will-daily-1:/app/data/daily.db ${BACKUP_DIR}/daily-\$(date +\\%Y\\%m\\%d).db 2>/dev/null; find ${BACKUP_DIR} -name '*.db' -mtime +30 -delete"
(crontab -l 2>/dev/null | grep -v "will-daily"; echo "$CRON_CMD") | crontab -
echo "✅ 每日备份已配置 (凌晨3点, 保留30天)"

# ---- 10. 输出结果 ----
SERVER_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "================================"
echo "🎋 Will Daily 部署完成！"
echo "================================"
echo ""
if [ "$DOMAIN" != "_" ]; then
  echo "  访问地址: https://${DOMAIN}"
else
  echo "  访问地址: http://${SERVER_IP}"
fi
echo ""
echo "  默认账号: admin"
echo "  默认密码: admin123"
echo "  ⚠️  请登录后立即修改密码！"
echo ""
echo "  管理后台: /admin"
echo "  API Token: 登录后在管理后台查看"
echo ""
echo "  常用命令:"
echo "    查看日志:  cd $APP_DIR && docker compose logs -f"
echo "    重启服务:  cd $APP_DIR && docker compose restart"
echo "    停止服务:  cd $APP_DIR && docker compose down"
echo "    更新部署:  cd $APP_DIR && git pull && docker compose up -d --build"
echo "    手动备份:  docker cp will-daily-will-daily-1:/app/data/daily.db ~/daily-backup.db"
echo ""
