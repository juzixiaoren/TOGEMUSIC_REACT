import os

# 数据库存放目录
DB_PATH = os.path.join(os.path.dirname(__file__), 'db')  # dao/db 文件夹
# 数据库文件名
DB_NAME = 'musicdata.db'

# 可选：完整路径
DB_FULL_PATH = os.path.join(DB_PATH, DB_NAME)