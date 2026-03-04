import os

# 数据库连接方式
class Config:
    SECRET_KEY = os.urandom(24)
    DEBUG = True
    SERVER_PORT = 8034
    SCHEDULER_API_ENABLED = True