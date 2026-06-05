import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import type { Playlist, Song } from './types';

// 搜索结果类型
type SearchResultItem = {
    songmid: string;
    title: string;
    artist: string;
    duration: number;
    platform: 'qqmusic' | 'netease';
    album?: string;
    cover?: string;
    strMediaMid?: string;
};

type TabType = 'playlists' | 'qqmusic' | 'netease';

type DrawerSearchPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    playlists: Playlist[];
    allSongs: Song[];
    expandedPlaylist: number | null;
    playlistSongsMap: Record<number, Song[]>;
    selectedSongs: number[];
    onTogglePlaylistExpand: (playlistId: number) => void;
    onSelectAllFromPlaylist: (playlistId: number) => void;
    onClearSelectionFromPlaylist: (playlistId: number) => void;
    onToggleSong: (songId: number, checked: boolean) => void;
    onImportSelectedSongs: () => void;
    onSongImported: () => void;
};

// QQ 音乐搜索结果标准化
function normalizeQQSearchItems(payload: any): SearchResultItem[] {
    const rawItems = Array.isArray(payload?.items)
        ? payload.items
        : (() => {
            const data = payload?.data;
            if (Array.isArray(data?.list)) {
                return data.list;
            }
            if (Array.isArray(data?.song?.list)) {
                return data.song.list;
            }
            return [];
        })();

    return rawItems
        .map((item: any) => {
            const singers = Array.isArray(item?.singer) ? item.singer : [];
            const artist = singers
                .map((s: any) => s?.name)
                .filter(Boolean)
                .join('/');
            const songmid = item?.songmid || item?.mid || item?.id;
            if (!songmid) return null;
            return {
                songmid,
                title: item?.songname || item?.title || '',
                artist: artist || item?.artist || '',
                duration: Number(item?.interval || 0) * 1000,
                platform: 'qqmusic' as const,
                strMediaMid: item?.strMediaMid || item?.media_mid || songmid,
            };
        })
        .filter((item: SearchResultItem | null): item is SearchResultItem => Boolean(item));
}

// 网易云搜索结果标准化
function normalizeNeteaseSearchItems(payload: any): SearchResultItem[] {
    const list = payload?.data?.list || [];
    return list.map((item: any) => ({
        songmid: String(item.songmid || item.id || ''),
        title: item.title || item.name || '',
        artist: item.artist || '',
        duration: Number(item.duration || 0),
        platform: 'netease' as const,
        album: item.album || '',
        cover: item.cover || '',
    }));
}

export default function DrawerSearchPanel({
    isOpen,
    onClose,
    playlists,
    allSongs,
    expandedPlaylist,
    playlistSongsMap,
    selectedSongs,
    onTogglePlaylistExpand,
    onSelectAllFromPlaylist,
    onClearSelectionFromPlaylist,
    onToggleSong,
    onImportSelectedSongs,
    onSongImported,
}: DrawerSearchPanelProps) {
    const { setMessage } = useMessage();
    const authHeader = useMemo(
        () => ({ Authorization: localStorage.getItem('token') || '' }),
        []
    );

    const [activeTab, setActiveTab] = useState<TabType>('playlists');
    const [searchKey, setSearchKey] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [existingMap, setExistingMap] = useState<Record<string, number>>({});
    const [importingKey, setImportingKey] = useState<string | null>(null);

    const ALL_SONGS_ID = -1;
    const isAllSongsExpanded = expandedPlaylist === ALL_SONGS_ID;
    const filterPlaylists = playlists.filter((p) => p.id !== 1);

    // 搜索歌曲
    const handleSearch = useCallback(async () => {
        const key = searchKey.trim();
        if (!key) return;
        setSearchLoading(true);
        setSearchResults([]);
        setExistingMap({});

        try {
            const endpoint = activeTab === 'qqmusic' ? '/qqmusic/search' : '/netease/search';
            const response = await axios.get(endpoint, {
                params: { key, pageNo: 1, pageSize: 20 },
                headers: authHeader,
            });

            const items = activeTab === 'qqmusic'
                ? normalizeQQSearchItems(response.data)
                : normalizeNeteaseSearchItems(response.data);

            setSearchResults(items);

            // 批量检查哪些歌曲已存在
            if (items.length > 0) {
                const platform = activeTab === 'qqmusic' ? 'qqmusic' : 'netease';
                const checks = items.map((item) => ({
                    platform,
                    platform_song_id: item.songmid,
                }));
                try {
                    const checkResp = await axios.post('/songs/check-platform', { checks }, { headers: authHeader });
                    setExistingMap(checkResp.data?.exists || {});
                } catch {
                    // 检查失败不影响搜索结果展示
                }
            }

            setMessage(`搜索完成，共 ${items.length} 条`, 'success');
        } catch (err) {
            console.error('搜索失败', err);
            setMessage('搜索失败，请检查后端服务', 'error');
        } finally {
            setSearchLoading(false);
        }
    }, [activeTab, authHeader, searchKey, setMessage]);

    // 导入单首搜索结果歌曲
    const handleImportSearchResult = useCallback(async (item: SearchResultItem) => {
        const key = `${item.platform}:${item.songmid}`;
        setImportingKey(key);
        try {
            const endpoint = item.platform === 'qqmusic' ? '/qqmusic/import' : '/netease/import';
            const payload: Record<string, any> = {
                songmid: item.songmid,
                title: item.title,
                artist: item.artist,
                duration: item.duration,
                addToPlaylist: true,
            };
            if (item.platform === 'qqmusic' && item.strMediaMid) {
                payload.strMediaMid = item.strMediaMid;
            }
            const response = await axios.post(endpoint, payload, { headers: authHeader });
            const msg = response.data?.message || '导入成功';
            setMessage(msg, 'success');

            // 更新已存在映射
            const songId = response.data?.songId;
            if (songId) {
                setExistingMap((prev) => ({
                    ...prev,
                    [key]: songId,
                }));

                // 将歌曲添加到主播放列表（ID=1）
                try {
                    await axios.post('/playlists/1/songs', {
                        songIds: [songId]
                    }, { headers: authHeader });
                } catch {
                    // 添加到播放列表失败不影响导入成功提示
                }
            }

            // 通知父组件刷新
            onSongImported();
        } catch (err) {
            console.error('导入失败', err);
            setMessage('导入失败', 'error');
        } finally {
            setImportingKey(null);
        }
    }, [authHeader, onSongImported, setMessage]);

    // Tab 切换时清空搜索
    useEffect(() => {
        setSearchResults([]);
        setSearchKey('');
        setExistingMap({});
    }, [activeTab]);

    return (
        <div className={`drawer-panel ${isOpen ? 'drawer-visible' : ''}`}>
            <div className="drawer-header">
                <div className="drawer-tabs">
                    <button
                        type="button"
                        className={`drawer-tab ${activeTab === 'playlists' ? 'active' : ''}`}
                        onClick={() => setActiveTab('playlists')}
                    >
                        歌单导入
                    </button>
                    <button
                        type="button"
                        className={`drawer-tab ${activeTab === 'qqmusic' ? 'active' : ''}`}
                        onClick={() => setActiveTab('qqmusic')}
                    >
                        QQ音乐
                    </button>
                    <button
                        type="button"
                        className={`drawer-tab ${activeTab === 'netease' ? 'active' : ''}`}
                        onClick={() => setActiveTab('netease')}
                    >
                        网易云
                    </button>
                </div>
                <button type="button" className="drawer-close-btn" onClick={onClose}>
                    ✕
                </button>
            </div>

            <div className="drawer-content">
                {/* 歌单导入 Tab */}
                {activeTab === 'playlists' && (
                    <div className="drawer-playlists">
                        <ul className="drawer-playlist-list">
                            {/* 所有歌曲 */}
                            <li className="drawer-playlist-item">
                                <div className="drawer-playlist-header">
                                    <button
                                        type="button"
                                        onClick={() => onTogglePlaylistExpand(ALL_SONGS_ID)}
                                        className="drawer-expand-btn"
                                    >
                                        {isAllSongsExpanded ? '▼' : '▶'}
                                    </button>
                                    <span className="drawer-playlist-name">所有歌曲（{allSongs.length}）</span>
                                    <button type="button" className="drawer-select-btn" onClick={() => {
                                        for (const song of allSongs) {
                                            if (!selectedSongs.includes(song.id)) onToggleSong(song.id, true);
                                        }
                                    }}>全选</button>
                                    <button type="button" className="drawer-select-btn" onClick={() => {
                                        for (const song of allSongs) {
                                            if (selectedSongs.includes(song.id)) onToggleSong(song.id, false);
                                        }
                                    }}>取消</button>
                                </div>
                                {isAllSongsExpanded && (
                                    <ul className="drawer-songs-list">
                                        {allSongs.map((song) => (
                                            <li key={song.id} className="drawer-song-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSongs.includes(song.id)}
                                                        onChange={(e) => onToggleSong(song.id, e.target.checked)}
                                                    />
                                                    <span className="drawer-song-title">{song.title}</span>
                                                    <span className="drawer-song-artist">{song.artist}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                            {/* 各歌单 */}
                            {filterPlaylists.map((playlist) => {
                                const songs = playlistSongsMap[playlist.id] || [];
                                const isExpanded = expandedPlaylist === playlist.id;
                                return (
                                    <li key={playlist.id} className="drawer-playlist-item">
                                        <div className="drawer-playlist-header">
                                            <button
                                                type="button"
                                                onClick={() => onTogglePlaylistExpand(playlist.id)}
                                                className="drawer-expand-btn"
                                            >
                                                {isExpanded ? '▼' : '▶'}
                                            </button>
                                            <span className="drawer-playlist-name">{playlist.playlist_name}</span>
                                            <button type="button" className="drawer-select-btn" onClick={() => onSelectAllFromPlaylist(playlist.id)}>全选</button>
                                            <button type="button" className="drawer-select-btn" onClick={() => onClearSelectionFromPlaylist(playlist.id)}>取消</button>
                                        </div>
                                        {isExpanded && (
                                            <ul className="drawer-songs-list">
                                                {songs.map((song) => (
                                                    <li key={song.id} className="drawer-song-item">
                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSongs.includes(song.id)}
                                                                onChange={(e) => onToggleSong(song.id, e.target.checked)}
                                                            />
                                                            <span className="drawer-song-title">{song.title}</span>
                                                            <span className="drawer-song-artist">{song.artist}</span>
                                                        </label>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {selectedSongs.length > 0 && (
                            <div className="drawer-import-bar">
                                <span>已选 {selectedSongs.length} 首</span>
                                <button type="button" className="drawer-import-btn" onClick={onImportSelectedSongs}>
                                    导入到播放列表
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 搜索 Tab（QQ音乐 / 网易云） */}
                {(activeTab === 'qqmusic' || activeTab === 'netease') && (
                    <div className="drawer-search">
                        <div className="drawer-search-bar">
                            <input
                                type="text"
                                className="drawer-search-input"
                                placeholder={`搜索${activeTab === 'qqmusic' ? 'QQ音乐' : '网易云'}歌曲...`}
                                value={searchKey}
                                onChange={(e) => setSearchKey(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSearch();
                                }}
                            />
                            <button
                                type="button"
                                className="drawer-search-btn"
                                onClick={() => void handleSearch()}
                                disabled={searchLoading}
                            >
                                {searchLoading ? '...' : '搜索'}
                            </button>
                        </div>

                        <div className="drawer-search-results">
                            {searchResults.map((item) => {
                                const key = `${item.platform}:${item.songmid}`;
                                const existingId = existingMap[key];
                                const isImporting = importingKey === key;
                                return (
                                    <div key={key} className="drawer-result-item">
                                        <div className="drawer-result-info">
                                            <div className="drawer-result-title">{item.title}</div>
                                            <div className="drawer-result-artist">{item.artist}</div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`drawer-result-import-btn ${existingId ? 'imported' : ''}`}
                                            disabled={isImporting}
                                            onClick={() => void handleImportSearchResult(item)}
                                        >
                                            {isImporting ? '...' : existingId ? '已导入' : '导入'}
                                        </button>
                                    </div>
                                );
                            })}
                            {searchResults.length === 0 && !searchLoading && (
                                <div className="drawer-empty-hint">
                                    {searchKey.trim() ? '无搜索结果' : '输入关键词搜索歌曲'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
