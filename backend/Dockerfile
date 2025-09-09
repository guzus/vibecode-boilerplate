FROM node:22-slim

WORKDIR /srv

# Enable corepack for pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm i --frozen-lockfile --prod

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Run the application
EXPOSE 8080
CMD ["node", "dist/server.js"]