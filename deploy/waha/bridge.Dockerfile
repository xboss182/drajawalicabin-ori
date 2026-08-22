# Booking bridge (MNC-961) runtime image. Node stdlib only — zero npm deps.
# Build context is the repo's wa-bridge/ directory.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Run as non-root. The bridge holds WAHA + machine secrets in env; least privilege.
RUN addgroup -S bridge && adduser -S bridge -G bridge

COPY package.json ./
COPY src ./src
COPY assets ./assets

USER bridge

EXPOSE 8080

# No npm install needed: package.json has zero dependencies.
CMD ["node", "src/server.js"]
