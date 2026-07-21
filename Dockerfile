# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Embrace Health Grid — Multi-Stage Dockerfile                              ║
# ║                                                                              ║
# ║  Stage 1 (builder):  Install deps + build Vite frontend                    ║
# ║  Stage 2 (backend):  Lean Node.js image for the REST/WS API               ║
# ║  Stage 3 (frontend): Nginx to serve static assets (optional standalone)   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ─── Base image ───────────────────────────────────────────────────────────────
ARG NODE_VERSION=22-alpine
FROM node:${NODE_VERSION} AS base
WORKDIR /app

# ─── Stage 1: Install all dependencies ───────────────────────────────────────
FROM base AS deps
# Copy root manifests
COPY package.json package-lock.json .npmrc ./
# Copy backend manifests
COPY backend/package.json backend/package-lock.json ./backend/
# Copy admin-portal manifests (if present)
COPY admin-portal/package.json admin-portal/package-lock.json* ./admin-portal/

# Install root deps (frontend build tooling)
RUN npm ci --ignore-scripts

# Install backend deps
RUN cd backend && npm ci --ignore-scripts --omit=dev

# ─── Stage 2: Build the frontend ──────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Vite frontend (output → dist/)
ARG VITE_API_BASE_URL=http://localhost:3001
ARG VITE_CONVEX_URL=""
ARG VITE_CLIENT_KEY=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_CONVEX_URL=${VITE_CONVEX_URL}
ENV VITE_CLIENT_KEY=${VITE_CLIENT_KEY}

RUN npm run build

# ─── Stage 3: Backend (Node.js API) ──────────────────────────────────────────
FROM node:${NODE_VERSION} AS backend
LABEL org.opencontainers.image.title="Embrace Health Grid — Backend"
LABEL org.opencontainers.image.description="Hospital REST API + WebSocket server"
LABEL org.opencontainers.image.version="1.0.0"

WORKDIR /app/backend

# Copy backend source
COPY backend/ .

# Copy production deps (already installed in deps stage)
COPY --from=deps /app/backend/node_modules ./node_modules

# Copy convex schema (shared types)
COPY --from=builder /app/convex ./convex

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Kubernetes / Docker health check (calls the liveness endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]

# ─── Stage 4: Frontend (Nginx static files) ──────────────────────────────────
FROM nginx:1.27-alpine AS frontend
LABEL org.opencontainers.image.title="Embrace Health Grid — Frontend"
LABEL org.opencontainers.image.description="Vite/React SPA served via Nginx"

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config: SPA fallback + gzip + security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
