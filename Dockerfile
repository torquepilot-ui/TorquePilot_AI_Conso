# ── Étape 1 : Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Étape 2 : Image de production ────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3026
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root pour la sécurité
RUN addgroup -S torquepilot && adduser -S torquepilot -G torquepilot

# Copier uniquement les fichiers nécessaires depuis le builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Dossier data pour SQLite (volume Docker monté ici)
RUN mkdir -p /app/data && chown torquepilot:torquepilot /app/data

USER torquepilot
EXPOSE 3026
CMD ["node", "server.js"]
