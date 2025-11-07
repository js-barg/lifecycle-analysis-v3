FROM node:18

WORKDIR /app

# Copy only package.json (not package-lock.json)
COPY package.json ./
COPY .npmrc ./

# Fresh install without lock file
RUN npm install --platform=linux

COPY . .

# Build the frontend
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]