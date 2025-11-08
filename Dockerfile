FROM node:20

WORKDIR /app

# Install Python and build tools for native dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy frontend package files and install ALL dependencies (including dev for build)
WORKDIR /app
COPY package*.json ./
RUN npm install --platform=linux

# Copy all source files (includes data directory)
COPY . .

# Build frontend (only once)
RUN npm run build

# Copy frontend build to backend public folder
RUN mkdir -p backend/public
RUN cp -r dist/* backend/public/

WORKDIR /app/backend

EXPOSE 8080
CMD ["node", "src/server.js"]
