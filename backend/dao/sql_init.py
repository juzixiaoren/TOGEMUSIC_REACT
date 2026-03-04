import sqlite3
import os
from contextlib import closing
import dao.config as config

db_path = config.DB_PATH
db_name = config.DB_NAME


class SQLInit:
    def __init__(self, db_path, db_name):
        self.db_path = db_path
        self.db_name = db_name
        if not self.check_db_exists():
            self.create_db()
            self.create_tables()
    
    def check_db_exists(self):
        return os.path.exists(os.path.join(self.db_path, self.db_name))
    
    def create_db(self):
        if not os.path.exists(self.db_path):
            os.makedirs(self.db_path)
        # create database file by opening and immediately closing connection
        with sqlite3.connect(os.path.join(self.db_path, self.db_name)):
            pass
    
    def create_tables(self):
        db_file = os.path.join(self.db_path, self.db_name)
        with sqlite3.connect(db_file) as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute("PRAGMA foreign_keys = ON;")
                cursor.execute("""
        CREATE TABLE IF NOT EXISTS songs(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT,
            duration INTEGER,
            uploader_id INTEGER,
            file_path TEXT NOT NULL,
            file_extension TEXT,
            time_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(title, artist),
            FOREIGN KEY (uploader_id) REFERENCES users(id)
        )
        """)
                conn.commit()
                cursor.execute("""
            CREATE TABLE IF NOT EXISTS users(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                token TEXT
            );
        """)
                conn.commit()
                cursor.execute("""
            CREATE TABLE IF NOT EXISTS playlists(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                creater_id INTEGER,
                playlist_name TEXT NOT NULL,
                UNIQUE(playlist_name),
                FOREIGN KEY (creater_id) REFERENCES users(id)
            );
        """)
                conn.commit()
                cursor.execute("""
            CREATE TABLE IF NOT EXISTS playlist_songs(
                playlist_id INTEGER,
                song_id INTEGER,
                order_index INTEGER,
                PRIMARY KEY (playlist_id, song_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id),
                FOREIGN KEY (song_id) REFERENCES songs(id)
                );
        """)
                
                conn.commit()
                cursor.execute("""
            CREATE TABLE IF NOT EXISTS LOGIN_HISTORY(
                user_id INTEGER PRIMARY KEY,
                token TEXT,
                login_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
                conn.commit()
                cursor.execute("""
            CREATE TABLE IF NOT EXISTS ROLE(
                role_id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_name TEXT NOT NULL UNIQUE
            );
        """)
                conn.commit()
                cursor.execute("""
            CREATE TABLE IF NOT EXISTS USER_ROLE(
                user_id INTEGER,
                role_id INTEGER,
                PRIMARY KEY (user_id, role_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (role_id) REFERENCES ROLE(role_id)
            );
        """)
                conn.commit()
                # 插入默认角色
                cursor.execute("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'system', 'SYSTEM')")
                cursor.execute("INSERT OR IGNORE INTO ROLE (role_name) VALUES ('user')")
                conn.commit()
                # 插入默认歌单
                cursor.execute("INSERT OR IGNORE INTO playlists (id, creater_id, playlist_name) VALUES (1, 1, '默认播放列表')")
                conn.commit()
                cursor.execute("""
                CREATE TABLE room_play_state (
                    room_id INT PRIMARY KEY,
                    play_start_time DATETIME,
                    is_playing BOOLEAN,
                    need_notify BOOLEAN DEFAULT FALSE
                    );
                """)
                conn.commit()
                cursor.execute("""
                INSERT OR IGNORE INTO room_play_state (room_id,play_start_time, is_playing,need_notify)
                VALUES (1, NULL, FALSE, FALSE);
                """)
                conn.commit()
    
    def close(self):
        # connections are opened per-method using context managers; nothing to close
        return


if __name__ == "__main__":
    sql_init = SQLInit(db_path, db_name)
    print("数据库初始化完成")
