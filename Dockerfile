FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production --ignore-scripts

# build stage
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

RUN bunx prisma generate

# map generated prisma -> @prisma/client
RUN mkdir -p node_modules/@prisma && \
    cp -r generated/prisma node_modules/@prisma/client

ENV NODE_ENV=production
RUN bun run build

# release stage
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/dist dist
COPY --from=prerelease /usr/src/app/generated generated
COPY --from=prerelease /usr/src/app/node_modules/@prisma node_modules/@prisma

USER bun
EXPOSE 4000

CMD ["bun", "run", "dist/src/main.js"]