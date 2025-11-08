FROM node:20

WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy and install frontend dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build frontend
COPY . .
RUN npm run build

# Copy data directory BEFORE building (so it's available)
COPY data ./data

# Build frontend
COPY . .
RUN npm run build

# Copy backend source
COPY backend/src ./backend/src

# Copy frontend build to backend public folder
RUN mkdir -p backend/public
RUN cp -r dist/* backend/public/

WORKDIR /app/backend

# Run the backend server (which will serve the frontend too)
EXPOSE 8080
CMD ["node", "src/server.js"]
