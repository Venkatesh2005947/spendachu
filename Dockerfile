FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install

COPY server/ ./server/

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
