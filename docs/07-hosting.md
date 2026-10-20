# 07 — Hosting

## 1. Target

| Item | Value |
|------|-------|
| Domain | `reflog.day` (owned, bought 2026-10-19) |
| App name | `app.reflog.day`. Keep the bare `reflog.day` free for a future landing page. |
| Host | A Mac or a small Linux box that is always on (example: Mac mini, Raspberry Pi 5). |
| App port | `127.0.0.1:8740` (not open to the network) |
| Public port | nginx on `443`, LAN only |
| Data | `~/reflog/data/reflog.db` and `~/reflog/data/backups/` |

## 2. DNS

Give the host a fixed LAN IP first (DHCP reservation on the router). Example: `192.168.1.20`.

Then select one option.

### Option 1 — public DNS record to the LAN IP (recommended, simplest)

1. Move the DNS of `reflog.day` to Cloudflare (free plan). Cloudflare has a good API for step 3.
2. Add this record. Set the proxy status to "DNS only" (grey cloud).

```
app.reflog.day.  A  192.168.1.20   ; LAN IP, not reachable from the internet
```

3. Make sure that the phone gets the answer: on the home Wi-Fi, open `https://app.reflog.day`.

The record shows your LAN IP to the public. This is low risk: a private IP is not reachable from the internet.

**Caution:** some routers and DNS filters block DNS answers with private IPs ("DNS rebind protection"). If the name does not resolve at home, allow `reflog.day` in the router rebind settings, or use option 2.

### Option 2 — local DNS override

Add the same `A` record in your local DNS server (router, Pi-hole, AdGuard Home or dnsmasq). Do not add it in public DNS.

## 3. TLS certificate

Use Let's Encrypt with the DNS-01 challenge. The challenge uses a DNS TXT record, so the host does not need to be reachable from the internet. The iPhone trusts the certificate, so you do not install anything on the phone.

1. In Cloudflare, make an API token with the permission `Zone → DNS → Edit` for `reflog.day` only.
2. On the host, install certbot and the plugin:

```bash
pip install certbot certbot-dns-cloudflare
```

3. Put the token in `~/.secrets/cloudflare.ini` and set its mode to `600`:

```ini
dns_cloudflare_api_token = <token>
```

4. Get the certificate:

```bash
certbot certonly --dns-cloudflare --dns-cloudflare-credentials ~/.secrets/cloudflare.ini -d app.reflog.day
```

5. Make sure that renewal runs automatically (`certbot renew` from cron or a systemd timer). After renewal, reload nginx with `--deploy-hook "nginx -s reload"`.

**Caution:** the API token can change the DNS of `reflog.day`. Give it access to this one zone only. Do not commit it to git.

Fallback (no internet DNS API): mkcert local CA with the name `reflog.home.arpa`. This needs a root CA profile on the iPhone (Settings → General → About → Certificate Trust Settings).

## 4. nginx

```nginx
server {
    listen 80;
    server_name app.reflog.day;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name app.reflog.day;

    ssl_certificate     /etc/letsencrypt/live/app.reflog.day/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.reflog.day/privkey.pem;

    # Allow only the local network.
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    allow 100.64.0.0/10;   # Tailscale, optional
    deny  all;

    location = /sw.js {
        proxy_pass http://127.0.0.1:8740;
        add_header Cache-Control "no-cache";
    }

    location / {
        proxy_pass http://127.0.0.1:8740;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 5. Run as a service

### 5.1 Linux (systemd)

```ini
# /etc/systemd/system/reflog.service
[Unit]
Description=reflog
After=network-online.target

[Service]
User=reflog
WorkingDirectory=/opt/reflog
ExecStart=/usr/bin/node server/dist/index.js
Environment=REFLOG_DATA=/var/lib/reflog
Environment=PORT=8740
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 5.2 macOS (launchd)

Use the template `deploy/day.reflog.app.plist`. It sets `RunAtLoad` and `KeepAlive`. The comment at the top gives the steps. The nginx and systemd templates are `deploy/nginx.conf` and `deploy/reflog.service`.

## 6. Use outside the home (optional)

Install Tailscale on the host and the phone. Add a Tailscale IP record (for example `app.reflog.day` in Tailscale split DNS), or use MagicDNS. Do not open port 443 on the router.

## 7. Update procedure

1. Run `git pull` on the host.
2. Run `npm ci && npm run build`.
3. Restart the service.
4. Open the PWA. The new service worker activates on the next open.

## 8. Docker and Portainer (alternative to §5)

The repository has a `Dockerfile` and a `docker-compose.yml`. The image holds the server and the built web app. All data is in the volume `reflog-data` (SQLite file, VAPID keys, daily backups). The image holds no secrets.

### 8.1 Deploy with Portainer

1. In Portainer, open your Docker environment. Go to **Stacks** → **Add stack**.
2. Name: `reflog`.
3. Build method: **Repository**.
4. Repository URL: `https://github.com/noorshikalgar/reflog.day`. Reference: `refs/heads/main`. Compose path: `docker-compose.yml`.
5. Environment variables (optional): `TZ` (default `Asia/Kolkata`), `REFLOG_PORT` (host port, default `8740`).
6. Click **Deploy the stack**. Portainer clones the repository and builds the image on the server.
7. Open **Containers** → `reflog` → **Logs**. Find the line `pairing code: 123456`.
8. Open `http://<server-ip>:8740` and type the code.

If your Portainer environment cannot build images (for example Docker Swarm), build on the server once: `docker compose build`, then deploy the stack.

### 8.2 Deploy without Portainer

```bash
git clone https://github.com/noorshikalgar/reflog.day.git reflog && cd reflog
docker compose up -d --build
docker compose logs reflog | grep "pairing code"
```

### 8.3 Update

- Portainer: open the stack → **Pull and redeploy** (turn on "re-pull image and redeploy" / re-build). The volume and the data stay.
- Without Portainer: `git pull && docker compose up -d --build`.

### 8.4 Back up the volume

The app makes a daily backup inside the volume (`/data/backups`). To copy everything off the server:

```bash
docker run --rm -v reflog_reflog-data:/data -v "$PWD":/out alpine tar czf /out/reflog-data.tgz -C /data .
```

The volume name has the stack name as a prefix (`reflog_reflog-data`). Check it with `docker volume ls`.

### 8.5 HTTPS

The container serves plain HTTP on port 8740. Put nginx (§4) or Nginx Proxy Manager in front of it for `https://app.reflog.day`. Point the proxy to `http://<server-ip>:8740` instead of `127.0.0.1:8740`. HTTPS is needed for the PWA service worker and Web Push.
