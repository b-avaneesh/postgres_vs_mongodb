FROM node:20-alpine

WORKDIR /app

# 1. Copy root package files
COPY package*.json ./

# 2. Copy all package.json files first (best practice for layer caching)
COPY services/gateway/package*.json ./services/gateway/
COPY services/mongo/package*.json ./services/mongo/
COPY services/postgres/package*.json ./services/postgres/
# Ensure the shared package is included so npm install doesn't fail
COPY services/shared/package*.json ./services/shared/

# 3. Install all dependencies (installs root + all workspaces)
RUN npm install

# 4. Copy the entire source code
COPY . .

# 5. Expose Gateway, Mongo Proxy, and Postgres Proxy
EXPOSE 9000 8000 7000

# 6. Boot up concurrently
CMD ["npm", "run", "dev"]