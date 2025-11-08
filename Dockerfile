FROM node:18-alpine

WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy and install frontend dependencies
WORKDIR /app
COPY package*.json ./
# Use npm install with platform flag instead of npm ci
RUN npm install --platform=linux --omit=dev

# Build frontend
COPY . .
RUN npm run build

# Copy backend source
COPY backend/src ./backend/src

# Copy frontend build to backend public folder
RUN mkdir -p backend/public
RUN cp -r dist/* backend/public/

WORKDIR /app/backend

# Run the backend server
EXPOSE 8080
CMD ["node", "src/server.js"]