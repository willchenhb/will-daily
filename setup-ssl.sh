#!/bin/bash
set -e

DOMAIN="willchenhb.cc"
NGINX_CONF="/etc/nginx/sites-available/will-daily"
SSL_CERT="/etc/nginx/ssl/${DOMAIN}.pem"
SSL_KEY="/etc/nginx/ssl/${DOMAIN}.key"

echo "🔒 为 ${DOMAIN} 配置 SSL (阿里云证书)"
echo "=========================="

# 1. 检查证书文件
if [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
  echo "❌ 证书文件不存在，请先上传："
  echo "   ${SSL_CERT}"
  echo "   ${SSL_KEY}"
  exit 1
fi
echo "✅ 证书文件已就绪"

if [ ! -f "$NGINX_CONF" ]; then
  echo "❌ Nginx 配置文件不存在: $NGINX_CONF"
  echo "   请先运行 deploy.sh 完成基础部署"
  exit 1
fi

# 2. 写入完整的 SSL nginx 配置
echo "▶ 配置 Nginx SSL..."
cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

# 3. 验证
echo ""
echo "=========================="
echo "✅ SSL 配置完成！"
echo "  访问: https://${DOMAIN}"
echo "  HTTP 自动跳转 HTTPS"
echo ""
echo "  注意: 阿里云证书到期前需手动更新，到期时间请在阿里云控制台查看"
echo ""
