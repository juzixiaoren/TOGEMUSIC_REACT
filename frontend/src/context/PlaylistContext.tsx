import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useMessage } from './MessageContext';
import type { Playlist, Song, User } from '../components/PlaylistManager/types';

interface PlaylistContextType {
    playlists: Playlist[];
    allSongs: Song[];
    users: User[];
    isLoading: boolean;
    isLoaded: boolean;
    loadPlaylists: (page?: number) => Promise<Playlist[]>;
    loadPlaylistDetail: (playlistId: number, page?: number) => Promise<void>;
    loadAllSongs: () => Promise<void>;
    loadUsers: () => Promise<void>;
    refreshAll: () => Promise<void>;
    // 歌单详情相关状态
    selectedPlaylistId: number | null;
    selectedPlaylist: Playlist | null;
    playlistSongs: Song[];
    playlistPage: number;
    playlistTotalPages: number;
    songPage: number;
    songTotalPages: number;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export function usePlaylist() {
    const context = useContext(PlaylistContext);
    if (!context) {
        throw new Error('usePlaylist must be used within a PlaylistProvider');
    }
    return context;
}

const PAGE_SIZE = 10;

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
    const { setMessage } = useMessage();

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [allSongs, setAllSongs] = useState<Song[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // 歌单详情相关状态
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
    const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
    const [playlistPage, setPlaylistPage] = useState(1);
    const [playlistTotalPages, setPlaylistTotalPages] = useState(1);
    const [songPage, setSongPage] = useState(1);
    const [songTotalPages, setSongTotalPages] = useState(1);

    const getAuthHeader = useCallback(() => ({
        Authorization: localStorage.getItem('token') || ''
    }), []);

    const loadPlaylistDetail = useCallback(async (playlistId: number, page = 1) => {
        try {
            const response = await axios.get(`/playlists/${playlistId}`, {
                params: { page, page_size: PAGE_SIZE },
                headers: getAuthHeader()
            });
            setSelectedPlaylist(response.data.playlist as Playlist);
            setPlaylistSongs(response.data.songs as Song[]);
            setSelectedPlaylistId(playlistId);
            setSongPage(response.data.page);
            setSongTotalPages(response.data.total_pages);
        } catch {
            setMessage('加载歌单详情失败', 'error');
        }
    }, [setMessage, getAuthHeader]);

    const loadPlaylists = useCallback(async (page = 1) => {
        try {
            const response = await axios.get('/getAllPlaylists', {
                params: { page, page_size: PAGE_SIZE },
                headers: getAuthHeader()
            });
            const list = response.data.items as Playlist[];
            setPlaylists(list);
            setPlaylistPage(response.data.page);
            setPlaylistTotalPages(response.data.total_pages);
            setIsLoaded(true);
            
            if (list.length > 0 && !selectedPlaylistId) {
                await loadPlaylistDetail(list[0].id);
            }
            return list;
        } catch {
            setMessage('加载歌单失败', 'error');
            return [] as Playlist[];
        }
    }, [setMessage, loadPlaylistDetail, selectedPlaylistId, getAuthHeader]);

    const loadAllSongs = useCallback(async () => {
        try {
            const response = await axios.get('/songs', { headers: getAuthHeader() });
            setAllSongs(response.data as Song[]);
        } catch {
            setMessage('加载歌曲失败', 'error');
        }
    }, [setMessage, getAuthHeader]);

    const loadUsers = useCallback(async () => {
        try {
            const response = await axios.get('/users', { headers: getAuthHeader() });
            setUsers(response.data as User[]);
        } catch {
            setMessage('加载用户失败', 'error');
        }
    }, [setMessage, getAuthHeader]);

    const refreshAll = useCallback(async () => {
        setIsLoading(true);
        try {
            await Promise.all([loadPlaylists(), loadAllSongs(), loadUsers()]);
        } finally {
            setIsLoading(false);
        }
    }, [loadPlaylists, loadAllSongs, loadUsers]);

    // 检查context中是否有数据，如果没有则自动加载一次
    useEffect(() => {
        if (playlists.length === 0 && !isLoading && !isLoaded) {
            void refreshAll();
        }
    }, [playlists.length, isLoading, isLoaded, refreshAll]);

    return (
        <PlaylistContext.Provider value={{
            playlists,
            allSongs,
            users,
            isLoading,
            isLoaded,
            loadPlaylists,
            loadPlaylistDetail,
            loadAllSongs,
            loadUsers,
            refreshAll,
            // 导出歌单详情相关状态
            selectedPlaylistId,
            selectedPlaylist,
            playlistSongs,
            playlistPage,
            playlistTotalPages,
            songPage,
            songTotalPages,
        }}>
            {children}
        </PlaylistContext.Provider>
    );
}