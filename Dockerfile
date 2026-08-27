FROM node:20-alpine AS lib-builder
WORKDIR /repo/mitto-lib-ts-orm
COPY mitto-lib-ts-orm/package.json mitto-lib-ts-orm/package-lock.json ./
RUN npm ci
COPY mitto-lib-ts-orm/ ./
RUN npm run build

FROM node:20-alpine AS builder
WORKDIR /repo/mitto-api
COPY mitto-api/package.json mitto-api/package-lock.json ./
COPY --from=lib-builder /repo/mitto-lib-ts-orm /repo/mitto-lib-ts-orm
RUN npm install --install-links
COPY mitto-api/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/mitto-api/dist ./dist
COPY --from=builder /repo/mitto-api/node_modules ./node_modules
COPY --from=builder /repo/mitto-api/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
