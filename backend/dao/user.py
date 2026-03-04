import sqlite3
import os
from contextlib import closing
from datetime import datetime
import threading
from utils.password import hash_password, verify_password
from utils.token import generate_token
import dao.config as config

# 用户基本操作
class User:
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
    
    # 判断用户是否存在并返回用户信息
    def find_user(self, username):
        query = "SELECT * FROM users WHERE username = ?"
        return self.execute(query, (username,)).fetchone()
    
    # 创建用户
    def create(self, username, password):
        hashed_password = hash_password(password)  # 密码加密

        # 写入到用户表
        query = "INSERT INTO users (username, password_hash) VALUES (?, ?)"
        self.execute(query, (username, hashed_password))

        # 获取对应的用户id并同步到用户状态表
        user_id = self.find_user_id_by_username(username)
        query = "INSERT INTO LOGIN_HISTORY (user_id) VALUES (?)"
        self.execute(query, (user_id,))
        self.commit()
    
    # 验证密码
    def verify_password(self, user, input_password):
        if user:
            return verify_password(input_password, user["password_hash"])
        return False
    
    # 通过用户名查找用户 id
    def find_user_id_by_username(self, username):
        query = "SELECT id FROM users WHERE username = ?"
        result = self.execute(query, (username,)).fetchone()

        if not result:
            raise ValueError(f"用户名 '{username}' 不存在")

        return result["id"]

    def find_user_by_id(self, user_id):
        query = "SELECT username FROM users WHERE id = ?"
        result = self.execute(query, (user_id,)).fetchone()

        if not result:
            return None

        return result["username"]

    # 查询 token
    def query_token(self, token):
        query = "SELECT user_id FROM LOGIN_HISTORY WHERE token = ?;"
        result = self.execute(query, (token,)).fetchone()

        if result is None:
            return None

        return result["user_id"]

    # 生成token并写入用户状态表
    def generate_token(self, username):
        token = generate_token()
        user_id = self.find_user_id_by_username(username)

        query = "UPDATE LOGIN_HISTORY SET token = ? WHERE user_id = ?"
        self.execute(query, (token, user_id))
        self.commit()

        return token
    
    # 登录后在线状态更新
    def online(self, user_id):
        time = datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S')  # 获取当前 UTC 时间

        query = "UPDATE LOGIN_HISTORY SET login_at = ? WHERE user_id = ?"
        self.execute(query, (time, user_id))
        self.commit()

    # 登录后返回权限组
    def get_user_role(self, user_id):
        query = '''
        SELECT R.role_name
        FROM USER_ROLE UR
        JOIN ROLE R ON UR.role_id = R.role_id
        WHERE UR.user_id = ?
        '''
        result = self.execute(query, (user_id,)).fetchone()

        if not result:
            raise ValueError("用户没有权限组")

        return result["role_name"]
    
    # 注册后默认分配到user组
    def assign_user_role(self, user_id):
        query = '''
        INSERT INTO USER_ROLE (user_id, role_id)
        VALUES (?, (SELECT role_id FROM ROLE WHERE role_name = 'user'))
        '''
        self.execute(query, (user_id,))
        self.commit()