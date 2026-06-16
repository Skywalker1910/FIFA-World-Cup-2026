FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js app.js admin.js index.html admin.html styles.css README.md ./
COPY assets ./assets
COPY data/fixtures.js ./data/fixtures.js
COPY scripts ./scripts

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
