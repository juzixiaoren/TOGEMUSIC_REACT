# 06 功能模块索引

## 1. 概述

本文档是TOGEMUSIC_REACT项目的功能模块索引，旨在帮助AI快速定位到目标代码。文档按照功能模块组织，每个模块包含相关的前端组件、后端API、数据库表和工具函数。

**使用说明**:
1. 根据功能需求查找对应模块
2. 使用代码位置快速定位文件
3. 参考相关文档获取详细信息

## 2. 功能模块总览

| 模块 | 说明 | 前端组件 | 后端路由 | 数据库表 |
|------|------|----------|----------|----------|
| 用户认证 | 登录、注册、Token管理 | LoginPage, LoginContainer, RegisterContainer | auth.py | users, LOGIN_HISTORY, ROLE, USER_ROLE |
| 音乐播放 | 播放控制、进度同步 | PlayerPage, PlayerPanel, AudioContext | music.py | songs, playlists, playlist_songs, room_play_state |
| 多平台支持 | QQ音乐、网易云、酷狗 | DrawerSearchPanel, MusicLogin | music.py, cookie.py | cookie_pool, user_music_sessions |
| 歌曲上传 | 文件上传、元数据解析 | UploadMusic, UploadDropzone, UploadFileTable | music.py | songs |
| 歌单管理 | 歌单CRUD、歌曲管理 | PlaylistManager, PlaylistPanel | music.py | playlists, playlist_songs |
| Cookie池 | 共享Cookie管理 | MusicLogin | cookie.py | cookie_pool |
| 实时通信 | Socket.IO事件 | SocketContext | app.py | - |

## 3. 用户认证模块

### 3.1 功能说明
- 用户登录/注册
- Token认证
- 角色权限管理
- 登录历史记录

### 3.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| LoginPage | `frontend/src/pages/LoginPage/LoginPage.tsx` | 登录/注册页面 |
| LoginContainer | `frontend/src/components/LoginComponents/LoginContainer.tsx` | 登录表单 |
| RegisterContainer | `frontend/src/components/RegisterComponents/RegisterContainer.tsx` | 注册表单 |
| HeaderTop | `frontend/src/components/HeaderTop/HeaderTop.tsx` | 头部导航 |

### 3.3 后端API

**文件位置**: `backend/server/routes/auth.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| POST | `/auth/login` | 用户登录 | - |
| POST | `/auth/register` | 用户注册 | - |
| POST | `/auth/refresh` | 刷新Token | - |
| GET | `/auth/me` | 获取当前用户信息 | - |

### 3.4 数据库表

**文件位置**: `backend/dao/sql_init.py`

| 表名 | 功能 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | id, username, password_hash, role |
| `LOGIN_HISTORY` | 登录历史 | id, user_id, login_time, ip_address |
| `ROLE` | 角色表 | id, name, description |
| `USER_ROLE` | 用户角色关联 | user_id, role_id |

### 3.5 工具函数

**文件位置**: `backend/server/utils/`

| 函数 | 文件 | 功能 |
|------|------|------|
| `hash_password` | `password.py` | 密码哈希 |
| `verify_password` | `password.py` | 密码验证 |
| `generate_token` | `token.py` | 生成Token |
| `verify_token` | `token.py` | 验证Token |

### 3.6 数据流

```
用户输入凭据 → LoginPage → POST /auth/login
    ↓
后端验证密码 → 生成Token → 返回用户信息
    ↓
前端存储token和userId → navigate('/home')
    ↓
HomePage检查登录状态 → 显示功能页面
```

## 4. 音乐播放模块

### 4.1 功能说明
- 歌曲播放控制
- 播放进度同步
- 播放列表管理
- 多客户端同步

### 4.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| PlayerPage | `frontend/src/components/PlayerPage/PlayerPage.tsx` | 主播放页面 |
| PlayerPanel | `frontend/src/components/PlayerPage/PlayerPanel.tsx` | 播放控制面板 |
| PlaylistPanel | `frontend/src/components/PlayerPage/PlaylistPanel.tsx` | 播放列表面板 |
| AudioContext | `frontend/src/context/AudioContext.tsx` | 音频状态管理 |
| SocketContext | `frontend/src/context/SocketContext.tsx` | Socket连接管理 |

### 4.3 后端API

**文件位置**: `backend/server/routes/music.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| GET | `/songs` | 获取所有歌曲 | - |
| GET | `/songs/:id/file.:ext` | 获取歌曲文件 | - |
| GET | `/songs/:id/cover` | 获取歌曲封面 | - |
| POST | `/requestplay` | 请求播放 | - |
| GET | `/getplaystatus` | 获取播放状态 | - |
| POST | `/reorderPlaylist` | 重排播放列表 | - |
| GET | `/clearplaylist` | 清空播放列表 | - |
| POST | `/removesongfromplaylist` | 从播放列表移除歌曲 | - |
| GET | `/playlists/:id` | 获取播放列表 | - |
| GET | `/getAllPlaylists` | 获取所有播放列表 | - |
| POST | `/playlists/:id/songs` | 添加歌曲到播放列表 | - |

### 4.4 数据库表

**文件位置**: `backend/dao/sql_init.py`

| 表名 | 功能 | 关键字段 |
|------|------|----------|
| `songs` | 歌曲表 | id, title, artist, duration, file_path, file_extension |
| `playlists` | 播放列表表 | id, playlist_name, user_id |
| `playlist_songs` | 播放列表歌曲关联 | playlist_id, song_id, sort_order |
| `room_play_state` | 房间播放状态 | id, current_song_id, is_playing, play_start_time |

### 4.5 工具函数

**文件位置**: `backend/server/utils/`

| 函数 | 文件 | 功能 |
|------|------|------|
| `start_song_timer` | `song_scheduler.py` | 启动歌曲定时器 |
| `cancel_song_timer` | `song_scheduler.py` | 取消歌曲定时器 |
| `play_next_song` | `song_scheduler.py` | 播放下一首 |

### 4.6 Socket事件

**文件位置**: `backend/server/app.py`

| 事件名 | 方向 | 功能 |
|--------|------|------|
| `song_changed` | Server→Client | 歌曲切换 |
| `playlist_shuffled` | Server→Client | 播放列表打乱 |
| `song_deleted_and_changed` | Server→Client | 歌曲删除并切歌 |
| `playlist_updated` | Server→Client | 播放列表更新 |
| `sync_play_status` | Server→Client | 同步播放状态 |
| `sync_playlist` | Server→Client | 同步播放列表 |
| `request_next_song` | Client→Server | 请求下一首 |
| `request_prev_song` | Client→Server | 请求上一首 |
| `request_shuffle_playlist` | Client→Server | 请求随机播放 |

### 4.7 数据流

```
播放歌曲:
PlayerPage.startPlay() → POST /requestplay
    ↓
后端开始播放 → 启动定时器 → 广播song_changed
    ↓
前端接收事件 → AudioContext.playSong() → HTML5 Audio播放
    ↓
播放结束 → 触发ended事件 → 请求下一首
```

## 5. 多平台支持模块

### 5.1 功能说明
- QQ音乐搜索/导入
- 网易云音乐搜索/导入
- 酷狗音乐支持（计划中）
- 平台歌曲URL动态获取

### 5.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| DrawerSearchPanel | `frontend/src/components/PlayerPage/DrawerSearchPanel.tsx` | 搜索导入抽屉 |
| MusicLogin | `frontend/src/components/MusicLogin/MusicLogin.tsx` | 音乐平台登录 |

### 5.3 后端API

**文件位置**: `backend/server/routes/music.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| GET | `/qqmusic/search` | QQ音乐搜索 | - |
| POST | `/qqmusic/import` | QQ音乐导入 | - |
| GET | `/qqmusic/cover/:id` | QQ音乐封面 | - |
| GET | `/netease/search` | 网易云搜索 | - |
| POST | `/netease/import` | 网易云导入 | - |
| POST | `/songs/check-platform` | 检查平台歌曲是否存在 | - |

**文件位置**: `backend/server/routes/cookie.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| POST | `/music-login/:platform/init` | 初始化平台登录 | - |
| GET | `/music-login/:platform/status` | 获取登录状态 | - |
| POST | `/music-login/:platform/logout` | 退出登录 | - |
| GET | `/music-login/:platform/playlists` | 获取用户歌单 | - |
| GET | `/music-login/:platform/playlist-songs` | 获取歌单歌曲 | - |
| POST | `/music-login/:platform/import-playlist` | 导入歌单 | - |
| GET | `/cookie/count` | 获取Cookie数量 | - |
| GET | `/cookie/vip-count` | 获取VIP Cookie数量 | - |

### 5.4 数据库表

**文件位置**: `backend/dao/sql_init.py`

| 表名 | 功能 | 关键字段 |
|------|------|----------|
| `cookie_pool` | Cookie池 | id, platform, cookie, is_vip, user_id |
| `user_music_sessions` | 用户音乐平台会话 | id, user_id, platform, session_data |

### 5.5 工具函数

**文件位置**: `backend/server/utils/`

| 函数 | 文件 | 功能 |
|------|------|------|
| `search_songs` | `qqmusic_tool.py` | QQ音乐搜索 |
| `get_song_url` | `qqmusic_tool.py` | 获取QQ音乐URL |
| `get_song_cover` | `qqmusic_tool.py` | 获取QQ音乐封面 |
| `search_songs` | `netease_tool.py` | 网易云搜索 |
| `get_song_url` | `netease_tool.py` | 获取网易云URL |
| `weapi_encrypt` | `netease_crypto.py` | 网易云weapi加密 |
| `eapi_encrypt` | `netease_crypto.py` | 网易云eapi加密 |
| `launch_puppeteer` | `puppeteer_login.py` | 启动Puppeteer登录 |

### 5.6 数据流

**搜索流程**:
```
DrawerSearchPanel搜索 → GET /qqmusic/search
    ↓
后端使用共享Cookie → 调用平台API → 返回搜索结果
    ↓
前端显示结果 → 用户点击导入
    ↓
POST /qqmusic/import → 后端下载歌曲 → 保存到数据库
    ↓
POST /playlists/1/songs → 添加到播放列表
```

## 6. 歌曲上传模块

### 6.1 功能说明
- 音频文件上传
- 元数据解析
- 分片上传
- COS直传
- 封面提取

### 6.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| UploadMusic | `frontend/src/components/UploadMusic/UploadMusic.tsx` | 上传主组件 |
| UploadDropzone | `frontend/src/components/UploadMusic/UploadDropzone.tsx` | 拖拽上传区 |
| UploadFileTable | `frontend/src/components/UploadMusic/UploadFileTable.tsx` | 文件列表 |

### 6.3 后端API

**文件位置**: `backend/server/routes/music.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| POST | `/upload/init` | 初始化COS上传 | - |
| POST | `/upload/complete` | 完成COS上传 | - |
| POST | `/uploadchunkinit` | 初始化分片上传 | - |
| POST | `/uploadchunk` | 上传分片 | - |
| POST | `/uploadchunkmerge` | 合并分片 | - |

### 6.4 数据库表

**文件位置**: `backend/dao/sql_init.py`

| 表名 | 功能 | 关键字段 |
|------|------|----------|
| `songs` | 歌曲表 | id, title, artist, duration, file_path, file_extension, cover_path |

### 6.5 工具函数

**文件位置**: `backend/server/utils/`

| 函数 | 文件 | 功能 |
|------|------|------|
| `get_upload_presigned_url` | `cos_storage.py` | 获取上传预签名URL |
| `get_download_presigned_url` | `cos_storage.py` | 获取下载预签名URL |
| `upload_file` | `cos_storage.py` | 上传文件到COS |

### 6.6 上传模式

**COS直传模式**:
1. 前端获取预签名URL
2. 直接上传到COS
3. 通知后端完成

**分片上传模式**:
1. 初始化上传会话
2. 并发上传分片
3. 合并分片

### 6.7 数据流

**COS上传流程**:
```
UploadMusic选择文件 → 解析元数据
    ↓
POST /upload/init → 获取预签名URL
    ↓
XMLHttpRequest直传COS → 进度追踪
    ↓
POST /upload/complete → 保存到数据库
    ↓
可选: 添加到播放列表
```

## 7. 歌单管理模块

### 7.1 功能说明
- 歌单创建/编辑/删除
- 歌曲添加/移除
- 歌单排序
- 默认歌单（ID=1）

### 7.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| PlaylistManager | `frontend/src/components/PlaylistManager/PlaylistManager.tsx` | 歌单管理 |
| PlaylistPanel | `frontend/src/components/PlayerPage/PlaylistPanel.tsx` | 播放列表面板 |

### 7.3 后端API

**文件位置**: `backend/server/routes/music.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| GET | `/playlists` | 获取所有歌单 | - |
| GET | `/playlists/:id` | 获取歌单详情 | - |
| POST | `/playlists` | 创建歌单 | - |
| PUT | `/playlists/:id` | 更新歌单 | - |
| DELETE | `/playlists/:id` | 删除歌单 | - |
| POST | `/playlists/:id/songs` | 添加歌曲到歌单 | - |
| DELETE | `/playlists/:id/songs/:songId` | 从歌单移除歌曲 | - |

### 7.4 数据库表

**文件位置**: `backend/dao/sql_init.py`

| 表名 | 功能 | 关键字段 |
|------|------|----------|
| `playlists` | 播放列表表 | id, playlist_name, user_id |
| `playlist_songs` | 播放列表歌曲关联 | playlist_id, song_id, sort_order |

### 7.5 特殊设计

**默认播放列表**:
- ID固定为1
- 所有用户共享
- 用于主播放器

**"所有歌曲"歌单**:
- 虚拟歌单，ID=-1
- 包含系统所有歌曲
- 用于导入功能

## 8. Cookie池模块

### 8.1 功能说明
- 共享Cookie管理
- VIP Cookie优先选择
- Cookie有效性检测
- 多平台支持

### 8.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| MusicLogin | `frontend/src/components/MusicLogin/MusicLogin.tsx` | Cookie状态显示 |

### 8.3 后端API

**文件位置**: `backend/server/routes/cookie.py`

| 方法 | 路径 | 功能 | 行号 |
|------|------|------|------|
| GET | `/cookie/count` | 获取Cookie数量 | - |
| GET | `/cookie/vip-count` | 获取VIP Cookie数量 | - |
| POST | `/cookie/add` | 添加Cookie | - |
| DELETE | `/cookie/:id` | 删除Cookie | - |
| POST | `/cookie/refresh/:id` | 刷新Cookie | - |

### 8.4 数据库表

**文件位置**: `backend/dao/sql_init.py`

| 表名 | 功能 | 关键字段 |
|------|------|----------|
| `cookie_pool` | Cookie池 | id, platform, cookie, is_vip, user_id, created_at |

### 8.5 工具函数

**文件位置**: `backend/server/utils/`

| 函数 | 文件 | 功能 |
|------|------|------|
| `get_vip_cookie` | `cookie_pool.py` | 获取VIP Cookie |
| `get_random_cookie` | `cookie_pool.py` | 获取随机Cookie |
| `validate_cookie` | `cookie_pool.py` | 验证Cookie有效性 |

### 8.6 数据流

**Cookie使用流程**:
```
前端请求平台API
    ↓
后端从Cookie池获取Cookie
    ↓
优先选择VIP Cookie
    ↓
调用平台API
    ↓
失败则尝试其他Cookie
    ↓
返回结果
```

## 9. 实时通信模块

### 9.1 功能说明
- Socket.IO连接管理
- 播放状态同步
- 多客户端实时更新
- 事件广播

### 9.2 前端组件

| 组件 | 文件路径 | 功能 |
|------|----------|------|
| SocketContext | `frontend/src/context/SocketContext.tsx` | Socket连接管理 |

### 9.3 后端实现

**文件位置**: `backend/server/app.py`

**Socket.IO事件处理**:
- `connect`: 客户端连接
- `disconnect`: 客户端断开
- `request_next_song`: 请求下一首
- `request_prev_song`: 请求上一首
- `request_shuffle_playlist`: 请求随机播放

**广播事件**:
- `song_changed`: 歌曲切换
- `playlist_shuffled`: 播放列表打乱
- `song_deleted_and_changed`: 歌曲删除并切歌
- `playlist_updated`: 播放列表更新
- `sync_play_status`: 同步播放状态
- `sync_playlist`: 同步播放列表

### 9.4 数据流

**播放同步流程**:
```
客户端A请求播放 → POST /requestplay
    ↓
后端开始播放 → 广播song_changed
    ↓
所有客户端接收事件 → 更新播放状态
    ↓
客户端B同步播放 → 播放同一首歌
```

## 10. 工具函数索引

### 10.1 后端工具函数

**文件位置**: `backend/server/utils/`

| 模块 | 文件 | 主要功能 |
|------|------|----------|
| QQ音乐工具 | `qqmusic_tool.py` | QQ音乐API封装 |
| 网易云工具 | `netease_tool.py` | 网易云API封装 |
| 网易云加密 | `netease_crypto.py` | weapi/eapi加密 |
| COS存储 | `cos_storage.py` | 腾讯云COS操作 |
| 歌曲调度 | `song_scheduler.py` | 歌曲播放定时器 |
| 密码工具 | `password.py` | 密码哈希验证 |
| Token工具 | `token.py` | Token生成验证 |
| Puppeteer登录 | `puppeteer_login.py` | 自动化登录 |

### 10.2 前端工具函数

**文件位置**: `frontend/src/`

| 模块 | 文件 | 主要功能 |
|------|------|----------|
| Axios配置 | `main.tsx` | 拦截器、基础URL |
| 路由配置 | `router/routes.tsx` | 路由定义 |
| 消息管理 | `context/MessageContext.tsx` | 全局消息 |
| 音频管理 | `context/AudioContext.tsx` | 播放控制 |
| Socket管理 | `context/SocketContext.tsx` | 实时通信 |

## 11. 代码位置快速查找

### 11.1 按文件类型查找

**Python文件**:
- 路由: `backend/server/routes/*.py`
- DAO: `backend/dao/*.py`
- 工具: `backend/server/utils/*.py`
- 配置: `backend/server/config.py`, `backend/dao/config.py`

**TypeScript文件**:
- 页面: `frontend/src/pages/**/*.tsx`
- 组件: `frontend/src/components/**/*.tsx`
- Context: `frontend/src/context/*.tsx`
- 路由: `frontend/src/router/routes.tsx`

**CSS文件**:
- 全局: `frontend/src/index.css`, `frontend/src/styles/*.css`
- 组件: `frontend/src/components/**/*.css`
- 页面: `frontend/src/pages/**/*.css`

### 11.2 按功能查找

**用户认证**:
- 前端: `frontend/src/pages/LoginPage/`, `frontend/src/components/LoginComponents/`
- 后端: `backend/server/routes/auth.py`
- 数据库: `backend/dao/user.py`

**音乐播放**:
- 前端: `frontend/src/components/PlayerPage/`, `frontend/src/context/AudioContext.tsx`
- 后端: `backend/server/routes/music.py`, `backend/server/utils/song_scheduler.py`
- 数据库: `backend/dao/song.py`, `backend/dao/playlist.py`

**多平台支持**:
- 前端: `frontend/src/components/PlayerPage/DrawerSearchPanel.tsx`, `frontend/src/components/MusicLogin/`
- 后端: `backend/server/routes/music.py`, `backend/server/routes/cookie.py`
- 工具: `backend/server/utils/qqmusic_tool.py`, `backend/server/utils/netease_tool.py`

## 12. 维护指南

### 12.1 添加新功能模块

1. 在本文档中添加新模块章节
2. 更新功能模块总览表
3. 添加相关的前端组件、后端API、数据库表
4. 更新代码位置索引

### 12.2 更新现有模块

1. 更新对应模块的详细信息
2. 检查代码位置是否准确
3. 更新数据流说明
4. 同步更新相关文档

### 12.3 文档一致性检查

定期检查以下内容:
- 代码位置是否准确
- API端点是否完整
- 数据库表字段是否正确
- 数据流是否清晰

---

**最后更新**: 2026-06-10  
**维护者**: AI Assistant  
**文档版本**: 1.0