FROM node:18-alpine

RUN apk add --no-cache curl mysql-client

WORKDIR /app

COPY package*.json ./
RUN npm install --registry=https://registry.npmmirror.com

COPY . .

# 启动脚本在构建时写入 /usr/local/bin/（不受 volume 挂载影响）
RUN mkdir -p /usr/local/bin && \
    cp docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# 启动脚本：等 MySQL 就绪后再启动服务
ENTRYPOINT ["sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
