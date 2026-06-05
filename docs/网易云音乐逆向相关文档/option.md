# option.js：模块如何选择 crypto / cookie / ua

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/util/option.js
```

## 关键源码摘录

```js
const createOption = (query, crypto = '') => {
  return {
    crypto: query.crypto || crypto || '',
    cookie: query.cookie || process.env.NETEASE_COOKIE,
    ua: query.ua || '',
    proxy: query.proxy,
    realIP: query.realIP,
    randomCNIP: query.randomCNIP || false,
    e_r: query.e_r || undefined,
    domain: query.domain || '',
    checkToken: query.checkToken || false,
  }
}
```

## 作用

业务模块通常这样调用：

```js
createOption(query)
```

或者显式指定：

```js
createOption(query, 'weapi')
```

例如：

- `user_playlist.js` 指定 `weapi`
- `song_detail.js` 指定 `weapi`
- `cloudsearch.js` 没指定，走默认加密策略
- `song_url_v1.js` 没指定，走默认加密策略
- `playlist_detail.js` 没指定，走默认加密策略

## 对你的项目的意义

你不需要完整移植 `option.js`，只需要在 Python 中写死更清晰的调用：

```python
user_playlists -> request_weapi('/api/user/playlist', ...)
song_detail -> request_weapi('/api/v3/song/detail', ...)
cloudsearch -> request_eapi('/api/cloudsearch/pc', ...)
playlist_detail -> request_eapi('/api/v6/playlist/detail', ...)
song_url_v1 -> request_eapi('/api/song/enhance/player/url/v1', ...)
```
