#!/usr/bin/env python3
"""
数据库迁移脚本：为songs表添加platform和platform_song_id字段
"""
import sqlite3
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dao.config as config

def migrate():
    db_path = os.path.join(config.DB_PATH, config.DB_NAME)
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 检查platform字段是否已存在
        cursor.execute("PRAGMA table_info(songs)")
        columns_info = cursor.fetchall()
        columns = [col[1] for col in columns_info]
        
        # 检查file_path是否有NOT NULL约束
        file_path_notnull = False
        for col in columns_info:
            if col[1] == 'file_path' and col[3] == 1:  # col[3] is notnull
                file_path_notnull = True
                break
        
        needs_rebuild = file_path_notnull or 'platform' not in columns
        
        if needs_rebuild:
            print("重建songs表（移除file_path的NOT NULL约束，添加platform字段）...")
            
            # 1. 创建临时表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS songs_new(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    artist TEXT,
                    duration INTEGER,
                    uploader_id INTEGER,
                    file_path TEXT,
                    file_extension TEXT,
                    platform TEXT DEFAULT 'local',
                    platform_song_id TEXT,
                    time_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(title, artist),
                    FOREIGN KEY (uploader_id) REFERENCES users(id)
                )
            """)
            
            # 2. 复制数据（包含新字段，新字段使用默认值）
            copy_cols = "id, title, artist, duration, uploader_id, file_path, file_extension"
            if 'time_added' in columns:
                copy_cols += ", time_added"
            if 'platform' in columns:
                copy_cols += ", platform"
            else:
                copy_cols += ", 'local' as platform"
            if 'platform_song_id' in columns:
                copy_cols += ", platform_song_id"
            else:
                copy_cols += ", NULL as platform_song_id"
            
            cursor.execute(f"INSERT INTO songs_new SELECT {copy_cols} FROM songs")
            
            # 3. 删除旧表，重命名新表
            cursor.execute("DROP TABLE songs")
            cursor.execute("ALTER TABLE songs_new RENAME TO songs")
            
            print("songs表重建完成！")
        else:
            # 只需要添加缺失的字段
            if 'platform' not in columns:
                print("添加 platform 字段...")
                cursor.execute("ALTER TABLE songs ADD COLUMN platform TEXT DEFAULT 'local'")
            
            if 'platform_song_id' not in columns:
                print("添加 platform_song_id 字段...")
                cursor.execute("ALTER TABLE songs ADD COLUMN platform_song_id TEXT")
        
        # 确保"所有歌曲"歌单存在
        cursor.execute("SELECT id FROM playlists WHERE playlist_name = '所有歌曲'")
        all_songs_row = cursor.fetchone()
        if all_songs_row:
            all_songs_id = all_songs_row[0]
        else:
            cursor.execute("INSERT INTO playlists (creater_id, playlist_name) VALUES (1, '所有歌曲')")
            all_songs_id = cursor.lastrowid
            print("已创建'所有歌曲'歌单")

        # 将已有歌曲加入"所有歌曲"歌单
        cursor.execute("SELECT id FROM songs WHERE id NOT IN (SELECT song_id FROM playlist_songs WHERE playlist_id = ?)", (all_songs_id,))
        missing_songs = cursor.fetchall()
        if missing_songs:
            max_order = cursor.execute("SELECT COALESCE(MAX(order_index), 0) FROM playlist_songs WHERE playlist_id = ?", (all_songs_id,)).fetchone()[0]
            for idx, (song_id,) in enumerate(missing_songs, start=max_order + 1):
                cursor.execute("INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, order_index) VALUES (?, ?, ?)", (all_songs_id, song_id, idx))
            print(f"已将 {len(missing_songs)} 首歌曲加入'所有歌曲'歌单")

        conn.commit()
        print("数据库迁移完成！")
        
    except Exception as e:
        print(f"迁移失败: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()