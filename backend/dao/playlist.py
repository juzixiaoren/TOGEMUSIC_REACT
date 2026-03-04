import sqlite3
import os
from contextlib import closing
import threading
import dao.config as config

class Playlist:
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
        conn = self.get_conn()
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor
    
    def commit(self):
        self.get_conn().commit()
    
    def get_all_playlists(self):
        cursor = self.execute("SELECT * FROM playlists")
        return cursor.fetchall()
    
    def get_default_playlists(self):
        cursor = self.execute("SELECT * FROM playlists WHERE id != 1")
        return cursor.fetchall()
    
    def get_playlist(self, playlist_id):
        cursor = self.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
        return cursor.fetchone()
    
    def create_playlist(self, user_id, name):
        self.execute("INSERT INTO playlists (creater_id, playlist_name) VALUES (?, ?)", (user_id, name))
        self.commit()
    
    def get_playlist_songs(self, playlist_id):
        cursor = self.execute("""
            SELECT s.* FROM songs s
            JOIN playlist_songs ps ON s.id = ps.song_id
            WHERE ps.playlist_id = ?
            ORDER BY ps.order_index
        """, (playlist_id,))
        return cursor.fetchall()
    
    def add_song_to_playlist(self, playlist_id, song_id):
        # Get max order_index
        cursor = self.execute("SELECT MAX(order_index) FROM playlist_songs WHERE playlist_id = ?", (playlist_id,))
        row = cursor.fetchone()
        max_order = row[0] if row[0] is not None else 0
        self.execute("INSERT INTO playlist_songs (playlist_id, song_id, order_index) VALUES (?, ?, ?)",
                     (playlist_id, song_id, max_order + 1))
        self.commit()
    
    def remove_song_from_playlist(self, playlist_id, song_id):
        self.execute("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", (playlist_id, song_id))
        self.commit()
    
    def clear_playlist(self, playlist_id):
        self.execute("DELETE FROM playlist_songs WHERE playlist_id = ?", (playlist_id,))
        self.execute("""UPDATE room_play_state
                        SET play_start_time = 0,
                        is_playing = 0
                        WHERE room_id = ?""", (playlist_id,))
        self.commit()
    
    def reset_index(self, playlist_id, deleted_id):
        self.execute("""
            UPDATE playlist_songs
            SET order_index = order_index - 1
            WHERE playlist_id = ? AND order_index > (SELECT order_index FROM playlist_songs WHERE song_id = ? AND playlist_id = ?)
        """, (playlist_id, deleted_id, playlist_id))
        self.commit()