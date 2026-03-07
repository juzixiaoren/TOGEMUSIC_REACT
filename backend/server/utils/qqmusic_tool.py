import re
import json
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests


class QQMusicTool:
    """QQ Music upstream helper used by backend routes."""

    _QUALITY_MAP = {
        'm4a': ('C400', 'm4a'),
        '128': ('M500', 'mp3'),
        '320': ('M800', 'mp3'),
    }

    def __init__(self, cookie_header: str = '', timeout: int = 15):
        self.cookie_header = (cookie_header or '').strip()
        self.timeout = timeout

    def _request_json(
        self,
        url: str,
        *,
        method: str = 'GET',
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        req_headers = {
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://y.qq.com/',
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/123.0.0.0 Safari/537.36'
            ),
        }
        if self.cookie_header:
            req_headers['Cookie'] = self.cookie_header
        if headers:
            req_headers.update(headers)

        response = requests.request(
            method=method,
            url=url,
            params=params,
            json=json_data,
            headers=req_headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def get_music_url(self, songmid: str, quality: str = '320', origin: bool = False) -> Any:
        quality_key = str(quality or '320').lower()
        prefix, suffix = self._QUALITY_MAP.get(quality_key, self._QUALITY_MAP['320'])
        payload = {
            'req_1': {
                'module': 'vkey.GetVkeyServer',
                'method': 'CgiGetVkey',
                'param': {
                    'filename': [f'{prefix}{songmid}{songmid}.{suffix}'],
                    'guid': '10000',
                    'songmid': [songmid],
                    'songtype': [0],
                    'uin': '0',
                    'loginflag': 1,
                    'platform': '20',
                },
            },
            'loginUin': '0',
            'comm': {'uin': '0', 'format': 'json', 'ct': 24, 'cv': 0},
        }
        data = self._request_json(
            'https://u.y.qq.com/cgi-bin/musicu.fcg',
            method='POST',
            json_data=payload,
            headers={'Content-Type': 'application/json;charset=UTF-8'},
        )
        if origin:
            return data

        req_data = (((data or {}).get('req_1') or {}).get('data') or {})
        sip = req_data.get('sip') or []
        mid_url_info = req_data.get('midurlinfo') or []
        base_url = sip[0] if sip else ''
        purl = (mid_url_info[0] or {}).get('purl') if mid_url_info else ''
        return f'{base_url}{purl}' if purl else ''

    def get_song_list(self, category_id: str, origin: bool = False) -> Any:
        data = self._request_json(
            'https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg',
            params={
                'type': 1,
                'json': 1,
                'utf8': 1,
                'onlysong': 0,
                'nosign': 1,
                'disstid': category_id,
                'g_tk': 5381,
                'loginUin': 0,
                'hostUin': 0,
                'format': 'json',
                'inCharset': 'GB2312',
                'outCharset': 'utf-8',
                'notice': 0,
                'platform': 'yqq',
                'needNewCode': 0,
            },
        )
        if origin:
            return data
        return ((data.get('cdlist') or [{}])[0] or {}).get('songlist') or []

    def get_song_list_name(self, category_id: str, origin: bool = False) -> Any:
        data = self.get_song_list(category_id, origin=True)
        if origin:
            return data
        return ((data.get('cdlist') or [{}])[0] or {}).get('dissname')

    def search_with_keyword(
        self,
        keyword: str,
        search_type: int = 0,
        result_num: int = 50,
        page_num: int = 1,
        origin: bool = False,
    ) -> Any:
        payload = {
            'comm': {'ct': '19', 'cv': '1859', 'uin': '0'},
            'req': {
                'method': 'DoSearchForQQMusicDesktop',
                'module': 'music.search.SearchCgiService',
                'param': {
                    'grp': 1,
                    'num_per_page': int(result_num),
                    'page_num': int(page_num),
                    'query': keyword,
                    'search_type': int(search_type),
                },
            },
        }
        data = self._request_json(
            'https://u.y.qq.com/cgi-bin/musicu.fcg',
            method='POST',
            json_data=payload,
            headers={'Content-Type': 'application/json;charset=UTF-8'},
        )
        if origin:
            return data

        body = ((((data or {}).get('req') or {}).get('data') or {}).get('body') or {})
        type_map = {
            0: 'song',
            2: 'album',
            3: 'songlist',
            4: 'mv',
            7: 'song',
            8: 'user',
        }
        key = type_map.get(int(search_type))
        return body.get(key) if key else body

    def get_song_lyric(self, songmid: str, parse: bool = False, origin: bool = False) -> Any:
        data = self._request_json(
            'https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg',
            params={
                'songmid': songmid,
                'g_tk': 5381,
                'format': 'json',
                'inCharset': 'utf8',
                'outCharset': 'utf-8',
                'nobase64': 1,
            },
        )
        if origin:
            return data
        if not parse:
            return f"{data.get('lyric', '')}\n{data.get('trans', '')}".strip()
        return self.parse_lyric(f"{data.get('lyric', '')}\n{data.get('trans', '')}")

    def get_album_song_list(self, album_mid: str, origin: bool = False) -> Any:
        data = self._request_json(
            'https://i.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg',
            params={
                'platform': 'h5page',
                'albummid': album_mid,
                'g_tk': 938407465,
                'uin': 0,
                'format': 'json',
                'inCharset': 'utf-8',
                'outCharset': 'utf-8',
                'notice': 0,
                'needNewCode': 1,
                '_': 1459961045571,
            },
        )
        if origin:
            return data
        return ((data.get('data') or {}).get('list')) or []

    def get_album_name(self, album_mid: str, origin: bool = False) -> Any:
        data = self.get_album_song_list(album_mid, origin=True)
        if origin:
            return data
        return (data.get('data') or {}).get('name')

    def get_mv_info(self, vid: str, origin: bool = True) -> Any:
        payload = {
            'comm': {
                'ct': 6,
                'cv': 0,
                'g_tk': 1646675364,
                'uin': 0,
                'format': 'json',
                'platform': 'yqq',
            },
            'mvInfo': {
                'module': 'music.video.VideoData',
                'method': 'get_video_info_batch',
                'param': {
                    'vidlist': [vid],
                    'required': [
                        'vid', 'type', 'sid', 'cover_pic', 'duration', 'singers',
                        'new_switch_str', 'video_pay', 'hint', 'code', 'msg', 'name',
                        'desc', 'playcnt', 'pubdate', 'isfav', 'fileid', 'filesize_v2',
                        'switch_pay_type', 'pay', 'pay_info', 'uploader_headurl',
                        'uploader_nick', 'uploader_uin', 'uploader_encuin',
                        'play_forbid_reason',
                    ],
                },
            },
            'mvUrl': {
                'module': 'music.stream.MvUrlProxy',
                'method': 'GetMvUrls',
                'param': {'vids': [vid], 'request_type': 10003, 'addrtype': 3, 'format': 264, 'maxFiletype': 60},
            },
        }
        data = self._request_json(
            'https://u.y.qq.com/cgi-bin/musicu.fcg',
            method='POST',
            json_data=payload,
            headers={'Content-Type': 'application/json;charset=UTF-8'},
        )
        return data if origin else data

    def get_singer_info(self, singer_mid: str, origin: bool = False) -> Any:
        data_param = {
            'comm': {'ct': 24, 'cv': 0},
            'singer': {
                'method': 'get_singer_detail_info',
                'param': {'sort': 5, 'singermid': singer_mid, 'sin': 0, 'num': 50},
                'module': 'music.web_singer_info_svr',
            },
        }
        data = self._request_json(
            'https://u.y.qq.com/cgi-bin/musicu.fcg',
            params={
                'format': 'json',
                'loginUin': 0,
                'hostUin': 0,
                'inCharset': 'utf8',
                'outCharset': 'utf-8',
                'platform': 'yqq.json',
                'needNewCode': 0,
                'data': quote(str(data_param).replace("'", '"')),
            },
        )
        if origin:
            return data
        return ((data.get('singer') or {}).get('data'))

    def get_song_detail(self, songmid: str, origin: bool = False) -> Any:
        payload = {
            'songinfo': {
                'method': 'get_song_detail_yqq',
                'module': 'music.pf_song_detail_svr',
                'param': {
                    'song_mid': songmid,
                },
            },
        }
        data = self._request_json(
            'https://u.y.qq.com/cgi-bin/musicu.fcg',
            params={'data': json.dumps(payload, ensure_ascii=False)},
        )
        if origin:
            return data
        return ((data.get('songinfo') or {}).get('data')) or {}

    def get_song_cover_image(self, songmid: str) -> Optional[str]:
        detail = self.get_song_detail(songmid=songmid, origin=False)
        track_info = detail.get('track_info') if isinstance(detail, dict) else {}
        album = track_info.get('album') if isinstance(track_info, dict) else {}
        album_mid = album.get('mid') if isinstance(album, dict) else None
        if not album_mid:
            return None
        return self.get_album_cover_image(album_mid)

    @staticmethod
    def get_album_cover_image(album_mid: str) -> str:
        return f'https://y.gtimg.cn/music/photo_new/T002R300x300M000{album_mid}.jpg'

    @staticmethod
    def parse_lyric(lyric_text: str) -> List[Dict[str, Any]]:
        """Parse [mm:ss.xx] lyric to sorted timestamp rows."""
        rows: List[Dict[str, Any]] = []
        for line in (lyric_text or '').splitlines():
            matches = re.findall(r'\[(\d+):(\d+)(?:\.(\d+))?\]', line)
            content = re.sub(r'\[[^\]]+\]', '', line).strip()
            if not matches:
                if content:
                    rows.append({'time_ms': 0, 'text': content})
                continue
            for minute, second, milli in matches:
                ms = int(minute) * 60000 + int(second) * 1000
                if milli:
                    ms += int(milli.ljust(3, '0')[:3])
                rows.append({'time_ms': ms, 'text': content})

        rows.sort(key=lambda x: x['time_ms'])
        return rows
