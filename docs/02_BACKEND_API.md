# 后端API接口文档

## 基础信息
- **基础URL**: `/api`
- **认证方式**: Token (Authorization Header)
- **数据格式**: JSON
- **后端端口**: 8034

## API蓝图列表

| 蓝图 | 文件 | 前缀 | 功能 |
|------|------|------|------|
| auth_bp | `backend/server/routes/auth.py` | `/` | 用户认证 |
| music_bp | `backend/server/routes/music.py` | `/` | 音乐管理 |
| cookie_bp | `backend/server/routes/cookie.py` | `/` | Cookie池管理 |

---

## 1. 认证接口 (auth.py)

### 1.1 用户登录
**POST** `/login`

**请求体**:
```json
{
  "userId": "string",  // 用户名
  "password": "string" // 密码
}
```

**响应**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "string",  // 50位随机Token
  "role": "user"      // 用户角色
}
```

**代码位置**: `backend/server/routes/auth.py:7-21`

---

### 1.2 用户注册
**POST** `/register`

**请求体**:
```json
{
  "userId": "string",  // 用户名
  "password": "string" // 密码
}
```

**响应**:
```json
{
  "success": true,
  "message": "Registration successful",
  "token": "string"
}
```

**代码位置**: `backend/server/routes/auth.py:24-40`

---

### 1.3 Token验证
**GET** `/protected`

**请求头**: `Authorization: <token>`

**响应**:
```json
{
  "success": true,
  "message": "Token 验证成功",
  "user_id": 1
}
```

**代码位置**: `backend/server/routes/auth.py:43-58`

---

## 2. 音乐管理接口 (music.py)

### 2.1 获取所有歌曲
**GET** `/songs`

**响应**:
```json
[
  {
    "id": 1,
    "title": "string",
    "artist": "string",
    "duration": 180000,  // 毫秒
    "file_path": "string",
    "file_extension": "mp3",
    "platform": "local",
    "platform_song_id": null,
    "time_added": "2024-01-01 00:00:00"
  }
]
```

**代码位置**: `backend/server/routes/music.py:629-632`

---

### 2.2 QQ音乐搜索
**GET** `/qqmusic/search`

**查询参数**:
- `key`: 搜索关键词 (必填)
- `pageNo`: 页码 (默认: 1)
- `pageSize`: 每页数量 (默认: 20)

**响应**:
```json
{
  "result": 100,
  "data": {
    "list": [
      {
        "songmid": "string",
        "title": "string",
        "artist": "string",
        "duration": 180000
      }
    ],
    "pageNo": 1,
    "pageSize": 20,
    "total": 100,
    "key": "string",
    "t": 0,
    "type": "song"
  }
}
```

**代码位置**: `backend/server/routes/music.py:635-672`

---

### 2.3 网易云音乐搜索
**GET** `/netease/search`

**查询参数**: 同QQ音乐搜索

**响应**: 同QQ音乐搜索

**代码位置**: `backend/server/routes/music.py:675-733`

---

### 2.4 QQ音乐歌曲导入
**POST** `/qqmusic/import`

**请求体**:
```json
{
  "songmid": "string",       // QQ音乐歌曲ID
  "title": "string",         // 歌曲标题
  "artist": "string",        // 艺术家
  "duration": 180000,        // 时长(毫秒)
  "type": "m4a",             // 音频类型
  "addToPlaylist": true      // 是否加入播放列表
}
```

**响应**:
```json
{
  "message": "Song imported",
  "songId": 1
}
```

**代码位置**: `backend/server/routes/music.py:737-828`

---

### 2.5 网易云音乐歌曲导入
**POST** `/netease/import`

**请求体**:
```json
{
  "songId": 123456,          // 网易云歌曲ID
  "title": "string",
  "artist": "string",
  "duration": 180000,
  "addToPlaylist": true
}
```

**响应**: 同QQ音乐导入

**代码位置**: `backend/server/routes/music.py:861-942`

---

### 2.6 平台歌曲检查
**POST** `/songs/check-platform`

**请求体**:
```json
{
  "platform": "qqmusic",     // 平台标识
  "platform_song_id": "string" // 平台歌曲ID
}
```

**响应**:
```json
{
  "exists": true,
  "song": { ... }
}
```

**代码位置**: `backend/server/routes/music.py:944-970`

---

### 2.7 获取播放列表
**GET** `/playlists`

**查询参数**:
- `page`: 页码 (默认: 1)
- `page_size`: 每页数量 (默认: 20)

**响应**:
```json
{
  "items": [
    {
      "id": 1,
      "creater_id": 1,
      "playlist_name": "默认播放列表"
    }
  ],
  "page": 1,
  "total_pages": 1
}
```

**代码位置**: `backend/server/routes/music.py:972-978`

---

### 2.8 获取所有播放列表 (不分页)
**GET** `/getAllPlaylists`

**响应**: 同上，但包含所有播放列表

**代码位置**: `backend/server/routes/music.py:980-998`

---

### 2.9 创建播放列表
**POST** `/playlists`

**请求体**:
```json
{
  "name": "string"  // 播放列表名称
}
```

**响应**:
```json
{
  "message": "Playlist created",
  "playlist": { ... }
}
```

**代码位置**: `backend/server/routes/music.py:1000-1007`

---

### 2.10 获取播放列表详情
**GET** `/playlists/<playlist_id>`

**查询参数**:
- `page`: 页码 (默认: 1)
- `page_size`: 每页数量 (默认: 20)

**响应**:
```json
{
  "playlist": {
    "id": 1,
    "playlist_name": "string"
  },
  "songs": [ ... ],
  "page": 1,
  "total_pages": 1
}
```

**代码位置**: `backend/server/routes/music.py:1009-1026`

---

### 2.11 添加歌曲到播放列表
**POST** `/playlists/<playlist_id>/songs`

**请求体**:
```json
{
  "songIds": [1, 2, 3]  // 歌曲ID数组
}
```

**响应**:
```json
{
  "message": "Songs added to playlist"
}
```

**代码位置**: `backend/server/routes/music.py:1028-1065`

---

### 2.12 从播放列表移除歌曲
**DELETE** `/playlists/<playlist_id>/songs/<song_id>`

**响应**:
```json
{
  "message": "Song removed"
}
```

**代码位置**: `backend/server/routes/music.py:1067-1070`

---

### 2.13 永久删除歌曲
**DELETE** `/songs/<song_id>`

**功能**: 从数据库删除歌曲记录，并清理COS文件

**响应**:
```json
{
  "message": "Song deleted permanently"
}
```

**代码位置**: `backend/server/routes/music.py:1073-1101`

---

### 2.14 获取歌曲文件
**GET** `/songs/<song_id>/file.<ext>`

**功能**: 获取歌曲音频文件，支持流式播放

**响应**: 
- 本地文件: 返回音频流 (206 Partial Content)
- COS文件: 返回预签名URL重定向 (302)
- 平台歌曲: 动态获取播放URL重定向 (302)

**代码位置**: `backend/server/routes/music.py:1104-1240`

---

### 2.15 获取歌曲封面
**GET** `/songs/<song_id>/cover`

**响应**:
```json
{
  "cover": "data:image/jpeg;base64,..."
}
```

**代码位置**: `backend/server/routes/music.py:1242-1333`

---

### 2.16 分片上传初始化
**POST** `/uploadchunkinit`

**请求体**:
```json
{
  "filename": "string",
  "totalChunks": 10,
  "totalSize": 10240000
}
```

**响应**:
```json
{
  "sessionId": "string",
  "chunkSize": 5242880
}
```

**代码位置**: `backend/server/routes/music.py:1335-1388`

---

### 2.17 上传分片
**POST** `/uploadchunk`

**请求**: multipart/form-data

**参数**:
- `sessionId`: 上传会话ID
- `chunkIndex`: 分片索引
- `chunk`: 分片文件

**响应**:
```json
{
  "message": "Chunk uploaded",
  "chunkIndex": 0
}
```

**代码位置**: `backend/server/routes/music.py:1390-1437`

---

### 2.18 合并分片
**POST** `/uploadchunkmerge`

**请求体**:
```json
{
  "sessionId": "string",
  "title": "string",
  "artist": "string",
  "duration": 180000
}
```

**响应**:
```json
{
  "message": "File merged successfully",
  "songId": 1
}
```

**代码位置**: `backend/server/routes/music.py:1439-1519`

---

### 2.19 获取用户列表
**GET** `/users`

**响应**:
```json
[
  {"id": 1, "username": "string"}
]
```

**代码位置**: `backend/server/routes/music.py:1521-1525`

---

### 2.20 获取播放状态
**GET** `/getplaystatus`

**响应**:
```json
{
  "play_start_time": 1704067200000,
  "is_playing": 1,
  "server_now": 1704067200000,
  "current_song": { ... }
}
```

**代码位置**: `backend/server/routes/music.py:1526-1552`

---

### 2.21 获取播放列表歌曲
**GET** `/getplaysongs`

**响应**: 播放列表中的歌曲数组

**代码位置**: `backend/server/routes/music.py:1553-1556`

---

### 2.22 开始播放
**POST** `/requestplay`

**功能**: 开始播放并设置定时器

**响应**:
```json
{
  "status": true,
  "message": "Request play successful"
}
```

**代码位置**: `backend/server/routes/music.py:1558-1585`

---

### 2.23 清空播放列表
**GET** `/clearplaylist`

**响应**:
```json
{
  "message": "Playlist cleared",
  "success": true
}
```

**代码位置**: `backend/server/routes/music.py:1587-1592`

---

### 2.24 从播放列表移除歌曲 (带切歌)
**POST** `/removesongfromplaylist`

**请求体**:
```json
{
  "song_id": 1
}
```

**响应**:
```json
{
  "message": "Song removed from playlist",
  "success": true,
  "is_playing": true  // 是否是当前播放歌曲
}
```

**特殊逻辑**: 如果删除的是当前播放歌曲，会自动切换下一首并广播

**代码位置**: `backend/server/routes/music.py:1594-1652`

---

### 2.25 重新排列播放列表
**POST** `/reorderPlaylist`

**请求体**:
```json
{
  "playlist_id": 1,
  "song_ids": [3, 1, 2]  // 新的歌曲顺序
}
```

**响应**:
```json
{
  "message": "Playlist reordered successfully",
  "success": true
}
```

**代码位置**: `backend/server/routes/music.py:1655-1689`

---

## 3. Cookie池管理接口 (cookie.py)

### 3.1 获取Cookie数量
**GET** `/cookie/count`

**查询参数**:
- `platform`: 平台标识 (默认: qqmusic)

**响应**:
```json
{
  "count": 10,
  "platform": "qqmusic"
}
```

**代码位置**: `backend/server/routes/cookie.py:38-43`

---

### 3.2 获取VIP Cookie数量
**GET** `/cookie/vip-count`

**响应**:
```json
{
  "vip": 5,
  "non_vip": 5,
  "total": 10,
  "platform": "qqmusic"
}
```

**代码位置**: `backend/server/routes/cookie.py:46-58`

---

### 3.3 获取Cookie列表
**GET** `/cookie/list`

**响应**: Cookie列表 (脱敏显示)

**代码位置**: `backend/server/routes/cookie.py:61-65`

---

### 3.4 添加Cookie
**POST** `/cookie/add`

**请求体**:
```json
{
  "cookie": "string",
  "user_label": "string"
}
```

**响应**:
```json
{
  "message": "Cookie已添加",
  "id": 1,
  "valid": true
}
```

**代码位置**: `backend/server/routes/cookie.py:68-109`

---

### 3.5 验证Cookie
**POST** `/cookie/verify/<cookie_id>`

**响应**: 验证结果

**代码位置**: `backend/server/routes/cookie.py:111-126`

---

### 3.6 验证所有Cookie
**POST** `/cookie/verify-all`

**响应**: 批量验证结果

**代码位置**: `backend/server/routes/cookie.py:128-142`

---

### 3.7 删除Cookie
**DELETE** `/cookie/<cookie_id>`

**响应**:
```json
{
  "message": "Cookie deleted"
}
```

**代码位置**: `backend/server/routes/cookie.py:144-149`

---

### 3.8 切换Cookie状态
**POST** `/cookie/<cookie_id>/toggle`

**响应**: 切换后的状态

**代码位置**: `backend/server/routes/cookie.py:151-163`

---

### 3.9 QQ音乐登录状态
**GET** `/music-login/qqmusic/status`

**响应**:
```json
{
  "logged_in": true,
  "uin": "string",
  "nickname": "string"
}
```

**代码位置**: `backend/server/routes/cookie.py:165-189`

---

### 3.10 QQ音乐登录初始化
**POST** `/music-login/qqmusic/init`

**功能**: 启动Puppeteer进行QQ音乐登录

**响应**: 登录页面URL

**代码位置**: `backend/server/routes/cookie.py:191-211`

---

### 3.11 QQ音乐登录回调
**POST** `/music-login/qqmusic/callback`

**请求体**:
```json
{
  "cookie": "string",
  "uin": "string",
  "nickname": "string"
}
```

**响应**:
```json
{
  "message": "登录成功",
  "uin": "string",
  "nickname": "string"
}
```

**代码位置**: `backend/server/routes/cookie.py:213-263`

---

### 3.12 QQ音乐登出
**POST** `/music-login/qqmusic/logout`

**响应**:
```json
{
  "message": "已退出登录"
}
```

**代码位置**: `backend/server/routes/cookie.py:266-275`

---

### 3.13 网易云音乐登录状态
**GET** `/music-login/netease/status`

**响应**: 同QQ音乐登录状态

**代码位置**: `backend/server/routes/cookie.py:315-367`

---

### 3.14 网易云音乐登录初始化
**POST** `/music-login/netease/init`

**代码位置**: `backend/server/routes/cookie.py:369-389`

---

### 3.15 网易云音乐登录回调
**POST** `/music-login/netease/callback`

**代码位置**: `backend/server/routes/cookie.py:391-452`

---

### 3.16 网易云音乐登出
**POST** `/music-login/netease/logout`

**代码位置**: `backend/server/routes/cookie.py:454-464`

---

### 3.17 获取网易云音乐播放列表
**GET** `/music-login/netease/playlists`

**响应**: 用户的网易云音乐播放列表

**代码位置**: `backend/server/routes/cookie.py:466-557`

---

### 3.18 获取QQ音乐播放列表
**GET** `/music-login/qqmusic/playlists`

**响应**: 用户的QQ音乐播放列表

**代码位置**: `backend/server/routes/cookie.py:559-915`

---

### 3.19 获取QQ音乐播放列表歌曲
**GET** `/music-login/qqmusic/playlist-songs`

**查询参数**:
- `playlist_id`: 播放列表ID
- `page`: 页码
- `page_size`: 每页数量

**响应**: 播放列表中的歌曲

**代码位置**: `backend/server/routes/cookie.py:917-954`

---

### 3.20 获取网易云音乐播放列表歌曲
**GET** `/music-login/netease/playlist-songs`

**代码位置**: `backend/server/routes/cookie.py:956-1005`

---

### 3.21 导入QQ音乐播放列表
**POST** `/music-login/qqmusic/import-playlist`

**请求体**:
```json
{
  "playlist_id": "string",
  "playlist_name": "string",
  "songs": [...]
}
```

**响应**: 导入结果

**代码位置**: `backend/server/routes/cookie.py:1007-1143`

---

### 3.22 导入网易云音乐播放列表
**POST** `/music-login/netease/import-playlist`

**请求体**: 同QQ音乐播放列表导入

**代码位置**: `backend/server/routes/cookie.py:1145-1395`

---

## 4. WebSocket事件

### 4.1 客户端 → 服务端

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `song_ended` | - | 歌曲播放结束通知 (当前忽略) |
| `request_next_song` | - | 请求下一首 |
| `request_prev_song` | - | 请求上一首 |
| `request_shuffle_playlist` | - | 请求随机播放列表 |

### 4.2 服务端 → 客户端

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `song_changed` | `{new_song_id, current_song}` | 歌曲切换通知 |
| `playlist_shuffled` | `{songs}` | 播放列表顺序更新 |
| `song_deleted_and_changed` | `{deleted_song_id, new_song_id, new_song, playlist}` | 歌曲删除并切歌 |
| `playlist_updated` | `{deleted_song_id, playlist}` | 播放列表更新 |
| `sync_play_status` | `{is_playing, current_song, play_start_time, server_now}` | 播放状态同步 |
| `sync_playlist` | `{songs}` | 播放列表同步 |
| `online_users_changed` | `{users: [{user_id, username}]}` | 在线用户列表更新 |

**WebSocket代码位置**: `backend/server/app.py:169-308`

---

## 5. 错误响应格式

```json
{
  "message": "错误描述"
}
```

**常见HTTP状态码**:
- 200: 成功
- 400: 请求参数错误
- 401: Token无效或过期
- 403: 音乐平台未登录
- 404: 资源不存在
- 500: 服务器内部错误
- 502: 外部API调用失败

---

## 6. 认证说明

大部分接口需要Token认证，Token通过以下方式传递:
- 请求头: `Authorization: <token>`
- Token在登录/注册时获取，长度50位
- Token存储在 `LOGIN_HISTORY` 表中
- Token验证失败返回401，会触发前端登出

**重要**: 音乐平台未登录返回403 (不会触发系统登出)

---

## 7. 文件上传流程

### 7.1 分片上传 (推荐)
1. `POST /uploadchunkinit` - 初始化上传会话
2. `POST /uploadchunk` - 逐个上传分片
3. `POST /uploadchunkmerge` - 合并分片并创建歌曲记录

### 7.2 COS直传
1. `POST /upload/init` - 获取预签名上传URL
2. 前端直接上传到COS
3. `POST /upload/complete` - 通知后端上传完成

### 7.3 传统上传
- `POST /upload` - 直接上传文件 (不推荐大文件)
