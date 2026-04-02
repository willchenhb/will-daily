#!/bin/bash
set -e

DOMAIN="willchenhb.cc"

echo "🔒 为 ${DOMAIN} 配置 SSL"
echo "=========================="

# 1. 确保 certbot 已安装
if ! command -v certbot &>/dev/null; then
  echo "▶ 安装 certbot..."
  apt update -qq
  apt install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1
  echo "✅ certbot 已安装"
fi

# 2. 创建验证目录
mkdir -p /var/www/html/.well-known/acme-challenge

# 3. 修改 nginx 配置，添加 acme-challenge 放行
NGINX_CONF="/etc/nginx/sites-available/will-daily"

if [ ! -f "$NGINX_CONF" ]; then
  echo "❌ Nginx 配置文件不存在: $NGINX_CONF"
  exit 1
fi

# 如果还没有 acme-challenge 配置就加上
if ! grep -q "acme-challenge" "$NGINX_CONF"; then
  echo "▶ 添加 acme-challenge 验证路径..."
  sed -i '/location \/ {/i \
    location /.well-known/acme-challenge/ {\
        root /var/www/html;\
        allow all;\
    }\
' "$NGINX_CONF"
  echo "✅ Nginx 配置已更新"
fi

# 4. 测试并重载 nginx
echo "▶ 重载 Nginx..."
nginx -t
systemctl reload nginx

# 5. 验证 80 端口可访问
echo "▶ 检查 80 端口..."
if curl -sf -o /dev/null http://127.0.0.1/.well-known/acme-challenge/; then
  echo "✅ 验证路径可访问"
else
  echo "⚠️  验证路径返回非 200，但可能正常（目录为空时 403 是预期的）"
fi

# 6. 申请证书
echo "▶ 申请 SSL 证书..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email

# 7. 验证结果
echo ""
echo "=========================="
echo "✅ SSL 配置完成！"
echo "  访问: https://${DOMAIN}"
echo ""
certbot certificates --domain "$DOMAIN" 2>/dev/null || true
