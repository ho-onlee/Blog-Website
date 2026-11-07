FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libstdc++
COPY --from=build /app/node_modules ./node_modules
COPY package.json package-lock.json server.js database.js ./
ENV NODE_ENV=production PORT=3001 DATA_DIR=/app/data
EXPOSE 3001
CMD ["npm", "start"]