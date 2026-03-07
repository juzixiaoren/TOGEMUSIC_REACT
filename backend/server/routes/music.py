from flask import Blueprint, request, jsonify, send_from_directory
from flask import send_file, abort, current_app, Response, stream_with_context, make_response
import requests
from dao.song import Song
from dao.playlist import Playlist
from dao.user import User
from utils.qqmusic_tool import QQMusicTool
from utils.song_scheduler import song_scheduler
import os
import time
import json
import re
import mimetypes
import shutil
import subprocess
import uuid
import tempfile
from urllib.parse import urlparse
from mutagen.id3 import ID3
from mutagen.flac import FLAC
from io import BytesIO
music_bp = Blueprint('music', __name__)

# 获取项目根目录，确保无论从哪里运行，路径都正确
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')

song_model = Song()
playlist_model = Playlist()
user_model = User()

# 针对音频流式播放的分块大小（字节）
STREAM_CHUNK_SIZE = 1024 * 1024

# 分片上传配置
UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024  # 前端分片大小 5MB
CHUNK_TEMP_DIR = os.path.join(BASE_DIR, 'temp_chunks')  # 临时分片存储目录
os.makedirs(CHUNK_TEMP_DIR, exist_ok=True)

# 上传会话映射表：存储每个上传会话的元数据
UPLOAD_SESSIONS = {}
FLAC_BLOCK_SIZE = 4096
QQ_IMPORT_PLAYLIST_NAME = 'QQ音乐导入歌单'
QQ_TITLE_SUFFIX = '[qq]'


def _normalize_qq_title(raw_title: str) -> str:
    title = (raw_title or '').strip()
    if not title:
        return title
    if title.endswith(QQ_TITLE_SUFFIX):
        return title
    return f'{title}{QQ_TITLE_SUFFIX}'


def _ensure_playlist_id_by_name(user_id: int, playlist_name: str) -> int:
    existed = playlist_model.execute(
        'SELECT id FROM playlists WHERE playlist_name = ? LIMIT 1',
        (playlist_name,)
    ).fetchone()
    if existed:
        return existed['id']

    playlist_model.execute(
        'INSERT OR IGNORE INTO playlists (creater_id, playlist_name) VALUES (?, ?)',
        (user_id, playlist_name)
    )
    playlist_model.commit()

    created = playlist_model.execute(
        'SELECT id FROM playlists WHERE playlist_name = ? LIMIT 1',
        (playlist_name,)
    ).fetchone()
    if created:
        return created['id']
    return 1


def _session_meta_path(session_id: str) -> str:
    return os.path.join(CHUNK_TEMP_DIR, f'{session_id}.json')


def _save_upload_session(session_id: str, session: dict):
    payload = dict(session)
    payload['uploaded_chunks'] = sorted(list(payload.get('uploaded_chunks', set())))
    meta_path = _session_meta_path(session_id)
    temp_meta_path = f'{meta_path}.tmp'
    with open(temp_meta_path, 'w', encoding='utf-8') as fp:
        json.dump(payload, fp, ensure_ascii=False)
    os.replace(temp_meta_path, meta_path)


def _load_upload_session(session_id: str):
    if session_id in UPLOAD_SESSIONS:
        return UPLOAD_SESSIONS[session_id]

    meta_path = _session_meta_path(session_id)
    if not os.path.exists(meta_path):
        return None

    try:
        with open(meta_path, 'r', encoding='utf-8') as fp:
            session = json.load(fp)
        session['uploaded_chunks'] = set(session.get('uploaded_chunks', []))
        UPLOAD_SESSIONS[session_id] = session
        return session
    except Exception:
        return None


def _clear_upload_session(session_id: str):
    UPLOAD_SESSIONS.pop(session_id, None)
    meta_path = _session_meta_path(session_id)
    if os.path.exists(meta_path):
        os.remove(meta_path)


def _get_uploaded_chunk_indices(session_dir: str):
    indices = set()
    if not os.path.isdir(session_dir):
        return indices

    for entry in os.listdir(session_dir):
        if not entry.startswith('chunk_'):
            continue
        suffix = entry[len('chunk_'):]
        if suffix.isdigit():
            indices.add(int(suffix))
    return indices

def _optimize_flac_file(file_path: str):
    """
    尝试优化 FLAC 文件以降低首播延迟：
    1) 移除体积很大的元数据块（例如封面图）
    2) 重编码为较小 blocksize，减少首段解码所需数据量
    3) 确保 STREAMINFO 位于文件头部（重编码会重写元数据顺序）
    注意：该过程仍保持 FLAC 格式，不改变容器类型。
    """
    flac_bin = shutil.which('flac')
    metaflac_bin = shutil.which('metaflac')

    # 如果工具不存在，跳过优化
    if not flac_bin:
        return

    # 先尝试移除 padding，保留封面元数据
    if metaflac_bin:
        try:
            # 仅移除 padding，避免首段被无意义元数据拖慢
            subprocess.run(
                [metaflac_bin, '--remove', '--block-type=PADDING', file_path],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            pass

    # 重编码到临时文件，blocksize 变小，首段解码更快
    tmp_path = f"{file_path}.opt"
    try:
        subprocess.run(
            [
                flac_bin,
                '-f',
                f'-b{FLAC_BLOCK_SIZE}',
                '--no-padding',
                '-o', tmp_path,
                file_path
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        # 原子替换
        os.replace(tmp_path, file_path)
    except Exception:
        # 失败时清理临时文件
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass

def _guess_audio_mime(ext: str) -> str:
    # 优先指定常见音频类型，避免浏览器当作二进制下载
    ext = (ext or '').lower()
    if ext == 'flac':
        return 'audio/flac'
    if ext == 'mp3':
        return 'audio/mpeg'
    if ext == 'wav':
        return 'audio/wav'
    if ext == 'ogg':
        return 'audio/ogg'
    mime = mimetypes.types_map.get(f'.{ext}')
    return mime or 'application/octet-stream'

def extract_cover_image(file_path: str, file_extension: str) -> bytes:
    """
    从音乐文件中提取封面图
    支持 MP3 (ID3标签) 和 FLAC (元数据)
    """
    try:
        file_extension = file_extension.lower()
        
        if file_extension == 'mp3':
            # 从MP3的ID3标签中提取
            try:
                audio = ID3(file_path)
                for tag in audio.values():
                    if tag.FrameID == 'APIC':  # Attached Picture
                        return tag.data
            except Exception as e:
                print(f"Failed to extract cover from MP3: {e}")
        
        elif file_extension == 'flac':
            # 从FLAC的元数据中提取
            try:
                audio = FLAC(file_path)
                if audio.pictures:
                    return audio.pictures[0].data
            except Exception as e:
                print(f"Failed to extract cover from FLAC: {e}")
    
    except Exception as e:
        print(f"Error extracting cover image: {e}")
    
    return None

def _parse_range(range_header: str, file_size: int):
    # 解析 Range: bytes=start-end
    if not range_header or not range_header.startswith('bytes='):
        return None
    try:
        range_value = range_header.split('=')[1]
        start_str, end_str = range_value.split('-')
        if start_str == '':
            # 后缀范围: bytes=-N
            length = int(end_str)
            start = max(file_size - length, 0)
            end = file_size - 1
            return start, end, False
        else:
            start = int(start_str)
            if end_str:
                end = int(end_str)
                return start, end, False
            # 开放区间: bytes=start-
            end = file_size - 1
            return start, end, True
        if start > end or start < 0 or end >= file_size:
            return None
    except Exception:
        return None

def _iter_file_range(file_path: str, start: int, end: int, chunk_size: int = STREAM_CHUNK_SIZE):
    # 按区间读取文件，避免一次性加载全部数据
    with open(file_path, 'rb') as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            read_size = min(chunk_size, remaining)
            data = f.read(read_size)
            if not data:
                break
            remaining -= len(data)
            yield data

def verify_token(token):
    return user_model.query_token(token)




def _guess_ext_from_url(play_url: str, fallback: str = 'm4a') -> str:
    try:
        path = urlparse(play_url).path or ''
        base = os.path.basename(path)
        if '.' in base:
            ext = base.rsplit('.', 1)[-1].lower()
            if ext:
                return ext
    except Exception:
        pass
    return fallback


def _extract_qqmusic_search_items(payload: dict):
    data = payload.get('data') if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        return []

    raw_items = []

    # 常见结构：data.list
    if isinstance(data.get('list'), list):
        raw_items = data.get('list')
    else:
        # 兼容 search 原始结构
        song_section = data.get('song') if isinstance(data.get('song'), dict) else {}
        if isinstance(song_section.get('list'), list):
            raw_items = song_section.get('list')

    result = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue

        songmid = item.get('songmid') or item.get('mid') or item.get('id')
        title = item.get('songname') or item.get('title') or ''
        singers = item.get('singer') if isinstance(item.get('singer'), list) else []
        artist = '/'.join([s.get('name', '') for s in singers if isinstance(s, dict) and s.get('name')])
        if not artist:
            artist = item.get('artist') or ''

        interval = item.get('interval')
        duration_ms = int(interval * 1000) if isinstance(interval, (int, float)) else int(item.get('duration') or 0)

        result.append({
            'songmid': songmid,
            'title': title,
            'artist': artist,
            'duration': duration_ms,
            'strMediaMid': item.get('strMediaMid') or item.get('media_mid') or songmid
        })

    return result


def _create_qqmusic_tool() -> QQMusicTool:
    # 运行时从后端环境变量读取 QQ cookie，前端不再持有敏感信息。
    cookie_header = (os.getenv('QQMUSIC_COOKIE') or '').strip()
    # 兼容历史调用：若环境变量为空，仍允许旧版前端透传。
    if not cookie_header:
        cookie_header = (request.headers.get('X-QQMusic-Cookie') or '').strip()
    return QQMusicTool(cookie_header=cookie_header, timeout=15)


def _extract_play_url(payload: dict):
    if not isinstance(payload, dict):
        return None

    req_data = (((payload.get('req_1') or {}).get('data') or {}))
    if isinstance(req_data, dict):
        sip = req_data.get('sip') or []
        mid_url_info = req_data.get('midurlinfo') or []
        base_url = sip[0] if sip else ''
        purl = (mid_url_info[0] or {}).get('purl') if mid_url_info else ''
        if purl:
            return f'{base_url}{purl}'

    data = payload.get('data')
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        if isinstance(data.get('url'), str):
            return data.get('url')
        for _, value in data.items():
            if isinstance(value, str) and value.startswith('http'):
                return value
    return None


def _is_qq_song(song: dict) -> bool:
    title = str((song or {}).get('title') or '')
    file_path = str((song or {}).get('file_path') or '')
    return title.endswith('[qq]') or ('qq.com' in file_path and file_path.startswith('http'))


def _extract_songmid_from_song(song: dict):
    file_path = str((song or {}).get('file_path') or '')
    if not file_path:
        return None

    # 常见 purl 格式：M800<songmid><mediaid>.mp3 / C400<songmid><mediaid>.m4a
    for pattern in [r'(?:C400|M500|M800|A000|F000)([A-Za-z0-9]{14})', r'/([A-Za-z0-9]{14})\.[A-Za-z0-9]+(?:\?|$)']:
        match = re.search(pattern, file_path)
        if match:
            return match.group(1)
    return None

@music_bp.route('/upload', methods=['POST'])
def upload_music():
    print(">>> Upload request received")  # 添加日志以确认请求到达
    token = request.headers.get('Authorization')
    if not token:
        print(">>> No token provided")
        return jsonify({'message': 'No token provided'}), 401
    user_id = verify_token(token)
    if not user_id:
        print(f">>> Invalid token for token: {token[:10]}...")
        return jsonify({'message': 'Invalid token'}), 401

    # 打印调试信息
    print("=== request.form ===")
    for k, v in request.form.items():
        print(f"{k} -> {v}")
    print("=== request.files ===")
    for f in request.files:
        print(f"{f} -> {request.files[f].filename}")

    files = request.files.getlist('files')

    # 按下标动态读取 titles, artists, durations
    titles, artists, durations = [], [], []
    i = 0
    while True:
        t_key = f'titles[{i}]'
        a_key = f'artists[{i}]'
        d_key = f'durations[{i}]'

        t_val = request.form.get(t_key)
        a_val = request.form.get(a_key)
        d_val = request.form.get(d_key)

        # 都没有就结束
        if t_val is None and a_val is None and d_val is None:
            break

        titles.append(t_val or '')
        artists.append(a_val or '')
        try:
            durations.append(int(d_val))
        except (TypeError, ValueError):
            durations.append(0)

    for i, file in enumerate(files):
        if file and file.filename:
            filename = file.filename
            file_extension = filename.split('.')[-1].lower() if '.' in filename else ''
            file_path = os.path.join(UPLOADS_DIR, filename)
            os.makedirs(UPLOADS_DIR, exist_ok=True)
            file.save(file_path)

            # 上传后对 FLAC 做优化处理，缩短首播等待
            if file_extension == 'flac':
                _optimize_flac_file(file_path)

            # 防止索引越界
            title = titles[i] if i < len(titles) else filename.rsplit('.', 1)[0]
            artist = artists[i] if i < len(artists) else ''
            duration = durations[i] if i < len(durations) else 0

            print(f"Saving song: {title}, {artist}, {duration}ms, {file_path}")
            song_model.add_song(title, artist, duration, file_path, user_id, file_extension)

    return jsonify({'message': 'Upload successful'}), 200


@music_bp.route('/songs', methods=['GET'])
def get_songs():
    songs = song_model.get_all_songs()
    return jsonify([dict(song) for song in songs]), 200


@music_bp.route('/qqmusic/search', methods=['GET'])
def qqmusic_search():
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    key = (request.args.get('key') or '').strip()
    if not key:
        return jsonify({'message': 'key is required'}), 400

    page_no = int(request.args.get('pageNo', '1'))
    page_size = int(request.args.get('pageSize', '20'))
    qqmusic = _create_qqmusic_tool()
    try:
        song_data = qqmusic.search_with_keyword(
            keyword=key,
            search_type=0,
            result_num=page_size,
            page_num=page_no,
            origin=False,
        ) or {}

        song_list = song_data.get('list') if isinstance(song_data, dict) else []
        return jsonify({
            'result': 100,
            'data': {
                'list': song_list or [],
                'pageNo': song_data.get('curpage', page_no) if isinstance(song_data, dict) else page_no,
                'pageSize': song_data.get('curnum', page_size) if isinstance(song_data, dict) else page_size,
                'total': song_data.get('totalnum', len(song_list or [])) if isinstance(song_data, dict) else 0,
                'key': key,
                't': 0,
                'type': 'song',
            }
        }), 200
    except Exception as e:
        return jsonify({'message': f'QQMusic API search failed: {str(e)}'}), 502




@music_bp.route('/qqmusic/import', methods=['POST'])
def qqmusic_import_song():
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    data = request.get_json() or {}
    songmid = (data.get('songmid') or '').strip()
    if not songmid:
        return jsonify({'message': 'songmid is required'}), 400

    title = _normalize_qq_title((data.get('title') or songmid))
    artist = (data.get('artist') or '').strip()
    duration = int(data.get('duration') or 0)
    audio_type = (data.get('type') or 'm4a').strip().lower()
    add_to_playlist = bool(data.get('addToPlaylist', True))

    qqmusic = _create_qqmusic_tool()

    try:
        payload = qqmusic.get_music_url(songmid=songmid, quality=audio_type, origin=True)
        play_url = _extract_play_url(payload)
        if not play_url:
            return jsonify({'message': 'No playable url returned from QQMusic API', 'raw': payload}), 502
    except requests.RequestException as e:
        return jsonify({'message': f'QQMusic upstream unavailable: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'message': f'QQMusic import failed: {str(e)}'}), 500

    exists = song_model.execute(
        'SELECT id FROM songs WHERE title = ? AND artist = ? LIMIT 1',
        (title, artist)
    ).fetchone()
    if exists:
        if add_to_playlist:
            target_playlist_id = _ensure_playlist_id_by_name(user_id, QQ_IMPORT_PLAYLIST_NAME)
            try:
                playlist_model.add_song_to_playlist(target_playlist_id, exists['id'])
            except Exception:
                pass
        return jsonify({'message': 'Song already exists', 'songId': exists['id'], 'playUrl': play_url}), 200

    file_extension = _guess_ext_from_url(play_url, audio_type)
    song_model.add_song(title, artist, duration, play_url, user_id, file_extension)
    created = song_model.execute('SELECT id FROM songs WHERE title = ? AND artist = ? LIMIT 1', (title, artist)).fetchone()
    if created and add_to_playlist:
        target_playlist_id = _ensure_playlist_id_by_name(user_id, QQ_IMPORT_PLAYLIST_NAME)
        try:
            playlist_model.add_song_to_playlist(target_playlist_id, created['id'])
        except Exception:
            pass

    return jsonify({
        'message': 'Imported successfully',
        'songId': created['id'] if created else None,
        'playUrl': play_url,
        'fileExtension': file_extension
    }), 201


@music_bp.route('/qqmusic/cover/<int:song_id>', methods=['GET'])
def qqmusic_cover(song_id):
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401

    song = song_model.get_song_by_id(song_id)
    if not song:
        return jsonify({'message': 'Song not found'}), 404

    song_obj = dict(song)
    if not _is_qq_song(song_obj):
        return jsonify({'message': 'Not a QQ song'}), 400

    songmid = _extract_songmid_from_song(song_obj)
    if not songmid:
        return jsonify({'message': 'Cannot extract songmid from song path'}), 404

    qqmusic = _create_qqmusic_tool()
    try:
        cover_url = qqmusic.get_song_cover_image(songmid=songmid)
        if not cover_url:
            return jsonify({'cover': None}), 404
        return jsonify({'cover': cover_url, 'songmid': songmid}), 200
    except requests.RequestException as e:
        return jsonify({'message': f'QQMusic upstream unavailable: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'message': f'QQMusic cover fetch failed: {str(e)}'}), 500

@music_bp.route('/playlists', methods=['GET'])
def get_playlists():
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if user_id is None:
        return jsonify({'message': 'Invalid token'}), 401
    playlists = playlist_model.get_default_playlists()
    return jsonify([dict(p) for p in playlists]), 200
@music_bp.route('/getAllPlaylists', methods=['GET'])
def get_all_playlists():
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if user_id is None:
        return jsonify({'message': 'Invalid token'}), 401
    playlists = playlist_model.get_all_playlists()
    return jsonify([dict(p) for p in playlists]), 200
@music_bp.route('/playlists', methods=['POST'])
def create_playlist():
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    data = request.get_json()
    name = data.get('name')
    playlist_model.create_playlist(user_id, name)
    return jsonify({'message': 'Playlist created'}), 201

@music_bp.route('/playlists/<int:playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    playlist = playlist_model.get_playlist(playlist_id)
    songs = playlist_model.get_playlist_songs(playlist_id)
    return jsonify({
        'playlist': dict(playlist),
        'songs': [dict(s) for s in songs]
    }), 200

@music_bp.route('/playlists/<int:playlist_id>/songs', methods=['POST'])
def add_songs_to_playlist(playlist_id):
    data = request.get_json()
    song_ids = data.get('songIds', [])
    source_playlist_id = data.get('sourcePlaylistId', None)
    
    added_count = 0
    skipped_count = 0
    
    # 如果指定了源歌单，从源歌单获取歌曲
    if source_playlist_id:
        source_songs = playlist_model.get_playlist_songs(source_playlist_id)
        # 从源歌单中按选中的歌曲ID导入
        for song in source_songs:
            if song["id"] in song_ids:  # song["id"] 是 song_id
                try:
                    playlist_model.add_song_to_playlist(playlist_id, song["id"])
                    added_count += 1
                except Exception as e:
                    # 捕获UNIQUE约束冲突或其他错误，继续处理其他歌曲
                    print(f'跳过歌曲 {song["id"]}: {e}')
                    skipped_count += 1
    else:
        # 直接从歌曲ID列表导入
        for song_id in song_ids:
            try:
                playlist_model.add_song_to_playlist(playlist_id, song_id)
                added_count += 1
            except Exception as e:
                # 捕获UNIQUE约束冲突或其他错误，继续处理其他歌曲
                print(f"跳过歌曲 {song_id}: {str(e)}")
                skipped_count += 1
    
    return jsonify({
        'message': f'导入成功: {added_count}首歌曲' + (f'，跳过: {skipped_count}首重复歌曲' if skipped_count > 0 else ''),
        'added': added_count,
        'skipped': skipped_count
    }), 200

@music_bp.route('/playlists/<int:playlist_id>/songs/<int:song_id>', methods=['DELETE'])
def remove_song_from_playlist(playlist_id, song_id):
    playlist_model.remove_song_from_playlist(playlist_id, song_id)
    return jsonify({'message': 'Song removed'}), 200

@music_bp.route('/songs/<int:song_id>/file.<ext>', methods=['GET'])
def get_song_file(song_id, ext):
    song = song_model.get_song_by_id(song_id)
    if not song:
        abort(404, description='Song not found')

    # song[5] is the stored file path. It might be a Windows path (e.g. E:\...) or a remote URL
    # When running on Linux (Docker), os.path.basename won't handle '\' correctly.
    stored_path = song[5]

    # 远程 URL 直接重定向，播放器继续使用原有 /songs/:id/file.ext 路径即可
    if isinstance(stored_path, str) and (stored_path.startswith('http://') or stored_path.startswith('https://')):
        return jsonify({'url': stored_path}), 302, {'Location': stored_path}

    if '\\' in stored_path:
        filename = stored_path.split('\\')[-1]
    else:
        filename = os.path.basename(stored_path)

    file_path = os.path.join(UPLOADS_DIR, filename)
    print(f"Serving file from: {file_path}")
    
    # 验证请求的后缀和文件实际后缀一致
    if not file_path.endswith(f'.{ext}'):
        abort(400, description='File extension mismatch')

    # 文件尺寸
    file_size = os.path.getsize(file_path)
    mime_type = _guess_audio_mime(ext)

    # 解析 Range 请求
    range_header = request.headers.get('Range')
    byte_range = _parse_range(range_header, file_size)

    # Range 存在但非法时，返回 416
    if range_header and byte_range is None:
        error_resp = make_response('', 416)
        error_resp.headers['Content-Range'] = f'bytes */{file_size}'
        error_resp.headers['Accept-Ranges'] = 'bytes'
        return error_resp

    # 没有 Range 时，主动返回首段数据，避免一次性传完整文件
    if byte_range is None:
        start = 0
        end = min(file_size - 1, STREAM_CHUNK_SIZE - 1)
        status_code = 206
    else:
        start, end, is_open_ended = byte_range
        # 对开放区间 Range 主动裁剪，避免一次性返回整文件
        if is_open_ended:
            end = min(end, start + STREAM_CHUNK_SIZE - 1)
        status_code = 206

    # 生成分段响应
    response = Response(
        stream_with_context(_iter_file_range(file_path, start, end)),
        status=status_code,
        mimetype=mime_type,
        direct_passthrough=True
    )
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    response.headers['Content-Length'] = str(end - start + 1)
    response.headers['Content-Disposition'] = 'inline'
    return response

@music_bp.route('/songs/<int:song_id>/cover', methods=['GET'])
def get_song_cover(song_id):
    """
    获取歌曲的封面图
    支持 MP3（ID3 APIC 标签）和 FLAC（METADATA_BLOCK_PICTURE）
    
    返回值：
    - JSON: { "cover": "data:image/jpeg;base64,..." } 如果有封面
    - JSON: { "cover": null } 如果没有封面
    - 404: 歌曲不存在
    """
    song = song_model.get_song_by_id(song_id)
    if not song:
        return jsonify({'cover': None}), 404
    
    # song[5] 是存储的文件路径
    stored_path = song[5]
    if '\\' in stored_path:
        filename = stored_path.split('\\')[-1]
    else:
        filename = os.path.basename(stored_path)
    
    file_path = os.path.join(UPLOADS_DIR, filename)
    file_extension = song[6]  # song[6] 是文件扩展名
    
    if not os.path.exists(file_path):
        return jsonify({'cover': None}), 404
    
    try:
        # 从音频文件中提取封面
        cover_data = extract_cover_image(file_path, file_extension)
        
        if cover_data:
            # 转换为 base64 data URL
            import base64
            b64_data = base64.b64encode(cover_data).decode('utf-8')
            cover_url = f'data:image/jpeg;base64,{b64_data}'
            return jsonify({'cover': cover_url}), 200
        else:
            # 没有找到封面
            return jsonify({'cover': None}), 200
            
    except Exception as e:
        print(f"获取歌曲 {song_id} 的封面失败: {e}")
        return jsonify({'cover': None}), 500

@music_bp.route('/uploadchunkinit', methods=['POST'])
def init_chunk_upload():
    # 初始化分片上传会话，生成唯一的 sessionId
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Invalid request body'}), 400

    filename = data.get('filename')
    total_chunks = data.get('totalChunks')
    file_size = data.get('fileSize')
    title = data.get('title')
    artist = data.get('artist')
    duration = data.get('duration')

    try:
        total_chunks = int(total_chunks)
        file_size = int(file_size)
        duration = int(duration)
    except (TypeError, ValueError):
        return jsonify({'message': 'Invalid chunk init params'}), 400

    if not filename or total_chunks <= 0 or file_size <= 0:
        return jsonify({'message': 'Invalid chunk init params'}), 400
    
    # 生成唯一的会话 ID
    session_id = str(uuid.uuid4())
    
    # 创建该会话的临时目录
    session_dir = os.path.join(CHUNK_TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # 存储会话元数据
    UPLOAD_SESSIONS[session_id] = {
        'user_id': user_id,
        'filename': filename,
        'total_chunks': total_chunks,
        'file_size': file_size,
        'title': title,
        'artist': artist,
        'duration': duration,
        'session_dir': session_dir,
        'uploaded_chunks': set(),
        'created_at': time.time()
    }
    _save_upload_session(session_id, UPLOAD_SESSIONS[session_id])
    
    print(f"初始化上传会话：{session_id}，总分片数：{total_chunks}")
    return jsonify({'sessionId': session_id}), 200


@music_bp.route('/uploadchunk', methods=['POST'])
def upload_chunk():
    # 接收单个分片，保存到会话的临时目录
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401
    
    session_id = (request.form.get('sessionId') or '').strip()
    chunk_index_raw = request.form.get('chunkIndex')
    total_chunks_raw = request.form.get('totalChunks')
    chunk_file = request.files.get('chunk')

    if not chunk_file or not session_id or chunk_index_raw is None or total_chunks_raw is None:
        return jsonify({'message': 'Invalid request'}), 400

    try:
        chunk_index = int(chunk_index_raw)
        total_chunks = int(total_chunks_raw)
    except (TypeError, ValueError):
        return jsonify({'message': 'Invalid chunk params'}), 400

    session = _load_upload_session(session_id)
    if not session:
        return jsonify({'message': 'Invalid session'}), 400

    if session['user_id'] != user_id:
        return jsonify({'message': 'Unauthorized'}), 403

    expected_chunks = int(session['total_chunks'])
    if total_chunks != expected_chunks or chunk_index < 0 or chunk_index >= expected_chunks:
        return jsonify({'message': 'Chunk index out of range'}), 400
    
    # 保存分片到临时目录
    chunk_path = os.path.join(session['session_dir'], f'chunk_{chunk_index}')
    chunk_file.save(chunk_path)

    # 记录已上传的分片
    session['uploaded_chunks'].add(chunk_index)

    # 进程内状态仅用于日志与快速读取；真实一致性依赖磁盘元数据与分片文件
    _save_upload_session(session_id, session)
    uploaded_count = len(_get_uploaded_chunk_indices(session['session_dir']))

    print(f"已接收分片 {chunk_index + 1}/{total_chunks}，会话 {session_id}，已完成 {uploaded_count}/{total_chunks}")
    
    return jsonify({'message': 'Chunk uploaded'}), 200


@music_bp.route('/uploadchunkmerge', methods=['POST'])
def merge_chunks():
    # 合并所有分片为完整文件，并保存到数据库
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'message': 'Invalid token'}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Invalid request body'}), 400

    session_id = (data.get('sessionId') or '').strip()

    session = _load_upload_session(session_id)
    if not session:
        return jsonify({'message': 'Invalid session'}), 400

    if session['user_id'] != user_id:
        return jsonify({'message': 'Unauthorized'}), 403

    # 验证所有分片是否已上传
    expected_count = int(session['total_chunks'])
    uploaded_chunks = _get_uploaded_chunk_indices(session['session_dir'])
    uploaded_count = len(uploaded_chunks)
    if uploaded_count != expected_count:
        missing_chunks = [i for i in range(expected_count) if i not in uploaded_chunks]
        print(f"❌ 合并失败：会话 {session_id} 只收到 {uploaded_count}/{expected_count} 个分片，缺少：{missing_chunks}")
        return jsonify({
            'message': f'Not all chunks uploaded: {uploaded_count}/{expected_count}',
            'missing': missing_chunks
        }), 400
    
    # 按顺序合并分片为完整文件
    output_path = os.path.join(UPLOADS_DIR, session['filename'])
    try:
        with open(output_path, 'wb') as outfile:
            for chunk_index in range(session['total_chunks']):
                chunk_path = os.path.join(session['session_dir'], f'chunk_{chunk_index}')
                with open(chunk_path, 'rb') as infile:
                    outfile.write(infile.read())
        
        # 对 FLAC 文件进行优化处理
        file_ext = session['filename'].split('.')[-1].lower()
        if file_ext == 'flac':
            _optimize_flac_file(output_path)
        
        # 将文件信息保存到数据库
        song_model.add_song(
            session['title'],
            session['artist'],
            session['duration'],
            output_path,
            user_id,
            file_ext
        )
        
        # 清理临时目录
        shutil.rmtree(session['session_dir'])
        _clear_upload_session(session_id)
        
        print(f"成功合并文件：{session['filename']}")
        return jsonify({'message': 'File merged successfully'}), 200
    
    except Exception as e:
        print(f"合并失败：{e}")
        return jsonify({'message': f'Merge failed: {str(e)}'}), 500

@music_bp.route('/users', methods=['GET'])
def get_users():
    # 简化，获取所有用户
    users = user_model.execute("SELECT id, username FROM users").fetchall()
    return jsonify([{'id': u["id"], 'username': u["username"]} for u in users]), 200
@music_bp.route('/getplaystatus', methods=['GET'])
def get_play_status():
    status = song_model.get_play_status()
    server_now = int(time.time() * 1000)
    
    # 获取当前歌曲的完整信息
    current_song = None
    if status and status["song_id"]:
        song = song_model.get_song_by_id(status["song_id"])
        if song:
            current_song = {
                'id': song['id'],
                'title': song['title'],
                'artist': song['artist'],
                'duration': song['duration'],
                'file_extension': song['file_extension'],
                'file_path': song['file_path'],
                'uploader_id': song['uploader_id']
            }
    
    result = {
        'play_start_time': status["play_start_time"] if status else None,
        'is_playing': status["is_playing"] if status else 0,
        'server_now': server_now,
        'current_song': current_song
    }
    return jsonify(result), 200
@music_bp.route('/getplaysongs', methods=['GET'])
def get_play_songs():
    songs=playlist_model.get_playlist_songs(1)
    return jsonify([dict(song) for song in songs]), 200

@music_bp.route('/requestplay', methods=['POST'])
def request_play():
    """开始播放，设置定时器"""
    songs = playlist_model.get_playlist_songs(1)
    if not songs or len(songs) == 0:
        return jsonify({'status': False, 'message': 'No songs in playlist'}), 400
    
    now_time = int(time.time() * 1000 + 2 * 1000)
    song_model.set_play_status(now_time, 1)
    
    # 设置精确定时器（备份机制）
    try:
        duration = song_model.get_current_song_duration()
        if duration:
            song_scheduler.schedule_song_end(now_time, duration["duration"])
            print(f"✅ 播放开始，定时器已设置")
        else:
            print("⚠️ 无法获取歌曲时长，定时器未设置")
    except Exception as e:
        print(f"⚠️ 设置定时器失败: {e}")
    
    return jsonify({'status': True, 'message': 'Request play successful'}), 200

@music_bp.route('/clearplaylist', methods=['GET'])
def clear_playlist():
    """清空播放列表，取消定时器"""
    playlist_model.clear_playlist(1)
    song_scheduler.cancel_current()  # 取消定时器
    return jsonify({'message': 'Playlist cleared', 'success': True}), 200

@music_bp.route('/removesongfromplaylist', methods=['POST'])
def remove_song_from_playlist_request():
    data = request.get_json()
    song_id = data.get('song_id')
    
    # 获取当前播放列表
    now_songs = playlist_model.get_playlist_songs(1)
    
    if not now_songs or len(now_songs) == 0:
        # 如果删除前列表为空，直接返回错误
        return jsonify({'message': '删除错误', 'success': False, 'is_playing': False}), 200
    
    # 检查删除的是否是当前播放的歌曲（order_index=1 的歌曲）
    is_playing_song = len(now_songs) > 0 and now_songs[0][0] == song_id
    
    # 从播放列表中删除歌曲
    playlist_model.remove_song_from_playlist(1, song_id)
    
    # 获取 socketio 实例
    socketio = current_app.extensions.get('socketio')
    
    if is_playing_song:
        # 如果删除的是当前播放的歌曲，切换下一首歌
        song_model.rotate_playlist_index()
        song_model.start_next_song()
        song_model.mark_need_notify()
        
        # 获取新的播放列表用于广播
        updated_songs = playlist_model.get_playlist_songs(1)
        songs_data = [dict(s) for s in updated_songs]
        
        # 广播所有人切歌并更新歌单
        if socketio:
            socketio.emit('song_deleted_and_changed', {
                'deleted_song_id': song_id,
                'new_song_id': songs_data[0]['id'] if songs_data else None,
                'new_song': dict(updated_songs[0]) if updated_songs else None,
                'playlist': songs_data
            }, room=None)
    else:
        # 如果删除的不是当前播放的歌曲，重新调整顺序索引
        playlist_model.reset_index(1, song_id)
        
        # 获取更新后的播放列表
        updated_songs = playlist_model.get_playlist_songs(1)
        songs_data = [dict(s) for s in updated_songs]
        
        # 广播歌单更新（不切歌）
        if socketio:
            socketio.emit('playlist_updated', {
                'deleted_song_id': song_id,
                'playlist': songs_data
            }, room=None)
    
    return jsonify({
        'message': 'Song removed from playlist',
        'success': True,
        'is_playing': is_playing_song
    }), 200


@music_bp.route('/reorderPlaylist', methods=['POST'])
def reorder_playlist():
    """重新排列播放列表中的歌曲顺序"""
    token = request.headers.get('Authorization')
    user_id = verify_token(token)
    if user_id is None:
        return jsonify({'message': 'Invalid token'}), 401

    data = request.get_json()
    playlist_id = data.get('playlist_id')
    song_ids = data.get('song_ids', [])
    socketio = current_app.extensions.get('socketio')

    if not playlist_id or not song_ids:
        return jsonify({'message': 'Missing playlist_id or song_ids'}), 400

    try:
        # 更新播放列表中歌曲的顺序
        song_model.set_playlist_index(song_ids)
        # 广播新的播放列表顺序
        songs = playlist_model.get_playlist_songs(playlist_id)
        songs_data = [dict(s) for s in songs]
        if socketio:
            socketio.emit('playlist_shuffled', {'songs': songs_data}, room=None)

        return jsonify({
            'message': 'Playlist reordered successfully',
            'success': True
        }), 200
    except Exception as e:
        print(f"重新排列播放列表失败: {e}")
        return jsonify({
            'message': 'Failed to reorder playlist',
            'error': str(e)
        }), 500
