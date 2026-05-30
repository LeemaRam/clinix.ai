FROM node:20-alpine AS build
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Create non-root user
FROM node:20-alpine AS production
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files
COPY --from=build --chown=nextjs:nodejs /app/package.json /app/package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy application code
COPY --from=build --chown=nextjs:nodejs /app/src ./src
COPY --from=build --chown=nextjs:nodejs /app/uploads ./uploads

# Create uploads directory with proper permissions
RUN mkdir -p uploads/audio uploads/reports && \
    chown -R nextjs:nodejs uploads

# Switch to non-root user
USER nextjs

EXPOSE 5000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
