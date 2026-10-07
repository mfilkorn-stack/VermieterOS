# syntax=docker/dockerfile:1.7
# App-Image (docs/PLAN.md 2.1): ein Image, zwei Startbefehle.
#   node apps/web/server.js   Web (Standard)
#   node db/dist/migrate.mjs  Migrationen mit der Besitzerrolle (einmalig je Deployment)
#   node worker/dist/worker.mjs  Worker: Mail-Abruf

FROM node:22-alpine AS basis
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM basis AS bau
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/ki/package.json packages/ki/
COPY packages/pdf/package.json packages/pdf/
COPY packages/post/package.json packages/post/
COPY packages/rechenkern/package.json packages/rechenkern/
COPY packages/schema/package.json packages/schema/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @vermieteros/web build \
 && pnpm --filter @vermieteros/db bundle:migrate \
 && pnpm --filter @vermieteros/worker bundle \
 && mkdir -p /aus/db /aus/worker \
 && cp -r packages/db/dist packages/db/migrations /aus/db/ \
 && cp -r apps/worker/dist /aus/worker/

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=bau /repo/apps/web/.next/standalone ./
COPY --from=bau /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=bau /aus/db ./db
COPY --from=bau /aus/worker ./worker
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/gesund || exit 1
CMD ["node", "apps/web/server.js"]
