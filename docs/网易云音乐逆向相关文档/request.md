# request.js：请求封装、真实 URL、Cookie、请求头

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/util/request.js
```

## 核心作用

业务模块里只写：

```js
request('/api/user/playlist', data, options)
```

`request.js` 会负责：

1. 根据 `options.crypto` 选择 `weapi/eapi/api/linuxapi`。
2. 把业务 URI 转成真实 URL。
3. 给请求体加密。
4. 构造 Cookie 和请求头。
5. 解析响应。

## weapi URL 转换

关键摘录：

```js
url = DOMAIN + '/weapi/' + uri.substr(5)
```

示例：

```text
/api/user/playlist -> https://music.163.com/weapi/user/playlist
```

## eapi URL 转换

关键摘录：

```js
url = API_DOMAIN + '/eapi/' + uri.substr(5)
```

示例：

```text
/api/song/enhance/player/url/v1
-> https://interface.music.163.com/eapi/song/enhance/player/url/v1
```

## weapi 请求头逻辑

```text
Referer: https://music.163.com
User-Agent: PC 浏览器 UA
Cookie: 原始登录 Cookie
```

同时会注入：

```json
{
  "csrf_token": "Cookie 中的 __csrf"
}
```

## eapi 请求头逻辑

`eapi` 会构造一个 `header` 对象，并放入加密前 JSON：

```json
{
  "osver": "...",
  "deviceId": "...",
  "os": "iPhone OS",
  "appver": "9.0.90",
  "versioncode": "140",
  "resolution": "1920x1080",
  "__csrf": "",
  "channel": "distribution",
  "requestId": "timestamp_random",
  "MUSIC_U": "..."
}
```

同时 HTTP Header 里也会有：

```http
User-Agent: NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)
Cookie: osver=...; os=...; appver=...; MUSIC_U=...
```

## 状态码特殊处理

源码里把这些 code 当作正常响应返回给调用方：

```text
201, 302, 400, 502, 800, 801, 802, 803
```

这个主要影响登录二维码相关状态。

## 你自己封装时的建议

你的 Python 封装可以拆成：

```python
request_weapi(uri, data, cookie)
request_eapi(uri, data, cookie)
```

然后业务层只管：

```python
cloudsearch(keyword)
user_playlists(uid)
playlist_detail(playlist_id)
song_url_v1(song_id)
```
