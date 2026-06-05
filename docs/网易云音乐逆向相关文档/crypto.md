# crypto.js：weapi / eapi 加密逻辑

## 上游源码

完整源码：

```text
https://raw.githubusercontent.com/TH911/NeteaseCloudMusicApi/main/util/crypto.js
```

## 固定值

```text
iv = 0102030405060708
presetKey = 0CoJUm6Qyw8W8jud
eapiKey = e82ckenh8dichen8
```

## weapi 关键逻辑

关键摘录：

```js
params = AES-CBC(AES-CBC(JSON.stringify(object), presetKey, iv), secretKey, iv)
encSecKey = RSA(secretKey.reverse(), publicKey)
```

还原说明：

1. 生成 16 位随机 `secretKey`。
2. 明文 JSON 先用 `presetKey` 做 AES-CBC。
3. 第一次结果再用随机 `secretKey` 做 AES-CBC。
4. `secretKey` 反转后用 RSA raw/no padding 加密，得到 `encSecKey`。

输出：

```json
{
  "params": "...",
  "encSecKey": "..."
}
```

## eapi 关键逻辑

关键摘录：

```js
message = `nobody${url}use${text}md5forencrypt`
digest = MD5(message)
data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
params = AES-ECB(data, eapiKey)
```

输出：

```json
{
  "params": "HEX_STRING"
}
```

## 你移植到 Python 时需要的库

```bash
pip install pycryptodome
```

需要实现：

- PKCS7 padding
- AES-CBC base64
- AES-ECB hex uppercase
- RSA raw/no padding
- MD5
