import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import SongPickerDialog from './SongPickerDialog';
import PlatformPlaylistImport from './PlatformPlaylistImport';
import Pagination from './Pagination';
import type { Playlist, Song, SortBy, User } from './types';
import './PlaylistManager.css';
import './PlatformPlaylistImport.css';
import './Pagination.css';

export default function PlaylistManager() {
    const setMessage = useMessage().setMessage;

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
    const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);

    const [allSongs, setAllSongs] = useState<Song[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [sourcePlaylistSongsMap, setSourcePlaylistSongsMap] = useState<Record<number, Song[]>>({});

    // 分页状态
    const [playlistPage, setPlaylistPage] = useState(1);
    const [playlistTotalPages, setPlaylistTotalPages] = useState(1);
    const [songPage, setSongPage] = useState(1);
    const [songTotalPages, setSongTotalPages] = useState(1);
    const PAGE_SIZE = 10;

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showPlatformImportDialog, setShowPlatformImportDialog] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');

    const [activeTab, setActiveTab] = useState<'songs' | 'playlists'>('songs');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [sortBy, setSortBy] = useState<SortBy>('time_added');
    const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
    const [selectedSourcePlaylistIds, setSelectedSourcePlaylistIds] = useState<number[]>([]);
    const [expandedSourcePlaylistIds, setExpandedSourcePlaylistIds] = useState<number[]>([]);
    const selectedPlaylistIdRef = useRef<number | null>(null);
    const hasInitializedRef = useRef(false);

    const authHeader = useMemo(
        () => ({ Authorization: localStorage.getItem('token') || '' }),
        []
    );

    const resetPickerState = useCallback(() => {
        setActiveTab('songs');
        setSearchQuery('');
        setFilterUser('');
        setSortBy('time_added');
        setSelectedSongIds([]);
        setSelectedSourcePlaylistIds([]);
        setExpandedSourcePlaylistIds([]);
    }, []);

    const loadPlaylistDetail = useCallback(async (playlistId: number, page = 1) => {
        try {
            const response = await axios.get(`/playlists/${playlistId}`, {
                params: { page, page_size: PAGE_SIZE },
                headers: authHeader
            });
            setSelectedPlaylist(response.data.playlist as Playlist);
            setPlaylistSongs(response.data.songs as Song[]);
            setSelectedPlaylistId(playlistId);
            setSongPage(response.data.page);
            setSongTotalPages(response.data.total_pages);
        } catch {
            setMessage('加载歌单详情失败', 'error');
        }
    }, [authHeader, setMessage]);

    const loadPlaylists = useCallback(async (page = 1) => {
        try {
            const response = await axios.get('/getAllPlaylists', {
                params: { page, page_size: PAGE_SIZE },
                headers: authHeader
            });
            const list = response.data.items as Playlist[];
            setPlaylists(list);
            setPlaylistPage(response.data.page);
            setPlaylistTotalPages(response.data.total_pages);
            if (list.length === 0) {
                setSelectedPlaylistId(null);
                setSelectedPlaylist(null);
                setPlaylistSongs([]);
                return list;
            }
            const currentSelectedId = selectedPlaylistIdRef.current;
            const targetId = currentSelectedId && list.some((p) => p.id === currentSelectedId)
                ? currentSelectedId
                : list[0].id;
            await loadPlaylistDetail(targetId);
            return list;
        } catch {
            setMessage('加载歌单失败', 'error');
            return [] as Playlist[];
        }
    }, [authHeader, loadPlaylistDetail, setMessage]);

    const loadAllSongs = useCallback(async () => {
        try {
            const response = await axios.get('/songs', { headers: authHeader });
            setAllSongs(response.data as Song[]);
        } catch {
            setMessage('加载歌曲失败', 'error');
        }
    }, [authHeader, setMessage]);

    const loadUsers = useCallback(async () => {
        try {
            const response = await axios.get('/users', { headers: authHeader });
            setUsers(response.data as User[]);
        } catch {
            setMessage('加载用户失败', 'error');
        }
    }, [authHeader, setMessage]);

    useEffect(() => {
        selectedPlaylistIdRef.current = selectedPlaylistId;
    }, [selectedPlaylistId]);

    useEffect(() => {
        if (hasInitializedRef.current) {
            return;
        }
        hasInitializedRef.current = true;
        void Promise.all([loadPlaylists(), loadAllSongs(), loadUsers()]);
    }, [loadAllSongs, loadPlaylists, loadUsers]);

    const availableSourcePlaylists = useMemo(() => {
        return playlists.filter((playlist) => playlist.id !== selectedPlaylistId);
    }, [playlists, selectedPlaylistId]);

    const ensureSourcePlaylistSongsLoaded = useCallback(async (playlistId: number) => {
        if (sourcePlaylistSongsMap[playlistId]) {
            return;
        }
        try {
            const response = await axios.get(`/playlists/${playlistId}`, { headers: authHeader });
            setSourcePlaylistSongsMap((prev) => ({
                ...prev,
                [playlistId]: response.data.songs as Song[]
            }));
        } catch {
            setMessage('加载来源歌单歌曲失败', 'error');
        }
    }, [authHeader, setMessage, sourcePlaylistSongsMap]);

    const toggleSong = useCallback((songId: number, checked: boolean) => {
        setSelectedSongIds((prev) => {
            if (checked) {
                if (prev.includes(songId)) {
                    return prev;
                }
                return [...prev, songId];
            }
            return prev.filter((id) => id !== songId);
        });
    }, []);

    const toggleSourcePlaylistSelect = useCallback((playlistId: number, checked: boolean) => {
        setSelectedSourcePlaylistIds((prev) => {
            if (checked) {
                if (prev.includes(playlistId)) {
                    return prev;
                }
                return [...prev, playlistId];
            }
            return prev.filter((id) => id !== playlistId);
        });
        if (checked) {
            void ensureSourcePlaylistSongsLoaded(playlistId);
        }
    }, [ensureSourcePlaylistSongsLoaded]);

    const toggleSourcePlaylistExpand = useCallback((playlistId: number) => {
        setExpandedSourcePlaylistIds((prev) => (
            prev.includes(playlistId)
                ? prev.filter((id) => id !== playlistId)
                : [...prev, playlistId]
        ));
        void ensureSourcePlaylistSongsLoaded(playlistId);
    }, [ensureSourcePlaylistSongsLoaded]);

    const selectAllFromSourcePlaylist = useCallback((playlistId: number) => {
        const songs = sourcePlaylistSongsMap[playlistId] || [];
        setSelectedSongIds((prev) => {
            const merged = new Set([...prev, ...songs.map((song) => song.id)]);
            return [...merged];
        });
    }, [sourcePlaylistSongsMap]);

    const clearSelectionFromSourcePlaylist = useCallback((playlistId: number) => {
        const songs = sourcePlaylistSongsMap[playlistId] || [];
        const songIds = new Set(songs.map((song) => song.id));
        setSelectedSongIds((prev) => prev.filter((id) => !songIds.has(id)));
    }, [sourcePlaylistSongsMap]);

    const openCreateDialog = useCallback(() => {
        setShowCreateDialog(true);
        setNewPlaylistName('');
        resetPickerState();
    }, [resetPickerState]);

    const openImportDialog = useCallback(() => {
        if (!selectedPlaylistId) {
            setMessage('请先选择歌单', 'warning');
            return;
        }
        setShowImportDialog(true);
        resetPickerState();
    }, [resetPickerState, selectedPlaylistId, setMessage]);

    const createPlaylistWithSongs = useCallback(async () => {
        const name = newPlaylistName.trim();
        if (!name) {
            setMessage('请输入歌单名称', 'warning');
            return;
        }

        try {
            const beforeIds = new Set(playlists.map((playlist) => playlist.id));
            await axios.post('/playlists', { name }, { headers: authHeader });
            const refreshed = await axios.get('/getAllPlaylists', {
                params: { page: 1, page_size: 100 },
                headers: authHeader
            });
            const refreshedPlaylists = refreshed.data.items as Playlist[];
            setPlaylists(refreshedPlaylists);

            let newPlaylist = refreshedPlaylists.find((playlist) => !beforeIds.has(playlist.id));
            if (!newPlaylist) {
                const candidates = refreshedPlaylists.filter((playlist) => playlist.playlist_name === name);
                newPlaylist = candidates.sort((a, b) => b.id - a.id)[0];
            }

            if (newPlaylist && selectedSongIds.length > 0) {
                await axios.post(`/playlists/${newPlaylist.id}/songs`, {
                    songIds: selectedSongIds
                }, { headers: authHeader });
            }

            setShowCreateDialog(false);
            resetPickerState();
            setNewPlaylistName('');

            if (newPlaylist) {
                await loadPlaylistDetail(newPlaylist.id);
            } else {
                await loadPlaylists();
            }

            setMessage('歌单创建成功', 'success');
        } catch {
            setMessage('创建歌单失败', 'error');
        }
    }, [authHeader, loadPlaylistDetail, loadPlaylists, newPlaylistName, playlists, resetPickerState, selectedSongIds, setMessage]);

    const importSongsToPlaylist = useCallback(async () => {
        if (!selectedPlaylistId) {
            setMessage('请先选择歌单', 'warning');
            return;
        }
        if (selectedSongIds.length === 0) {
            setMessage('请选择要导入的歌曲', 'warning');
            return;
        }

        try {
            await axios.post(`/playlists/${selectedPlaylistId}/songs`, {
                songIds: selectedSongIds
            }, { headers: authHeader });
            setShowImportDialog(false);
            resetPickerState();
            await loadPlaylistDetail(selectedPlaylistId);
            setMessage('导入歌曲成功', 'success');
        } catch {
            setMessage('导入歌曲失败', 'error');
        }
    }, [authHeader, loadPlaylistDetail, resetPickerState, selectedPlaylistId, selectedSongIds, setMessage]);

    const allSongsPlaylistId = useMemo(() => {
        const found = playlists.find((p) => p.playlist_name === '所有歌曲');
        return found?.id ?? null;
    }, [playlists]);

    const removeSong = useCallback(async (songId: number) => {
        if (!selectedPlaylistId) {
            return;
        }
        try {
            if (selectedPlaylistId === allSongsPlaylistId) {
                // "所有歌曲"歌单：永久删除（数据库+COS文件）
                await axios.delete(`/songs/${songId}`, { headers: authHeader });
                await loadPlaylistDetail(selectedPlaylistId);
                await loadAllSongs();
                setMessage('歌曲已永久删除', 'success');
            } else {
                // 普通歌单：仅移除关联
                await axios.delete(`/playlists/${selectedPlaylistId}/songs/${songId}`, { headers: authHeader });
                await loadPlaylistDetail(selectedPlaylistId);
                setMessage('歌曲已从歌单移除', 'success');
            }
        } catch {
            setMessage('删除歌曲失败', 'error');
        }
    }, [authHeader, loadAllSongs, loadPlaylistDetail, selectedPlaylistId, setMessage]);

    return (
        <div className="playlist-manager-page">
            <div className="playlist-manager-left">
                <div className="playlist-manager-header">
                    <h2>我的歌单</h2>
                    <button type="button" className="playlist-primary-btn" onClick={openCreateDialog}>创建歌单</button>
                </div>
                <ul className="playlist-list">
                    {playlists.map((playlist) => (
                        <li key={playlist.id}>
                            <button
                                type="button"
                                className={`playlist-item-btn ${selectedPlaylistId === playlist.id ? 'active' : ''}`}
                                onClick={() => { void loadPlaylistDetail(playlist.id); }}
                            >
                                {playlist.playlist_name}
                            </button>
                        </li>
                    ))}
                </ul>
                <Pagination
                    currentPage={playlistPage}
                    totalPages={playlistTotalPages}
                    onPageChange={(page) => { void loadPlaylists(page); }}
                />
            </div>

            <div className="playlist-manager-right">
                <div className="playlist-manager-header">
                    <h2>{selectedPlaylist?.playlist_name || '请选择歌单'}</h2>
                    <div className="header-buttons">
                        <button type="button" className="playlist-primary-btn" onClick={() => {
                            if (!selectedPlaylistId) {
                                setMessage('请先选择歌单', 'warning');
                                return;
                            }
                            setShowPlatformImportDialog(true);
                        }}>导入歌单</button>
                        <button type="button" className="playlist-primary-btn" onClick={openImportDialog}>导入歌曲</button>
                    </div>
                </div>
                <ul className="playlist-song-list">
                    {playlistSongs.map((song) => (
                        <li key={song.id}>
                            <div>
                                <div className="song-title">{song.title}</div>
                                <div className="song-sub">{song.artist}</div>
                            </div>
                            <button type="button" className="playlist-secondary-btn" onClick={() => { void removeSong(song.id); }}>
                                {selectedPlaylistId === allSongsPlaylistId ? '永久删除' : '删除'}
                            </button>
                        </li>
                    ))}
                    {playlistSongs.length === 0 && <li className="playlist-empty">当前歌单还没有歌曲</li>}
                </ul>
                {selectedPlaylistId && (
                    <Pagination
                        currentPage={songPage}
                        totalPages={songTotalPages}
                        onPageChange={(page) => { void loadPlaylistDetail(selectedPlaylistId, page); }}
                    />
                )}
            </div>

            <SongPickerDialog
                open={showCreateDialog}
                title="创建歌单并组合歌曲"
                mode="create"
                playlistName={newPlaylistName}
                selectedSongIds={selectedSongIds}
                allSongs={allSongs}
                users={users}
                sourcePlaylists={playlists}
                sourcePlaylistSongsMap={sourcePlaylistSongsMap}
                selectedSourcePlaylistIds={selectedSourcePlaylistIds}
                expandedSourcePlaylistIds={expandedSourcePlaylistIds}
                searchQuery={searchQuery}
                filterUser={filterUser}
                sortBy={sortBy}
                activeTab={activeTab}
                onPlaylistNameChange={setNewPlaylistName}
                onSearchQueryChange={setSearchQuery}
                onFilterUserChange={setFilterUser}
                onSortByChange={setSortBy}
                onTabChange={setActiveTab}
                onToggleSong={toggleSong}
                onToggleSourcePlaylistSelect={toggleSourcePlaylistSelect}
                onToggleSourcePlaylistExpand={toggleSourcePlaylistExpand}
                onSelectAllFromSourcePlaylist={selectAllFromSourcePlaylist}
                onClearSelectionFromSourcePlaylist={clearSelectionFromSourcePlaylist}
                onConfirm={() => { void createPlaylistWithSongs(); }}
                onCancel={() => {
                    setShowCreateDialog(false);
                    resetPickerState();
                }}
            />

            <SongPickerDialog
                open={showImportDialog}
                title="导入歌曲到当前歌单"
                mode="import"
                playlistName=""
                selectedSongIds={selectedSongIds}
                allSongs={allSongs}
                users={users}
                sourcePlaylists={availableSourcePlaylists}
                sourcePlaylistSongsMap={sourcePlaylistSongsMap}
                selectedSourcePlaylistIds={selectedSourcePlaylistIds}
                expandedSourcePlaylistIds={expandedSourcePlaylistIds}
                searchQuery={searchQuery}
                filterUser={filterUser}
                sortBy={sortBy}
                activeTab={activeTab}
                onPlaylistNameChange={() => { return; }}
                onSearchQueryChange={setSearchQuery}
                onFilterUserChange={setFilterUser}
                onSortByChange={setSortBy}
                onTabChange={setActiveTab}
                onToggleSong={toggleSong}
                onToggleSourcePlaylistSelect={toggleSourcePlaylistSelect}
                onToggleSourcePlaylistExpand={toggleSourcePlaylistExpand}
                onSelectAllFromSourcePlaylist={selectAllFromSourcePlaylist}
                onClearSelectionFromSourcePlaylist={clearSelectionFromSourcePlaylist}
                onConfirm={() => { void importSongsToPlaylist(); }}
                onCancel={() => {
                    setShowImportDialog(false);
                    resetPickerState();
                }}
            />

            <PlatformPlaylistImport
                open={showPlatformImportDialog}
                targetPlaylistId={selectedPlaylistId || 0}
                targetPlaylistName={selectedPlaylist?.playlist_name || ''}
                onConfirm={async () => {
                    setShowPlatformImportDialog(false);
                    if (selectedPlaylistId) {
                        await loadPlaylistDetail(selectedPlaylistId);
                        await loadAllSongs();
                    }
                }}
                onCancel={() => setShowPlatformImportDialog(false)}
            />
        </div>
    );
}
