FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY packages/contracts/src packages/contracts/src
COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src
COPY apps/server/scripts apps/server/scripts
COPY apps/dashboard/tsconfig.json apps/dashboard/vite.config.ts apps/dashboard/components.json apps/dashboard/index.html apps/dashboard/
COPY apps/dashboard/src apps/dashboard/src
RUN npm run build

FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm ci --omit=dev --workspace=@eousbot/server --workspace=@eousbot/contracts --include-workspace-root=false && npm cache clean --force

FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./package.json
COPY --from=dependencies /app/packages/contracts ./packages/contracts
COPY --from=dependencies /app/apps/server ./apps/server
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist
COPY --chmod=0555 docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',{signal:AbortSignal.timeout(4000)}).then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/server/dist/main.js"]
