"""
Cookie池管理路由 + 用户音乐平台登录路由
- /cookie/* : 共享Cookie池的管理（管理员/内部使用）
- /music-login/* : 用户个人音乐平台登录（Puppeteer弹窗）
"""

import os
import re
import time
import requests
import asyncio
import threading
import atexit
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from dao.cookie_pool import CookiePool
from dao.user_music_session import UserMusicSession
from dao.song import Song
from dao.playlist import Playlist
from dao.db_queue import db_queue
from utils.qqmusic_tool import QQMusicTool
from utils.netease_tool import NeteaseMusicTool

cookie_bp = Blueprint('cookie', __name__)
cookie_pool = CookiePool()
user_session_model = UserMusicSession()

# Puppeteer进程管理（per-user+platform，允许多个用户同时登录不同平台）
_puppeteer_lock = threading.Lock()
_puppeteer_status = {}  # key: f"user_{user_id}_{platform}", value: status dict


def _cleanup_puppeteer_on_exit():
    """后端退出时清理所有Puppeteer子进程"""
    with _puppeteer_lock:
        for key, status in _puppeteer_status.items():
            proc = status.get('process')
            if proc and proc.poll() is None:
                try:
                    import signal
                    if os.name != 'nt':
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    proc.kill()
                except (ProcessLookupError, OSError):
                    pass


atexit.register(_cleanup_puppeteer_on_exit)

# Socket.IO事件处理（在app.py中注册）
def register_socketio_events(socketio):
    """注册Socket.IO事件处理器"""
    
    @socketio.on('login_screenshot')
    def handle_login_screenshot(data):
        """接收Puppeteer截图并转发给对应的用户"""
        from flask_socketio import emit
        platform = data.get('platform')
        screenshot = data.get('screenshot')
        
        # 从_puppeteer_status中查找对应platform的user_id
        with _puppeteer_lock:
            for key, status in _puppeteer_status.items():
                if status.get('platform') == platform and status.get('running'):
                    user_id = status.get('user_id')
                    if user_id and screenshot:
                        # 发送给特定用户房间
                        emit('login_qr_update', {
                            'platform': platform,
                            'screenshot': screenshot
                        }, to=f'user_{user_id}')
                        print(f"📸 转发截图给用户 {user_id}, 平台: {platform}")
                    break
    
    @socketio.on('login_status_update')
    def handle_login_status_update(data):
        """接收Puppeteer登录状态更新并转发给对应的用户"""
        from flask_socketio import emit
        platform = data.get('platform')
        status = data.get('status')
        message = data.get('message')
        
        # 从_puppeteer_status中查找对应platform的user_id
        with _puppeteer_lock:
            for key, status_info in _puppeteer_status.items():
                if status_info.get('platform') == platform and status_info.get('running'):
                    user_id = status_info.get('user_id')
                    if user_id:
                        # 发送给特定用户房间
                        emit('login_status_update', {
                            'platform': platform,
                            'status': status,
                            'message': message
                        }, to=f'user_{user_id}')
                        print(f"✅ 转发登录状态给用户 {user_id}, 平台: {platform}, 状态: {status}")
                    break


def verify_token(token):
    from dao.user import User
    user_model = User()
    return user_model.query_token(token)


# ===================== Cookie池管理接口 =====================

@cookie_bp.route('/cookie/count', methods=['GET'])
def get_cookie_count():
    """获取可用Cookie数量（前端显示用）"""
    platform = request.args.get('platform', 'qqmusic')
    count = cookie_pool.count_active(platform)
    return jsonify({'count': count, 'platform': platform}), 200


@cookie_bp.route('/cookie/vip-count', methods=['GET'])
def get_cookie_vip_count():
    """获取VIP和非VIP Cookie数量"""
    platform = request.args.get('platform', 'qqmusic')
    vip = cookie_pool.count_vip(platform)
    non_vip = cookie_pool.count_non_vip(platform)
    total = vip + non_vip
    return jsonify({
        'vip': vip,
        'non_vip': non_vip,
        'total': total,
        'platform': platform
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

    key = f"user_{user_id}_qqmusic"
    with _puppeteer_lock:
        if key in _puppeteer_status and _puppeteer_status[key].get('running'):
            # 检查进程是否仍然存活
            proc = _puppeteer_status[key].get('process')
            if proc and proc.poll() is not None:
                # 进程已退出但状态未重置，重置状态
                del _puppeteer_status[key]
            else:
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
SUPPORTED_PLATFORMS = {'qqmusic', 'netease'}

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


@cookie_bp.route('/music-login/netease/status', methods=['GET'])
def netease_login_status():
    """检查用户网易云音乐登录状态"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    has_session = user_session_model.has_valid_session(user_id, 'netease')
    session = user_session_model.get_session(user_id, 'netease') if has_session else None

    uid = session.get('uin', '') if session else ''
    nickname = session.get('nickname', '') if session else ''

    # 如果session中uid为空、不是数字格式、或nickname为空，尝试通过API回退获取
    if has_session and (not uid or not uid.isdigit() or not nickname):
        try:
            session_data = user_session_model.get_session_data(user_id, 'netease')
            if session_data:
                netease = NeteaseMusicTool(cookie=session_data, timeout=10)
                account = netease.get_user_account(origin=True)
                if account and isinstance(account, dict):
                    profile = account.get('profile', {})
                    if not uid and profile:
                        uid = str(profile.get('userId', ''))
                    if not nickname and profile:
                        nickname = profile.get('nickname', '')
                    # 更新session中的数据
                    if uid or nickname:
                        user_session_model.save_session(
                            user_id=user_id,
                            platform='netease',
                            session_data=session_data,
                            uin=uid,
                            nickname=nickname,
                            expires_at=(datetime.utcnow() + timedelta(days=365)).isoformat()
                        )
        except Exception as e:
            print(f"⚠️ 网易云登录状态API回退失败: {e}")

    is_vip = False
    if uid:
        # 优先从Cookie池获取VIP状态
        cookie_row = cookie_pool.find_cookie_by_uin(uid, 'netease')
        if cookie_row:
            is_vip = bool(cookie_row.get('is_vip', 0))
        
        # 如果Cookie池中没有VIP标记，直接检测当前session的VIP状态
        if not is_vip and has_session:
            try:
                session_data = user_session_model.get_session_data(user_id, 'netease')
                if session_data:
                    is_vip = _detect_netease_vip(session_data, uid)
                    # 如果检测到VIP，更新Cookie池中的VIP状态
                    if is_vip and cookie_row:
                        cookie_pool.update_vip_status(cookie_row['id'], True)
            except Exception as e:
                print(f"⚠️ 检测网易云VIP状态失败: {e}")

    return jsonify({
        'logged_in': has_session,
        'uin': uid,
        'nickname': nickname,
        'is_vip': is_vip
    }), 200


@cookie_bp.route('/music-login/netease/init', methods=['POST'])
def netease_login_init():
    """启动网易云音乐Puppeteer登录流程"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    key = f"user_{user_id}_netease"
    with _puppeteer_lock:
        if key in _puppeteer_status and _puppeteer_status[key].get('running'):
            # 检查进程是否仍然存活
            proc = _puppeteer_status[key].get('process')
            if proc and proc.poll() is not None:
                # 进程已退出但状态未重置，重置状态
                del _puppeteer_status[key]
            else:
                return jsonify({'message': '登录流程已在进行中'}), 409

    # 启动Puppeteer（异步）
    thread = threading.Thread(
        target=_run_puppeteer_login,
        args=(user_id, 'netease'),
        daemon=True
    )
    thread.start()

    return jsonify({'message': '登录流程已启动'}), 200


@cookie_bp.route('/music-login/cancel', methods=['POST'])
def cancel_login():
    """取消正在进行的Puppeteer登录流程"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    # 查找该用户所有正在运行的登录流程
    cancelled = []
    with _puppeteer_lock:
        keys_to_remove = []
        for key, status in _puppeteer_status.items():
            if status.get('user_id') == user_id and status.get('running'):
                # 终止Puppeteer子进程
                proc = status.get('process')
                if proc and proc.poll() is None:
                    try:
                        import signal
                        if os.name != 'nt':
                            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                        proc.kill()
                    except (ProcessLookupError, OSError):
                        pass
                keys_to_remove.append(key)
                cancelled.append(status.get('platform'))
        
        for key in keys_to_remove:
            del _puppeteer_status[key]
    
    if cancelled:
        print(f"🛑 用户 {user_id} 取消了登录流程: {cancelled}")
        return jsonify({'message': f'已取消登录流程: {", ".join(cancelled)}'}), 200
    else:
        return jsonify({'message': '没有正在进行的登录流程'}), 200


@cookie_bp.route('/music-login/netease/callback', methods=['POST'])
def netease_login_callback():
    """网易云音乐登录回调：接收cookie并保存"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    data = request.get_json() or {}
    cookie = (data.get('cookie') or '').strip()
    uid = (data.get('uid') or '').strip()

    if not cookie:
        return jsonify({'message': 'cookie is required'}), 400

    # 验证cookie
    if not _verify_netease_cookie(cookie):
        return jsonify({'message': 'Cookie验证失败'}), 400

    # 提取用户信息：通过API获取uid和nickname
    nickname = ''
    if not uid or not uid.isdigit():
        try:
            netease = NeteaseMusicTool(cookie=cookie, timeout=10)
            uid = netease.extract_uid()
            account = netease.get_user_account(origin=True)
            if account and isinstance(account, dict):
                profile = account.get('profile', {})
                nickname = profile.get('nickname', '') if profile else ''
        except Exception as e:
            print(f"⚠️ 网易云callback API获取用户信息失败: {e}")

    # 保存到用户Session
    user_session_model.save_session(
        user_id=user_id,
        platform='netease',
        session_data=cookie,
        uin=uid,
        nickname=nickname,
        expires_at=(datetime.utcnow() + timedelta(days=365)).isoformat()
    )

    # 同时加入Cookie池（共享给所有人）
    existing = cookie_pool.find_cookie_by_uin(uid, 'netease')
    if not existing:
        cookie_id = cookie_pool.add_cookie(
            cookie=cookie,
            platform='netease',
            user_label=nickname or uid or f'user_{user_id}',
            uin=uid,
            added_by=user_id
        )
        # 检测并标记VIP状态
        if _detect_netease_vip(cookie, uid):
            cookie_pool.update_vip_status(cookie_id, True)
    else:
        # 如果cookie已存在，检查并更新VIP状态
        cookie_id = existing['id']
        if not existing.get('is_vip'):
            if _detect_netease_vip(cookie, uid):
                cookie_pool.update_vip_status(cookie_id, True)

    return jsonify({
        'message': '登录成功',
        'uin': uid,
        'nickname': nickname
    }), 200


@cookie_bp.route('/music-login/netease/logout', methods=['POST'])
def netease_logout():
    """退出网易云音乐登录"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    user_session_model.delete_session(user_id, 'netease')
    return jsonify({'message': '已退出登录'}), 200


@cookie_bp.route('/music-login/netease/playlists', methods=['GET'])
def netease_user_playlists():
    """获取用户网易云音乐歌单列表（需要登录）"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    # 优先使用用户个人 session
    session_data = user_session_model.get_session_data(user_id, 'netease')
    if not session_data:
        return jsonify({
            'message': '请先登录网易云音乐',
            'code': 'NOT_LOGGED_IN'
        }), 403

    # 从 session 中获取 uid（真正的用户 ID，不是 MUSIC_U）
    session = user_session_model.get_session(user_id, 'netease')
    uid = session.get('uin', '') if session else ''

    # 如果 session 中没有 uid 或 uid 不是数字格式，通过 API 获取
    if not uid or not uid.isdigit():
        try:
            netease = NeteaseMusicTool(cookie=session_data, timeout=10)
            profile = netease.get_user_account()
            if profile and profile.get('userId'):
                uid = str(profile['userId'])
                # 更新 session
                nickname = profile.get('nickname', '')
                user_session_model.save_session(
                    user_id=user_id,
                    platform='netease',
                    session_data=session_data,
                    uin=uid,
                    nickname=nickname,
                    expires_at=(datetime.utcnow() + timedelta(days=365)).isoformat()
                )
        except Exception as e:
            print(f"⚠️ 获取网易云用户ID失败: {e}")

    if not uid:
        return jsonify({
            'message': '无法获取网易云用户ID，请重新登录',
            'code': 'NO_UID'
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
        netease = NeteaseMusicTool(cookie=session_data, timeout=15)
        playlists = netease.get_user_playlists(uid, offset=offset, limit=limit)
        
        # 格式化歌单数据，匹配前端 UserPlaylist 类型
        formatted_playlists = []
        for playlist in playlists:
            formatted_playlists.append({
                'id': str(playlist.get('id', '')),
                'name': playlist.get('name', ''),
                'song_count': playlist.get('trackCount', 0),
                'cover': playlist.get('coverImgUrl', '')
            })

        return jsonify({
            'playlists': formatted_playlists,
            'count': len(formatted_playlists),
            'uid': uid
        }), 200

    except Exception as e:
        print(f"获取用户网易云音乐歌单失败: {e}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'message': f'获取歌单失败: {str(e)}'
        }), 500


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
        }), 403

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
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        data = resp.json()
        # 检查VIP相关字段
        profile_data = data.get("data", {})
        vip_info = profile_data.get("vip_info", {})
        
        # 检查vip_info中的VIP状态
        vip_status = int(vip_info.get("vip") or 0)
        svip_status = int(vip_info.get("svip") or 0)
        
        if vip_status > 0 or svip_status > 0:
            return True
        
        # 检查creator中的VIP标识
        creator = profile_data.get("creator", {})
        if creator.get("isVip", 0) > 0:
            return True
        
        # 检查creator.lvinfo中的VIP图标（关键字段！）
        # lvinfo[0].iconurl 包含 "svip_g.png" 或 "vip_g.png" 表示VIP用户
        lvinfo = creator.get("lvinfo", [])
        for lv in lvinfo:
            iconurl = lv.get("iconurl", "")
            if "svip" in iconurl.lower() or "vip" in iconurl.lower():
                print(f"🔍 QQ音乐VIP检测 uin={uin}: 通过lvinfo检测到VIP, iconurl={iconurl}")
                return True
        
        # 检查其他可能的VIP字段
        if profile_data.get("isVip", 0) > 0:
            return True
        
        print(f"🔍 QQ音乐VIP检测 uin={uin}: 未检测到VIP状态")
        return False
    except Exception as e:
        print(f"⚠️ VIP检测API失败: {e}")
        return False


def _run_puppeteer_login(user_id: int, platform: str):
    """运行Puppeteer登录流程（在后台线程中）"""
    key = f"user_{user_id}_{platform}"
    with _puppeteer_lock:
        _puppeteer_status[key] = {'running': True, 'platform': platform, 'user_id': user_id, 'process': None}

    try:
        print(f"🚀 启动Puppeteer登录流程, user_id={user_id}, platform={platform}")
        
        # 设置环境变量，启用headless模式和Socket.IO传输
        import os
        os.environ['PUPPETEER_HEADLESS'] = 'true'
        os.environ['SOCKET_URL'] = 'http://localhost:8034'
        # 注意：AUTH_TOKEN需要从请求中获取，但_run_puppeteer_login在后台线程中运行
        # 这里使用空token，因为Socket.IO连接会使用用户的token
        
        if platform == 'qqmusic':
            from utils.puppeteer_login import run_qqmusic_login
            result = run_qqmusic_login(process_ref=_puppeteer_status[key])
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
        elif platform == 'netease':
            from utils.puppeteer_login import run_netease_login
            result = run_netease_login(process_ref=_puppeteer_status[key])
            if result:
                cookie = result.get('cookie') if isinstance(result, dict) else result
                uid = result.get('uid', '') or ''
                nickname = ''
                # 如果Puppeteer未返回uid，通过API回退获取
                if not uid:
                    try:
                        netease = NeteaseMusicTool(cookie=cookie, timeout=10)
                        profile = netease.get_user_account()
                        if profile and profile.get('userId'):
                            uid = str(profile['userId'])
                            nickname = profile.get('nickname', '')
                    except Exception as e:
                        print(f"⚠️ 通过API获取网易云用户信息失败: {e}")
                # 确保 uid 是数字格式（用户ID应该是数字，不是MUSIC_U token）
                if uid and not uid.isdigit():
                    print(f"⚠️ uid格式异常（可能是MUSIC_U）: {uid[:20]}...")
                    uid = ''
                # 保存到用户Session
                user_session_model.save_session(
                    user_id=user_id,
                    platform=platform,
                    session_data=cookie,
                    uin=uid,
                    nickname=nickname,
                    expires_at=(datetime.utcnow() + timedelta(days=365)).isoformat()
                )
                # 加入Cookie池（仅当uid有效时）
                if uid:
                    existing = cookie_pool.find_cookie_by_uin(uid, platform)
                    if not existing:
                        cookie_id = cookie_pool.add_cookie(
                            cookie=cookie,
                            platform=platform,
                            user_label=nickname or uid or f'user_{user_id}',
                            uin=uid,
                            added_by=user_id
                        )
                    else:
                        cookie_id = existing['id']
                    # 检测VIP状态
                    is_vip = _detect_netease_vip(cookie, uid)
                    if is_vip:
                        cookie_pool.update_vip_status(cookie_id, True)
                    print(f"✅ Puppeteer登录成功，uid={uid}，VIP={is_vip}")
                else:
                    print("⚠️ Puppeteer登录成功但未获取到有效uid")
            else:
                print("⚠️ Puppeteer登录未完成")
        else:
            print(f"❌ 不支持的平台: {platform}")
    except Exception as e:
        print(f"❌ Puppeteer登录失败: {e}")
    finally:
        with _puppeteer_lock:
            if key in _puppeteer_status:
                del _puppeteer_status[key]


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
        # 解析歌曲数：subtitle 格式为 "6首    0次播放    "
        song_count = 0
        subtitle = item.get("subtitle", "")
        m = re.search(r"(\d+)首", subtitle)
        if m:
            song_count = int(m.group(1))

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
            "song_count": song_count,
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
        return jsonify({'message': '无可用Cookie，请先登录QQ音乐'}), 403

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
                'duration': song.get('interval', 0) * 1000,  # interval是秒，转换为毫秒
            })
        return jsonify({'songs': formatted_songs}), 200
    except Exception as e:
        return jsonify({'message': f'获取歌单歌曲失败: {str(e)}'}), 500


@cookie_bp.route('/music-login/netease/playlist-songs', methods=['GET'])
def netease_playlist_songs():
    """获取网易云音乐歌单中的歌曲列表"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    playlist_id = request.args.get('playlist_id', '').strip()
    if not playlist_id:
        return jsonify({'message': 'playlist_id is required'}), 400

    # 优先使用用户个人session，否则使用cookie池
    session_data = user_session_model.get_session_data(user_id, 'netease')
    if not session_data:
        session_data = cookie_pool.pick_random_cookie('netease') or ''

    if not session_data:
        return jsonify({'message': '无可用Cookie，请先登录网易云音乐'}), 403

    netease = NeteaseMusicTool(cookie=session_data, timeout=15)

    try:
        playlist_detail = netease.get_playlist_detail(playlist_id)
        if not playlist_detail:
            return jsonify({'message': '获取歌单详情失败'}), 500

        tracks = playlist_detail.get('tracks', [])
        track_count = playlist_detail.get('trackCount', len(tracks))
        
        print(f"[网易云歌单获取] playlist_id={playlist_id}, trackCount={track_count}, 初始tracks数={len(tracks)}")
        
        failed_batches = 0
        # 如果返回的tracks数量小于trackCount，使用trackIds获取所有歌曲
        if len(tracks) < track_count:
            track_ids = playlist_detail.get('trackIds', [])
            print(f"[网易云歌单获取] trackIds总数={len(track_ids)}")
            if track_ids:
                all_tracks = []
                batch_size = 200
                total_batches = (len(track_ids) + batch_size - 1) // batch_size
                for i in range(0, len(track_ids), batch_size):
                    batch_ids = [item.get('id') for item in track_ids[i:i+batch_size] if item.get('id')]
                    batch_num = i // batch_size + 1
                    if batch_ids:
                        try:
                            batch_tracks = netease.get_song_detail(batch_ids)
                            if batch_tracks:
                                all_tracks.extend(batch_tracks)
                                print(f"[网易云歌单获取] 第{batch_num}/{total_batches}批: 请求{len(batch_ids)}首, 返回{len(batch_tracks)}首")
                            else:
                                failed_batches += 1
                                print(f"[网易云歌单获取] 第{batch_num}/{total_batches}批: 请求{len(batch_ids)}首, 返回空")
                        except Exception as e:
                            failed_batches += 1
                            print(f"[网易云歌单获取] 第{batch_num}/{total_batches}批失败: {e}")
                tracks = all_tracks
                print(f"[网易云歌单获取] 分批获取完成: 共{total_batches}批, 失败{failed_batches}批, 获取到{len(tracks)}首")
        
        formatted_songs = []
        for track in tracks:
            artists = '/'.join([(a.get('name') or '') for a in track.get('ar', [])])
            formatted_songs.append({
                'song_id': track.get('id', ''),
                'title': track.get('name', ''),
                'artist': artists,
                'album': (track.get('al') or {}).get('name', ''),
                'duration': track.get('dt', 0),
                'cover': (track.get('al') or {}).get('picUrl', ''),
            })

        print(f"[网易云歌单获取] 最终结果: 共{track_count}首, 获取成功{len(formatted_songs)}首, 失败批次{failed_batches}")

        return jsonify({
            'songs': formatted_songs,
            'playlist_name': playlist_detail.get('name', ''),
            'count': len(formatted_songs),
            'cover_url': playlist_detail.get('coverImgUrl', ''),
            'track_count': track_count,
            'failed_batches': failed_batches
        }), 200
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
    playlist_id = str(data.get('playlist_id', '')).strip()
    playlist_name = str(data.get('playlist_name', '')).strip()
    songs = data.get('songs', [])

    if not playlist_id:
        return jsonify({'message': 'playlist_id is required'}), 400
    if not songs:
        return jsonify({'message': 'songs is required'}), 400

    # 检查是否有可用的QQ音乐Cookie
    session_data = user_session_model.get_session_data(user_id, 'qqmusic')
    if not session_data:
        session_data = cookie_pool.pick_random_cookie('qqmusic') or ''

    if not session_data:
        return jsonify({'message': '无可用Cookie，请先登录QQ音乐'}), 403

    try:
        # 创建歌单（如果不存在）
        if not playlist_name:
            playlist_name = f'QQ音乐歌单_{playlist_id}'
        
        # 检查歌单是否已存在
        existing_playlist = db_queue.execute_query(
            'SELECT id FROM playlists WHERE playlist_name = ? LIMIT 1',
            (playlist_name,)
        )
        
        if existing_playlist:
            target_playlist_id = existing_playlist[0]['id']
        else:
            # 创建新歌单
            db_queue.execute_write(
                'INSERT INTO playlists (creater_id, playlist_name) VALUES (?, ?)',
                (user_id, playlist_name)
            )
            created_playlist = db_queue.execute_query(
                'SELECT id FROM playlists WHERE playlist_name = ? LIMIT 1',
                (playlist_name,)
            )
            target_playlist_id = created_playlist[0]['id'] if created_playlist else None

        if not target_playlist_id:
            return jsonify({'message': '创建歌单失败'}), 500

        # 预加载"所有歌曲"歌单ID，避免批量操作中调用 get_or_create_all_songs_playlist
        all_songs_rows = db_queue.execute_query(
            "SELECT id FROM playlists WHERE playlist_name = '所有歌曲' LIMIT 1"
        )
        if all_songs_rows:
            all_songs_playlist_id = all_songs_rows[0]['id']
        else:
            db_queue.execute_write(
                "INSERT INTO playlists (creater_id, playlist_name) VALUES (1, '所有歌曲')"
            )
            all_songs_rows = db_queue.execute_query(
                "SELECT id FROM playlists WHERE playlist_name = '所有歌曲' LIMIT 1"
            )
            all_songs_playlist_id = all_songs_rows[0]['id'] if all_songs_rows else None

        # 导入歌曲（只保存元数据和songmid，不获取播放URL）
        imported_count = 0
        failed_count = 0
        batch_size = 500
        
        batch_ops = []
        
        for idx, song_info in enumerate(songs):
            try:
                songmid = song_info.get('songmid', '')
                title = song_info.get('title', songmid)
                artist = song_info.get('artist', '')
                duration = song_info.get('duration', 0)

                if not songmid:
                    failed_count += 1
                    continue

                # 检查歌曲是否已存在
                existing_song = db_queue.execute_query(
                    'SELECT id FROM songs WHERE (platform = ? AND platform_song_id = ?) OR (title = ? AND artist = ?) LIMIT 1',
                    ('qqmusic', songmid, title, artist)
                )

                if existing_song:
                    song_id = existing_song[0]['id']
                    # 添加到目标歌单和所有歌曲歌单
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, ?, COALESCE(MAX(order_index), 0) + 1 FROM playlist_songs WHERE playlist_id = ?',
                         (target_playlist_id, song_id, target_playlist_id))
                    )
                    if all_songs_playlist_id:
                        batch_ops.append(
                            ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, ?, COALESCE(MAX(order_index), 0) + 1 FROM playlist_songs WHERE playlist_id = ?',
                             (all_songs_playlist_id, song_id, all_songs_playlist_id))
                        )
                    imported_count += 1
                else:
                    # 插入新歌曲（OR IGNORE 避免 UNIQUE 约束导致整个批次回滚）
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO songs (title, artist, duration, file_path, uploader_id, file_extension, platform, platform_song_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                         (title, artist, duration, '', user_id, 'm4a', 'qqmusic', songmid))
                    )
                    # 添加到歌单（使用子查询获取刚插入的song_id）
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, id, COALESCE(ps.max_order, 0) + 1 FROM songs s CROSS JOIN (SELECT MAX(order_index) as max_order FROM playlist_songs WHERE playlist_id = ?) ps WHERE s.platform = ? AND s.platform_song_id = ?',
                         (all_songs_playlist_id, all_songs_playlist_id, 'qqmusic', songmid) if all_songs_playlist_id else (target_playlist_id, target_playlist_id, 'qqmusic', songmid))
                    )
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, id, COALESCE(ps.max_order, 0) + 1 FROM songs s CROSS JOIN (SELECT MAX(order_index) as max_order FROM playlist_songs WHERE playlist_id = ?) ps WHERE s.platform = ? AND s.platform_song_id = ?',
                         (target_playlist_id, target_playlist_id, 'qqmusic', songmid))
                    )
                    imported_count += 1

            except Exception as e:
                print(f"导入歌曲失败: {e}")
                failed_count += 1

            # 每 batch_size 首提交一次，释放写锁
            if (idx + 1) % batch_size == 0:
                try:
                    db_queue.execute_batch(batch_ops)
                except Exception as e:
                    print(f"批量提交失败: {e}")
                batch_ops = []

        # 提交剩余操作
        if batch_ops:
            try:
                db_queue.execute_batch(batch_ops)
            except Exception as e:
                print(f"批量提交失败: {e}")

        return jsonify({
            'message': f'导入完成: 成功 {imported_count} 首, 失败 {failed_count} 首',
            'imported': imported_count,
            'failed': failed_count,
            'playlist_id': target_playlist_id,
            'playlist_name': playlist_name
        }), 200
            
    except Exception as e:
        return jsonify({'message': f'导入歌单失败: {str(e)}'}), 500


@cookie_bp.route('/music-login/netease/import-playlist', methods=['POST'])
def netease_import_playlist():
    """导入网易云音乐歌单到系统"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    data = request.get_json() or {}
    playlist_id = str(data.get('playlist_id', '')).strip()
    playlist_name = str(data.get('playlist_name', '')).strip()
    songs = data.get('songs', [])
    cover_url = data.get('cover_url', '')
    track_count = data.get('track_count', 0)

    if not playlist_id:
        return jsonify({'message': 'playlist_id is required'}), 400
    if not songs:
        return jsonify({'message': 'songs is required'}), 400

    try:
        # 创建歌单（如果不存在）
        if not playlist_name:
            playlist_name = f'网易云歌单_{playlist_id}'
        
        # 检查歌单是否已存在
        existing_playlist = db_queue.execute_query(
            'SELECT id FROM playlists WHERE playlist_name = ? LIMIT 1',
            (playlist_name,)
        )
        
        if existing_playlist:
            target_playlist_id = existing_playlist[0]['id']
        else:
            # 创建新歌单
            db_queue.execute_write(
                'INSERT INTO playlists (creater_id, playlist_name) VALUES (?, ?)',
                (user_id, playlist_name)
            )
            created_playlist = db_queue.execute_query(
                'SELECT id FROM playlists WHERE playlist_name = ? LIMIT 1',
                (playlist_name,)
            )
            target_playlist_id = created_playlist[0]['id'] if created_playlist else None

        if not target_playlist_id:
            return jsonify({'message': '创建歌单失败'}), 500

        # 预加载"所有歌曲"歌单ID，避免批量操作中调用 get_or_create_all_songs_playlist
        all_songs_rows = db_queue.execute_query(
            "SELECT id FROM playlists WHERE playlist_name = '所有歌曲' LIMIT 1"
        )
        if all_songs_rows:
            all_songs_playlist_id = all_songs_rows[0]['id']
        else:
            db_queue.execute_write(
                "INSERT INTO playlists (creater_id, playlist_name) VALUES (1, '所有歌曲')"
            )
            all_songs_rows = db_queue.execute_query(
                "SELECT id FROM playlists WHERE playlist_name = '所有歌曲' LIMIT 1"
            )
            all_songs_playlist_id = all_songs_rows[0]['id'] if all_songs_rows else None

        # 导入歌曲（只保存元数据和song_id，不获取播放URL）
        imported_count = 0
        failed_count = 0
        skipped_count = 0
        batch_size = 500
        
        batch_ops = []
        
        for idx, song_info in enumerate(songs):
            try:
                netease_song_id = song_info.get('song_id', '')
                title = (song_info.get('title') or '').strip()
                artist = (song_info.get('artist') or '').strip()
                duration = song_info.get('duration', 0)

                if not netease_song_id:
                    failed_count += 1
                    continue

                # 数据完整性校验：缺失title/artist/duration的歌曲跳过导入
                if not title or not artist or not duration:
                    skipped_count += 1
                    continue

                # 检查歌曲是否已存在
                existing_song = db_queue.execute_query(
                    'SELECT id FROM songs WHERE (platform = ? AND platform_song_id = ?) OR (title = ? AND artist = ?) LIMIT 1',
                    ('netease', str(netease_song_id), title, artist)
                )

                if existing_song:
                    song_id = existing_song[0]['id']
                    # 添加到目标歌单和所有歌曲歌单
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, ?, COALESCE(MAX(order_index), 0) + 1 FROM playlist_songs WHERE playlist_id = ?',
                         (target_playlist_id, song_id, target_playlist_id))
                    )
                    if all_songs_playlist_id:
                        batch_ops.append(
                            ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, ?, COALESCE(MAX(order_index), 0) + 1 FROM playlist_songs WHERE playlist_id = ?',
                             (all_songs_playlist_id, song_id, all_songs_playlist_id))
                        )
                    imported_count += 1
                else:
                    # 插入新歌曲（OR IGNORE 避免 UNIQUE 约束导致整个批次回滚）
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO songs (title, artist, duration, file_path, uploader_id, file_extension, platform, platform_song_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                         (title, artist, duration, None, user_id, 'mp3', 'netease', str(netease_song_id)))
                    )
                    # 添加到歌单（使用子查询获取刚插入的song_id）
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, id, COALESCE(ps.max_order, 0) + 1 FROM songs s CROSS JOIN (SELECT MAX(order_index) as max_order FROM playlist_songs WHERE playlist_id = ?) ps WHERE s.platform = ? AND s.platform_song_id = ?',
                         (all_songs_playlist_id, all_songs_playlist_id, 'netease', str(netease_song_id)) if all_songs_playlist_id else (target_playlist_id, target_playlist_id, 'netease', str(netease_song_id)))
                    )
                    batch_ops.append(
                        ('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) SELECT ?, id, COALESCE(ps.max_order, 0) + 1 FROM songs s CROSS JOIN (SELECT MAX(order_index) as max_order FROM playlist_songs WHERE playlist_id = ?) ps WHERE s.platform = ? AND s.platform_song_id = ?',
                         (target_playlist_id, target_playlist_id, 'netease', str(netease_song_id)))
                    )
                    imported_count += 1

            except Exception as e:
                print(f"导入歌曲失败: {e}")
                failed_count += 1

            # 每 batch_size 首提交一次，释放写锁
            if (idx + 1) % batch_size == 0:
                try:
                    db_queue.execute_batch(batch_ops)
                except Exception as e:
                    print(f"批量提交失败: {e}")
                batch_ops = []

        # 提交剩余操作
        if batch_ops:
            try:
                db_queue.execute_batch(batch_ops)
            except Exception as e:
                print(f"批量提交失败: {e}")

        msg = f'导入完成: 成功 {imported_count} 首, 失败 {failed_count} 首'
        if skipped_count > 0:
            msg += f', 跳过(数据不完整) {skipped_count} 首'

        return jsonify({
            'message': msg,
            'imported': imported_count,
            'failed': failed_count,
            'skipped': skipped_count,
            'playlist_id': target_playlist_id,
            'playlist_name': playlist_name,
            'cover_url': cover_url,
            'track_count': track_count
        }), 200
            
    except Exception as e:
        return jsonify({'message': f'导入歌单失败: {str(e)}'}), 500


# ===================== 定时任务 =====================

def register_cookie_tasks(scheduler):
    """注册Cookie定时验证任务"""

    def verify_all_cookies_job():
        """定时验证所有Cookie有效性"""
        try:
            # 验证QQ音乐Cookie
            qqmusic_cookies = cookie_pool.get_all_raw_cookies('qqmusic')
            qqmusic_active = 0
            for row in qqmusic_cookies:
                is_valid = _verify_qqmusic_cookie(row['cookie'])
                cookie_pool.update_verified(row['id'], is_valid)
                if is_valid:
                    qqmusic_active += 1
            
            # 验证网易云音乐Cookie
            netease_cookies = cookie_pool.get_all_raw_cookies('netease')
            netease_active = 0
            for row in netease_cookies:
                is_valid = _verify_netease_cookie(row['cookie'])
                cookie_pool.update_verified(row['id'], is_valid)
                if is_valid:
                    netease_active += 1
            
            print(f"✅ Cookie定时验证完成: QQ音乐 {qqmusic_active}/{len(qqmusic_cookies)} 有效, 网易云 {netease_active}/{len(netease_cookies)} 有效")
        except Exception as e:
            print(f"❌ Cookie定时验证失败: {e}")

    def check_user_sessions_health():
        """定时检查用户Session健康状态：验证cookie是否有效"""
        try:
            from dao.user_music_session import UserMusicSession
            session_model = UserMusicSession()

            for platform in ('qqmusic', 'netease'):
                sessions = session_model.get_all_sessions(platform)
                valid_count, expired_count = 0, 0

                for s in sessions:
                    cookie = s.get('session_data', '')
                    user_id = s.get('user_id')

                    # 验证 cookie 是否仍然有效
                    if platform == 'netease':
                        valid = _verify_netease_cookie(cookie)
                    else:
                        valid = _verify_qqmusic_cookie(cookie)

                    if valid:
                        valid_count += 1
                    else:
                        session_model.mark_expired(user_id, platform)
                        expired_count += 1

                print(f"✅ {platform} Session健康检查: 共{len(sessions)}个, 有效{valid_count}个, 过期{expired_count}个")

        except Exception as e:
            print(f"❌ Session健康检查失败: {e}")

    # 每30分钟验证一次
    scheduler.add_job(
        id='verify_cookies',
        func=verify_all_cookies_job,
        trigger='interval',
        minutes=30,
        replace_existing=True
    )
    # 每30分钟检查Session健康
    scheduler.add_job(
        id='check_sessions_health',
        func=check_user_sessions_health,
        trigger='interval',
        minutes=30,
        replace_existing=True
    )
    print("✅ Cookie定时验证任务已注册（每30分钟）")
    print("✅ Session健康检查任务已注册（每30分钟）")


# ===================== 网易云音乐工具函数 =====================

def _extract_netease_music_u_from_cookie(cookie: str) -> str:
    """从网易云音乐Cookie中提取 MUSIC_U（注意：这不是用户ID）"""
    import re
    match = re.search(r'MUSIC_U=([^;]+)', cookie)
    return match.group(1) if match else ''


def _verify_netease_cookie(cookie: str) -> bool:
    """验证网易云音乐Cookie是否有效"""
    try:
        netease = NeteaseMusicTool(cookie=cookie, timeout=10)
        profile = netease.get_user_account()
        return bool(profile and profile.get('userId'))
    except Exception:
        return False


def _detect_netease_vip(cookie: str, uid: str) -> bool:
    """检测网易云音乐用户是否为VIP（黑胶）"""
    try:
        netease = NeteaseMusicTool(cookie=cookie, timeout=10)
        # 获取完整API数据
        user_info = netease.get_user_account(origin=True)
        if not user_info or user_info.get('code') != 200:
            print(f"⚠️ 网易云VIP检测: API返回异常 code={user_info.get('code') if user_info else 'None'}")
            return False
        
        account = user_info.get('account') or {}
        profile = user_info.get('profile') or {}
        
        # 方法1: 检查account.vipType（最可靠的字段）
        # 0=普通用户, 10=黑胶VIP, 11=黑胶SVIP
        vip_type = int(account.get('vipType') or 0)
        print(f"🔍 网易云VIP检测 uid={uid}: account.vipType={vip_type}")
        if vip_type > 0:
            return True
        
        # 方法2: 检查profile.vipType
        profile_vip_type = int(profile.get('vipType') or 0)
        print(f"🔍 网易云VIP检测 uid={uid}: profile.vipType={profile_vip_type}")
        if profile_vip_type > 0:
            return True
        
        # 方法3: 检查account.paidFee（付费金额/布尔值）
        paid_fee = account.get('paidFee')
        print(f"🔍 网易云VIP检测 uid={uid}: account.paidFee={paid_fee}")
        if paid_fee and paid_fee != 0:
            return True
        
        # 方法4: 检查profile.vipRights（VIP权益信息）
        vip_rights = profile.get('vipRights') or {}
        if vip_rights:
            associator = vip_rights.get('associator') or {}
            if associator.get('rights'):
                print(f"🔍 网易云VIP检测 uid={uid}: profile.vipRights.associator.rights=True")
                return True
        
        print(f"🔍 网易云VIP检测 uid={uid}: 未检测到VIP状态")
        return False
    except Exception as e:
        print(f"⚠️ 网易云VIP检测失败 uid={uid}: {e}")
        return False