#!/bin/bash
set -e

DOMAIN="willchenhb.cc"
NGINX_CONF="/etc/nginx/sites-available/will-daily"

echo "🔒 为 ${DOMAIN} 配置 SSL"
echo "=========================="

# 1. 确保 certbot 已安装
if ! command -v certbot &>/dev/null; then
  echo "▶ 安装 certbot..."
  apt update -qq
  apt install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1
  echo "✅ certbot 已安装"
fi

if [ ! -f "$NGINX_CONF" ]; then
  echo "❌ Nginx 配置文件不存在: $NGINX_CONF"
  exit 1
fi

# 2. 先把 server_name 改成域名
echo "▶ 更新 Nginx server_name..."
sed -i "s/server_name .*;/server_name ${DOMAIN};/" "$NGINX_CONF"

# 确保有 acme-challenge 放行
if ! grep -q "acme-challenge" "$NGINX_CONF"; then
  sed -i '/location \/ {/i \
    location /.well-known/acme-challenge/ {\
        root /var/www/html;\
        allow all;\
    }\
' "$NGINX_CONF"
fi

mkdir -p /var/www/html/.well-known/acme-challenge
nginx -t && systemctl reload nginx
echo "✅ Nginx 已更新"

# 3. 用 webroot 模式申请证书（不让 certbot 改 nginx 配置）
echo "▶ 申请 SSL 证书 (webroot 模式)..."
certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
  --non-interactive --agree-tos --register-unsafely-without-email

# 4. 写入完整的 SSL nginx 配置
echo "▶ 配置 Nginx SSL..."
cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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

nginx -t && systemctl reload nginx

# 5. 验证
echo ""
echo "=========================="
echo "✅ SSL 配置完成！"
echo "  访问: https://${DOMAIN}"
echo "  HTTP 自动跳转 HTTPS"
echo ""
echo "  证书自动续期已由 certbot 配置 (systemctl list-timers certbot)"
echo ""
