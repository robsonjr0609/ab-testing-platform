# Use official Node.js LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy all source files
COPY server/ ./server/
COPY client/ ./client/

# Set working directory to server
WORKDIR /app/server

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]
