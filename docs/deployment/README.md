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
- **Port 80 (HTTP)**: Handles ACME challenges (`/.well-known/acme-challenge/`) and domain routing.
- **Port 443 (HTTPS)**: Proxies traffic with HTTP/2 and modern TLS protocols:
  - `api-datemate.testdevvvv.site`: Reverse proxies to DateMate Backend (NestJS, port 2020).
  - `dl-datemate.testdevvvv.site`: Reverse proxies to DateMate Downloads Server (Docker container, port 5454) with streaming buffering disabled for high-throughput geographic file downloads.

### 4.3 Geographic Database Seeding
To populate `countries`, `states`, and `cities` for location validation matching the download service:
```bash
npx ts-node prisma/seed-geo.ts
```
This reads `countries.json`, `states.json`, and `cities.json` and seeds 250 countries, 5,308 states, and 152,970 cities into PostgreSQL.

### 4.4 Production SSL with Let's Encrypt / Certbot
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

---

## 6. CI/CD Automated Deployment (`.gitlab-ci.yml`)

The repository includes a GitLab CI/CD pipeline that automates testing, Docker container management, and zero-downtime server deployments:

### 6.1 Pipeline Stages
1. **`test` Stage**:
   - Runs `npm ci`, `npx prisma generate`, `npm test`, and `npm run build`.
   - Ensures all unit/integration tests pass and the TypeScript build succeeds before any deployment is triggered.

2. **`deploy` Stage (on `main` branch)**:
   - Connects to the production server via SSH using `$SSH_PRIVATE_KEY`.
   - Fetches and resets to the latest `origin/main`.
   - **Starts or updates Docker backing services**: Runs `docker compose up -d --remove-orphans` to ensure PostgreSQL, Redis, and Nginx containers are running and recreated if configurations changed.
   - **Waits for database readiness**: Checks PostgreSQL connectivity before running migrations.
   - **Runs database migrations**: Executes `npx prisma migrate deploy` safely.
   - **Generates Prisma client & builds project**: Executes `npx prisma generate && npm run build`.
   - **Zero-downtime reload**: Executes `pm2 reload datemate-backend` (or falls back to `restart`/`start`) and saves PM2 state.
   - **Nginx configuration reload**: Safely reloads the Nginx container (`docker exec datemate_nginx nginx -s reload`).

### 6.2 Required CI/CD Variables
In GitLab (Settings > CI/CD > Variables):
- `SERVER_IP`: Target production host IP address.
- `SERVER_USER`: SSH username (e.g. `datemate` or `root`).
- `SSH_PRIVATE_KEY`: Private SSH key for server access.
- `SSH_PORT`: (Optional, defaults to `22`).
- `DEPLOY_DIR`: Target deployment directory on the server (e.g. `~/backend`).

### 6.3 Applying Pending Database Migrations
The production release must run `npx prisma migrate deploy` against the same database configured for the backend before restarting the application. For a manual recovery, run the migration from the deployed backend directory, then regenerate the Prisma client, rebuild, and reload the service:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 reload datemate-backend
```

This applies the `profiles.profile_picture_url` schema change required by `Profile.profilePictureUrl`; regenerating the client or restarting the process alone does not add the database column.
