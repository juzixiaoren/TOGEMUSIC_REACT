# cloudsearch.js：搜索歌曲，推荐接口

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/cloudsearch.js
```

## 关键源码摘录

```js
const data = {
  s: query.keywords,
  type: query.type || 1,
  limit: query.limit || 30,
  offset: query.offset || 0,
  total: true,
}
return request(`/api/cloudsearch/pc`, data, createOption(query))
```

## 还原接口

业务 URI：

```text
/api/cloudsearch/pc
```

默认 `createOption(query)` 没指定 `weapi`，在 request 层通常按默认加密策略走 `eapi`。

实际请求 URL：

```http
POST https://interface.music.163.com/eapi/cloudsearch/pc
```

## 请求头

```http
Content-Type: application/x-www-form-urlencoded
User-Agent: NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)
Cookie: MUSIC_U=...; __csrf=...; NMTID=...
```

## 加密前请求体

```json
{
  "s": "周杰伦",
  "type": 1,
  "limit": 30,
  "offset": 0,
  "total": true
}
```

## Body

```http
params=<eapi 加密后的 HEX>
```

## 返回值重点字段

```json
{
  "code": 200,
  "result": {
    "songCount": 1000,
    "songs": [
      {
        "id": 123,
        "name": "歌曲名",
        "ar": [{"name": "歌手"}],
        "al": {"name": "专辑", "picUrl": "https://..."},
        "dt": 240000
      }
    ]
  }
}
```

## 你自己的 REST API 建议

```http
GET /music-login/netease/search?keyword=周杰伦&limit=30&offset=0
```

标准化返回：

```json
{
  "songs": [
    {
      "id": "123",
      "title": "歌曲名",
      "artist": "歌手",
      "album": "专辑",
      "duration": 240000,
      "cover": "https://..."
    }
  ]
}
```
