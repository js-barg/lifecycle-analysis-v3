FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use npm install instead of npm ci, with platform flag
RUN npm install --omit=optional --platform=linux --force

COPY . .
RUN npm run build

# Continue with rest of Dockerfile...