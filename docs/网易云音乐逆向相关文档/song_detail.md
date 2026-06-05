# song_detail.js：批量歌曲详情补全

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/song_detail.js
```

## 关键源码摘录

```js
query.ids = query.ids.split(/\s*,\s*/)
const data = {
  c: '[' + query.ids.map((id) => '{"id":' + id + '}').join(',') + ']',
}
return request(`/api/v3/song/detail`, data, createOption(query, 'weapi'))
```

## 还原接口

业务 URI：

```text
/api/v3/song/detail
```

实际请求 URL：

```http
POST https://music.163.com/weapi/v3/song/detail
```

## 加密方式

```text
weapi
```

## 加密前请求体

```json
{
  "c": "[{"id":123},{"id":456}]",
  "csrf_token": ""
}
```

注意：`c` 是字符串，不是数组。

## 返回值重点字段

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
