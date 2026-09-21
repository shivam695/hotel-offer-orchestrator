FROM node:22-slim
WORKDIR /app

# Install packages first (Docker remembers this step, so rebuilds are faster)
COPY package*.json ./
RUN npm ci

# Copy our code
COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000

# Default: run the API. The worker overrides this in docker-compose.yml
CMD ["npx", "tsx", "src/server.ts"]