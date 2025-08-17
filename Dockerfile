FROM oven/bun:latest

COPY package.json ./
COPY bun.lock ./
RUN bun install

COPY src ./

ENTRYPOINT [ "bun", "run", "main.ts" ]