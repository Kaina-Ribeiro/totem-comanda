# Stateful mock Core API behind Prism, standing in for the Go API until it exists.
# Build context: repo root. Prism (validated against contract/openapi.yaml) on 4010, the
# mock's own port (media, kitchen stream) on 4020.
FROM node:24-slim
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
# Prism is a devDependency, so install before NODE_ENV=production.
RUN npm ci
ENV NODE_ENV=production PRISM_HOST=0.0.0.0
COPY contract /repo/contract
COPY docs/prototype/assets /repo/docs/prototype/assets
COPY apps/web/mock ./mock
RUN chown -R node:node /repo
USER node
EXPOSE 4010 4020
CMD ["node", "mock/server.ts"]
