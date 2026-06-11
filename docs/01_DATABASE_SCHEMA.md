# 数据库表设计文档

## 数据库信息
- **数据库引擎**: SQLite
- **数据库文件**: `backend/dao/db/musicdata.db`
- **配置文件**: `backend/dao/config.py`
- **初始化脚本**: `backend/dao/sql_init.py`

## 表结构列表

### 1. songs (歌曲表)
存储所有歌曲的基本信息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 歌曲ID |
| title | TEXT | NOT NULL | 歌曲标题 |
| artist | TEXT | | 艺术家 |
| duration | INTEGER | | 时长(毫秒) |
| uploader_id | INTEGER | FOREIGN KEY → users(id) | 上传者ID |
| file_path | TEXT | | 文件路径 (本地路径或 `cos:key` 格式) |
| file_extension | TEXT | | 文件扩展名 (mp3/flac/wav/ogg) |
| platform | TEXT | DEFAULT 'local' | 平台标识 (local/qqmusic/netease) |
| platform_song_id | TEXT | | 平台歌曲ID (用于动态获取播放URL) |
| time_added | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 添加时间 |

**约束**:
- UNIQUE(title, artist): 同一首歌不能重复添加

**DAO文件**: `backend/dao/song.py` - `Song` 类

---

### 2. users (用户表)
存储系统用户信息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 用户ID |
| username | TEXT | NOT NULL UNIQUE | 用户名 |
| password_hash | TEXT | NOT NULL | 密码哈希 (bcrypt) |
| token | TEXT | | 当前登录Token |

**默认数据**:
- id=1, username='system': 系统用户，用于创建默认播放列表

**DAO文件**: `backend/dao/user.py` - `User` 类

---

### 3. playlists (播放列表表)
存储播放列表信息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 播放列表ID |
| creater_id | INTEGER | FOREIGN KEY → users(id) | 创建者ID |
| playlist_name | TEXT | NOT NULL | 播放列表名称 |

**约束**:
- UNIQUE(playlist_name): 播放列表名称唯一

**默认数据**:
- id=1, playlist_name='默认播放列表': 系统默认播放列表，用于播放队列
- playlist_name='所有歌曲': 包含所有歌曲的特殊歌单

**DAO文件**: `backend/dao/playlist.py` - `Playlist` 类

**关键方法**:
- `get_or_create_all_songs_playlist()`: 动态获取或创建"所有歌曲"歌单

---

### 4. playlist_songs (播放列表-歌曲关联表)
存储播放列表和歌曲的多对多关系。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| playlist_id | INTEGER | FOREIGN KEY → playlists(id), PRIMARY KEY | 播放列表ID |
| song_id | INTEGER | FOREIGN KEY → songs(id), PRIMARY KEY | 歌曲ID |
| order_index | INTEGER | | 播放顺序索引 (从1开始) |

**约束**:
- PRIMARY KEY(playlist_id, song_id): 联合主键

**特殊逻辑**:
- playlist_id=1 是"默认播放列表"，order_index=1 表示当前正在播放的歌曲
- 歌曲切换时通过 `rotate_playlist_index()` 将 order_index=1 的歌曲移到最后

---

### 5. LOGIN_HISTORY (登录历史表)
存储用户登录状态和Token。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| user_id | INTEGER | PRIMARY KEY, FOREIGN KEY → users(id) | 用户ID |
| token | TEXT | | 当前有效Token |
| login_at | TIMESTAMP | | 最后登录时间 |

**说明**: 每个用户只保留一条记录，登录时更新Token

---

### 6. ROLE (角色表)
存储系统角色定义。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| role_id | INTEGER | PRIMARY KEY AUTOINCREMENT | 角色ID |
| role_name | TEXT | NOT NULL UNIQUE | 角色名称 |

**默认数据**:
- role_name='user': 普通用户角色

---

### 7. USER_ROLE (用户-角色关联表)
存储用户和角色的多对多关系。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| user_id | INTEGER | FOREIGN KEY → users(id), PRIMARY KEY | 用户ID |
| role_id | INTEGER | FOREIGN KEY → ROLE(role_id), PRIMARY KEY | 角色ID |

---

### 8. room_play_state (房间播放状态表)
存储当前播放状态（单房间模式，固定room_id=1）。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| room_id | INT | PRIMARY KEY | 房间ID (固定为1) |
| play_start_time | DATETIME | | 当前歌曲开始播放时间戳(毫秒) |
| is_playing | BOOLEAN | | 是否正在播放 |
| need_notify | BOOLEAN | DEFAULT FALSE | 是否需要通知客户端 |

**默认数据**:
- room_id=1, is_playing=FALSE: 初始化播放状态

**DAO文件**: `backend/dao/song.py` - `Song` 类中包含相关方法

---

### 9. cookie_pool (Cookie池表)
存储共享的音乐平台Cookie。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Cookie ID |
| user_label | TEXT | | 用户标签 (昵称或uin) |
| cookie | TEXT | NOT NULL | Cookie内容 |
| uin | TEXT | | QQ号 |
| platform | TEXT | DEFAULT 'qqmusic' | 平台标识 |
| status | TEXT | DEFAULT 'active' | 状态 (active/expired) |
| is_vip | INTEGER | DEFAULT 0 | 是否VIP (0/1) |
| use_count | INTEGER | DEFAULT 0 | 使用次数 |
| fail_count | INTEGER | DEFAULT 0 | 连续失败次数 |
| last_used_at | TIMESTAMP | | 最后使用时间 |
| last_verified_at | TIMESTAMP | | 最后验证时间 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| added_by | INTEGER | FOREIGN KEY → users(id) | 添加者ID |

**状态逻辑**:
- active: 有效Cookie
- expired: 失效Cookie (fail_count >= 4 时自动标记)

**DAO文件**: `backend/dao/cookie_pool.py` - `CookiePool` 类

---

### 10. user_music_sessions (用户音乐平台Session表)
存储用户个人的音乐平台登录态。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Session ID |
| user_id | INTEGER | NOT NULL, FOREIGN KEY → users(id) | 用户ID |
| platform | TEXT | NOT NULL DEFAULT 'qqmusic' | 平台标识 |
| session_data | TEXT | NOT NULL | Session数据 (Cookie等) |
| uin | TEXT | | 平台账号ID |
| nickname | TEXT | | 平台昵称 |
| status | TEXT | DEFAULT 'active' | 状态 (active/expired) |
| last_used_at | TIMESTAMP | | 最后使用时间 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| expires_at | TIMESTAMP | | 过期时间 |

**约束**:
- UNIQUE(user_id, platform): 每个用户每个平台只有一条Session

**DAO文件**: `backend/dao/user_music_session.py` - `UserMusicSession` 类

---

## 表关系图

```
users (1) ──────┬────── (N) playlists
                │
                ├────── (N) songs (uploader_id)
                │
                ├────── (1) LOGIN_HISTORY
                │
                ├────── (N) cookie_pool (added_by)
                │
                └────── (N) user_music_sessions

playlists (N) ──────┬────── (N) songs
                    │
                    └────── playlist_songs (关联表)

ROLE (N) ──────┬────── (N) users
               │
               └────── USER_ROLE (关联表)
```

## 特殊设计说明

### 1. 默认播放列表 (id=1)
- 系统启动时自动创建
- 用于播放队列管理
- order_index=1 表示当前播放歌曲
- 歌曲切换通过 `rotate_playlist_index()` 实现循环播放

### 2. "所有歌曲"歌单
- 动态获取ID，不硬编码
- 通过 `get_or_create_all_songs_playlist()` 方法获取
- 上传/导入歌曲时自动添加到此歌单
- 从此歌单删除会永久删除歌曲 (数据库+COS文件)

### 3. 平台歌曲存储
- 本地歌曲: file_path 存储本地路径
- COS歌曲: file_path 存储 `cos:songs/2024/06/xxx.mp3` 格式
- 平台歌曲: platform_song_id 存储平台ID，播放时动态获取URL

### 4. Cookie池 vs 用户Session
- **Cookie池**: 共享资源，多用户贡献，用于QQ音乐API调用
- **用户Session**: 个人登录态，用于网易云等需要个人登录的平台

## DAO层文件索引

| 文件 | 类名 | 操作表 | 主要功能 |
|------|------|--------|----------|
| `backend/dao/user.py` | User | users, LOGIN_HISTORY, USER_ROLE | 用户CRUD、Token管理、角色分配 |
| `backend/dao/song.py` | Song | songs, room_play_state | 歌曲CRUD、播放状态、播放列表索引 |
| `backend/dao/playlist.py` | Playlist | playlists, playlist_songs | 播放列表CRUD、歌曲关联 |
| `backend/dao/cookie_pool.py` | CookiePool | cookie_pool | Cookie池管理、VIP选择、状态验证 |
| `backend/dao/user_music_session.py` | UserMusicSession | user_music_sessions | 用户音乐平台Session管理 |
| `backend/dao/sql_init.py` | SQLInit | 所有表 | 数据库初始化、表创建 |

## 数据库迁移

迁移脚本: `backend/migrate_db.py`

用途: 将现有歌曲添加到"所有歌曲"歌单，处理历史数据兼容。
