# 后端工具模块文档

## 工具模块列表

| 文件 | 类/函数 | 功能 |
|------|---------|------|
| `backend/server/utils/qqmusic_tool.py` | QQMusicTool | QQ音乐API封装 |
| `backend/server/utils/netease_tool.py` | NeteaseMusicTool | 网易云音乐API封装 |
| `backend/server/utils/netease_crypto.py` | weapi_encrypt, eapi_encrypt | 网易云加密算法 |
| `backend/server/utils/cos_storage.py` | 多个函数 | 腾讯云COS存储封装 |
| `backend/server/utils/song_scheduler.py` | SongScheduler | 歌曲播放调度器 |
| `backend/server/utils/password.py` | hash_password, verify_password | 密码加密工具 |
| `backend/server/utils/token.py` | generate_token | Token生成工具 |
| `backend/server/utils/puppeteer_login.py` | run_qqmusic_login, run_netease_login | Puppeteer自动登录 |

---

## 1. QQMusicTool (QQ音乐工具)

**文件**: `backend/server/utils/qqmusic_tool.py`

### 类定义
```python
class QQMusicTool:
    def __init__(self, cookie_header: str = '', timeout: int = 15)
```

### 音质映射
```python
_QUALITY_MAP = {
    'm4a': ('C400', 'm4a'),    # 128kbps M4A
    '128': ('M500', 'mp3'),    # 128kbps MP3
    '320': ('M800', 'mp3'),    # 320kbps MP3
}
```

### 主要方法

#### get_music_url(songmid, quality='320', origin=False)
获取歌曲播放URL

**参数**:
- `songmid`: QQ音乐歌曲ID (必填)
- `quality`: 音质 ('m4a', '128', '320')
- `origin`: 是否返回原始响应

**返回**: 
- origin=False: 播放URL字符串
- origin=True: 完整API响应

**API端点**: `https://u.y.qq.com/cgi-bin/musicu.fcg`

**代码位置**: `backend/server/utils/qqmusic_tool.py:56-90`

---

#### search_with_keyword(keyword, search_type=0, result_num=50, page_num=1, origin=False)
搜索歌曲

**参数**:
- `keyword`: 搜索关键词
- `search_type`: 搜索类型 (0=歌曲, 2=专辑, 3=歌单, 4=MV, 7=歌词, 8=用户)
- `result_num`: 结果数量
- `page_num`: 页码

**返回**: 搜索结果列表

**API端点**: `https://u.y.qq.com/cgi-bin/musicu.fcg`

**代码位置**: `backend/server/utils/qqmusic_tool.py:123-164`

---

#### get_song_list(category_id, origin=False)
获取歌单歌曲列表

**参数**:
- `category_id`: 歌单ID

**返回**: 歌曲列表

**API端点**: `https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg`

**代码位置**: `backend/server/utils/qqmusic_tool.py:92-115`

---

#### get_song_lyric(songmid, parse=False, origin=False)
获取歌词

**参数**:
- `songmid`: 歌曲ID
- `parse`: 是否解析歌词

**返回**: 歌词文本或解析后的歌词

**API端点**: `https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg`

**代码位置**: `backend/server/utils/qqmusic_tool.py:166-182`

---

#### get_album_song_list(album_mid, origin=False)
获取专辑歌曲列表

**参数**:
- `album_mid`: 专辑ID

**返回**: 歌曲列表

**API端点**: `https://i.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg`

**代码位置**: `backend/server/utils/qqmusic_tool.py:184-202`

---

#### get_mv_info(vid, origin=True)
获取MV信息

**参数**:
- `vid`: 视频ID

**返回**: MV信息

**API端点**: `https://u.y.qq.com/cgi-bin/musicu.fcg`

**代码位置**: `backend/server/utils/qqmusic_tool.py:210-247`

---

## 2. NeteaseMusicTool (网易云音乐工具)

**文件**: `backend/server/utils/netease_tool.py`

### 类定义
```python
class NeteaseMusicTool:
    def __init__(self, cookie: str = '', timeout: int = 15)
```

### 音质映射
```python
QUALITY_MAP = {
    'standard': 'standard',   # 标准 128kbps
    'exhigh': 'exhigh',       # 极高 192kbps
    'lossless': 'lossless',   # 无损 320kbps
    'hires': 'hires',         # Hi-Res
    'jyeffect': 'jyeffect',   # 高清环绕声
    'sky': 'sky',             # 沉浸环绕声
    'jymaster': 'jymaster',   # 超清母带
}
```

### 加密方式
- **weapi**: 双层AES-CBC + RSA (用于用户相关API)
- **eapi**: MD5摘要 + AES-ECB (用于歌曲/歌单API)

### 主要方法

#### search(keyword, search_type=1, limit=30, offset=0, origin=False)
搜索歌曲

**参数**:
- `keyword`: 搜索关键词
- `search_type`: 搜索类型 (1=单曲, 10=专辑, 100=歌手, 1000=歌单)
- `limit`: 结果数量
- `offset`: 偏移量

**返回**: 搜索结果

**加密方式**: eapi

**API端点**: `/api/cloudsearch/pc`

**代码位置**: `backend/server/utils/netease_tool.py:92-108`

---

#### get_song_url(song_id, level='standard', origin=False)
获取歌曲播放URL

**参数**:
- `song_id`: 歌曲ID
- `level`: 音质等级

**返回**: 播放URL信息

**加密方式**: eapi

**API端点**: `/api/song/enhance/player/url/v1`

**代码位置**: `backend/server/utils/netease_tool.py:110-133`

---

#### get_user_playlists(uid, limit=100, offset=0, origin=False)
获取用户歌单列表 (需要cookie)

**参数**:
- `uid`: 用户ID

**返回**: 歌单列表

**加密方式**: weapi

**API端点**: `/api/user/playlist`

**代码位置**: `backend/server/utils/netease_tool.py:137-150`

---

#### get_playlist_detail(playlist_id, origin=False)
获取歌单详情

**参数**:
- `playlist_id`: 歌单ID

**返回**: 歌单详情

**加密方式**: eapi

**API端点**: `/api/v6/playlist/detail`

**代码位置**: `backend/server/utils/netease_tool.py:152-166`

---

#### get_song_detail(song_ids, origin=False)
批量获取歌曲详情 (需要cookie)

**参数**:
- `song_ids`: 歌曲ID列表

**返回**: 歌曲详情列表

**加密方式**: weapi

**API端点**: `/api/v3/song/detail`

**代码位置**: `backend/server/utils/netease_tool.py:168-178`

---

#### get_user_account(origin=False)
获取当前登录用户信息 (需要cookie)

**返回**: 用户信息

**加密方式**: 无 (公开API)

**API端点**: `/api/nuser/account/get`

**代码位置**: `backend/server/utils/netease_tool.py:180-185`

---

### 辅助函数

#### format_netease_song(song)
格式化网易云歌曲数据为标准格式

**返回**:
```python
{
    'id': 123456,
    'title': '歌曲名',
    'artist': '艺术家',
    'album': '专辑名',
    'duration': 180000,
    'cover': '封面URL',
    'fee': 0
}
```

**代码位置**: `backend/server/utils/netease_tool.py:211-223`

---

#### format_netease_playlist(pl)
格式化网易云歌单数据为标准格式

**返回**:
```python
{
    'id': '123456',
    'name': '歌单名',
    'song_count': 100,
    'cover': '封面URL',
    'creator': '创建者昵称'
}
```

**代码位置**: `backend/server/utils/netease_tool.py:226-235`

---

## 3. 网易云加密算法

**文件**: `backend/server/utils/netease_crypto.py`

### 固定密钥
```python
IV = b'0102030405060708'
PRESET_KEY = b'0CoJUm6Qyw8W8jud'
EA_KEY = b'e82ckenh8dichen8'
```

### 加密函数

#### weapi_encrypt(plain)
weapi加密：双层AES-CBC + RSA

**参数**:
- `plain`: 要加密的字典数据

**返回**:
```python
{
    'params': '加密后的params',
    'encSecKey': 'RSA加密后的密钥'
}
```

**加密流程**:
1. JSON序列化数据
2. 第一层AES-CBC加密 (使用PRESET_KEY)
3. Base64编码
4. 生成16位随机密钥
5. 第二层AES-CBC加密 (使用随机密钥)
6. RSA加密随机密钥

**代码位置**: `backend/server/utils/netease_crypto.py:72-97`

---

#### eapi_encrypt(url, plain)
eapi加密：MD5摘要 + AES-ECB

**参数**:
- `url`: API路径
- `plain`: 要加密的字典数据

**返回**:
```python
{
    'params': '加密后的params'
}
```

**加密流程**:
1. JSON序列化数据
2. MD5摘要: `nobody{url}use{text}md5forencrypt`
3. 拼接: `{url}-36cd479b6b5-{text}-36cd479b6b5-{digest}`
4. AES-ECB加密 (使用EA_KEY)
5. 转换为大写十六进制

**代码位置**: `backend/server/utils/netease_crypto.py:100-120`

---

## 4. COS存储工具

**文件**: `backend/server/utils/cos_storage.py`

### 配置
```python
_COS_SECRET_ID = os.getenv('COS_SECRET_ID', '')
_COS_SECRET_KEY = os.getenv('COS_SECRET_KEY', '')
_COS_BUCKET = os.getenv('COS_BUCKET', '')
_COS_REGION = os.getenv('COS_REGION', 'ap-guangzhou')
_COS_PRESIGN_EXPIRE = int(os.getenv('COS_PRESIGN_EXPIRE', '3600'))
_STORAGE_BACKEND = os.getenv('STORAGE_BACKEND', 'cos').lower()
```

### 主要函数

#### is_cos_enabled()
判断是否使用COS存储

**返回**: bool

**代码位置**: `backend/server/utils/cos_storage.py:25-33`

---

#### generate_cos_key(filename)
生成COS对象key

**格式**: `songs/{year}/{month}/{uuid}_{原始文件名}`

**参数**:
- `filename`: 原始文件名

**返回**: COS key字符串

**代码位置**: `backend/server/utils/cos_storage.py:48-57`

---

#### generate_presigned_upload_url(cos_key, expire=None)
生成预签名上传URL (PUT方式)

**参数**:
- `cos_key`: COS对象key
- `expire`: 过期时间 (秒)

**返回**:
```python
{
    'url': '预签名URL',
    'key': 'COS key',
    'expire': 3600
}
```

**代码位置**: `backend/server/utils/cos_storage.py:60-73`

---

#### generate_presigned_download_url(cos_key, expire=None)
生成预签名下载URL (GET方式)

**参数**:
- `cos_key`: COS对象key

**返回**: 预签名URL字符串

**代码位置**: `backend/server/utils/cos_storage.py:76-88`

---

#### delete_cos_object(cos_key)
删除COS对象

**参数**:
- `cos_key`: COS对象key

**返回**: bool (成功/失败)

**代码位置**: `backend/server/utils/cos_storage.py:98-112`

---

#### extract_cos_key_from_path(stored_path)
从数据库存储的file_path中提取COS key

**参数**:
- `stored_path`: 存储格式 (`cos:songs/2024/06/xxx.mp3`)

**返回**: COS key

**代码位置**: `backend/server/utils/cos_storage.py:115-122`

---

## 5. 歌曲播放调度器

**文件**: `backend/server/utils/song_scheduler.py`

### 类定义
```python
class SongScheduler:
    def __init__(self)
```

### 主要方法

#### set_callback(callback)
设置歌曲结束时的回调函数

**参数**:
- `callback`: 回调函数 (切歌逻辑)

**代码位置**: `backend/server/utils/song_scheduler.py:15-17`

---

#### schedule_song_end(start_time_ms, duration_ms)
设置精确定时器，在歌曲结束时触发

**参数**:
- `start_time_ms`: 歌曲开始播放时间戳 (毫秒)
- `duration_ms`: 歌曲时长 (毫秒)

**逻辑**:
1. 计算剩余播放时间: `remaining_ms = duration_ms - (now_ms - start_time_ms)`
2. 如果剩余时间 <= 0，立即触发切歌
3. 否则设置 `threading.Timer` 定时器

**代码位置**: `backend/server/utils/song_scheduler.py:19-54`

---

#### cancel_current()
取消当前定时器

**代码位置**: `backend/server/utils/song_scheduler.py:56-62`

---

### 全局实例
```python
song_scheduler = SongScheduler()
```

**使用方式**:
1. 在 `app.py` 中设置回调: `song_scheduler.set_callback(trigger_next_song)`
2. 播放开始时调用: `song_scheduler.schedule_song_end(start_time, duration)`
3. 手动切歌时取消: `song_scheduler.cancel_current()`

---

## 6. 密码加密工具

**文件**: `backend/server/utils/password.py`

### 函数

#### hash_password(password)
加密密码 (bcrypt)

**参数**:
- `password`: 原始密码

**返回**: 哈希后的密码字符串

**代码位置**: `backend/server/utils/password.py:4-6`

---

#### verify_password(input_password, hashed_password)
验证密码

**参数**:
- `input_password`: 输入的密码
- `hashed_password`: 存储的哈希密码

**返回**: bool

**代码位置**: `backend/server/utils/password.py:9-10`

---

## 7. Token生成工具

**文件**: `backend/server/utils/token.py`

### 函数

#### generate_token(length=50)
生成随机Token

**参数**:
- `length`: Token长度 (默认50)

**返回**: URL安全的随机Token字符串

**实现**: `secrets.token_urlsafe(length)[:length]`

**代码位置**: `backend/server/utils/token.py:4-5`

---

## 8. Puppeteer登录工具

**文件**: `backend/server/utils/puppeteer_login.py`

### 函数

#### run_qqmusic_login(timeout=300)
启动QQ音乐登录流程

**参数**:
- `timeout`: 超时时间 (秒，默认300)

**返回**:
```python
{
    'cookie': 'Cookie字符串',
    'is_vip': bool
}
```

**流程**:
1. 启动Puppeteer进程 (`puppeteer_scripts/qqmusic_login.js`)
2. 用户在浏览器中登录
3. 脚本自动获取Cookie并写入临时文件
4. 读取临时文件返回结果

**代码位置**: `backend/server/utils/puppeteer_login.py:14-76`

---

#### run_netease_login(timeout=300)
启动网易云音乐登录流程

**参数**: 同QQ音乐登录

**返回**:
```python
{
    'cookie': 'Cookie字符串',
    'uid': '用户ID'
}
```

**代码位置**: `backend/server/utils/puppeteer_login.py:79-100+`

---

## 工具模块调用关系

```
routes/cookie.py
    ├── QQMusicTool (QQ音乐API调用)
    ├── NeteaseMusicTool (网易云API调用)
    ├── CookiePool (Cookie池管理)
    └── UserMusicSession (用户Session管理)

routes/music.py
    ├── QQMusicTool (搜索、导入)
    ├── NeteaseMusicTool (搜索、导入)
    ├── SongScheduler (播放调度)
    ├── COS存储函数 (文件上传/下载)
    ├── Song DAO (歌曲操作)
    └── Playlist DAO (播放列表操作)

NeteaseMusicTool
    └── netease_crypto.py (加密算法)

QQMusicTool
    └── CookiePool (获取Cookie)
```

---

## 使用示例

### QQ音乐搜索并导入
```python
# 1. 创建工具实例
qqmusic = QQMusicTool(cookie_header=cookie, timeout=15)

# 2. 搜索歌曲
result = qqmusic.search_with_keyword('周杰伦', search_type=0, result_num=20)

# 3. 获取播放URL
play_url = qqmusic.get_music_url(songmid='songmid123', quality='320')
```

### 网易云音乐搜索并导入
```python
# 1. 创建工具实例
netease = NeteaseMusicTool(cookie=cookie, timeout=15)

# 2. 搜索歌曲
result = netease.search('周杰伦', limit=20)

# 3. 获取播放URL
song_url = netease.get_song_url(song_id=123456, level='standard')
```

### COS文件上传
```python
# 1. 生成COS key
cos_key = generate_cos_key('song.mp3')

# 2. 生成预签名URL
upload_info = generate_presigned_upload_url(cos_key)

# 3. 前端上传到COS (使用upload_info['url'])

# 4. 保存到数据库
file_path = f'cos:{cos_key}'
```

---

## 注意事项

1. **Cookie管理**: QQ音乐API需要有效Cookie，优先使用VIP Cookie
2. **加密算法**: 网易云API需要加密请求，使用 `netease_crypto.py`
3. **错误处理**: 所有API调用都应捕获异常，返回502表示外部API失败
4. **超时控制**: 所有HTTP请求都有超时设置 (默认15秒)
5. **COS配置**: 需要配置环境变量才能使用COS存储
