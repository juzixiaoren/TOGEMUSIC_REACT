# 1. 构建阶段
FROM node:20-alpine AS build
WORKDIR /frontend

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. 运行阶段（用 nginx 托管）
FROM nginx:alpine
COPY --from=build /frontend/dist /usr/share/nginx/html

# 将本地写好的复杂 Nginx 配置复制进去，替代 echo
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 14514