# song_url_v1.js：新版播放 URL，推荐

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/song_url_v1.js
```

## 关键源码摘录

```js
const data = {
  ids: '[' + query.id + ']',
  level: query.level,
  encodeType: 'flac',
}
if (data.level == 'sky') {
  data.immerseType = 'c51'
}
return request(`/api/song/enhance/player/url/v1`, data, createOption(query))
```

## 还原接口

业务 URI：

```text
/api/song/enhance/player/url/v1
```

实际请求 URL：

```http
POST https://interface.music.163.com/eapi/song/enhance/player/url/v1
```

## 加密方式

```text
eapi
```

## 加密前请求体

```json
{
  "ids": "[123456]",
  "level": "standard",
  "encodeType": "flac"
}
```

如果 `level = sky`：

```json
{
  "immerseType": "c51"
}
```

## level 可选值

```text
standard
exhigh
lossless
hires
jyeffect
sky
jymaster
```

## 返回值重点字段

```json
{
  "code": 200,
  "data": [
    {
      "id": 123456,
      "url": "https://...",
      "br": 128000,
      "size": 1234567,
      "code": 200,
      "expi": 1200,
      "type": "mp3",
      "level": "standard",
      "fee": 0
    }
  ]
}
```

## 失败判断

下面情况都当作不可播放：

```python
not data
data[0].get("url") is None
data[0].get("code") != 200
```

建议返回：

```json
{
  "reason": "NO_PLAYABLE_URL",
  "message": "网易云未返回可播放地址，可能是 VIP、无版权、地区限制、歌曲下架或 Cookie 失效"
}
```
