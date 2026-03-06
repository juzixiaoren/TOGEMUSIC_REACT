import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useMessage } from "./MessageContext";
import { useSocket } from "./SocketContext";
import type { Song } from '../components/PlayerPage/types';

export interface AudioContextType {
    volume: number;
    isPlaying: boolean;
    currentTime: number;
    currentSongId: number | null;
    playSong: (song: Song, offset?: number) => Promise<boolean>;
    stopPlayback: () => void;
    handleSetVolume: (newVolume: number) => void;
    setOnEndedCallback: (callback: (() => void) | null) => void;
    nextSong: () => void;
    prevSong: () => void;
    shufflePlaylist: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};

export const AudioProvider = ({ children }: { children: ReactNode }) => {
    const [volume, setVolume] = useState(50);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentSongId, setCurrentSongId] = useState<number | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const onEndedCallbackRef = useRef<(() => void) | null>(null);
    const updateIntervalRef = useRef<number | null>(null);
    const isInitializingRef = useRef(false);

    const { setMessage } = useMessage();
    const {
        emitRequestNextSong,
        emitRequestPrevSong,
        emitRequestShuffle
    } = useSocket();

    const setOnEndedCallback = useCallback((callback: (() => void) | null) => {
        onEndedCallbackRef.current = callback;
    }, []);

    const stopTimeUpdate = useCallback(() => {
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }
    }, []);

    const startTimeUpdate = useCallback(() => {
        stopTimeUpdate();
        updateIntervalRef.current = window.setInterval(() => {
            if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
            }
        }, 100);
    }, [stopTimeUpdate]);

    const handleSetVolume = useCallback((newVolume: number) => {
        if (audioRef.current) {
            audioRef.current.volume = newVolume / 100;
        }
        setVolume(newVolume);
    }, []);

    const cleanupAudio = useCallback(() => {
        stopTimeUpdate();
        if (!audioRef.current) {
            return;
        }
        const audio = audioRef.current;
        // 先移除事件监听器，避免触发 error 事件
        audio.onplay = null;
        audio.onpause = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        audio.pause();
        audio.src = '';
        audioRef.current = null;
        setIsPlaying(false);
        setCurrentTime(0);
    }, [stopTimeUpdate]);

    const stopPlayback = useCallback(() => {
        cleanupAudio();
        setCurrentSongId(null);
    }, [cleanupAudio]);

    const playSong = useCallback(async (song: Song, offset = 0) => {
        if (isInitializingRef.current) {
            setMessage("播放初始化中，请稍候", "warning");
            return false;
        }

        try {
            isInitializingRef.current = true;
            cleanupAudio();

            const audio = new Audio(`/api/songs/${song.id}/file.${song.file_extension}`);
            audio.preload = 'metadata';
            audio.volume = volume / 100;

            // 设置事件监听（使用属性赋值，便于清理）
            audio.onplay = () => {
                setIsPlaying(true);
                startTimeUpdate();
            };

            audio.onpause = () => {
                setIsPlaying(false);
                stopTimeUpdate();
            };

            audio.onended = () => {
                console.log('歌曲播放结束');
                setIsPlaying(false);
                stopTimeUpdate();
                if (onEndedCallbackRef.current) {
                    onEndedCallbackRef.current();
                }
            };

            audio.onloadedmetadata = () => {
                if (offset > 0) {
                    audio.currentTime = offset;
                }
            };

            audio.onerror = () => {
                console.error('音频加载失败');
                setMessage(`加载歌曲失败: ${song.title}`, 'error');
                isInitializingRef.current = false;
            };

            audioRef.current = audio;
            setCurrentSongId(song.id);

            await audio.play();
            setMessage(`已开始播放: ${song.title} - ${song.artist}`, 'success');
            isInitializingRef.current = false;
            return true;
        } catch {
            setMessage('浏览器阻止了自动播放，请点击页面任意位置解锁播放', 'warning');
            isInitializingRef.current = false;

            // 添加解锁监听
            const unlock = () => {
                if (audioRef.current) {
                    void audioRef.current.play();
                }
                document.removeEventListener('click', unlock);
            };
            document.addEventListener('click', unlock);
            return false;
        }
    }, [cleanupAudio, setMessage, startTimeUpdate, stopTimeUpdate, volume]);

    // 切歌功能（通过 Socket）
    const nextSong = useCallback(() => {
        emitRequestNextSong((response) => {
            if (response?.success) {
                setMessage('切换到下一首', 'success');
            }
        });
    }, [emitRequestNextSong, setMessage]);

    const prevSong = useCallback(() => {
        emitRequestPrevSong((response) => {
            if (response?.success) {
                setMessage('切换到上一首', 'success');
            }
        });
    }, [emitRequestPrevSong, setMessage]);

    const shufflePlaylist = useCallback(() => {
        emitRequestShuffle((response) => {
            if (response?.success) {
                setMessage('播放列表已打乱', 'success');
            }
        });
    }, [emitRequestShuffle, setMessage]);

    // 全局键盘快捷键监听（切歌/随机播放）
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            const isTyping = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable') === 'true';
            if (isTyping) {
                return;
            }

            // PageDown 或小键盘 2：下一首
            if (event.key === 'PageDown' || event.code === 'Numpad2') {
                event.preventDefault();
                nextSong();
            }

            // PageUp 或小键盘 8：上一首
            if (event.key === 'PageUp' || event.code === 'Numpad8') {
                event.preventDefault();
                prevSong();
            }

            // 小键盘 5（Numpad5）：随机播放
            if (event.code === 'Numpad5') {
                event.preventDefault();
                shufflePlaylist();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [nextSong, prevSong, shufflePlaylist]);

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            cleanupAudio();
        };
    }, [cleanupAudio]);

    // 登出时强制停止播放（避免路由切换竞态导致音频残留）
    useEffect(() => {
        const handleLogout = () => {
            cleanupAudio();
            setCurrentSongId(null);
        };

        window.addEventListener('app:logout', handleLogout);
        return () => {
            window.removeEventListener('app:logout', handleLogout);
        };
    }, [cleanupAudio]);

    return (
        <AudioContext.Provider value={{
            volume,
            isPlaying,
            currentTime,
            currentSongId,
            playSong,
            stopPlayback,
            handleSetVolume,
            setOnEndedCallback,
            nextSong,
            prevSong,
            shufflePlaylist
        }}>
            {children}
        </AudioContext.Provider>
    );
};
