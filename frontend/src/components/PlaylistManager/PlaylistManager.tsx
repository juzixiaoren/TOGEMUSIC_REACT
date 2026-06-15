import axios from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import { usePlaylist } from '../../context/PlaylistContext';
import SongPickerDialog, { filterAndSortSongs } from './SongPickerDialog';
import PlatformPlaylistImport from './PlatformPlaylistImport';
import Pagination from './Pagination';
import type { Playlist, Song, SortBy } from './types';
const CL = {
    page: 'grid grid-cols-[320px_1fr] gap-[18px] w-full min-h-[580px] max-[960px]:grid-cols-1',
    panel: 'bg-surface rounded-2xl flex flex-col min-h-0 p-[18px] shadow-card-lg',
    header: 'flex justify-between items-center gap-2.5 mb-[14px]',
    headerTitle: 'm-0 text-xl text-text-primary',
    headerBtns: 'flex gap-2',
    primaryBtn: 'border-none rounded-xl font-semibold cursor-pointer py-[9px] px-[14px] text-white bg-primary',
    secondaryBtn: 'bg-surface-elevated rounded-lg cursor-pointer border border-border-blue-muted py-1.5 px-2.5 text-text-blue-muted',
    refreshBtn: 'bg-surface-elevated rounded-lg cursor-pointer border border-border-blue-muted py-1.5 px-2.5 text-text-blue-muted hover:bg-primary hover:text-white hover:border-primary',
    playlistList: 'list-none m-0 p-0 overflow-auto flex flex-col gap-2',
    itemBtn: 'w-full text-left cursor-pointer border border-border-blue-source bg-surface-blue-light rounded-[10px] py-[10px] px-3 text-text-blue-placeholder',
    itemBtnActive: 'border-primary bg-primary-light',
    songList: 'list-none m-0 p-0 overflow-auto flex flex-col gap-2',
    songItem: 'flex justify-between items-center gap-2.5 border border-border-blue-pale rounded-[10px] bg-surface-blue-pale py-[10px] px-3',
    songTitle: 'font-semibold text-sm text-text-blue-deep',
    songSub: 'text-xs text-text-blue-sub',
    empty: 'justify-center text-text-blue-gray',
};

export default function PlaylistManager() {
    const setMessage = useMessage().setMessage;
    const {
        playlists,
        allSongs,
        users,
        isLoading,
        loadPlaylists,
        loadPlaylistDetail,
        loadAllSongs,
        refreshAll,
        selectedPlaylistId,
        selectedPlaylist,
        playlistSongs,
        playlistPage,
        playlistTotalPages,
        songPage,
        songTotalPages,
    } = usePlaylist();

    const [sourcePlaylistSongsMap, setSourcePlaylistSongsMap] = useState<Record<number, Song[]>>({});
    const [selectedPlaylistSongIds, setSelectedPlaylistSongIds] = useState<number[]>([]);

    const getAuthHeader = useCallback(() => ({
        Authorization: localStorage.getItem('token') || ''
    }), []);
    
    // 全选当前歌单的所有歌曲
    const selectAllPlaylistSongs = useCallback(async () => {
        if (!selectedPlaylistId) {
            setMessage('请先选择歌单', 'warning');
            return;
        }
        try {
            const response = await axios.get(`/playlists/${selectedPlaylistId}/all-songs`, { headers: getAuthHeader() });
            const songs = (response.data?.songs || []) as Song[];
            const allIds = songs.map(song => song.id);
            setSelectedPlaylistSongIds(allIds);
            setMessage(`已全选 ${allIds.length} 首歌曲`, 'success');
        } catch {
            setMessage('获取歌单歌曲失败', 'error');
        }
    }, [selectedPlaylistId, setMessage, getAuthHeader]);

    // 全选当前页的歌曲
    const selectAllCurrentPageSongs = useCallback(() => {
        const pageSongIds = playlistSongs.map(song => song.id);
        setSelectedPlaylistSongIds(prev => {
            const merged = new Set([...prev, ...pageSongIds]);
            return [...merged];
        });
        setMessage(`已全选当前页 ${pageSongIds.length} 首歌曲`, 'success');
    }, [playlistSongs, setMessage]);

    // 切换歌曲选中状态
    const togglePlaylistSongSelection = useCallback((songId: number, checked: boolean) => {
        setSelectedPlaylistSongIds(prev => {
            if (checked) {
                if (prev.includes(songId)) {
                    return prev;
                }
                return [...prev, songId];
            } else {
                return prev.filter(id => id !== songId);
            }
        });
    }, []);

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
    
    // SongPickerDialog 分页状态
    const [songsCurrentPage, setSongsCurrentPage] = useState(1);
    const [sourcePlaylistPagination, setSourcePlaylistPagination] = useState<Record<number, { currentPage: number, totalPages: number }>>({});
    const songPickerPageSize = 100;
    
    // 计算歌曲总页数
    const songsTotalPages = useMemo(() => {
        const filteredSongs = filterAndSortSongs(allSongs, searchQuery, filterUser, sortBy);
        return Math.max(1, Math.ceil(filteredSongs.length / songPickerPageSize));
    }, [allSongs, searchQuery, filterUser, sortBy, songPickerPageSize]);
    
    // 歌曲页变化处理
    const handleSongsPageChange = useCallback((page: number) => {
        setSongsCurrentPage(page);
    }, []);
    
    // 源歌单页变化处理
    const handleSourcePlaylistPageChange = useCallback((playlistId: number, page: number) => {
        setSourcePlaylistPagination(prev => ({
            ...prev,
            [playlistId]: {
                ...prev[playlistId],
                currentPage: page
            }
        }));
    }, []);
    
    // 全选当前页的歌曲（SongPickerDialog songs tab）
    const selectAllCurrentPageForPicker = useCallback(() => {
        const filteredSongs = filterAndSortSongs(allSongs, searchQuery, filterUser, sortBy);
        const startIndex = (songsCurrentPage - 1) * songPickerPageSize;
        const endIndex = startIndex + songPickerPageSize;
        const pageSongs = filteredSongs.slice(startIndex, endIndex);
        const pageSongIds = pageSongs.map(song => song.id);
        setSelectedSongIds(prev => {
            const merged = new Set([...prev, ...pageSongIds]);
            return [...merged];
        });
        setMessage(`已全选当前页 ${pageSongIds.length} 首歌曲`, 'success');
    }, [allSongs, searchQuery, filterUser, sortBy, songsCurrentPage, songPickerPageSize, setMessage]);
    
    // 全选当前页的歌曲（SongPickerDialog playlists tab）
    const selectAllCurrentPageFromSourcePlaylist = useCallback((playlistId: number) => {
        const songs = sourcePlaylistSongsMap[playlistId] || [];
        const pagination = sourcePlaylistPagination[playlistId];
        const currentPage = pagination?.currentPage || 1;
        const startIndex = (currentPage - 1) * songPickerPageSize;
        const endIndex = startIndex + songPickerPageSize;
        const pageSongs = songs.slice(startIndex, endIndex);
        const pageSongIds = pageSongs.map(song => song.id);
        setSelectedSongIds(prev => {
            const merged = new Set([...prev, ...pageSongIds]);
            return [...merged];
        });
        setMessage(`已全选当前页 ${pageSongIds.length} 首歌曲`, 'success');
    }, [sourcePlaylistSongsMap, sourcePlaylistPagination, songPickerPageSize, setMessage]);

    const resetPickerState = useCallback(() => {
        setActiveTab('songs');
        setSearchQuery('');
        setFilterUser('');
        setSortBy('time_added');
        setSelectedSongIds([]);
        setSelectedSourcePlaylistIds([]);
        setExpandedSourcePlaylistIds([]);
        setSongsCurrentPage(1);
        setSourcePlaylistPagination({});
    }, []);

    const availableSourcePlaylists = useMemo(() => {
        return playlists.filter((playlist) => playlist.id !== selectedPlaylistId);
    }, [playlists, selectedPlaylistId]);

    const ensureSourcePlaylistSongsLoaded = useCallback(async (playlistId: number) => {
        if (sourcePlaylistSongsMap[playlistId]) {
            return;
        }
        try {
            const response = await axios.get(`/playlists/${playlistId}`, { headers: getAuthHeader() });
            setSourcePlaylistSongsMap((prev) => ({
                ...prev,
                [playlistId]: response.data.songs as Song[]
            }));
        } catch {
            setMessage('加载来源歌单歌曲失败', 'error');
        }
    }, [getAuthHeader, setMessage, sourcePlaylistSongsMap]);

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
            await axios.post('/playlists', { name }, { headers: getAuthHeader() });
            
            // 刷新歌单列表
            const refreshed = await loadPlaylists(1);
            const refreshedPlaylists = refreshed as Playlist[];

            let newPlaylist = refreshedPlaylists.find((playlist) => !beforeIds.has(playlist.id));
            if (!newPlaylist) {
                const candidates = refreshedPlaylists.filter((playlist) => playlist.playlist_name === name);
                newPlaylist = candidates.sort((a, b) => b.id - a.id)[0];
            }

            if (newPlaylist && selectedSongIds.length > 0) {
                await axios.post(`/playlists/${newPlaylist.id}/songs`, {
                    songIds: selectedSongIds
                }, { headers: getAuthHeader() });
            }

            setShowCreateDialog(false);
            resetPickerState();
            setNewPlaylistName('');

            if (newPlaylist) {
                await loadPlaylistDetail(newPlaylist.id);
            }

            setMessage('歌单创建成功', 'success');
        } catch {
            setMessage('创建歌单失败', 'error');
        }
    }, [getAuthHeader, loadPlaylistDetail, loadPlaylists, newPlaylistName, playlists, resetPickerState, selectedSongIds, setMessage]);

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
            }, { headers: getAuthHeader() });
            setShowImportDialog(false);
            resetPickerState();
            await loadPlaylistDetail(selectedPlaylistId);
            setMessage('导入歌曲成功', 'success');
        } catch {
            setMessage('导入歌曲失败', 'error');
        }
    }, [getAuthHeader, loadPlaylistDetail, resetPickerState, selectedPlaylistId, selectedSongIds, setMessage]);

    const allSongsPlaylistId = useMemo(() => {
        const found = playlists.find((p) => p.playlist_name === '所有歌曲');
        return found?.id ?? null;
    }, [playlists]);

    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const removeSong = useCallback(async (songId: number) => {
        if (!selectedPlaylistId) {
            return;
        }
        try {
            if (selectedPlaylistId === allSongsPlaylistId) {
                // "所有歌曲"歌单：永久删除（数据库+COS文件）
                await axios.delete(`/songs/${songId}`, { headers: getAuthHeader() });
                await loadPlaylistDetail(selectedPlaylistId);
                await loadAllSongs();
                setMessage('歌曲已永久删除', 'success');
            } else {
                // 普通歌单：仅移除关联
                await axios.delete(`/playlists/${selectedPlaylistId}/songs/${songId}`, { headers: getAuthHeader() });
                await loadPlaylistDetail(selectedPlaylistId);
                setMessage('歌曲已从歌单移除', 'success');
            }
        } catch {
            setMessage('删除歌曲失败', 'error');
        }
    }, [getAuthHeader, loadAllSongs, loadPlaylistDetail, selectedPlaylistId, setMessage]);

    return (
        <div className={CL.page}>
            <div className={CL.panel}>
                <div className={CL.header}>
                    <h2 className={CL.headerTitle}>我的歌单</h2>
                    <div className={CL.headerBtns}>
                        <button
                            type="button"
                            className={CL.refreshBtn}
                            onClick={() => { void refreshAll(); }}
                            disabled={isLoading}
                        >
                            {isLoading ? '刷新中...' : '刷新'}
                        </button>
                        <button type="button" className={CL.primaryBtn} onClick={openCreateDialog}>创建歌单</button>
                    </div>
                </div>
                <ul className={CL.playlistList}>
                    {playlists.map((playlist) => (
                        <li key={playlist.id}>
                            <button
                                type="button"
                                className={`${CL.itemBtn} ${selectedPlaylistId === playlist.id ? CL.itemBtnActive : ''}`}
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

            <div className={CL.panel}>
                <div className={CL.header}>
                    <div className="flex items-center gap-4">
                        <h2 className={CL.headerTitle}>{selectedPlaylist?.playlist_name || '请选择歌单'}</h2>
                        <span className="text-sm text-text-quaternary">
                            已选 {selectedPlaylistSongIds.length} 首
                        </span>
                    </div>
                    <div className={CL.headerBtns}>
                        <button type="button" className={CL.secondaryBtn} onClick={() => { void selectAllPlaylistSongs(); }}>全选所有</button>
                        <button type="button" className={CL.secondaryBtn} onClick={selectAllCurrentPageSongs}>全选当前页</button>
                        <button type="button" className={CL.primaryBtn} onClick={() => {
                            if (!selectedPlaylistId) {
                                setMessage('请先选择歌单', 'warning');
                                return;
                            }
                            setShowPlatformImportDialog(true);
                        }}>导入歌单</button>
                        <button type="button" className={CL.primaryBtn} onClick={openImportDialog}>导入歌曲</button>
                    </div>
                </div>
                <ul className={CL.songList}>
                    {playlistSongs.map((song) => (
                        <li key={song.id} className={CL.songItem}>
                            <input
                                type="checkbox"
                                checked={selectedPlaylistSongIds.includes(song.id)}
                                onChange={(e) => togglePlaylistSongSelection(song.id, e.target.checked)}
                                className="mr-2"
                            />
                            <div className="flex-1">
                                <div className={CL.songTitle}>{song.title}</div>
                                <div className={CL.songSub}>{song.artist}</div>
                            </div>
                            <button type="button" className={CL.secondaryBtn} onClick={() => { void removeSong(song.id); }}>
                                {selectedPlaylistId === allSongsPlaylistId ? '永久删除' : '删除'}
                            </button>
                        </li>
                    ))}
                    {playlistSongs.length === 0 && <li className={CL.empty}>当前歌单还没有歌曲</li>}
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
                songsCurrentPage={songsCurrentPage}
                songsTotalPages={songsTotalPages}
                onSongsPageChange={handleSongsPageChange}
                sourcePlaylistPagination={sourcePlaylistPagination}
                onSourcePlaylistPageChange={handleSourcePlaylistPageChange}
                pageSize={songPickerPageSize}
                onSelectAllCurrentPage={selectAllCurrentPageForPicker}
                onSelectAllCurrentPageFromSourcePlaylist={selectAllCurrentPageFromSourcePlaylist}
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
                songsCurrentPage={songsCurrentPage}
                songsTotalPages={songsTotalPages}
                onSongsPageChange={handleSongsPageChange}
                sourcePlaylistPagination={sourcePlaylistPagination}
                onSourcePlaylistPageChange={handleSourcePlaylistPageChange}
                pageSize={songPickerPageSize}
                onSelectAllCurrentPage={selectAllCurrentPageForPicker}
                onSelectAllCurrentPageFromSourcePlaylist={selectAllCurrentPageFromSourcePlaylist}
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
