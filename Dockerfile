FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN cd server && npm install
RUN cd client && npm install

COPY server server/
COPY client client/

RUN cd client && npm run build

RUN mkdir -p server/databases server/uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server/index.js"]
