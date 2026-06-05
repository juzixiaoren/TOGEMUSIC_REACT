# playlist_detail.js：获取歌单详情 / 歌单歌曲

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/module/playlist_detail.js
```

## 关键源码摘录

```js
const data = {
  id: query.id,
  n: 100000,
  s: query.s || 8,
}
return request(`/api/v6/playlist/detail`, data, createOption(query))
```

## 还原接口

业务 URI：

```text
/api/v6/playlist/detail
```

实际请求 URL：

```http
POST https://interface.music.163.com/eapi/v6/playlist/detail
```

## 加密方式

```text
eapi
```

## 加密前请求体

```json
{
  "id": "歌单ID",
  "n": 100000,
  "s": 8
}
```

## 返回值重点字段

```json
{
  "code": 200,
  "playlist": {
    "id": 123456,
    "name": "歌单名",
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

## 注意

小歌单通常 `playlist.tracks` 够用。大歌单可能 `tracks` 不完整，需要用 `playlist.trackIds` 再批量请求 `song_detail`。
