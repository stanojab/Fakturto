
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Potrebne sistemske knjižnice
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Produkcijske odvisnosti
COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# Že zgrajena aplikacija iz GitHub Actions
COPY dist/ ./dist/

# Mapa za dokumente
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "dist/server.js"]
