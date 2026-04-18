FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .

EXPOSE 5000
CMD ["npm", "start"]
