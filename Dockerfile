FROM node:18

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./

RUN npm install --omit=optional --platform=linux --force

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]