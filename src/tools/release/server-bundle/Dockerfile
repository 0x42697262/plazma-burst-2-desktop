FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY dist/ /app/dist/
RUN mkdir -p /app/game /app/data/server /app/data/maps && chown -R node:node /app
USER node
EXPOSE 2053
CMD ["node", "dist/server/server.cjs"]
