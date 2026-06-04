# HTTPS 证书部署方案

适用项目：`lenjoy-bbs`

适用域名：`www.lxziyuan.site`

## 1. 当前项目部署结构

本项目生产入口在 Docker Compose 中：

```text
infra/docker/docker-compose.yml
```

Nginx 配置文件在：

```text
infra/nginx/default.conf
```

当前反向代理链路是：

```text
公网 80/443
  -> nginx 容器
    -> web:3000
    -> api:8080
    -> minio:9000
```

因此 HTTPS 证书方案采用：

- Nginx 容器负责公网 HTTP/HTTPS 入口
- Let’s Encrypt 签发免费证书
- Certbot 使用 Docker 容器运行
- 证书保存在宿主机 `infra/docker/letsencrypt`
- ACME HTTP-01 校验文件保存在 `infra/docker/certbot/www`

## 2. 前置条件

域名 DNS 需要配置：

```text
www.lxziyuan.site  A  服务器公网 IP
```

服务器安全组和防火墙需要放通：

```bash
80/tcp
443/tcp
```

如果服务器启用了 UFW：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

注意：Let’s Encrypt 普通 HTTP-01 证书依赖域名，不建议按纯 IP 部署 HTTPS。

## 3. 已调整的项目配置

`infra/docker/docker-compose.yml` 中的 `nginx` 服务已增加：

```yaml
ports:
  - "80:80"
  - "443:443"
volumes:
  - ../nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
  - ./certbot/www:/var/www/certbot:ro
  - ./letsencrypt:/etc/letsencrypt:ro
```

`infra/nginx/default.conf` 已设置：

```nginx
server_name www.lxziyuan.site;

location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

当前仓库内的 Nginx 配置是“证书签发阶段”配置：只启用 HTTP 和 ACME 校验，不直接启用 443。这样可以避免证书还不存在时，Nginx 因找不到证书文件而启动失败。

## 4. 启动 Nginx 并自检 ACME 目录

在服务器上进入 compose 目录：

```bash
cd /opt/lenjoy/lenjoy-bbs/infra/docker
```

创建证书和校验目录：

```bash
mkdir -p certbot/www letsencrypt
```

启动服务：

```bash
docker compose up -d
docker compose exec nginx nginx -t
docker compose restart nginx
```

创建测试文件：

```bash
mkdir -p certbot/www/.well-known/acme-challenge
echo ok > certbot/www/.well-known/acme-challenge/ping
```

从公网测试：

```bash
curl -i http://www.lxziyuan.site/.well-known/acme-challenge/ping
```

必须返回 `ok`。如果不能返回，先检查：

- 域名是否已解析到当前服务器公网 IP
- 云厂商安全组是否放通 80
- 本机防火墙是否放通 80
- `docker compose ps` 中 nginx 是否正常运行

## 5. 申请 Let’s Encrypt 证书

在 `infra/docker` 目录执行：

```bash
cd /opt/lenjoy/lenjoy-bbs/infra/docker

docker run --rm \
  -v "$PWD/certbot/www:/var/www/certbot" \
  -v "$PWD/letsencrypt:/etc/letsencrypt" \
  certbot/certbot:v2.11.0 certonly \
  --webroot -w /var/www/certbot \
  -d www.lxziyuan.site \
  --email 1765174487@qq.com \
  --agree-tos \
  --no-eff-email \
  --non-interactive
```

成功后证书文件会出现在：

```text
infra/docker/letsencrypt/live/www.lxziyuan.site/fullchain.pem
infra/docker/letsencrypt/live/www.lxziyuan.site/privkey.pem
```

## 6. 签发成功后启用 HTTPS

证书签发成功后，将 `infra/nginx/default.conf` 替换为以下配置：

```nginx
server {
    listen 80;
    server_name www.lxziyuan.site;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name www.lxziyuan.site;
    client_max_body_size 20m;

    ssl_certificate /etc/letsencrypt/live/www.lxziyuan.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.lxziyuan.site/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    location /api/v1/ {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /swagger-ui {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /v3/api-docs {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /lenjoy-bbs/ {
        proxy_pass http://minio:9000/lenjoy-bbs/;
        proxy_http_version 1.1;
        proxy_set_header Host minio:9000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

验证并重启 Nginx：

```bash
cd /opt/lenjoy/lenjoy-bbs/infra/docker

docker compose exec nginx nginx -t
docker compose restart nginx
```

验证 HTTPS：

```bash
curl -I https://www.lxziyuan.site
```

## 7. 自动续期

Let’s Encrypt 证书默认 90 天有效。建议使用 root crontab 每天凌晨尝试续期：

```bash
sudo crontab -e
```

添加：

```bash
0 3 * * * cd /opt/lenjoy/lenjoy-bbs/infra/docker && docker run --rm -v "$PWD/certbot/www:/var/www/certbot" -v "$PWD/letsencrypt:/etc/letsencrypt" certbot/certbot:v2.11.0 renew --webroot -w /var/www/certbot --quiet && docker compose exec -T nginx nginx -s reload
```

续期命令只有在证书接近过期时才会真正更新证书。

## 8. 生产环境变量建议

生产环境 `.env` 建议使用：

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_SERVER_BASE_URL=http://api:8080
MINIO_PUBLIC_BASE_URL=/lenjoy-bbs
```

如果这些变量参与前端构建，修改后需要重新构建：

```bash
cd /opt/lenjoy/lenjoy-bbs/infra/docker
docker compose up -d --build
```

## 9. 常见问题

### Nginx 启动失败，提示找不到证书

说明提前启用了 443 配置，但证书还没有签发成功。先使用仓库当前的 HTTP/ACME 配置，签发成功后再切换到 HTTPS 配置。

### ACME 自检不能返回 ok

优先检查：

```bash
docker compose ps
docker compose logs nginx --tail=100
```

然后确认 DNS、安全组、防火墙和 `certbot/www` 挂载路径。

### 是否需要配置 lxziyuan.site 裸域

当前方案只配置 `www.lxziyuan.site`。如果需要 `lxziyuan.site` 也可访问，需要先添加裸域 A 记录，然后证书命令改为：

```bash
-d lxziyuan.site -d www.lxziyuan.site
```

Nginx 中也要改成：

```nginx
server_name lxziyuan.site www.lxziyuan.site;
```
