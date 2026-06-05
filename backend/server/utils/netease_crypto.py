"""
网易云音乐加密工具：weapi / eapi 加密逻辑
参考：docs/网易云音乐逆向相关文档/crypto.md
"""

import base64
import hashlib
import json
import os
import binascii
from typing import Dict, Any

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

# 固定密钥
IV = b'0102030405060708'
PRESET_KEY = b'0CoJUm6Qyw8W8jud'
EA_KEY = b'e82ckenh8dichen8'

# RSA 公钥（用于 weapi 第二层加密）
RSA_PUBLIC_KEY = (
    '-----BEGIN PUBLIC KEY-----\n'
    'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxZS3e0S2lK3uJ2MFmSN0sNkz3PL0z5pVbG2g3f5tB4H3P3c1Q9o5BZJj7M3sJ9dP3p7RvF7j2j0eG1v7R1kHQQIDAQAB\n'
    '-----END PUBLIC KEY-----'
)

# RSA 公钥的 modulus（用于原始 RSA 加密）
RSA_MODULUS = (
    '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7'
    'b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280'
    '104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932'
    '575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b'
    '3ece0462db0a22b8e7'
)
RSA_EXPONENT = '10001'


def _aes_cbc_encrypt(data: bytes, key: bytes, iv: bytes) -> bytes:
    """AES-CBC 加密，PKCS7 填充"""
    cipher = AES.new(key, AES.MODE_CBC, iv)
    padded = pad(data, AES.block_size, style='pkcs7')
    return cipher.encrypt(padded)


def _aes_ecb_encrypt(data: bytes, key: bytes) -> bytes:
    """AES-ECB 加密，PKCS7 填充"""
    cipher = AES.new(key, AES.MODE_ECB)
    padded = pad(data, AES.block_size, style='pkcs7')
    return cipher.encrypt(padded)


def _rsa_encrypt(data: bytes) -> str:
    """RSA 原始加密（no padding），data 是反转后的随机密钥"""
    # 网易云用的是 RSA raw/no padding，手动实现
    # 把 data 当作大整数，计算 pow(data, e, n)
    n = int(RSA_MODULUS, 16)
    e = int(RSA_EXPONENT, 16)

    # data 转大整数（小端序，因为 JS 的 reverse 是字符串反转）
    # 实际上 data 是 16 字节的 ASCII 字符串反转后的 bytes
    text = data[::-1]  # 反转
    # 转为十六进制整数
    bi = int(binascii.hexlify(text), 16)
    # RSA 加密: c = m^e mod n
    ci = pow(bi, e, n)
    # 转回十六进制字符串，补齐 256 字节（128 位 = 256 hex chars）
    result = format(ci, 'x').zfill(256)
    return result


def weapi_encrypt(plain: Dict[str, Any]) -> Dict[str, str]:
    """
    weapi 加密：双层 AES-CBC + RSA
    用于：/weapi/user/playlist, /weapi/v3/song/detail
    """
    text = json.dumps(plain, separators=(',', ':'))

    # 第一层 AES-CBC
    step1 = _aes_cbc_encrypt(text.encode('utf-8'), PRESET_KEY, IV)
    step1_b64 = base64.b64encode(step1)

    # 生成 16 位随机密钥
    secret_key = os.urandom(16)
    secret_key_hex = binascii.hexlify(secret_key)[:16]  # 16 字节 = 32 hex，取前 16 字符

    # 第二层 AES-CBC
    step2 = _aes_cbc_encrypt(step1_b64, secret_key_hex, IV)
    params = base64.b64encode(step2).decode('utf-8')

    # RSA 加密随机密钥
    enc_sec_key = _rsa_encrypt(secret_key_hex)

    return {
        'params': params,
        'encSecKey': enc_sec_key
    }


def eapi_encrypt(url: str, plain: Dict[str, Any]) -> Dict[str, str]:
    """
    eapi 加密：MD5 摘要 + AES-ECB
    用于：/eapi/cloudsearch/pc, /eapi/v6/playlist/detail, /eapi/song/enhance/player/url/v1
    """
    text = json.dumps(plain, separators=(',', ':'))

    # MD5 摘要
    message = f'nobody{url}use{text}md5forencrypt'
    digest = hashlib.md5(message.encode('utf-8')).hexdigest()

    # 拼接
    data = f'{url}-36cd479b6b5-{text}-36cd479b6b5-{digest}'

    # AES-ECB 加密
    encrypted = _aes_ecb_encrypt(data.encode('utf-8'), EA_KEY)
    params = binascii.hexlify(encrypted).upper().decode('utf-8')

    return {
        'params': params
    }


if __name__ == '__main__':
    # 测试加密
    print('=== weapi 测试 ===')
    result = weapi_encrypt({'uid': '123', 'limit': 10, 'offset': 0, 'csrf_token': ''})
    print(f'params: {result["params"][:50]}...')
    print(f'encSecKey: {result["encSecKey"][:50]}...')

    print('\n=== eapi 测试 ===')
    result = eapi_encrypt('/api/cloudsearch/pc', {'s': '周杰伦', 'type': 1, 'limit': 10})
    print(f'params: {result["params"][:50]}...')
