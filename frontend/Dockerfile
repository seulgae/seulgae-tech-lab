FROM node:24-alpine AS build
WORKDIR /build/frontend
ENV NODE_OPTIONS="--max-old-space-size=768"
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY shared /build/shared
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/frontend/dist /usr/share/nginx/html
EXPOSE 8080
