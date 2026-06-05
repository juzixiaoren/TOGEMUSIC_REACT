"""
网易云音乐 API 工具类
参考：docs/网易云音乐逆向相关文档/
对标 QQMusicTool，提供搜索、播放URL、歌单等接口
"""

import re
import json
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests

from server.utils.netease_crypto import weapi_encrypt, eapi_encrypt


class NeteaseMusicTool:
    """网易云音乐上游 API 封装"""

    # 音质等级映射
    QUALITY_MAP = {
        'standard': 'standard',   # 标准 128kbps
        'exhigh': 'exhigh',       # 极高 192kbps
        'lossless': 'lossless',   # 无损 320kbps
        'hires': 'hires',         # Hi-Res
        'jyeffect': 'jyeffect',   # 高清环绕声
        'sky': 'sky',             # 沉浸环绕声
        'jymaster': 'jymaster',   # 超清母带
    }

    def __init__(self, cookie: str = '', timeout: int = 15):
        self.cookie = (cookie or '').strip()
        self.timeout = timeout

    def _post_eapi(self, uri: str, plain: Dict[str, Any]) -> Dict[str, Any]:
        """POST eapi 加密请求"""
        crypto = eapi_encrypt(uri, plain)
        # 源码逻辑: DOMAIN + '/eapi/' + uri.substr(5) → 去掉 /api 前缀
        real_uri = uri[4:] if uri.startswith('/api') else uri
        url = f'https://interface.music.163.com/eapi{real_uri}'
        headers = {
            'User-Agent': 'NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        if self.cookie:
            headers['Cookie'] = self.cookie

        resp = requests.post(url, data={'params': crypto['params']},
                             headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def _post_weapi(self, uri: str, plain: Dict[str, Any]) -> Dict[str, Any]:
        """POST weapi 加密请求"""
        crypto = weapi_encrypt(plain)
        # 源码逻辑: DOMAIN + '/weapi/' + uri.substr(5) → 去掉 /api 前缀
        real_uri = uri[4:] if uri.startswith('/api') else uri
        url = f'https://music.163.com/weapi{real_uri}'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/124.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://music.163.com',
        }
        if self.cookie:
            headers['Cookie'] = self.cookie

        resp = requests.post(url,
                             data={'params': crypto['params'], 'encSecKey': crypto['encSecKey']},
                             headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def _get_public(self, uri: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """GET 公开接口（无需加密，但支持cookie）"""
        url = f'https://music.163.com{uri}'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://music.163.com/',
        }
        if self.cookie:
            headers['Cookie'] = self.cookie
        resp = requests.get(url, params=params, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # ===================== 公开API（无需cookie） =====================

    def search(self, keyword: str, search_type: int = 1,
               limit: int = 30, offset: int = 0, origin: bool = False) -> Any:
        """
        搜索歌曲
        search_type: 1=单曲, 10=专辑, 100=歌手, 1000=歌单
        """
        plain = {
            's': keyword,
            'type': search_type,
            'limit': limit,
            'offset': offset,
            'total': True,
        }
        data = self._post_eapi('/api/cloudsearch/pc', plain)
        if origin:
            return data
        return data.get('result', {})

    def get_song_url(self, song_id: int, level: str = 'standard',
                     origin: bool = False) -> Any:
        """
        获取播放URL
        level: standard/exhigh/lossless/hires/jyeffect/sky/jymaster
        """
        level = self.QUALITY_MAP.get(level, 'standard')
        plain = {
            'ids': f'[{song_id}]',
            'level': level,
            'encodeType': 'flac',
            'header': {
                'os': 'iPhone OS',
                'osver': '16.2',
                'appver': '9.0.90',
                'versioncode': '140',
                'channel': 'distribution',
            }
        }
        data = self._post_eapi('/api/song/enhance/player/url/v1', plain)
        if origin:
            return data
        items = data.get('data', [])
        return items[0] if items else None

    # ===================== 需要cookie的API =====================

    def get_user_playlists(self, uid: str, limit: int = 100,
                           offset: int = 0, origin: bool = False) -> Any:
        """获取用户歌单列表（需要cookie）"""
        plain = {
            'uid': str(uid),
            'limit': limit,
            'offset': offset,
            'includeVideo': True,
            'csrf_token': self._extract_csrf(),
        }
        data = self._post_weapi('/api/user/playlist', plain)
        if origin:
            return data
        return data.get('playlist', [])

    def get_playlist_detail(self, playlist_id: int, origin: bool = False) -> Any:
        """获取歌单详情（公开或需cookie）"""
        plain = {
            'id': playlist_id,
            'n': 100000,
            's': 8,
            'header': {
                'os': 'iPhone OS',
                'appver': '9.0.90',
            }
        }
        data = self._post_eapi('/api/v6/playlist/detail', plain)
        if origin:
            return data
        return data.get('playlist', {})

    def get_song_detail(self, song_ids: List[int], origin: bool = False) -> Any:
        """批量获取歌曲详情（需要cookie）"""
        c = json.dumps([{'id': sid} for sid in song_ids])
        plain = {
            'c': c,
            'csrf_token': self._extract_csrf(),
        }
        data = self._post_weapi('/api/v3/song/detail', plain)
        if origin:
            return data
        return data.get('songs', [])

    def get_user_account(self, origin: bool = False) -> Any:
        """获取当前登录用户信息（需要cookie）"""
        data = self._get_public('/api/nuser/account/get', {})
        if origin:
            return data
        return data.get('profile', {})

    # ===================== 工具方法 =====================

    def _extract_csrf(self) -> str:
        """从cookie中提取 __csrf"""
        match = re.search(r'__csrf=([^;]+)', self.cookie)
        return match.group(1) if match else ''

    def extract_uid(self) -> str:
        """从cookie中提取用户uid（MUSIC_U 解码或API获取）"""
        # 方法1: 通过API获取
        try:
            profile = self.get_user_account()
            if profile and profile.get('userId'):
                return str(profile['userId'])
        except Exception:
            pass
        return ''

    def extract_music_u(self) -> str:
        """从cookie中提取 MUSIC_U"""
        match = re.search(r'MUSIC_U=([^;]+)', self.cookie)
        return match.group(1) if match else ''


def format_netease_song(song: Dict[str, Any]) -> Dict[str, Any]:
    """将网易云歌曲数据格式化为标准格式"""
    artists = '/'.join([a.get('name', '') for a in song.get('ar', [])])
    album = song.get('al', {})
    return {
        'id': song.get('id'),
        'title': song.get('name', ''),
        'artist': artists,
        'album': album.get('name', ''),
        'duration': song.get('dt', 0),
        'cover': album.get('picUrl', ''),
        'fee': song.get('fee', 0),
    }


def format_netease_playlist(pl: Dict[str, Any]) -> Dict[str, Any]:
    """将网易云歌单数据格式化为标准格式"""
    creator = pl.get('creator', {})
    return {
        'id': str(pl.get('id', '')),
        'name': pl.get('name', ''),
        'song_count': pl.get('trackCount', 0),
        'cover': pl.get('coverImgUrl', ''),
        'creator': creator.get('nickname', ''),
    }


if __name__ == '__main__':
    # 测试
    tool = NeteaseMusicTool()
    print('=== 搜索测试 ===')
    result = tool.search('晴天 周杰伦', limit=3)
    songs = result.get('songs', [])
    for s in songs:
        fmt = format_netease_song(s)
        print(f"  id={fmt['id']} {fmt['title']} - {fmt['artist']}")

    if songs:
        sid = songs[0]['id']
        print(f'\n=== 播放URL测试 (id={sid}) ===')
        url_data = tool.get_song_url(sid)
        if url_data:
            print(f"  url: {str(url_data.get('url', ''))[:80]}")
            print(f"  code: {url_data.get('code')}")
            print(f"  type: {url_data.get('type')}")
        else:
            print('  无数据')

    print('\n=== 歌单详情测试 (热歌榜 3778678) ===')
    pl = tool.get_playlist_detail(3778678)
    if pl:
        fmt = format_netease_playlist(pl)
        print(f"  name: {fmt['name']}")
        print(f"  trackCount: {fmt['song_count']}")
        tracks = pl.get('tracks', [])
        print(f"  返回tracks: {len(tracks)} 首")
