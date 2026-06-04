# QQ音乐播放实现链路

## 1. 概述

本项目通过QQ音乐的内部API实现歌曲搜索、导入和播放功能。关键特点：
- **服务器不存储音频文件**：只存储QQ音乐CDN的URL
- **播放时302重定向**：浏览器直接从QQ音乐CDN下载音频
- **节省服务器带宽**：音频流量完全由QQ音乐CDN承担

## 2. 实现架构

```
前端组件 (QQMusicFun.tsx)
    ↓ 搜索请求
后端路由 (/qqmusic/search)
    ↓ 调用
QQMusicTool (qqmusic_tool.py)
    ↓ HTTP请求
QQ音乐API (u.y.qq.com/cgi-bin/musicu.fcg)
    ↓ 返回搜索结果
后端路由 (/qqmusic/import)
    ↓ 获取播放URL
QQMusicTool.get_music_url()
    ↓ 存储URL到数据库
播放时：
前端请求 /songs/{id}/file.ext
    ↓ 检测URL
后端路由 (get_song_file)
    ↓ 302重定向
QQ音乐CDN (dl.stream.qqmusic.qq.com)
    ↓ 返回音频流
浏览器播放
```

## 3. 后端工具类 (`backend/server/utils/qqmusic_tool.py`)

### 3.1 QQMusicTool 类
- **初始化**: 接收cookie参数，用于身份验证
- **HTTP请求封装**: `_request_json()` 方法统一处理请求头、超时等

### 3.2 核心方法

#### 搜索功能
```python
def search_with_keyword(
    self,
    keyword: str,
    search_type: int = 0,
    result_num: int = 50,
    page_num: int = 1,
    origin: bool = False,
) -> Any:
```
- 调用 `music.search.SearchCgiService` 模块
- 支持歌曲、专辑、歌单、MV等类型搜索
- 返回结构化搜索结果

#### 获取播放URL
```python
def get_music_url(self, songmid: str, quality: str = '320', origin: bool = False) -> Any:
```
- 调用 `vkey.GetVkeyServer` 模块
- 支持不同音质：m4a (C400), 128kbps (M500), 320kbps (M800)
- 返回带签名的CDN播放URL

#### 获取封面图片
```python
def get_song_cover_image(self, songmid: str) -> Optional[str]:
```
- 通过 `get_song_detail()` 获取专辑信息
- 构造封面URL: `https://y.gtimg.cn/music/photo_new/T002R300x300M000{album_mid}.jpg`

#### 获取歌词
```python
def get_song_lyric(self, songmid: str, parse: bool = False, origin: bool = False) -> Any:
```
- 调用 `fcg_query_lyric_new.fcg` 接口
- 支持原始歌词和解析后的时间戳格式

## 4. 后端路由 (`backend/server/routes/music.py`)

### 4.1 搜索接口
```python
@music_bp.route('/qqmusic/search', methods=['GET'])
def qqmusic_search():
```
- **请求参数**: `key` (关键词), `pageNo`, `pageSize`
- **处理流程**:
  1. 验证用户token
  2. 创建 `QQMusicTool` 实例
  3. 调用 `search_with_keyword()`
  4. 返回结构化搜索结果

### 4.2 导入接口
```python
@music_bp.route('/qqmusic/import', methods=['POST'])
def qqmusic_import_song():
```
- **请求参数**: `songmid`, `title`, `artist`, `duration`, `type`, `addToPlaylist`
- **处理流程**:
  1. 验证用户token
  2. 调用 `get_music_url()` 获取播放URL
  3. 检查歌曲是否已存在（标题+艺术家）
  4. 存入数据库：`file_path` 存储QQ音乐CDN的URL
  5. 自动添加到"QQ音乐导入歌单"播放列表

### 4.3 封面接口
```python
@music_bp.route('/qqmusic/cover/<int:song_id>', methods=['GET'])
def qqmusic_cover(song_id):
```
- **处理流程**:
  1. 验证歌曲是否为QQ音乐歌曲（标题以`[qq]`结尾或URL包含`qq.com`）
  2. 从URL中提取 `songmid`
  3. 调用 `get_song_cover_image()` 获取封面URL
  4. 返回封面图片URL

## 5. 前端组件 (`frontend/src/QQMusicApi/QQMusicFun.tsx`)

### 5.1 状态管理
- `items`: 搜索结果列表
- `loading`: 搜索加载状态
- `searchKey`: 搜索关键词
- `importingSongmid`: 正在导入的歌曲ID

### 5.2 搜索功能
```typescript
async function searchMusic() {
    // 调用后端搜索接口
    const response = await axios.get('/qqmusic/search', {
        params: { key: searchKey, pageNo: 1, pageSize: 5 }
    });
    // 标准化搜索结果
    const resultItems = normalizeSearchItems(response.data);
    setItems(resultItems);
}
```

### 5.3 导入功能
```typescript
async function importSong(item: QQSearchItem) {
    // 调用后端导入接口
    const response = await axios.post('/qqmusic/import', {
        songmid: item.songmid,
        title: item.title,
        artist: item.artist,
        duration: item.duration,
        type: 'm4a',
        addToPlaylist: true
    });
}
```

### 5.4 数据标准化
```typescript
function normalizeSearchItems(payload: any): QQSearchItem[] {
    // 处理不同API返回格式
    // 提取 songmid, title, artist, duration, strMediaMid
}
```

## 6. 播放机制

### 6.1 数据库存储
- **file_path字段**: 存储QQ音乐CDN的URL
  - 格式: `https://dl.stream.qqmusic.qq.com/C400{songmid}{mediaid}.m4a?...`
  - 示例: `https://dl.stream.qqmusic.qq.com/C400003a1T1g2F2Cgm001.m4a?vkey=...`

### 6.2 播放路由
```python
@music_bp.route('/songs/<int:song_id>/file.<ext>', methods=['GET'])
def get_song_file(song_id, ext):
    # 获取歌曲信息
    stored_path = song[5]  # file_path字段
    
    # 检测是否为远程URL
    if isinstance(stored_path, str) and (stored_path.startswith('http://') or stored_path.startswith('https://')):
        # 302重定向到QQ音乐CDN
        return jsonify({'url': stored_path}), 302, {'Location': stored_path}
```

### 6.3 播放流程
1. 前端请求: `GET /api/songs/{id}/file.{ext}`
2. 后端检测 `file_path` 是否以 `http` 开头
3. 返回302重定向响应
4. 浏览器跟随重定向到QQ音乐CDN
5. QQ音乐CDN返回音频流
6. 浏览器播放音频

## 7. 数据结构

### 7.1 数据库表结构
```sql
CREATE TABLE songs (
    id INTEGER PRIMARY KEY,
    title TEXT,
    artist TEXT,
    duration INTEGER,
    file_path TEXT,  -- 存储本地路径或远程URL
    uploader_id INTEGER,
    file_extension TEXT
);
```

### 7.2 QQ音乐歌曲标识
- **标题后缀**: 导入时自动添加 `[qq]` 后缀
  - 示例: `晴天[qq]`
- **URL特征**: 包含 `qq.com` 域名
- **判断函数**:
  ```python
  def _is_qq_song(song: dict) -> bool:
      title = str((song or {}).get('title') or '')
      file_path = str((song or {}).get('file_path') or '')
      return title.endswith('[qq]') or ('qq.com' in file_path and file_path.startswith('http'))
  ```

### 7.3 songmid提取
```python
def _extract_songmid_from_song(song: dict):
    # 从URL中提取14位songmid
    # 匹配模式: C400/M500/M800 + 14位字符 + 14位字符 + .ext
    for pattern in [r'(?:C400|M500|M800|A000|F000)([A-Za-z0-9]{14})', r'/([A-Za-z0-9]{14})\.[A-Za-z0-9]+(?:\?|$)']:
        match = re.search(pattern, file_path)
        if match:
            return match.group(1)
```

## 8. 时序流程

### 8.1 搜索导入流程
```
用户输入关键词
    ↓
前端调用 /qqmusic/search
    ↓
后端调用 QQMusicTool.search_with_keyword()
    ↓
返回搜索结果列表
    ↓
用户点击"导入到曲库"
    ↓
前端调用 /qqmusic/import
    ↓
后端调用 QQMusicTool.get_music_url()
    ↓
获取播放URL
    ↓
存储到数据库 (file_path = URL)
    ↓
添加到播放列表
```

### 8.2 播放流程
```
前端请求播放歌曲
    ↓
GET /songs/{id}/file.{ext}
    ↓
后端检查 file_path
    ↓
检测到 http:// 或 https:// 开头
    ↓
返回302重定向响应
    ↓
浏览器跟随重定向
    ↓
QQ音乐CDN返回音频流
    ↓
浏览器播放音频
```

## 9. 注意事项

### 9.1 安全性
- **Cookie管理**: QQ音乐Cookie存储在环境变量 `QQMUSIC_COOKIE` 中
- **身份验证**: 所有接口都需要有效的用户token

### 9.2 限制与约束
- **播放URL有效期**: QQ音乐CDN的播放URL有时效性
- **音质限制**: 默认使用320kbps，但实际可用音质取决于QQ音乐账号权限
- **地区限制**: 可能受QQ音乐服务地区限制

### 9.3 错误处理
- **网络错误**: 捕获 `requests.RequestException`
- **API错误**: 检查返回数据结构
- **重复导入**: 检查歌曲是否已存在（标题+艺术家）

### 9.4 性能优化
- **搜索缓存**: 可考虑缓存搜索结果
- **批量导入**: 目前支持单首歌曲导入
- **封面懒加载**: 封面图片按需获取

## 10. 相关文件

- `backend/server/utils/qqmusic_tool.py` - QQ音乐工具类
- `backend/server/routes/music.py` - 后端路由实现
- `frontend/src/QQMusicApi/QQMusicFun.tsx` - 前端搜索导入组件
- `backend/dao/song.py` - 歌曲数据访问层

## 11. 配置说明

### 环境变量
```env
# QQ音乐Cookie（可选）
QQMUSIC_COOKIE=your_qq_music_cookie_here
```

### 数据库配置
- 歌曲表 `songs` 的 `file_path` 字段存储QQ音乐CDN URL
- 歌曲标题自动添加 `[qq]` 后缀标识来源

---

*文档生成时间: 2026年6月4日*