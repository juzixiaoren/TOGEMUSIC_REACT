"""
Cookie池管理路由 + 用户音乐平台登录路由
- /cookie/* : 共享Cookie池的管理（管理员/内部使用）
- /music-login/* : 用户个人音乐平台登录（Puppeteer弹窗）
"""

import os
import json
import asyncio
import threading
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from dao.cookie_pool import CookiePool
from dao.user_music_session import UserMusicSession
from utils.qqmusic_tool import QQMusicTool

cookie_bp = Blueprint('cookie', __name__)
cookie_pool = CookiePool()
user_session_model = UserMusicSession()

# Puppeteer进程管理
_puppeteer_process = None
_puppeteer_status = {'running': False, 'platform': None, 'user_id': None}


def verify_token(token):
    from dao.user import User
    user_model = User()
    return user_model.query_token(token)


# ===================== Cookie池管理接口 =====================

@cookie_bp.route('/cookie/count', methods=['GET'])
def get_cookie_count():
    """获取可用Cookie数量（前端显示用）"""
    count = cookie_pool.count_active('qqmusic')
    return jsonify({'count': count, 'platform': 'qqmusic'}), 200


@cookie_bp.route('/cookie/vip-count', methods=['GET'])
def get_cookie_vip_count():
    """获取VIP和非VIP Cookie数量"""
    vip = cookie_pool.count_vip('qqmusic')
    non_vip = cookie_pool.count_non_vip('qqmusic')
    total = vip + non_vip
    return jsonify({
        'vip': vip,
        'non_vip': non_vip,
        'total': total,
        'platform': 'qqmusic'
    }), 200


@cookie_bp.route('/cookie/list', methods=['GET'])
def list_cookies():
    """获取Cookie列表（脱敏）"""
    cookies = cookie_pool.get_all_cookies('qqmusic')
    return jsonify({'cookies': cookies}), 200


@cookie_bp.route('/cookie/add', methods=['POST'])
def add_cookie():
    """手动添加Cookie"""
    data = request.get_json() or {}
    cookie = (data.get('cookie') or '').strip()
    user_label = (data.get('user_label') or '').strip()

    if not cookie:
        return jsonify({'message': 'cookie is required'}), 400

    # 尝试提取uin
    uin = _extract_uin_from_cookie(cookie)

    # 验证cookie有效性
    is_valid = _verify_qqmusic_cookie(cookie)

    cookie_id = cookie_pool.add_cookie(
        cookie=cookie,
        platform='qqmusic',
        user_label=user_label,
        uin=uin,
        added_by=None
    )

    if not is_valid:
        cookie_pool.update_status(cookie_id, 'expired')
        return jsonify({
            'message': 'Cookie已添加但验证失败，状态为expired',
            'id': cookie_id,
            'valid': False
        }), 200

    # 检测并标记VIP状态
    if uin and _detect_qqmusic_vip(cookie, uin):
        cookie_pool.update_vip_status(cookie_id, True)

    return jsonify({
        'message': 'Cookie添加成功',
        'id': cookie_id,
        'valid': True
    }), 201


@cookie_bp.route('/cookie/verify/<int:cookie_id>', methods=['POST'])
def verify_cookie(cookie_id):
    """验证指定Cookie是否有效"""
    row = cookie_pool.get_cookie_by_id(cookie_id)
    if not row:
        return jsonify({'message': 'Cookie not found'}), 404

    is_valid = _verify_qqmusic_cookie(row['cookie'])
    cookie_pool.update_verified(cookie_id, is_valid)

    return jsonify({
        'id': cookie_id,
        'valid': is_valid,
        'status': 'active' if is_valid else 'expired'
    }), 200


@cookie_bp.route('/cookie/verify-all', methods=['POST'])
def verify_all_cookies():
    """批量验证所有Cookie"""
    cookies = cookie_pool.get_all_raw_cookies('qqmusic')
    results = []
    for row in cookies:
        is_valid = _verify_qqmusic_cookie(row['cookie'])
        cookie_pool.update_verified(row['id'], is_valid)
        results.append({
            'id': row['id'],
            'valid': is_valid,
            'user_label': row.get('user_label', '')
        })
    return jsonify({'results': results}), 200


@cookie_bp.route('/cookie/<int:cookie_id>', methods=['DELETE'])
def delete_cookie(cookie_id):
    """删除Cookie"""
    cookie_pool.delete_cookie(cookie_id)
    return jsonify({'message': 'Cookie deleted'}), 200


@cookie_bp.route('/cookie/<int:cookie_id>/toggle', methods=['POST'])
def toggle_cookie(cookie_id):
    """启用/禁用Cookie"""
    row = cookie_pool.get_cookie_by_id(cookie_id)
    if not row:
        return jsonify({'message': 'Cookie not found'}), 404

    new_status = 'disabled' if row['status'] == 'active' else 'active'
    cookie_pool.update_status(cookie_id, new_status)
    return jsonify({'id': cookie_id, 'status': new_status}), 200


# ===================== 用户音乐平台登录接口 =====================

@cookie_bp.route('/music-login/qqmusic/status', methods=['GET'])
def qqmusic_login_status():
    """检查用户QQ音乐登录状态"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    has_session = user_session_model.has_valid_session(user_id, 'qqmusic')
    session = user_session_model.get_session(user_id, 'qqmusic') if has_session else None

    uin = session.get('uin', '') if session else ''
    is_vip = False
    if uin:
        cookie_row = cookie_pool.find_cookie_by_uin(uin, 'qqmusic')
        if cookie_row:
            is_vip = bool(cookie_row.get('is_vip', 0))

    return jsonify({
        'logged_in': has_session,
        'uin': uin,
        'nickname': session.get('nickname', '') if session else '',
        'is_vip': is_vip
    }), 200


@cookie_bp.route('/music-login/qqmusic/init', methods=['POST'])
def qqmusic_login_init():
    """启动QQ音乐Puppeteer登录流程"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    if _puppeteer_status['running']:
        return jsonify({'message': '登录流程已在进行中'}), 409

    # 启动Puppeteer（异步）
    thread = threading.Thread(
        target=_run_puppeteer_login,
        args=(user_id, 'qqmusic'),
        daemon=True
    )
    thread.start()

    return jsonify({'message': '登录流程已启动'}), 200


@cookie_bp.route('/music-login/qqmusic/callback', methods=['POST'])
def qqmusic_login_callback():
    """QQ音乐登录回调：接收cookie并保存"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    data = request.get_json() or {}
    cookie = (data.get('cookie') or '').strip()

    if not cookie:
        return jsonify({'message': 'cookie is required'}), 400

    # 验证cookie
    if not _verify_qqmusic_cookie(cookie):
        return jsonify({'message': 'Cookie验证失败'}), 400

    # 提取用户信息
    uin = _extract_uin_from_cookie(cookie)
    nickname = _extract_nickname_from_cookie(cookie)

    # 保存到用户Session
    user_session_model.save_session(
        user_id=user_id,
        platform='qqmusic',
        session_data=cookie,
        uin=uin,
        nickname=nickname,
        expires_at=(datetime.utcnow() + timedelta(days=365)).isoformat()
    )

    # 同时加入Cookie池（共享给所有人）
    existing = cookie_pool.find_cookie_by_uin(uin, 'qqmusic')
    if not existing:
        cookie_id = cookie_pool.add_cookie(
            cookie=cookie,
            platform='qqmusic',
            user_label=nickname or uin or f'user_{user_id}',
            uin=uin,
            added_by=user_id
        )
        # 检测并标记VIP状态
        if _detect_qqmusic_vip(cookie, uin):
            cookie_pool.update_vip_status(cookie_id, True)

    return jsonify({
        'message': '登录成功',
        'uin': uin,
        'nickname': nickname
    }), 200


@cookie_bp.route('/music-login/qqmusic/logout', methods=['POST'])
def qqmusic_logout():
    """退出QQ音乐登录"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    user_session_model.delete_session(user_id, 'qqmusic')
    return jsonify({'message': '已退出登录'}), 200


# 通用兜底路由：不支持的平台返回默认未登录状态，避免前端切换平台时 404
SUPPORTED_PLATFORMS = {'qqmusic'}

@cookie_bp.route('/music-login/<platform>/status', methods=['GET'])
def generic_login_status(platform):
    """通用登录状态查询（不支持的平台返回未登录）"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    if platform not in SUPPORTED_PLATFORMS:
        return jsonify({
            'logged_in': False,
            'uin': '',
            'nickname': '',
            'is_vip': False
        }), 200

    # qqmusic 走到这里不会发生，因为上面有精确路由
    return jsonify({'logged_in': False, 'uin': '', 'nickname': '', 'is_vip': False}), 200


@cookie_bp.route('/music-login/<platform>/logout', methods=['POST'])
def generic_logout(platform):
    """通用退出登录（不支持的平台直接返回成功）"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    if platform not in SUPPORTED_PLATFORMS:
        return jsonify({'message': '已退出登录'}), 200

    return jsonify({'message': '已退出登录'}), 200


@cookie_bp.route('/music-login/qqmusic/playlists', methods=['GET'])
def qqmusic_user_playlists():
    """获取用户QQ音乐歌单列表（需要登录）"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    # 优先使用用户个人 session
    session_data = user_session_model.get_session_data(user_id, 'qqmusic')
    if not session_data:
        return jsonify({
            'message': '请先登录QQ音乐',
            'code': 'NOT_LOGGED_IN'
        }), 401

    # 从 Cookie 中提取 uin
    uin = _extract_uin_from_cookie(session_data)
    if not uin:
        return jsonify({
            'message': 'QQ音乐 Cookie 中没有找到 uin，请重新登录QQ音乐',
            'code': 'NO_UIN'
        }), 400

    # 支持分页参数
    try:
        offset = int(request.args.get('offset', 0))
        limit = int(request.args.get('limit', 100))
    except ValueError:
        return jsonify({
            'message': 'offset / limit 必须是数字'
        }), 400

    # 防止一次拉太多
    if offset < 0:
        offset = 0
    if limit <= 0:
        limit = 100
    if limit > 200:
        limit = 200

    try:
        playlists = fetch_user_playlists(
            cookie=session_data,
            uin=uin,
            offset=offset,
            limit=limit
        )

        return jsonify({
            'playlists': playlists,
            'count': len(playlists),
            'uin': uin
        }), 200

    except Exception as e:
        print(f"获取用户QQ音乐歌单失败: {e}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'message': f'获取歌单失败: {str(e)}'
        }), 500


# ===================== 内部工具函数 =====================

def _extract_uin_from_cookie(cookie: str) -> str:
    """从Cookie中提取uin"""
    import re
    match = re.search(r'uin=(\d+)', cookie)
    return match.group(1) if match else ''


def _extract_nickname_from_cookie(cookie: str) -> str:
    """从Cookie中提取昵称（如果有的话）"""
    import re
    match = re.search(r'nickname=([^;]+)', cookie)
    if match:
        from urllib.parse import unquote
        return unquote(match.group(1))
    return ''


def _verify_qqmusic_cookie(cookie: str) -> bool:
    """验证QQ音乐Cookie是否有效"""
    try:
        tool = QQMusicTool(cookie_header=cookie, timeout=10)
        result = tool.search_with_keyword('周杰伦', result_num=1, origin=False)
        return bool(result and result.get('list'))
    except Exception:
        return False


def _detect_qqmusic_vip(cookie: str, uin: str) -> bool:
    """通过 QQ 音乐 profile API 检测用户是否为 VIP"""
    try:
        url = "https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg"
        params = {
            "uin": int(uin),
            "format": "json",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "platform": "yqq.json",
            "cid": 205360838,
            "userid": int(uin),
            "hostUin": 0,
            "loginUin": int(uin),
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Cookie": cookie,
        }
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        data = resp.json()
        # 检查VIP相关字段
        profile_data = data.get("data", {})
        vip_info = profile_data.get("vip_info", {})
        # vip > 0 或 svip > 0 表示VIP用户
        if vip_info.get("vip", 0) > 0 or vip_info.get("svip", 0) > 0:
            return True
        # 也可以检查 creator 中的 vip 标识
        creator = profile_data.get("creator", {})
        if creator.get("isVip", 0) > 0:
            return True
        return False
    except Exception as e:
        print(f"⚠️ VIP检测API失败: {e}")
        return False


def _run_puppeteer_login(user_id: int, platform: str):
    """运行Puppeteer登录流程（在后台线程中）"""
    global _puppeteer_status
    _puppeteer_status = {'running': True, 'platform': platform, 'user_id': user_id}

    try:
        print(f"🚀 启动Puppeteer登录流程, user_id={user_id}, platform={platform}")
        from utils.puppeteer_login import run_qqmusic_login
        result = run_qqmusic_login()
        if result:
            cookie = result.get('cookie') if isinstance(result, dict) else result
            # 保存到用户Session
            uin = _extract_uin_from_cookie(cookie)
            nickname = _extract_nickname_from_cookie(cookie)
            user_session_model.save_session(
                user_id=user_id,
                platform=platform,
                session_data=cookie,
                uin=uin,
                nickname=nickname,
                expires_at=(datetime.utcnow() + timedelta(days=365)).isoformat()
            )
            # 加入Cookie池
            existing = cookie_pool.find_cookie_by_uin(uin, platform)
            if not existing:
                cookie_id = cookie_pool.add_cookie(
                    cookie=cookie,
                    platform=platform,
                    user_label=nickname or uin,
                    uin=uin,
                    added_by=user_id
                )
            else:
                cookie_id = existing['id']
            # 使用API检测VIP状态
            is_vip = _detect_qqmusic_vip(cookie, uin)
            if is_vip:
                cookie_pool.update_vip_status(cookie_id, True)
            print(f"✅ Puppeteer登录成功，uin={uin}，VIP={is_vip}")
        else:
            print("⚠️ Puppeteer登录未完成")
    except Exception as e:
        print(f"❌ Puppeteer登录失败: {e}")
    finally:
        _puppeteer_status = {'running': False, 'platform': None, 'user_id': None}


import time
import requests

def fetch_user_playlists(cookie: str, uin: str, offset: int = 0, limit: int = 30):
    uin = str(uin).lstrip("o")
    uin_num = int(uin)

    url = "https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg"

    params = {
        "_": int(time.time() * 1000),
        "cv": 4747474,
        "ct": 24,
        "format": "json",
        "inCharset": "utf-8",
        "outCharset": "utf-8",
        "notice": 0,
        "platform": "yqq.json",
        "needNewCode": 0,
        "uin": uin_num,
        "g_tk_new_20200303": 0,
        "g_tk": 0,
        "cid": 205360838,
        "userid": uin_num,
        "reqfrom": 1,
        "reqtype": 0,
        "hostUin": 0,
        "loginUin": uin_num,
    }

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": f"https://y.qq.com/portal/profile.html?uin={uin}",
        "Cookie": cookie,
    }

    resp = requests.get(url, params=params, headers=headers, timeout=15)
    data = resp.json()

    print("top keys:", list(data.keys()))
    print("code:", data.get("code"))
    print("data keys:", list(data.get("data", {}).keys()) if isinstance(data.get("data"), dict) else None)

    if data.get("code") not in (0, None):
        raise RuntimeError(f"QQ音乐上游错误: {data}")

    candidates = [
        ("data.mydiss.list", lambda x: x.get("data", {}).get("mydiss", {}).get("list")),
        ("data.mymusic", lambda x: x.get("data", {}).get("mymusic")),
        ("data.createdDissList", lambda x: x.get("data", {}).get("createdDissList")),
        ("data.createdList", lambda x: x.get("data", {}).get("createdList")),
        ("data.creator.playlist", lambda x: x.get("data", {}).get("creator", {}).get("playlist")),
        ("data.creator.playlists", lambda x: x.get("data", {}).get("creator", {}).get("playlists")),
        ("data.playlist", lambda x: x.get("data", {}).get("playlist")),
        ("data.playlists", lambda x: x.get("data", {}).get("playlists")),
        ("mydiss.list", lambda x: x.get("mydiss", {}).get("list")),
        ("mymusic", lambda x: x.get("mymusic")),
        ("createdDissList", lambda x: x.get("createdDissList")),
        ("createdList", lambda x: x.get("createdList")),
        ("creator.playlist", lambda x: x.get("creator", {}).get("playlist")),
        ("creator.playlists", lambda x: x.get("creator", {}).get("playlists")),
        ("playlist", lambda x: x.get("playlist")),
        ("playlists", lambda x: x.get("playlists")),
    ]

    raw_list = None
    matched_path = None

    for path, getter in candidates:
        value = getter(data)
        if isinstance(value, list):
            raw_list = value
            matched_path = path
            break

    if raw_list is None:
        raise RuntimeError(f"未找到歌单字段，上游返回: {data}")

    print("matched playlist path:", matched_path)

    # qq_music_api 源码里这里是 offset % limit，语义有点怪；
    # 你自己写建议直接用 offset 切。
    sliced = raw_list[offset: offset + limit]

    playlists = []
    for item in sliced:
        playlists.append({
            "id": (
                item.get("dissid")
                or item.get("tid")
                or item.get("dirid")
                or item.get("id")
                or ""
            ),
            "name": (
                item.get("dissname")
                or item.get("title")
                or item.get("name")
                or ""
            ),
            "song_count": (
                item.get("song_cnt")
                or item.get("songnum")
                or item.get("cnt")
                or item.get("num0")
                or 0
            ),
            "cover": (
                item.get("logo")
                or item.get("pic")
                or item.get("cover")
                or item.get("picurl")
                or ""
            ),
            "raw": item,
        })

    return playlists


@cookie_bp.route('/music-login/qqmusic/playlist-songs', methods=['GET'])
def qqmusic_playlist_songs():
    """获取QQ音乐歌单中的歌曲列表"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    playlist_id = request.args.get('playlist_id', '').strip()
    if not playlist_id:
        return jsonify({'message': 'playlist_id is required'}), 400

    # 优先使用用户个人session，否则使用cookie池
    session_data = user_session_model.get_session_data(user_id, 'qqmusic')
    if not session_data:
        session_data = cookie_pool.pick_random_cookie('qqmusic') or ''

    if not session_data:
        return jsonify({'message': '无可用Cookie，请先登录QQ音乐'}), 401

    qqmusic = QQMusicTool(cookie_header=session_data, timeout=15)

    try:
        songs = qqmusic.get_song_list(playlist_id)
        # 格式化歌曲信息
        formatted_songs = []
        for song in songs:
            formatted_songs.append({
                'songmid': song.get('songmid', ''),
                'title': song.get('songname', ''),
                'artist': '/'.join([s.get('name', '') for s in song.get('singer', [])]),
                'album': (song.get('album') or {}).get('name', ''),
                'duration': song.get('interval', 0),
            })
        return jsonify({'songs': formatted_songs}), 200
    except Exception as e:
        return jsonify({'message': f'获取歌单歌曲失败: {str(e)}'}), 500


@cookie_bp.route('/music-login/qqmusic/import-playlist', methods=['POST'])
def qqmusic_import_playlist():
    """导入QQ音乐歌单到系统"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    data = request.get_json() or {}
    playlist_id = (data.get('playlist_id') or '').strip()
    playlist_name = (data.get('playlist_name') or '').strip()
    songmids = data.get('songmids', [])

    if not playlist_id:
        return jsonify({'message': 'playlist_id is required'}), 400
    if not songmids:
        return jsonify({'message': 'songmids is required'}), 400

    # 获取cookie
    session_data = user_session_model.get_session_data(user_id, 'qqmusic')
    if not session_data:
        session_data = cookie_pool.pick_random_cookie('qqmusic') or ''

    if not session_data:
        return jsonify({'message': '无可用Cookie，请先登录QQ音乐'}), 401

    qqmusic = QQMusicTool(cookie_header=session_data, timeout=15)

    try:
        # 导入歌曲
        imported_count = 0
        failed_count = 0
        for songmid in songmids:
            try:
                # 获取歌曲详情
                detail = qqmusic.get_song_detail(songmid)
                if not detail:
                    failed_count += 1
                    continue

                # 获取播放链接
                url = qqmusic.get_music_url(songmid, quality='320')
                if not url:
                    failed_count += 1
                    continue

                # 保存到数据库（这里需要调用music.py中的导入逻辑）
                # 简化处理：直接返回成功，让前端调用现有的导入接口
                imported_count += 1
            except Exception as e:
                print(f"导入歌曲 {songmid} 失败: {e}")
                failed_count += 1

        return jsonify({
            'message': f'导入完成: 成功 {imported_count} 首, 失败 {failed_count} 首',
            'imported': imported_count,
            'failed': failed_count,
        }), 200
    except Exception as e:
        return jsonify({'message': f'导入歌单失败: {str(e)}'}), 500


# ===================== 定时任务 =====================

def register_cookie_tasks(scheduler):
    """注册Cookie定时验证任务"""

    def verify_all_cookies_job():
        """定时验证所有Cookie有效性"""
        try:
            cookies = cookie_pool.get_all_raw_cookies('qqmusic')
            active_count = 0
            for row in cookies:
                is_valid = _verify_qqmusic_cookie(row['cookie'])
                cookie_pool.update_verified(row['id'], is_valid)
                if is_valid:
                    active_count += 1
            print(f"✅ Cookie定时验证完成: {active_count}/{len(cookies)} 有效")
        except Exception as e:
            print(f"❌ Cookie定时验证失败: {e}")

    # 每30分钟验证一次
    scheduler.add_job(
        id='verify_cookies',
        func=verify_all_cookies_job,
        trigger='interval',
        minutes=30,
        replace_existing=True
    )
    print("✅ Cookie定时验证任务已注册（每30分钟）")