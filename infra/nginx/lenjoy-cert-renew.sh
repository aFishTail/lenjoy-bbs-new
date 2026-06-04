  #!/bin/sh
  set -e

  cd /opt/lenjoy/lenjoy-bbs/infra/docker

  docker run --rm \
    -v "$PWD/certbot/www:/var/www/certbot" \
    -v "$PWD/letsencrypt:/etc/letsencrypt" \
    certbot/certbot:v2.11.0 renew \
    --webroot -w /var/www/certbot \
    --quiet

  docker compose exec -T nginx nginx -s reload
