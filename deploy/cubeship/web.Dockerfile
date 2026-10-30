# Next.js app (kiosk, kitchen, back office and BFF) for Cubeship. Build context: repo root.
# Not standalone: the service worker route builds sw.js at runtime with esbuild, a
# devDependency (COM-21), so the full node_modules ships until that is paid.
FROM node:24-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY contract /repo/contract
COPY apps/web ./
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA
RUN npm run build

FROM node:24-slim
ARG GIT_SHA=""
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 GIT_SHA=$GIT_SHA
WORKDIR /repo/apps/web
COPY --from=build --chown=node:node /repo/apps/web ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start"]
