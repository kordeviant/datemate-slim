# Deployment & Getting Started Guide

This guide covers local development setup, environment configuration, and production deployment for the **DateMate Backend**.

---

## 1. Prerequisites

- **Node.js**: `v20.x` LTS or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For local PostgreSQL, Redis, and Elasticsearch containers
- **Git**: For version control

---

## 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Key environment variables:
```ini
# Application
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/datemate?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets
JWT_ACCESS_SECRET="your-access-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"

# Media Storage
UPLOAD_DIR="./uploads"

# Firebase Cloud Messaging
FIREBASE_SERVICE_ACCOUNT_KEY="./firebase-service-account.json"

# Zarinpal Gateway
ZARINPAL_MERCHANT_ID="your-merchant-id"
```

---

## 3. Local Development

### 3.1 Start Backing Services
```bash
docker compose up -d
```

### 3.2 Install Dependencies & Seed Database
```bash
npm install
npx prisma migrate dev
npx prisma db seed
```

### 3.3 Run Development Server
```bash
npm run start:dev
```
The API server will listen on `http://localhost:3000` and Socket.IO on `ws://localhost:3000`.

---

## 4. Reverse Proxy & HTTPS (Nginx)

DateMate uses an **Nginx** reverse proxy configured with **HTTPS/TLS**, HTTP-to-HTTPS redirect (301), Gzip compression, and WebSocket (Socket.IO) forwarding.

### 4.1 Generate Local SSL Certificates
For local development and testing, generate a self-signed certificate with SAN (Subject Alternative Name) for `localhost` and `127.0.0.1`:
```bash
cd backend/nginx
./generate-certs.sh
```
This generates `certs/fullchain.pem` and `certs/privkey.pem`.

### 4.2 Start Nginx
```bash
docker compose up -d nginx
```

Nginx will listen on:
- **Port 80 (HTTP)**: Automatically redirects to `https://$host$request_uri` (301 Permanent Redirect) and handles ACME challenge renewals (`/.well-known/acme-challenge/`).
- **Port 443 (HTTPS)**: Proxies all API and WebSocket traffic with HTTP/2 and modern TLS protocols (`TLSv1.2 TLSv1.3`).

### 4.3 Production SSL with Let's Encrypt / Certbot
In production, obtain certificates for your domain:
```bash
certbot certonly --webroot -w /var/www/certbot \
  -d api.datemate.com \
  --email admin@datemate.com \
  --agree-tos --no-eff-email
```
Mount the Let's Encrypt certificate directory (`/etc/letsencrypt/live/api.datemate.com/`) to `/etc/nginx/certs/` in `docker-compose.yml`.

---

## 5. Production Deployment

### 5.1 Build
```bash
npm run build
```

### 5.2 Start Production Server
```bash
npm run start:prod
```

### 5.3 Process Management (PM2)
```bash
pm2 start dist/main.js --name "datemate-backend" -i max
pm2 save
```
