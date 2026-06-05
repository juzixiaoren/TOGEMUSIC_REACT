# user_playlist.js：获取用户歌单列表

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/user_playlist.js
```

## 关键源码摘录

```js
const data = {
  uid: query.uid,
  limit: query.limit || 30,
  offset: query.offset || 0,
  includeVideo: true,
}
return request(`/api/user/playlist`, data, createOption(query, 'weapi'))
```

## 还原接口

业务 URI：

```text
/api/user/playlist
```

实际请求 URL：

```http
POST https://music.163.com/weapi/user/playlist
```

## 加密方式

```text
weapi
```

## 请求头

```http
Content-Type: application/x-www-form-urlencoded
Referer: https://music.163.com
User-Agent: Mozilla/5.0 ... Chrome/124 ...
Cookie: MUSIC_U=...; __csrf=...; NMTID=...
```

## 加密前请求体

```json
{
  "uid": "网易云用户ID",
  "limit": 100,
  "offset": 0,
  "includeVideo": true,
  "csrf_token": ""
}
```

`csrf_token` 由 request 层从 Cookie 的 `__csrf` 注入；没有时可为空。

## Body

```http
params=<weapi 加密结果>&encSecKey=<RSA 加密随机密钥>
```

## 返回值重点字段

```json
{
  "code": 200,
  "playlist": [
    {
      "id": 123456789,
      "name": "我喜欢的音乐",
      "trackCount": 100,
      "coverImgUrl": "https://...",
      "creator": {"nickname": "昵称"}
    }
  ]
}
```

## 你自己的 REST API 建议

```http
GET /music-login/netease/playlists?offset=0&limit=100
```

标准化：

```json
{
  "id": "123456789",
  "name": "我喜欢的音乐",
  "song_count": 100,
  "cover": "https://...",
  "creator": "昵称"
}
```
