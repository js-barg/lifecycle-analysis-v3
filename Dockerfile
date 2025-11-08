FROM node:20

WORKDIR /app

# Install Python and build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy everything
WORKDIR /app
COPY . .

# Install frontend dependencies and build
RUN cd /app && npm install && npx vite build

# Copy frontend build to backend
EOF ["node", "src/server.js"]& cp -r dist/* backend/public/
rm: cannot remove 'Dockerfile': No such file or directory
jsbarg@cloudshell:~/lifecycle-analysis-v3 (lifecycle-analysis-477518)$ cat Dockerfile | grep vite
RUN cd /app && npm install && npx vite build
jsbarg@cloudshell:~/lifecycle-analysis-v3 (lifecycle-analysis-477518)$ git add -f Dockerfile
jsbarg@cloudshell:~/lifecycle-analysis-v3 (lifecycle-analysis-477518)$ git push origin main
Username for 'https://github.com': js-barg
Password for 'https://js-barg@github.com': 
jsbarg@cloudshell:~/lifecycle-analysis-v3 (lifecycle-analysis-477518)$ cat Dockerfile
FROM node:20

WORKDIR /app

# Install Python and build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Copy everything
WORKDIR /app
COPY . .

# Install frontend dependencies and build
RUN cd /app && npm install && npx vite build

# Copy frontend build to backend
RUN mkdir -p backend/public && cp -r dist/* backend/public/

WORKDIR /app/backend

EXPOSE 8080
CMD ["node", "src/server.js"]
