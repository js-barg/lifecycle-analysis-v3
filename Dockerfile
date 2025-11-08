FROM node:20

WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install ALL dependencies (frontend)
RUN npm install

# Install backend production dependencies
WORKDIR /app/backend
RUN npm install --production

# Back to app root
WORKDIR /app

# Copy all source files
COPY . .

# Build frontend (vite should be available now)
RUN ./node_modules/.bin/vite build

# Copy build to backend
RUN mkdir -p backend/public && cp -r dist/* backend/public/

WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "src/server.js"]
