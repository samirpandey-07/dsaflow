# Use Node.js 20 as the base image for building
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from the root and the API package
# Since this is a monorepo, we only need the API package to be independent if we set it up that way.
# For simplicity in this Dockerfile, we assume it's run from the app directory.
COPY package*.json ./
RUN npm install

COPY . .

# Final stage
FROM node:20-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app ./

EXPOSE 3001

CMD ["node", "index.js"]
