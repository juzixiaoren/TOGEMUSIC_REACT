import sqlite3
import os
import threading
import random
from datetime import datetime
from typing import Optional, List, Dict, Any
import dao.config as config


class CookiePool:
    """Cookie池数据访问层：管理共享的QQ音乐Cookie"""

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

    def add_cookie(self, cookie: str, platform: str = 'qqmusic',
                   user_label: str = '', uin: str = '', added_by: int = None) -> int:
        """添加Cookie到池中"""
        self.execute(
            """INSERT INTO cookie_pool (cookie, platform, user_label, uin, added_by, last_verified_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (cookie, platform, user_label, uin, added_by, datetime.utcnow().isoformat())
        )
        self.commit()
        cursor = self.execute("SELECT last_insert_rowid()")
        return cursor.fetchone()[0]

    def get_all_cookies(self, platform: str = 'qqmusic') -> List[Dict[str, Any]]:
        """获取所有Cookie（脱敏显示）"""
        rows = self.execute(
            "SELECT * FROM cookie_pool WHERE platform = ? ORDER BY created_at DESC",
            (platform,)
        ).fetchall()
        return [self._mask_cookie(dict(row)) for row in rows]

    def get_active_cookies(self, platform: str = 'qqmusic') -> List[Dict[str, Any]]:
        """获取所有有效Cookie"""
        rows = self.execute(
            "SELECT * FROM cookie_pool WHERE platform = ? AND status = 'active'",
            (platform,)
        ).fetchall()
        return [dict(row) for row in rows]

    def pick_random_cookie(self, platform: str = 'qqmusic') -> Optional[str]:
        """随机选取一个有效Cookie（优先选失败次数少的）"""
        rows = self.execute(
            """SELECT id, cookie FROM cookie_pool
               WHERE platform = ? AND status = 'active'
               ORDER BY fail_count ASC, RANDOM()
               LIMIT 1""",
            (platform,)
        ).fetchall()

        if not rows:
            return None

        cookie_row = rows[0]
        # 更新使用计数
        self.execute(
            "UPDATE cookie_pool SET use_count = use_count + 1, last_used_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), cookie_row['id'])
        )
        self.commit()
        return cookie_row['cookie']

    def pick_random_cookie_with_id(self, platform: str = 'qqmusic') -> Optional[tuple]:
        """随机选取一个有效Cookie，返回 (cookie, cookie_id) 元组"""
        rows = self.execute(
            """SELECT id, cookie FROM cookie_pool
               WHERE platform = ? AND status = 'active'
               ORDER BY fail_count ASC, RANDOM()
               LIMIT 1""",
            (platform,)
        ).fetchall()

        if not rows:
            return None

        cookie_row = rows[0]
        self.execute(
            "UPDATE cookie_pool SET use_count = use_count + 1, last_used_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), cookie_row['id'])
        )
        self.commit()
        return (cookie_row['cookie'], cookie_row['id'])

    def update_vip_status(self, cookie_id: int, is_vip: bool):
        """更新Cookie的VIP状态"""
        self.execute(
            "UPDATE cookie_pool SET is_vip = ? WHERE id = ?",
            (1 if is_vip else 0, cookie_id)
        )
        self.commit()

    def pick_vip_cookie(self, platform: str = 'qqmusic') -> Optional[str]:
        """选取一个VIP Cookie（仅active且is_vip=1）"""
        rows = self.execute(
            """SELECT id, cookie FROM cookie_pool
               WHERE platform = ? AND status = 'active' AND is_vip = 1
               ORDER BY fail_count ASC, RANDOM()
               LIMIT 1""",
            (platform,)
        ).fetchall()

        if not rows:
            return None

        cookie_row = rows[0]
        self.execute(
            "UPDATE cookie_pool SET use_count = use_count + 1, last_used_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), cookie_row['id'])
        )
        self.commit()
        return cookie_row['cookie']

    def pick_vip_cookie_with_id(self, platform: str = 'qqmusic') -> Optional[tuple]:
        """选取一个VIP Cookie，返回 (cookie, cookie_id) 元组"""
        rows = self.execute(
            """SELECT id, cookie FROM cookie_pool
               WHERE platform = ? AND status = 'active' AND is_vip = 1
               ORDER BY fail_count ASC, RANDOM()
               LIMIT 1""",
            (platform,)
        ).fetchall()

        if not rows:
            return None

        cookie_row = rows[0]
        self.execute(
            "UPDATE cookie_pool SET use_count = use_count + 1, last_used_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), cookie_row['id'])
        )
        self.commit()
        return (cookie_row['cookie'], cookie_row['id'])

    def has_vip_cookie(self, platform: str = 'qqmusic') -> bool:
        """检查是否有可用的VIP Cookie"""
        cursor = self.execute(
            """SELECT COUNT(*) FROM cookie_pool
               WHERE platform = ? AND status = 'active' AND is_vip = 1""",
            (platform,)
        )
        return cursor.fetchone()[0] > 0

    def record_success(self, cookie_id: int):
        """记录Cookie使用成功"""
        self.execute(
            "UPDATE cookie_pool SET fail_count = 0, last_used_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), cookie_id)
        )
        self.commit()

    def record_failure(self, cookie_id: int):
        """记录Cookie使用失败"""
        self.execute(
            """UPDATE cookie_pool
               SET fail_count = fail_count + 1,
                   status = CASE WHEN fail_count >= 4 THEN 'expired' ELSE status END
               WHERE id = ?""",
            (cookie_id,)
        )
        self.commit()

    def update_status(self, cookie_id: int, status: str):
        """更新Cookie状态"""
        self.execute(
            "UPDATE cookie_pool SET status = ? WHERE id = ?",
            (status, cookie_id)
        )
        self.commit()

    def update_verified(self, cookie_id: int, is_valid: bool):
        """更新Cookie验证结果"""
        status = 'active' if is_valid else 'expired'
        self.execute(
            "UPDATE cookie_pool SET status = ?, last_verified_at = ?, fail_count = CASE WHEN ? THEN 0 ELSE fail_count END WHERE id = ?",
            (status, datetime.utcnow().isoformat(), is_valid, cookie_id)
        )
        self.commit()

    def delete_cookie(self, cookie_id: int):
        """删除Cookie"""
        self.execute("DELETE FROM cookie_pool WHERE id = ?", (cookie_id,))
        self.commit()

    def count_active(self, platform: str = 'qqmusic') -> int:
        """统计有效Cookie数量"""
        cursor = self.execute(
            "SELECT COUNT(*) FROM cookie_pool WHERE platform = ? AND status = 'active'",
            (platform,)
        )
        return cursor.fetchone()[0]

    def count_vip(self, platform: str = 'qqmusic') -> int:
        """统计有效VIP Cookie数量"""
        cursor = self.execute(
            "SELECT COUNT(*) FROM cookie_pool WHERE platform = ? AND status = 'active' AND is_vip = 1",
            (platform,)
        )
        return cursor.fetchone()[0]

    def count_non_vip(self, platform: str = 'qqmusic') -> int:
        """统计有效非VIP Cookie数量"""
        cursor = self.execute(
            "SELECT COUNT(*) FROM cookie_pool WHERE platform = ? AND status = 'active' AND (is_vip = 0 OR is_vip IS NULL)",
            (platform,)
        )
        return cursor.fetchone()[0]

    def get_cookie_by_id(self, cookie_id: int) -> Optional[Dict[str, Any]]:
        """根据ID获取Cookie（完整内容，内部使用）"""
        row = self.execute(
            "SELECT * FROM cookie_pool WHERE id = ?", (cookie_id,)
        ).fetchone()
        return dict(row) if row else None

    def find_cookie_by_uin(self, uin: str, platform: str = 'qqmusic') -> Optional[Dict[str, Any]]:
        """根据uin查找Cookie"""
        row = self.execute(
            "SELECT * FROM cookie_pool WHERE uin = ? AND platform = ? AND status = 'active'",
            (uin, platform)
        ).fetchone()
        return dict(row) if row else None

    def get_all_raw_cookies(self, platform: str = 'qqmusic') -> List[Dict[str, Any]]:
        """获取所有原始Cookie（未脱敏，用于验证）"""
        rows = self.execute(
            "SELECT * FROM cookie_pool WHERE platform = ?",
            (platform,)
        ).fetchall()
        return [dict(row) for row in rows]

    def _mask_cookie(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """脱敏Cookie内容"""
        masked = dict(row)
        cookie = masked.get('cookie', '')
        if len(cookie) > 40:
            masked['cookie_masked'] = cookie[:20] + '...' + cookie[-10:]
        else:
            masked['cookie_masked'] = cookie[:10] + '...'
        del masked['cookie']
        return masked