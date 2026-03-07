import sqlite3
import os
from contextlib import closing
import threading
import dao.config as config
class Song:
    def __init__(self):
        self.db_path = os.path.join(config.DB_PATH, config.DB_NAME)
        self.local = threading.local()
    def get_conn(self):
        if not hasattr(self.local, 'conn'):
            self.local.conn = sqlite3.connect(
                self.db_path,
                timeout=10,
                check_same_thread=True
            )
            self.local.conn.row_factory = sqlite3.Row
        return self.local.conn
    def execute(self, query, params=()):
        conn= self.get_conn()
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor
    def commit(self):
        self.get_conn().commit()
    
    def get_all_songs(self):
        cursor = self.execute("SELECT * FROM songs")
        return cursor.fetchall()
    
    def get_song_by_id(self, song_id):
        cursor = self.execute("SELECT * FROM songs WHERE id = ?", (song_id,))
        return cursor.fetchone()
    
    def add_song(self, title, artist, duration, file_path, uploader_id, file_extension):
        self.execute("INSERT INTO songs (title, artist, duration, file_path, uploader_id, file_extension) VALUES (?, ?, ?, ?, ?, ?)",
                     (title, artist, duration, file_path, uploader_id, file_extension))
        self.commit()
    def get_play_status(self):
        cursor = self.execute("""
                            SELECT play_start_time ,is_playing,song_id
                            FROM room_play_state AS rps
                            JOIN playlist_songs AS ps ON rps.room_id = ps.playlist_id
                            WHERE rps.room_id = 1 AND ps.order_index = 1
                            LIMIT 1
                            """)
        return cursor.fetchone()
    def set_play_status(self, play_start_time, is_playing):
        self.execute("""
                    UPDATE room_play_state
                    SET play_start_time = ?, is_playing = ?
                    """, (play_start_time, is_playing))
        self.commit()
    def get_song_duration(self, song_id):
        cursor = self.execute("SELECT duration FROM songs WHERE id = ?", (song_id,))
        result = cursor.fetchone()
        return result["duration"] if result else None
    
    def get_current_song_duration(self):
        cursor = self.execute("""
            SELECT s.duration FROM songs s
            JOIN playlist_songs ps ON s.id = ps.song_id
            WHERE ps.playlist_id = 1
            AND ps.order_index=1
        """)
        return cursor.fetchone()
    def set_playlist_index(self,song_ids):
        for index, song_id in enumerate(song_ids, start=1):
            self.execute(
                "UPDATE playlist_songs SET order_index = ? WHERE playlist_id = ? AND song_id = ?",
                (index, 1, song_id)
            )
        self.commit()
    def rotate_playlist_index(self):
        cursor = self.execute(
            "SELECT MAX(order_index) FROM playlist_songs WHERE playlist_id = 1"
        )
        row = cursor.fetchone()
        max_index = row[0] if row[0] is not None else None

        if max_index is None or max_index <= 1:
            return

        tmp = max_index + 1

        conn = self.get_conn()
        try:
            # 将 order_index = 1 的歌移到临时位置
            self.execute(
                "UPDATE playlist_songs SET order_index = ? "
                "WHERE playlist_id = 1 AND order_index = 1",
                (tmp,)
            )

            # 其他 song 的 order_index 前移
            self.execute(
                "UPDATE playlist_songs SET order_index = order_index - 1 "
                "WHERE playlist_id = 1 AND order_index > 1 AND order_index < ?",
                (tmp,)
            )

            # 将临时位置的歌放到最后（max_index，因为前面的都减了1）
            self.execute(
                "UPDATE playlist_songs SET order_index = ? "
                "WHERE playlist_id = 1 AND order_index = ?",
                (max_index, tmp)
            )
            conn.commit()

        except Exception as e:
            conn.rollback()
            print("rotate_playlist_index failed:", e)
            raise
    def mark_need_notify(self):
        self.execute(
            "UPDATE room_play_state SET need_notify = 1 WHERE room_id = 1"
        )
        self.commit()
        

    def fetch_and_clear_notify(self):
        conn = self.get_conn()
        try:
            cur = self.execute(
                "SELECT need_notify FROM room_play_state WHERE room_id = 1"
            )
            row = cur.fetchone()
            if not row or row["need_notify"] == 0:
                return False

            self.execute(
                "UPDATE room_play_state SET need_notify = 0 WHERE room_id = 1"
            )

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            print("fetch_and_clear_notify failed:", e)
            raise

    
    def start_next_song(self):
        import time
        now = int(time.time() * 1000)
        self.set_play_status(now, 1)
        