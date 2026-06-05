# song_url.js：老版播放 URL，备用

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/song_url.js
```

## 关键源码摘录

```js
const ids = String(query.id).split(',')
const data = {
  ids: JSON.stringify(ids),
  br: parseInt(query.br || 999000),
}
return request(`/api/song/enhance/player/url`, data, createOption(query))
```

## 还原接口

业务 URI：

```text
/api/song/enhance/player/url
```

实际请求 URL：

```http
POST https://interface.music.163.com/eapi/song/enhance/player/url
```

## 加密方式

```text
eapi
```

## 加密前请求体

```json
{
  "ids": "["123456"]",
  "br": 999000
}
```

## 返回值重点字段

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

你的项目建议优先用 `song_url_v1`。
