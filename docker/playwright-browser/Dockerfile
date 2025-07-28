FROM mcr.microsoft.com/playwright:v1.54.1-jammy

WORKDIR /app

# Copy server file
COPY docker/playwright-browser/server.js ./

# Install dependencies with exact versions to match the base image
RUN npm init -y && \
    npm install express@^4.18.2 playwright@1.54.1 --no-save

# Expose the API port
EXPOSE 3000

# Force headless mode in Docker environment
ENV HEADLESS=true

# Start the browser API server
CMD ["node", "server.js"] 