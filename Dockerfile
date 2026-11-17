# Chance Signal Hub — multi-stage production image (static SPA)
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV HOST=0.0.0.0

RUN npm install -g serve@14.2.4

COPY --from=builder /app/dist ./dist

EXPOSE 10000

CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-10000}"]
