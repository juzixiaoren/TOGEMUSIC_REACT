# TogeMusic 快速部署

## 前置要求

- Docker
- Docker Compose

## 快速开始

1. 进入 build 目录：
   ```bash
   cd build
   ```

2. 复制配置文件并填写：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件填写配置
   ```

3. 启动服务：
   ```bash
   docker compose up -d
   ```

4. 访问应用：
   - 前端：http://localhost:14514
   - 后端 API：http://localhost:8034

## 数据持久化

- 数据库文件：`./data/db/`
- 上传文件：`./data/uploads/`

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新镜像
docker compose pull
docker compose up -d
```

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| QQMUSIC_COOKIE | QQ音乐Cookie（可选） | - |
| STORAGE_BACKEND | 存储后端（cos/local） | cos |
| COS_SECRET_ID | 腾讯云COS Secret ID | - |
| COS_SECRET_KEY | 腾讯云COS Secret Key | - |
| COS_BUCKET | 腾讯云COS存储桶名称 | - |
| COS_REGION | 腾讯云COS区域 | ap-guangzhou |
| COS_PRESIGN_EXPIRE | COS签名URL有效期（秒） | 3600 |
