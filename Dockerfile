FROM node:20-alpine

WORKDIR /app

# Install native dependencies required by Prisma and Sharp
RUN apk add --no-cache openssl postgresql-client libc6-compat

# Copy package manifests and Prisma schema first for layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript to dist
RUN npm run build

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 2020

CMD ["node", "dist/src/main.js"]
