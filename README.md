# TOGEMUSIC

多人共享音乐播放系统，支持 QQ 音乐搜索/导入、Cookie 池管理、VIP 歌曲自动重试。

## 项目结构

```
TOGEMUSIC_REACT/
├── frontend/          # React 前端
├── backend/           # Flask 后端
│   ├── server/        # 路由、工具函数
│   ├── dao/           # 数据访问层 (SQLite)
│   ├── venv/          # Python 虚拟环境
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## 快速开始

### 1. 启动后端

```sh
# 进入后端目录
cd backend

# 激活虚拟环境（macOS / Linux）
source venv/bin/activate

# Windows 激活虚拟环境
# venv\Scripts\activate

# 安装依赖（首次或依赖更新时执行）
pip install -r requirements.txt

# 启动服务
python -m server.app
```

后端默认运行在 `http://127.0.0.1:14514`。

### 2. 启动前端

```sh
# 新开一个终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

前端默认运行在 `http://localhost:5173`。

### 3. 退出虚拟环境

```sh
deactivate
```

## Docker 部署

```sh
docker-compose up -d
```

## 主要功能

- 音乐上传、播放、歌单管理
- QQ 音乐搜索 & 一键导入
- 共享 Cookie 池（多人贡献，自动验证）
- VIP Cookie 标记 & 歌曲获取失败时自动 VIP 重试
- Puppeteer 浏览器登录 QQ 音乐
