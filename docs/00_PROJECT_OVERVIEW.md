# TOGEMUSIC_REACT 项目概览

## 项目简介
TOGEMUSIC_REACT 是一个多平台音乐聚合系统，支持 QQ 音乐、网易云音乐、酷狗音乐等多个音乐平台的歌曲搜索、播放列表导入、歌曲上传和播放功能。

## 技术栈

### 后端
- **框架**: Flask + Flask-SocketIO
- **数据库**: SQLite (文件: `backend/dao/db/musicdata.db`)
- **实时通信**: WebSocket (Socket.IO)
- **定时任务**: APScheduler
- **密码加密**: bcrypt
- **Token生成**: secrets (Python标准库)
- **音频元数据**: mutagen (MP3/FLAC)
- **云存储**: 腾讯云 COS (可选)
- **网易云加密**: pycryptodome (AES/MD5)

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router v6
- **HTTP客户端**: Axios
- **实时通信**: Socket.IO Client
- **音频播放**: HTML5 Audio API
- **元数据解析**: music-metadata-browser

### 部署
- **容器化**: Docker + Docker Compose
- **服务**: Frontend (14514) + Backend (8034) + Redis

## 目录结构

```
TOGEMUSIC_REACT/
├── backend/                    # 后端服务
│   ├── dao/                    # 数据访问层
│   │   ├── db/                 # SQLite数据库文件目录
│   │   ├── config.py           # 数据库配置
│   │   ├── sql_init.py         # 数据库初始化/表结构
│   │   ├── user.py             # 用户DAO
│   │   ├── song.py             # 歌曲DAO
│   │   ├── playlist.py         # 播放列表DAO
│   │   ├── cookie_pool.py      # Cookie池DAO
│   │   └── user_music_session.py # 用户音乐平台Session DAO
│   ├── server/                 # 服务层
│   │   ├── app.py              # Flask应用入口
│   │   ├── config.py           # 服务配置
│   │   ├── routes/             # API路由
│   │   │   ├── auth.py         # 认证路由 (登录/注册/Token验证)
│   │   │   ├── music.py        # 音乐路由 (歌曲/播放列表/上传)
│   │   │   └── cookie.py       # Cookie池管理 + 音乐平台登录
│   │   └── utils/              # 工具模块
│   │       ├── cos_storage.py  # 腾讯云COS存储封装
│   │       ├── qqmusic_tool.py # QQ音乐API工具
│   │       ├── netease_tool.py # 网易云音乐API工具
│   │       ├── netease_crypto.py # 网易云加密算法
│   │       ├── song_scheduler.py # 歌曲播放调度器
│   │       ├── password.py     # 密码加密工具
│   │       ├── token.py        # Token生成工具
│   │       └── puppeteer_login.py # Puppeteer自动化登录
│   ├── migrate_db.py           # 数据库迁移脚本
│   └── requirements.txt        # Python依赖
├── frontend/                   # 前端应用
│   └── src/
│       ├── main.tsx            # 应用入口 (Axios拦截器)
│       ├── App.tsx             # 根组件 (Context Provider)
│       ├── router/             # 路由配置
│       │   └── routes.tsx      # 路由定义
│       ├── pages/              # 页面组件
│       │   ├── LoginPage/      # 登录页面
│       │   └── HomePage/       # 主页
│       ├── components/         # 功能组件
│       │   ├── PlayerPage/     # 播放器页面
│       │   ├── PlaylistManager/# 播放列表管理
│       │   ├── UploadMusic/    # 音乐上传
│       │   ├── MusicLogin/     # 音乐平台登录
│       │   ├── HeaderTop/      # 顶部导航
│       │   ├── CoverImage/     # 封面图组件
│       │   ├── MessageBox/     # 消息提示
│       │   ├── FeatureSwitchBar/ # 功能切换栏
│       │   └── RegisterComponents/ # 注册组件
│       └── context/            # React Context
│           ├── AudioContext.tsx # 音频播放状态管理
│           ├── SocketContext.tsx # WebSocket连接管理
│           └── MessageContext.tsx # 全局消息提示
├── docs/                       # 项目文档 (本目录)
├── docker-compose.yml          # Docker编排配置
└── requirements.txt            # 根目录依赖 (引用backend)
```

## 核心功能模块

### 1. 用户认证模块
- 用户注册/登录
- Token验证 (50位随机Token)
- 角色权限管理 (user角色)

### 2. 音乐播放模块
- 歌曲播放 (HTML5 Audio)
- 播放列表管理 (默认播放列表 + 自定义歌单)
- 歌曲切换 (上一首/下一首/随机播放)
- 自动切歌 (后端定时器 + WebSocket广播)
- 音量控制
- 键盘快捷键 (PageUp/PageDown/Numpad)

### 3. 多平台音乐支持
- **QQ音乐**: Cookie池管理、歌曲搜索、播放列表导入
- **网易云音乐**: 加密API调用、歌曲搜索、播放列表导入
- **本地上传**: 分片上传、COS直传、元数据解析

### 4. 歌曲上传模块
- 本地文件上传 (分片上传)
- COS直传 (预签名URL)
- 元数据解析 (标题、艺术家、时长、封面)
- 文件格式支持: MP3, FLAC, WAV, OGG

### 5. Cookie池管理
- 多用户共享Cookie池
- VIP Cookie优先选择
- Cookie状态验证
- 自动过期检测

### 6. 在线用户管理
- 实时在线用户显示
- 随机颜色头像（基于用户名哈希）
- 在线用户为0时自动停止播放
- WebSocket实时同步

## 数据流概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   SQLite    │
│  (React)    │◀────│   (Flask)   │◀────│  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │ WebSocket         │ HTTP API
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Socket.IO │     │  Music APIs │
│   (实时)    │     │ (QQ/Netease)│
└─────────────┘     └─────────────┘
```

## 关键配置

### 环境变量 (后端)
- `BACKEND_PORT`: 后端端口 (默认: 8034)
- `CORS_ORIGINS`: CORS允许的源
- `STORAGE_BACKEND`: 存储后端 (cos/local)
- `COS_SECRET_ID/KEY/BUCKET/REGION`: COS配置
- `SOCKETIO_ASYNC_MODE`: SocketIO异步模式
- `SOCKETIO_MESSAGE_QUEUE`: Redis消息队列

### 端口配置
- Frontend: 14514
- Backend: 8034
- Redis: 6379

## 文档维护说明

本文档由AI维护，用于快速定位代码和理解项目结构。当代码发生重大变更时，应同步更新本文档。
