import sqlite3
import os
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
import dao.config as config


class UserMusicSession:
    """用户音乐平台登录Session数据访问层"""

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
            self.local.conn.execute("PRAGMA journal_mode=WAL;")
            self.local.conn.execute("PRAGMA busy_timeout=5000;")
        return self.local.conn

    def execute(self, query, params=()):
        conn = self.get_conn()
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor

    def commit(self):
        self.get_conn().commit()

    def save_session(self, user_id: int, platform: str, session_data: str,
                     uin: str = '', nickname: str = '', expires_at: str = None) -> int:
        """保存或更新用户Session"""
        # 先尝试更新
        existing = self.execute(
            "SELECT id FROM user_music_sessions WHERE user_id = ? AND platform = ?",
            (user_id, platform)
        ).fetchone()

        if existing:
            self.execute(
                """UPDATE user_music_sessions
                   SET session_data = ?, uin = ?, nickname = ?,
                       status = 'active', last_used_at = ?, expires_at = ?
                   WHERE user_id = ? AND platform = ?""",
                (session_data, uin, nickname, datetime.utcnow().isoformat(),
                 expires_at, user_id, platform)
            )
            self.commit()
            return existing['id']
        else:
            self.execute(
                """INSERT INTO user_music_sessions
                   (user_id, platform, session_data, uin, nickname, last_used_at, expires_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, platform, session_data, uin, nickname,
                 datetime.utcnow().isoformat(), expires_at)
            )
            self.commit()
            cursor = self.execute("SELECT last_insert_rowid()")
            return cursor.fetchone()[0]

    def get_session(self, user_id: int, platform: str = 'qqmusic') -> Optional[Dict[str, Any]]:
        """获取用户的Session"""
        row = self.execute(
            "SELECT * FROM user_music_sessions WHERE user_id = ? AND platform = ? AND status = 'active'",
            (user_id, platform)
        ).fetchone()
        if row:
            return dict(row)
        return None

    def get_session_data(self, user_id: int, platform: str = 'qqmusic') -> Optional[str]:
        """获取用户的Session数据（纯cookie字符串）"""
        session = self.get_session(user_id, platform)
        return session['session_data'] if session else None

    def delete_session(self, user_id: int, platform: str = 'qqmusic'):
        """删除用户Session"""
        self.execute(
            "DELETE FROM user_music_sessions WHERE user_id = ? AND platform = ?",
            (user_id, platform)
        )
        self.commit()

    def mark_expired(self, user_id: int, platform: str = 'qqmusic'):
        """标记Session为过期"""
        self.execute(
            "UPDATE user_music_sessions SET status = 'expired' WHERE user_id = ? AND platform = ?",
            (user_id, platform)
        )
        self.commit()

    def has_valid_session(self, user_id: int, platform: str = 'qqmusic') -> bool:
        """检查用户是否有有效的Session"""
        cursor = self.execute(
            """SELECT COUNT(*) FROM user_music_sessions
               WHERE user_id = ? AND platform = ? AND status = 'active'""",
            (user_id, platform)
        )
        return cursor.fetchone()[0] > 0

    def get_all_sessions(self, platform: str = 'qqmusic') -> List[Dict[str, Any]]:
        """获取所有Session（管理用）"""
        rows = self.execute(
            "SELECT * FROM user_music_sessions WHERE platform = ? ORDER BY last_used_at DESC",
            (platform,)
        ).fetchall()
        return [dict(row) for row in rows]