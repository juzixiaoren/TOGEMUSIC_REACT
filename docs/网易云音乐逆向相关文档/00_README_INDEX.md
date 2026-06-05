# 网易云逆向实现方案
# 网易云音乐逆向接口整理：Puppeteer 登录 Cookie + 自封装 REST API

> 适用场景：Puppeteer 只负责登录网易云音乐并拿到 Cookie；后端通过附带 Cookie 调用网易云接口，自己封装 REST API。
>
> 重点操作：搜索歌曲、获取用户歌单、获取歌单歌曲、获取播放 URL。
>
> 注意：本文只整理正常登录态下可访问的接口，不包含解灰、绕过 VIP、绕过版权限制等逻辑。播放 URL 返回为空时，应作为“无版权 / VIP / 地区限制 / Cookie 失效”等失败状态处理。

---

## 0. 总体结论

网易云接口不是简单 JSON 直发，大多数请求需要经过加密封装。

常见两种模式：

| 加密模式 | 实际请求域名 | 实际 URL 形式 | HTTP Body |
|---|---|---|---|
| `weapi` | `https://music.163.com` | `/weapi/...` | `params=...&encSecKey=...` |
| `eapi` | `https://interface.music.163.com` | `/eapi/...` | `params=...` |

源码里的业务 URI 通常长这样：

```text
/api/user/playlist
/api/cloudsearch/pc
/api/v6/playlist/detail
/api/song/enhance/player/url/v1
```

真正请求时会变成：

```text
/api/user/playlist              -> https://music.163.com/weapi/user/playlist
/api/cloudsearch/pc             -> https://interface.music.163.com/eapi/cloudsearch/pc
/api/v6/playlist/detail         -> https://interface.music.163.com/eapi/v6/playlist/detail
/api/song/enhance/player/url/v1 -> https://interface.music.163.com/eapi/song/enhance/player/url/v1
```

---

## 1. 通用请求头

### 1.1 `eapi` 请求头

用于：

- 搜索歌曲：`/api/cloudsearch/pc`
- 歌单详情：`/api/v6/playlist/detail`
- 播放 URL：`/api/song/enhance/player/url/v1`

建议请求头：

```http
POST /eapi/xxx HTTP/1.1
Host: interface.music.163.com
Content-Type: application/x-www-form-urlencoded
User-Agent: NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)
Cookie: MUSIC_U=...; __csrf=...; NMTID=...; os=iPhone OS; appver=9.0.90; channel=distribution; ...
```

实际 body：

```http
params=<eapi AES-ECB 加密后的 HEX 字符串>
```

`eapi` 明文业务体里通常还要带 `header` 字段，示例：

```json
{
  "ids": "[123456]",
  "level": "standard",
  "encodeType": "flac",
  "header": {
    "osver": "iPhone OS 16.2",
    "os": "iPhone OS",
    "appver": "9.0.90",
    "versioncode": "140",
    "channel": "distribution",
    "requestId": "1710000000000_0001",
    "__csrf": "",
    "MUSIC_U": "..."
  }
}
```

### 1.2 `weapi` 请求头

用于：

- 用户歌单列表：`/api/user/playlist`

建议请求头：

```http
POST /weapi/xxx HTTP/1.1
Host: music.163.com
Content-Type: application/x-www-form-urlencoded
Referer: https://music.163.com
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0
Cookie: MUSIC_U=...; __csrf=...; NMTID=...
```

实际 body：

```http
params=<weapi 双 AES-CBC 加密结果>&encSecKey=<RSA 加密后的随机密钥>
```

---

## 2. 加密层说明

### 2.1 `weapi`

明文 JSON 会经过：

```text
AES-CBC(text, presetKey, iv)
-> AES-CBC(result, randomSecretKey, iv)
-> RSA(randomSecretKey reversed)
```

固定值：

```text
iv = 0102030405060708
presetKey = 0CoJUm6Qyw8W8jud
```

输出：

```json
{
  "params": "...",
  "encSecKey": "..."
}
```

### 2.2 `eapi`

明文 JSON 先参与 MD5 拼接：

```text
message = "nobody" + uri + "use" + jsonText + "md5forencrypt"
digest = md5(message)
payload = uri + "-36cd479b6b5-" + jsonText + "-36cd479b6b5-" + digest
```

然后：

```text
AES-ECB(payload, eapiKey)
```

固定值：

```text
eapiKey = e82ckenh8dichen8
```

输出：

```json
{
  "params": "..."
}
```

---

## 3. 搜索歌曲

推荐用 `cloudsearch`，比老搜索接口更常用。

### 3.1 上游业务 URI

```text
/api/cloudsearch/pc
```

### 3.2 实际请求 URL

```http
POST https://interface.music.163.com/eapi/cloudsearch/pc
```

### 3.3 加密方式

```text
eapi
```

### 3.4 明文请求体，加密前

```json
{
  "s": "周杰伦",
  "type": 1,
  "limit": 30,
  "offset": 0,
  "total": true
}
```

参数说明：

| 参数 | 说明 |
|---|---|
| `s` | 搜索关键词 |
| `type` | 搜索类型，`1` 表示单曲 |
| `limit` | 返回数量 |
| `offset` | 偏移量 |
| `total` | 是否返回总数 |

常见 `type`：

| type | 含义 |
|---:|---|
| `1` | 单曲 |
| `10` | 专辑 |
| `100` | 歌手 |
| `1000` | 歌单 |
| `1002` | 用户 |
| `1004` | MV |
| `1006` | 歌词 |
| `1009` | 电台 |
| `1014` | 视频 |

### 3.5 返回值重点字段

典型结构：

```json
{
  "code": 200,
  "result": {
    "songCount": 1000,
    "songs": [
      {
        "id": 123456,
        "name": "歌曲名",
        "ar": [
          {"id": 1, "name": "歌手名"}
        ],
        "al": {
          "id": 1,
          "name": "专辑名",
          "picUrl": "https://..."
        },
        "dt": 240000,
        "fee": 8,
        "privilege": {}
      }
    ]
  }
}
```

建议后端标准化成：

```json
{
  "id": "123456",
  "title": "歌曲名",
  "artist": "歌手名",
  "album": "专辑名",
  "duration": 240000,
  "cover": "https://..."
}
```

### 3.6 备用老搜索接口

业务 URI：

```text
/api/search/get
```

实际 URL：

```http
POST https://interface.music.163.com/eapi/search/get
```

明文请求体：

```json
{
  "s": "周杰伦",
  "type": 1,
  "limit": 30,
  "offset": 0
}
```

---

## 4. 获取用户歌单列表

这个用于“登录用户有哪些歌单”。

### 4.1 上游业务 URI

```text
/api/user/playlist
```

### 4.2 实际请求 URL

```http
POST https://music.163.com/weapi/user/playlist
```

### 4.3 加密方式

```text
weapi
```

### 4.4 明文请求体，加密前

```json
{
  "uid": "用户ID",
  "limit": 100,
  "offset": 0,
  "includeVideo": true,
  "csrf_token": ""
}
```

参数说明：

| 参数 | 说明 |
|---|---|
| `uid` | 网易云用户 ID，不是手机号 |
| `limit` | 返回数量 |
| `offset` | 偏移量 |
| `includeVideo` | 是否包含视频歌单信息 |
| `csrf_token` | 从 Cookie 的 `__csrf` 取；没有可传空字符串 |

### 4.5 返回值重点字段

典型结构：

```json
{
  "code": 200,
  "playlist": [
    {
      "id": 123456789,
      "name": "我喜欢的音乐",
      "trackCount": 100,
      "coverImgUrl": "https://...",
      "creator": {
        "userId": 123,
        "nickname": "昵称"
      },
      "subscribed": false
    }
  ]
}
```

建议后端标准化成：

```json
{
  "id": "123456789",
  "name": "我喜欢的音乐",
  "song_count": 100,
  "cover": "https://...",
  "creator": "昵称"
}
```

---

## 5. 获取歌单详情 / 歌单歌曲

这个用于“点进某个歌单，看里面有哪些歌”。

### 5.1 上游业务 URI

```text
/api/v6/playlist/detail
```

### 5.2 实际请求 URL

```http
POST https://interface.music.163.com/eapi/v6/playlist/detail
```

### 5.3 加密方式

```text
eapi
```

### 5.4 明文请求体，加密前

```json
{
  "id": "歌单ID",
  "n": 100000,
  "s": 8
}
```

参数说明：

| 参数 | 说明 |
|---|---|
| `id` | 歌单 ID |
| `n` | 请求歌曲数量上限 |
| `s` | 歌单最近收藏者数量，通常传 `8` |

### 5.5 返回值重点字段

典型结构：

```json
{
  "code": 200,
  "playlist": {
    "id": 123456789,
    "name": "歌单名",
    "trackCount": 100,
    "tracks": [
      {
        "id": 123,
        "name": "歌曲名",
        "ar": [{"name": "歌手"}],
        "al": {"name": "专辑", "picUrl": "https://..."},
        "dt": 240000
      }
    ],
    "trackIds": [
      {"id": 123, "v": 1}
    ]
  }
}
```

注意：

- 小歌单通常 `playlist.tracks` 已经足够。
- 大歌单可能 `tracks` 不完整，需要用 `trackIds` 再批量请求歌曲详情。

---

## 6. 歌单歌曲补全：批量歌曲详情

当 `playlist.tracks` 不完整时，用 `playlist.trackIds` 拿 ID 列表，再请求歌曲详情。

### 6.1 上游业务 URI

```text
/api/v3/song/detail
```

### 6.2 推荐实际请求 URL

可以用 `weapi`：

```http
POST https://music.163.com/weapi/v3/song/detail
```

也可以按默认 `eapi`：

```http
POST https://interface.music.163.com/eapi/v3/song/detail
```

如果你已经实现了 `weapi`，推荐用 `weapi`，因为原始 `song_detail` 模块明确指定了 `weapi`。

### 6.3 明文请求体，加密前

```json
{
  "c": "[{\"id\":123},{\"id\":456}]",
  "csrf_token": ""
}
```

参数说明：

| 参数 | 说明 |
|---|---|
| `c` | 字符串，不是数组；内容是歌曲 ID 对象数组的 JSON 字符串 |
| `csrf_token` | Cookie 中的 `__csrf`，没有可传空 |

### 6.4 返回值重点字段

典型结构：

```json
{
  "code": 200,
  "songs": [
    {
      "id": 123,
      "name": "歌曲名",
      "ar": [{"name": "歌手"}],
      "al": {"name": "专辑", "picUrl": "https://..."},
      "dt": 240000
    }
  ],
  "privileges": []
}
```

---

## 7. 获取播放 URL

推荐用新版 `/song/url/v1`，因为它用 `level` 表示音质，不再用老接口的 `br`。

### 7.1 上游业务 URI

```text
/api/song/enhance/player/url/v1
```

### 7.2 实际请求 URL

```http
POST https://interface.music.163.com/eapi/song/enhance/player/url/v1
```

### 7.3 加密方式

```text
eapi
```

### 7.4 明文请求体，加密前

```json
{
  "ids": "[123456]",
  "level": "standard",
  "encodeType": "flac"
}
```

如果 `level = "sky"`，额外加：

```json
{
  "immerseType": "c51"
}
```

参数说明：

| 参数 | 说明 |
|---|---|
| `ids` | 字符串，不是数组；例如 `"[123456]"` |
| `level` | 音质等级 |
| `encodeType` | 通常传 `flac` |

常见 `level`：

| level | 含义 |
|---|---|
| `standard` | 标准 |
| `exhigh` | 极高 |
| `lossless` | 无损 |
| `hires` | Hi-Res |
| `jyeffect` | 高清环绕声 |
| `sky` | 沉浸环绕声 |
| `jymaster` | 超清母带 |

### 7.5 返回值重点字段

典型结构：

```json
{
  "code": 200,
  "data": [
    {
      "id": 123456,
      "url": "https://...",
      "br": 128000,
      "size": 1234567,
      "md5": "...",
      "code": 200,
      "expi": 1200,
      "type": "mp3",
      "level": "standard",
      "fee": 0,
      "time": 240000
    }
  ]
}
```

### 7.6 失败判断

下面情况都应视为不可播放：

```python
not data
data[0].get("url") is None
data[0].get("code") != 200
```

建议标准化失败原因：

```json
{
  "status": "failed",
  "reason": "NO_PLAYABLE_URL",
  "message": "网易云未返回可播放地址，可能是 VIP、无版权、地区限制、歌曲下架或 Cookie 失效"
}
```

不要把这种情况当成程序异常中断整个导入流程。

---

## 8. 老版播放 URL 接口

如果你想兼容老逻辑，也可以保留：

### 8.1 上游业务 URI

```text
/api/song/enhance/player/url
```

### 8.2 实际请求 URL

```http
POST https://interface.music.163.com/eapi/song/enhance/player/url
```

### 8.3 明文请求体，加密前

```json
{
  "ids": "[\"123456\"]",
  "br": 999000
}
```

参数说明：

| 参数 | 说明 |
|---|---|
| `ids` | JSON 字符串数组 |
| `br` | 码率，例如 `128000`、`320000`、`999000` |

返回值也是：

```json
{
  "code": 200,
  "data": [
    {
      "id": 123456,
      "url": "https://...",
      "code": 200
    }
  ]
}
```

---

## 9. 建议你自己封装的 REST API

你的 Flask 后端可以暴露统一接口：

```text
GET  /music-login/netease/status
GET  /music-login/netease/playlists?offset=0&limit=100
GET  /music-login/netease/playlist-songs?playlist_id=xxx
GET  /music-login/netease/search?keyword=xxx&limit=30&offset=0
POST /music-login/netease/import-playlist
```

### 9.1 搜索歌曲返回格式

```json
{
  "songs": [
    {
      "id": "123456",
      "title": "歌曲名",
      "artist": "歌手",
      "album": "专辑",
      "duration": 240000,
      "cover": "https://..."
    }
  ],
  "count": 30
}
```

### 9.2 用户歌单返回格式

```json
{
  "playlists": [
    {
      "id": "123456789",
      "name": "我喜欢的音乐",
      "song_count": 100,
      "cover": "https://...",
      "creator": "昵称"
    }
  ],
  "count": 1
}
```

### 9.3 歌单歌曲返回格式

```json
{
  "songs": [
    {
      "id": "123456",
      "title": "歌曲名",
      "artist": "歌手",
      "album": "专辑",
      "duration": 240000,
      "cover": "https://..."
    }
  ],
  "count": 1
}
```

### 9.4 播放 URL 返回格式

```json
{
  "id": "123456",
  "url": "https://...",
  "level": "standard",
  "type": "mp3",
  "br": 128000,
  "size": 1234567
}
```

失败：

```json
{
  "id": "123456",
  "url": null,
  "reason": "NO_PLAYABLE_URL",
  "message": "网易云未返回可播放地址，可能是 VIP、无版权、地区限制、歌曲下架或 Cookie 失效"
}
```

---

## 10. 推荐落地顺序

1. Puppeteer 登录网易云，确认能拿到 `MUSIC_U`。
2. 保存完整 Cookie 到 `user_music_session`，platform 用 `netease`。
3. 实现 `weapi` 加密。
4. 先跑通 `/api/user/playlist`。
5. 实现 `eapi` 加密。
6. 跑通 `/api/cloudsearch/pc`。
7. 跑通 `/api/v6/playlist/detail`。
8. 跑通 `/api/song/enhance/player/url/v1`。
9. 导入时逐首处理，不要因为某一首 `url=null` 中断整个任务。

---

# 网易云音乐逆向源码参考索引

本目录把 `NeteaseCloudMusicApiEnhanced` 中和你当前项目相关的源码模块拆成多个 Markdown 文件。

每个文件包含：

1. 上游源码位置
2. 关键源码摘录
3. 还原后的真实上游接口
4. 请求头 / 请求体 / 返回值
5. 你在 Flask 后端里应该移植的点

> 说明：这里不把第三方仓库完整源码逐字复制打包，而是提供源码链接、关键片段和可落地的接口还原说明。需要完整源码时直接打开对应 raw 链接即可。

## 文件列表

- `cloudsearch.md`：新搜索接口，推荐用于搜索歌曲。
- `search.md`：老搜索接口，备用。
- `user_playlist.md`：获取用户歌单列表。
- `playlist_detail.md`：获取歌单详情 / 歌单歌曲。
- `song_detail.md`：根据歌曲 ID 批量补全歌曲详情。
- `song_url_v1.md`：新版播放 URL 接口，推荐。
- `song_url.md`：老版播放 URL 接口，备用。
- `crypto.md`：`weapi` / `eapi` 加密逻辑。
- `request.md`：真实 URL 转换、请求头、Cookie、加密选择逻辑。
- `option.md`：每个模块如何选择 `crypto/cookie/ua/proxy`。
