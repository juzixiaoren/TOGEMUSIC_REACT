import sys
import os
import random

# 首先设置模块搜索路径，让 Python 能找到 dao 包
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request
import dao.config as dao_config
from dao.sql_init import SQLInit
database = SQLInit(dao_config.DB_PATH, dao_config.DB_NAME)
from flask_cors import CORS
from flask_apscheduler import APScheduler
from flask_socketio import SocketIO
from server.config import Config
from routes.auth import auth_bp
from routes.music import music_bp

scheduler = None
socketio_async_mode = os.getenv("SOCKETIO_ASYNC_MODE", "threading")
socketio_message_queue = os.getenv("SOCKETIO_MESSAGE_QUEUE") or None
# 开启 logger 和 engineio_logger 方便排查 WebSocket 400 错误
socketio = SocketIO(
    logger=True,
    engineio_logger=True,
    cors_allowed_origins="*",
    async_mode=socketio_async_mode,
    message_queue=socketio_message_queue
)

import time
from dao.song import Song
from dao.playlist import Playlist
from utils.song_scheduler import song_scheduler

song_model = Song()
playlist_model = Playlist()

def now_ms():
    return int(time.time() * 1000)

def broadcast_song_changed():
    """
    歌曲切换时广播给所有客户端
    由定时器或客户端通知触发，不是轮询
    """
    try:
        # 查询当前播放歌曲（完整信息）
        cursor = song_model.execute("""
            SELECT s.id, s.title, s.artist, s.duration, s.uploader_id, s.file_path, s.file_extension, s.time_added
            FROM songs s
            JOIN playlist_songs ps ON s.id = ps.song_id
            WHERE ps.playlist_id = 1 AND ps.order_index = 1
        """)
        row = cursor.fetchone()
        current_song = dict(row) if row else None
        song_id = current_song["id"] if current_song else None

        socketio.emit(
            'song_changed',
            {
                'new_song_id': song_id,
                'title': current_song["title"] if current_song else None,
                'artist': current_song["artist"] if current_song else None,
                'current_song': current_song
            },
            room=None
        )

        # 同步广播最新的播放列表顺序
        cursor = song_model.execute("""
            SELECT s.id, s.title, s.artist, s.duration, s.uploader_id, s.file_path, s.file_extension, s.time_added
            FROM songs s
            JOIN playlist_songs ps ON s.id = ps.song_id
            WHERE ps.playlist_id = 1
            ORDER BY ps.order_index
        """)
        songs_rows = cursor.fetchall()
        songs_data = [dict(row) for row in songs_rows]
        socketio.emit('playlist_shuffled', {'songs': songs_data}, room=None)

        print(f"📢 广播切歌：{song_id}，已同步播放列表顺序，共 {len(songs_data)} 首")
    except Exception as e:
        print(f"❌ 广播切歌失败: {e}")
        import traceback
        traceback.print_exc()

def trigger_next_song():
    """
    切换到下一首歌曲并设置新的定时器
    由定时器或客户端通知触发
    """
    try:
        # 切歌逻辑
        song_model.rotate_playlist_index()
        song_model.start_next_song()
        
        # 广播给所有客户端
        broadcast_song_changed()
        
        # 为新歌设置定时器（备份机制）
        status = song_model.get_play_status()
        duration = song_model.get_current_song_duration()
        
        if status and duration and status["is_playing"]:
            song_scheduler.schedule_song_end(
                status["play_start_time"],
                duration["duration"]
            )
        else:
            print("⚠️ 无法设置定时器：播放状态或歌曲时长不可用")
    except Exception as e:
        print(f"❌ 切歌失败: {e}")
        import traceback
        traceback.print_exc()

def register_tasks():
    # APScheduler 现在只用于非关键任务
    # 歌曲切换由精确定时器处理，不再轮询
    pass
    
def create_app():
    app = Flask(__name__)
    cors_origins = os.getenv("CORS_ORIGINS", "*")
    if cors_origins != "*":
        cors_origins = cors_origins.split(",")

    CORS(
        app,
        resources={r"/*": {"origins": cors_origins}},
        supports_credentials=True
    )
    app.config.from_object(Config)

    # 注册蓝图
    app.register_blueprint(auth_bp)
    app.register_blueprint(music_bp)

    # 设置定时器的回调函数
    song_scheduler.set_callback(trigger_next_song)

    # 初始化 SocketIO（只初始化一次，避免运行模式冲突）
    print(f"✅ SocketIO init with CORS: {cors_origins}")
    socketio.init_app(app, cors_allowed_origins=cors_origins)

    # ===== WebSocket 事件处理 =====
    @socketio.on('connect')
    def handle_connect():
        """客户端连接时，发送当前状态（初始化同步）"""
        print(f"✅ Client connected: {request.sid}")
        try:
            # 发送当前播放状态
            status = song_model.get_play_status()
            if status:
                # 获取当前播放的歌曲信息
                cursor = song_model.execute("""
                    SELECT s.id, s.title, s.artist, s.duration, s.uploader_id, s.file_path, s.file_extension, s.time_added
                    FROM songs s
                    JOIN playlist_songs ps ON s.id = ps.song_id
                    WHERE ps.playlist_id = 1 AND ps.order_index = 1
                """)
                current_song_row = cursor.fetchone()
                current_song = dict(current_song_row) if current_song_row else None
                
                socketio.emit('sync_play_status', {
                    'play_start_time': status["play_start_time"],
                    'is_playing': status["is_playing"],
                    'current_song': current_song,
                    'server_now': now_ms()
                }, room=request.sid)
            
            # 发送当前播放列表
            songs = playlist_model.get_playlist_songs(1)
            socketio.emit('sync_playlist', {
                'songs': [dict(s) for s in songs]
            }, room=request.sid)
            
            print(f"✅ Sent initial state to {request.sid}")
        except Exception as e:
            print(f"❌ Failed to send initial state: {e}")

    @socketio.on('disconnect')
    def handle_disconnect():
        print(f"❌ Client disconnected: {request.sid}")

    @socketio.on('song_ended')
    def handle_song_ended(data=None):
        """客户端通知歌曲播放完毕（主流程，无延迟）"""
        try:
            print("🎵 客户端通知：歌曲播放完毕")
            song_scheduler.cancel_current()  # 取消服务器备份定时器
            trigger_next_song()  # 切歌
            return {'success': True}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    @socketio.on('request_next_song')
    def handle_next_song(data=None):
        """用户手动切下一首"""
        try:
            song_scheduler.cancel_current()  # 取消当前定时器
            trigger_next_song()  # 切歌并设置新定时器
            return {'success': True}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    @socketio.on('request_prev_song')
    def handle_prev_song(data=None):
        try:
            cursor = song_model.execute("SELECT MAX(order_index) FROM playlist_songs WHERE playlist_id = 1")
            max_index = cursor.fetchone()[0]
            if max_index is None:
                return {'success': False, 'error': 'Playlist is empty'}

            with song_model.get_conn():
                # 移最后一首到最前面
                song_model.get_conn().execute(
                    "UPDATE playlist_songs SET order_index = 0 WHERE playlist_id = 1 AND order_index = ?", (max_index,)
                )
                # 其他歌曲整体后移
                song_model.get_conn().execute(
                    "UPDATE playlist_songs SET order_index = order_index + 1 WHERE playlist_id = 1 AND order_index >= 1"
                )
                # 放回第一
                song_model.get_conn().execute(
                    "UPDATE playlist_songs SET order_index = 1 WHERE playlist_id = 1 AND order_index = 0"
                )
                song_model.get_conn().commit()

            song_scheduler.cancel_current()
            # 更新播放开始时间，避免补偿时间错误
            song_model.start_next_song()
            # 直接广播新的播放状态，而不是再次rotate (trigger_next_song会导致第二次rotate)
            broadcast_song_changed()
            
            # 为新歌设置定时器
            status = song_model.get_play_status()
            duration = song_model.get_current_song_duration()
            if status and duration and status["is_playing"]:
                song_scheduler.schedule_song_end(
                    status["play_start_time"],
                    duration["duration"]
                )
            return {'success': True}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    @socketio.on('request_shuffle_playlist')
    def handle_shuffle_playlist(data=None):
        try:
            # 获取除了第一首歌之外的歌曲
            cursor = song_model.execute("""
                SELECT song_id FROM playlist_songs 
                WHERE playlist_id = 1 AND order_index > 1
                ORDER BY order_index
            """)
            songs = cursor.fetchall()
            if not songs:
                return {'success': True, 'message': 'Playlist has only one song or is empty'}

            song_ids = [s[0] for s in songs]
            random.shuffle(song_ids)
            with song_model.get_conn():
                for idx, song_id in enumerate(song_ids, start=2):
                    song_model.get_conn().execute(
                        "UPDATE playlist_songs SET order_index = ? WHERE playlist_id = 1 AND song_id = ?", (idx, song_id)
                    )

            # 广播新顺序
            cursor = song_model.execute("""
                SELECT s.id, s.title, s.artist, s.duration, s.uploader_id, s.file_path, s.file_extension, s.time_added
                FROM songs s
                JOIN playlist_songs ps ON s.id = ps.song_id
                WHERE ps.playlist_id = 1
                ORDER BY ps.order_index
            """)
            shuffled_songs = cursor.fetchall()
            songs_data = [dict(zip(['id', 'title', 'artist', 'duration', 'uploader_id', 'file_path', 'file_extension', 'time_added'], s)) for s in shuffled_songs]

            socketio.emit('playlist_shuffled', {'songs': songs_data}, room=None)
            return {'success': True, 'songs': songs_data}

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    return app

app = create_app()

if __name__ == '__main__':
    allow_unsafe_werkzeug = os.getenv("ALLOW_UNSAFE_WERKZEUG", "1") == "1"
    
    socketio.run(
        app,
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=int(os.getenv("BACKEND_PORT", Config.SERVER_PORT)),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
        allow_unsafe_werkzeug=allow_unsafe_werkzeug
    )