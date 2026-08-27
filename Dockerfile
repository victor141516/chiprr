FROM oven/bun:latest

WORKDIR /app

COPY package.json ./
COPY bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src

ENTRYPOINT [ "bun", "run", "src/main.ts" ]
