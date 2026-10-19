FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY web ./web
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV PORT=8787 \
    HOST=0.0.0.0 \
    MATURA_DB=/data/matura.db \
    MATURA_IMAGES=/data/images

VOLUME ["/data"]
EXPOSE 8787

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
