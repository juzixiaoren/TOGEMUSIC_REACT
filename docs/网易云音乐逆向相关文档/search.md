# search.js：老搜索接口，备用

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/search.js
```

## 关键源码摘录

```js
const data = {
  s: query.keywords,
  type: query.type || 1,
  limit: query.limit || 30,
  offset: query.offset || 0,
}
return request(`/api/search/get`, data, createOption(query))
```

## 还原接口

业务 URI：

```text
/api/search/get
```

实际请求 URL：

```http
POST https://interface.music.163.com/eapi/search/get
```

## 加密方式

```text
eapi
```

## 加密前请求体

```json
{
  "s": "周杰伦",
  "type": 1,
  "limit": 30,
  "offset": 0
}
```

## 返回值

结构与 `cloudsearch` 类似，但字段完整性可能略差。你的项目优先用 `cloudsearch`，这个作为 fallback。
