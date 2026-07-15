FROM node:22-alpine AS builder

RUN apk add --no-cache openssl python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
COPY . .

# Generate Prisma client and build TypeScript
RUN npm run build:prod
RUN npm prune --production

FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
