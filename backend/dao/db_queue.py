import sqlite3
import os
import threading
import queue
import time
import dao.config as config


class DatabaseQueue:
    """
    数据库操作队列，确保所有写操作串行执行，避免 SQLite 锁冲突。
    使用单个连接处理所有数据库操作，通过队列保证顺序执行。
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """单例模式，确保全局只有一个队列实例"""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.db_path = os.path.join(config.DB_PATH, config.DB_NAME)
        self._queue = queue.Queue()
        self._worker_thread = None
        self._running = False
        self._initialized = True
        self._conn: sqlite3.Connection = None  # type: ignore[assignment]
        self._init_connection()
        self._start_worker()
    
    def _init_connection(self):
        """初始化数据库连接"""
        self._conn = sqlite3.connect(
            self.db_path,
            timeout=30,
            check_same_thread=False
        )
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA busy_timeout=10000;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
    
    def _start_worker(self):
        """启动工作线程处理队列"""
        self._running = True
        self._worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self._worker_thread.start()
    
    def _process_queue(self):
        """处理队列中的操作"""
        while self._running:
            try:
                # 从队列获取任务，超时 1 秒
                task = self._queue.get(timeout=1)
                if task is None:  # 停止信号
                    break
                
                operation, args, result_event, result_container = task
                try:
                    result = operation(*args)
                    result_container['result'] = result
                    result_container['error'] = None
                except Exception as e:
                    result_container['result'] = None
                    result_container['error'] = e
                finally:
                    result_event.set()
                    
            except queue.Empty:
                continue
            except Exception as e:
                print(f"数据库队列处理异常: {e}")
    
    def execute_sync(self, operation, *args):
        """
        同步执行数据库操作，等待结果返回。
        
        Args:
            operation: 可调用的操作函数
            *args: 操作函数的参数
        
        Returns:
            操作结果
        
        Raises:
            操作中抛出的异常
        """
        result_event = threading.Event()
        result_container = {'result': None, 'error': None}
        
        # 将操作放入队列
        self._queue.put((operation, args, result_event, result_container))
        
        # 等待操作完成
        result_event.wait()
        
        if result_container['error']:
            raise result_container['error']
        
        return result_container['result']
    
    def execute_query(self, query, params=()):
        """执行查询并返回结果"""
        def _query():
            cursor = self._conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchall()
        
        return self.execute_sync(_query)
    
    def execute_write(self, query, params=()):
        """执行写操作"""
        def _write():
            cursor = self._conn.cursor()
            cursor.execute(query, params)
            self._conn.commit()
            return cursor.lastrowid
        
        return self.execute_sync(_write)
    
    def execute_batch(self, operations):
        """
        批量执行操作，在单个事务中完成。
        
        Args:
            operations: 操作列表，每个操作是 (query, params) 元组
        
        Returns:
            列表，包含每个操作的结果 (lastrowid 或 None)
        """
        def _batch():
            results = []
            cursor = self._conn.cursor()
            
            # 开始事务
            cursor.execute("BEGIN IMMEDIATE")
            
            try:
                for query, params in operations:
                    cursor.execute(query, params)
                    results.append(cursor.lastrowid)
                
                # 提交事务
                self._conn.commit()
                return results
                
            except Exception as e:
                # 回滚事务
                try:
                    self._conn.rollback()
                except:
                    pass
                raise e
        
        return self.execute_sync(_batch)
    
    def execute_batch_with_check(self, check_queries, insert_operations):
        """
        批量执行带检查的操作，先检查是否存在，再决定是否插入。
        
        Args:
            check_queries: 检查查询列表，每个是 (query, params) 元组
            insert_operations: 插入操作列表，每个是 (query, params) 元组
        
        Returns:
            字典，包含 'exists' (已存在的ID列表) 和 'inserted' (新插入的ID列表)
        """
        def _batch_with_check():
            results = {'exists': [], 'inserted': []}
            cursor = self._conn.cursor()
            
            # 开始事务
            cursor.execute("BEGIN IMMEDIATE")
            
            try:
                # 执行检查查询
                for query, params in check_queries:
                    cursor.execute(query, params)
                    row = cursor.fetchone()
                    if row:
                        results['exists'].append(row[0])
                
                # 执行插入操作
                for query, params in insert_operations:
                    cursor.execute(query, params)
                    results['inserted'].append(cursor.lastrowid)
                
                # 提交事务
                self._conn.commit()
                return results
                
            except Exception as e:
                # 回滚事务
                try:
                    self._conn.rollback()
                except:
                    pass
                raise e
        
        return self.execute_sync(_batch_with_check)
    
    def get_connection(self):
        """获取数据库连接（用于需要直接操作连接的场景）"""
        return self._conn
    
    def close(self):
        """关闭队列和连接"""
        self._running = False
        self._queue.put(None)  # 发送停止信号
        
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5)
        
        if self._conn:
            self._conn.close()
            self._conn = None


# 全局队列实例
db_queue = DatabaseQueue()
