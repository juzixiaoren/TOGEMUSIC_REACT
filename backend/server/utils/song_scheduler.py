"""
歌曲播放调度器 - 精确定时器，无轮询
使用精确定时在歌曲结束时触发切歌，而不是频繁轮询数据库
"""
import threading
import time


class SongScheduler:
    def __init__(self):
        self.current_timer = None
        self.lock = threading.Lock()
        self.callback = None  # 切歌时的回调函数
    
    def set_callback(self, callback):
        """设置歌曲结束时的回调函数"""
        self.callback = callback
    
    def schedule_song_end(self, start_time_ms, duration_ms):
        """
        在歌曲开始播放时调用，设置精确的切歌定时器
        
        Args:
            start_time_ms: 歌曲开始播放的时间戳（毫秒）
            duration_ms: 歌曲时长（毫秒）
        """
        # 取消之前的定时器
        self.cancel_current()
        print(f"⏰ 设置定时器: start_time={start_time_ms}, duration={duration_ms}ms")
        print (f"⏰ 当前时间: {int(time.time() * 1000)}ms")
        
        # 计算剩余播放时间
        now_ms = int(time.time() * 1000)
        elapsed_ms = now_ms - start_time_ms  # 已经播放的时长
        remaining_ms = duration_ms - elapsed_ms  # 还需要播放的时长
        print(f"⏰ 计算剩余时间: 已播放 {elapsed_ms}ms, 还剩 {remaining_ms}ms")
        
        if remaining_ms <= 0:
            # 歌曲应该已经结束了，立即触发
            print(f"⚠️ 歌曲应该已结束（开始时间: {start_time_ms}, 时长: {duration_ms}ms）")
            self._on_song_end()
            return
        
        # 设置精确定时器（只触发一次，不是轮询）
        remaining_seconds = remaining_ms / 1000.0
        with self.lock:
            self.current_timer = threading.Timer(
                remaining_seconds,
                self._on_song_end
            )
            self.current_timer.daemon = True
            self.current_timer.start()
        
        print(f"⏰ 定时器已设置: {remaining_ms}ms ({remaining_seconds:.1f}秒) 后自动切歌")
    
    def cancel_current(self):
        """取消当前的定时器（当客户端提前通知歌曲结束时调用）"""
        with self.lock:
            if self.current_timer and self.current_timer.is_alive():
                self.current_timer.cancel()
                print("⏰ 定时器已清理")
            self.current_timer = None
    
    def _on_song_end(self):
        """歌曲结束时触发（精确时间，无轮询）"""
        print("🎵 定时器触发：歌曲播放完毕，准备切换下一首")
        print(f"⏰ 当前时间: {int(time.time() * 1000)}ms")
        if self.callback:
            try:
                self.callback()  # 执行切歌回调
            except Exception as e:
                print(f"❌ 切歌回调执行失败: {e}")
                import traceback
                traceback.print_exc()


# 全局单例
song_scheduler = SongScheduler()
