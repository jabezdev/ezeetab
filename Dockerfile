# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package.json and bun.lockb (if exists) before other files
# Utilizing Docker cache to save re-installing dependencies if unchanged
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all files
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
