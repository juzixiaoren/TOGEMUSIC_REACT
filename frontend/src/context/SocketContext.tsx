import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Song } from '../components/PlayerPage/types';

// 定义 Socket 事件数据类型
export interface SongChangedData {
    new_song_id: number;
    current_song?: Song;
}

export interface PlaylistShuffledData {
    songs: Song[];
}

export interface SongDeletedAndChangedData {
    deleted_song_id: number;
    new_song_id: number | null;
    new_song: Song | null;
    playlist: Song[];
}

export interface PlaylistUpdatedData {
    deleted_song_id: number;
    playlist: Song[];
}

export interface SyncPlayStatusData {
    is_playing: boolean;
    current_song: Song | null;
    play_start_time: string;
    server_now: number;
}

export interface SyncPlaylistData {
    songs: Song[];
}

// Socket 事件回调类型
export interface SocketEventHandlers {
    onSongChanged?: (data: SongChangedData) => void;
    onPlaylistShuffled?: (data: PlaylistShuffledData) => void;
    onSongDeletedAndChanged?: (data: SongDeletedAndChangedData) => void;
    onPlaylistUpdated?: (data: PlaylistUpdatedData) => void;
    onSyncPlayStatus?: (data: SyncPlayStatusData) => void;
    onSyncPlaylist?: (data: SyncPlaylistData) => void;
}

export interface SocketContextType {
    isConnected: boolean;
    emitRequestNextSong: (callback?: (response: { success: boolean }) => void) => void;
    emitRequestPrevSong: (callback?: (response: { success: boolean }) => void) => void;
    emitRequestShuffle: (callback?: (response: { success: boolean }) => void) => void;
    registerEventHandlers: (handlers: SocketEventHandlers) => void;
    unregisterEventHandlers: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const handlersRef = useRef<SocketEventHandlers>({});

    useEffect(() => {
        // 开发环境默认直连后端，避免 Vite WS 代理导致的 transport close。
        const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || (
            import.meta.env.DEV
                ? `${window.location.protocol}//${window.location.hostname}:8034`
                : '/'
        );

        // 建立 Socket 连接
        const socket = io(socketBaseUrl, {
            path: '/socket.io',
            // 允许 polling 回退，降低本地代理/网络抖动导致的断连概率
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket 已连接');
            setIsConnected(true);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket 已断开:', reason);
            setIsConnected(false);

            // 服务端主动断开时，手动拉起一次重连。
            if (reason === 'io server disconnect') {
                socket.connect();
            }
        });

        socket.on('connect_error', (error) => {
            console.warn('Socket 连接失败:', error.message);
        });

        socket.io.on('reconnect_attempt', (attempt) => {
            console.log('Socket 重连尝试:', attempt);
        });

        socket.io.on('reconnect', (attempt) => {
            console.log('Socket 重连成功，尝试次数:', attempt);
        });

        socket.io.on('reconnect_error', (error) => {
            console.warn('Socket 重连失败:', error.message);
        });

        socket.io.on('reconnect_failed', () => {
            console.error('Socket 重连失败：已达到最大重试次数');
        });

        // 监听后端事件并转发给注册的处理器
        socket.on('song_changed', (data: SongChangedData) => {
            console.log('收到歌曲切换事件:', data);
            handlersRef.current.onSongChanged?.(data);
        });

        socket.on('playlist_shuffled', (data: PlaylistShuffledData) => {
            console.log('收到播放列表打乱事件:', data);
            handlersRef.current.onPlaylistShuffled?.(data);
        });

        socket.on('song_deleted_and_changed', (data: SongDeletedAndChangedData) => {
            console.log('收到歌曲删除切歌事件:', data);
            handlersRef.current.onSongDeletedAndChanged?.(data);
        });

        socket.on('playlist_updated', (data: PlaylistUpdatedData) => {
            console.log('收到播放列表更新事件:', data);
            handlersRef.current.onPlaylistUpdated?.(data);
        });

        socket.on('sync_play_status', (data: SyncPlayStatusData) => {
            console.log('收到播放状态同步:', data);
            handlersRef.current.onSyncPlayStatus?.(data);
        });

        socket.on('sync_playlist', (data: SyncPlaylistData) => {
            console.log('收到播放列表同步:', data);
            handlersRef.current.onSyncPlaylist?.(data);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);


    const emitRequestNextSong = (callback?: (response: { success: boolean }) => void) => {
        socketRef.current?.emit('request_next_song', {}, callback);
    };

    const emitRequestPrevSong = (callback?: (response: { success: boolean }) => void) => {
        socketRef.current?.emit('request_prev_song', {}, callback);
    };

    const emitRequestShuffle = (callback?: (response: { success: boolean }) => void) => {
        socketRef.current?.emit('request_shuffle_playlist', {}, callback);
    };

    const registerEventHandlers = (handlers: SocketEventHandlers) => {
        handlersRef.current = handlers;
    };

    const unregisterEventHandlers = () => {
        handlersRef.current = {};
    };

    return (
        <SocketContext.Provider value={{
            isConnected,
            emitRequestNextSong,
            emitRequestPrevSong,
            emitRequestShuffle,
            registerEventHandlers,
            unregisterEventHandlers
        }}>
            {children}
        </SocketContext.Provider>
    );
};
