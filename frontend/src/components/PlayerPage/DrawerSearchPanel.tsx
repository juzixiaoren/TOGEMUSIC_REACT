import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import type { Playlist, Song } from './types';

const CL = {
    // 面板基础样式（不含 translate）
    panelBase: 'absolute bg-surface rounded-2xl flex flex-col top-6 right-6 w-[380px] h-[calc(100%-48px)] min-h-[572px] shadow-drawer z-5 transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] max-[1100px]:rounded-2xl max-[1100px]:w-[calc(100%-32px)] max-[1100px]:right-4 max-[1100px]:top-4 max-[1100px]:h-[calc(100%-32px)] max-[1100px]:min-h-0',
    // 隐藏状态：滑出到右侧外
    panelHidden: 'translate-x-full',
    // 显示状态：归位
    panelVisible: 'translate-x-0',
    // 头部
    header: 'flex items-center justify-between pt-4 px-4 border-b-2 border-surface-gray',
    tabs: 'flex gap-1',
    tab: 'border-none bg-transparent cursor-pointer py-2 px-3.5 text-[13px] font-medium text-text-tertiary border-b-2 border-transparent transition-all duration-200 -mb-0.5 hover:text-primary',
    tabActive: 'text-primary border-b-primary',
    closeBtn: 'w-7 h-7 border-none rounded-full cursor-pointer flex items-center justify-center bg-surface-gray text-sm text-text-tertiary transition-colors duration-200 hover:bg-surface-gray-hover hover:text-text-primary',
    // 内容区
    content: 'flex-1 overflow-y-auto p-3',
    // 歌单导入
    playlists: 'flex flex-col h-full',
    playlistList: 'list-none p-0 m-0 flex-1 overflow-y-auto',
    playlistItem: 'overflow-hidden border border-border-light rounded-lg mb-2',
    playlistHeader: 'flex items-center gap-2 p-2.5 px-3 bg-surface-muted',
    expandBtn: 'bg-none border-none cursor-pointer p-0 text-xs text-text-quaternary w-5',
    playlistName: 'flex-1 font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-text-primary',
    selectBtn: 'bg-surface-elevated cursor-pointer py-[3px] px-2 text-[11px] border border-border rounded text-text-secondary hover:bg-surface-elevated-hover',
    // 歌曲列表 - 不限制高度，由父容器滚动
    songsList: 'list-none py-2 px-3 bg-surface-gray-light',
    // 歌单内筛选输入框
    songFilterInput: 'w-full mb-2 px-2 py-1.5 text-xs border border-border rounded outline-none focus:border-primary placeholder:text-text-muted',
    songItem: 'py-[5px]',
    songLabel: 'flex items-center gap-2 cursor-pointer text-xs',
    songTitle: 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-text-primary',
    songArtist: 'overflow-hidden text-ellipsis whitespace-nowrap text-text-quaternary text-[11px] max-w-20',
    filterEmpty: 'text-center text-text-muted text-xs py-3',
    // 导入栏
    importBar: 'flex items-center justify-between py-2.5 mt-2 border-t border-border-light',
    importBarText: 'font-medium text-[13px] text-primary',
    importBtn: 'border-none cursor-pointer py-2 px-4 bg-primary text-white rounded-md text-[13px] font-medium',
    // 搜索
    search: 'flex flex-col h-full',
    searchBar: 'flex gap-2 mb-3',
    searchInput: 'flex-1 outline-none py-2 px-3 border border-border rounded-lg text-[13px] transition-colors duration-200 focus:border-primary',
    searchBtn: 'border-none cursor-pointer whitespace-nowrap py-2 px-4 bg-primary text-white rounded-lg text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed',
    searchResults: 'flex-1 overflow-y-auto',
    resultItem: 'flex items-center gap-3 p-2.5 px-2 border-b border-surface-gray',
    resultInfo: 'flex-1 min-w-0',
    resultTitle: 'font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-text-primary',
    resultArtist: 'mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-text-quaternary',
    resultImportBtn: 'bg-surface-elevated cursor-pointer whitespace-nowrap py-[5px] px-3 border border-primary text-primary rounded text-xs transition-all duration-200 hover:bg-primary hover:text-white',
    resultImported: 'border-success-light text-success-light cursor-default',
    resultDisabled: 'opacity-60 cursor-not-allowed',
    emptyHint: 'flex items-center justify-center h-[120px] text-text-muted text-[13px]',
};

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => {
            const singers = Array.isArray(item?.singer) ? item.singer : [];
            const artist = singers
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNeteaseSearchItems(payload: any): SearchResultItem[] {
    const list = payload?.data?.list || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const [songFilter, setSongFilter] = useState('');

    const ALL_SONGS_ID = -1;
    const isAllSongsExpanded = expandedPlaylist === ALL_SONGS_ID;
    const filterPlaylists = playlists.filter((p) => p.id !== 1);
    const playlistListRef = useRef<HTMLUListElement>(null);

    // 展开歌单时自动将该歌单头部滚动到列表顶部
    const scrollPlaylistIntoView = useCallback((playlistId: number) => {
        requestAnimationFrame(() => {
            const list = playlistListRef.current;
            if (!list) return;
            const items = list.children;
            // 找到对应歌单的 li 元素
            for (let i = 0; i < items.length; i++) {
                const li = items[i] as HTMLElement;
                const header = li.querySelector('[data-playlist-id]');
                if (header && String(header.getAttribute('data-playlist-id')) === String(playlistId)) {
                    li.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    break;
                }
            }
        });
    }, []);

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
            const payload: Record<string, unknown> = {
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
        <div className={`${CL.panelBase} ${isOpen ? CL.panelVisible : CL.panelHidden}`}>
            <div className={CL.header}>
                <div className={CL.tabs}>
                    <button
                        type="button"
                        className={`${CL.tab}${activeTab === 'playlists' ? ` ${CL.tabActive}` : ''}`}
                        onClick={() => setActiveTab('playlists')}
                    >
                        歌单导入
                    </button>
                    <button
                        type="button"
                        className={`${CL.tab}${activeTab === 'qqmusic' ? ` ${CL.tabActive}` : ''}`}
                        onClick={() => setActiveTab('qqmusic')}
                    >
                        QQ音乐
                    </button>
                    <button
                        type="button"
                        className={`${CL.tab}${activeTab === 'netease' ? ` ${CL.tabActive}` : ''}`}
                        onClick={() => setActiveTab('netease')}
                    >
                        网易云
                    </button>
                </div>
                <button type="button" className={CL.closeBtn} onClick={onClose}>
                    ✕
                </button>
            </div>

            <div className={CL.content}>
                {/* 歌单导入 Tab */}
                {activeTab === 'playlists' && (
                    <div className={CL.playlists}>
                        <ul className={CL.playlistList} ref={playlistListRef}>
                            {/* 所有歌曲 */}
                            <li className={CL.playlistItem}>
                                <div className={CL.playlistHeader} data-playlist-id={ALL_SONGS_ID}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onTogglePlaylistExpand(ALL_SONGS_ID);
                                            if (!isAllSongsExpanded) {
                                                scrollPlaylistIntoView(ALL_SONGS_ID);
                                            } else {
                                                setSongFilter('');
                                            }
                                        }}
                                        className={CL.expandBtn}
                                    >
                                        {isAllSongsExpanded ? '▼' : '▶'}
                                    </button>
                                    <span className={CL.playlistName}>所有歌曲（{allSongs.length}）</span>
                                    <button type="button" className={CL.selectBtn} onClick={() => {
                                        for (const song of allSongs) {
                                            if (!selectedSongs.includes(song.id)) onToggleSong(song.id, true);
                                        }
                                    }}>全选</button>
                                    <button type="button" className={CL.selectBtn} onClick={() => {
                                        for (const song of allSongs) {
                                            if (selectedSongs.includes(song.id)) onToggleSong(song.id, false);
                                        }
                                    }}>取消</button>
                                </div>
                                {isAllSongsExpanded && (
                                    <ul className={CL.songsList}>
                                        <li>
                                            <input
                                                type="text"
                                                className={CL.songFilterInput}
                                                placeholder="搜索歌名或歌手..."
                                                value={songFilter}
                                                onChange={(e) => setSongFilter(e.target.value)}
                                            />
                                        </li>
                                        {(() => {
                                            const filterLower = songFilter.trim().toLowerCase();
                                            const filteredSongs = filterLower
                                                ? allSongs.filter((song) =>
                                                    song.title.toLowerCase().includes(filterLower) ||
                                                    song.artist.toLowerCase().includes(filterLower)
                                                )
                                                : allSongs;
                                            if (filteredSongs.length === 0) {
                                                return (
                                                    <li className={CL.filterEmpty}>无匹配歌曲</li>
                                                );
                                            }
                                            return filteredSongs.map((song) => (
                                                <li key={song.id} className={CL.songItem}>
                                                    <label className={CL.songLabel}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSongs.includes(song.id)}
                                                            onChange={(e) => onToggleSong(song.id, e.target.checked)}
                                                        />
                                                        <span className={CL.songTitle}>{song.title}</span>
                                                        <span className={CL.songArtist}>{song.artist}</span>
                                                    </label>
                                                </li>
                                            ));
                                        })()}
                                    </ul>
                                )}
                            </li>
                            {/* 各歌单 */}
                            {filterPlaylists.map((playlist) => {
                                const songs = playlistSongsMap[playlist.id] || [];
                                const isExpanded = expandedPlaylist === playlist.id;
                                return (
                                    <li key={playlist.id} className={CL.playlistItem}>
                                        <div className={CL.playlistHeader} data-playlist-id={playlist.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onTogglePlaylistExpand(playlist.id);
                                                    if (!isExpanded) {
                                                        scrollPlaylistIntoView(playlist.id);
                                                    } else {
                                                        setSongFilter('');
                                                    }
                                                }}
                                                className={CL.expandBtn}
                                            >
                                                {isExpanded ? '▼' : '▶'}
                                            </button>
                                            <span className={CL.playlistName}>{playlist.playlist_name}</span>
                                            <button type="button" className={CL.selectBtn} onClick={() => onSelectAllFromPlaylist(playlist.id)}>全选</button>
                                            <button type="button" className={CL.selectBtn} onClick={() => onClearSelectionFromPlaylist(playlist.id)}>取消</button>
                                        </div>
                                        {isExpanded && (
                                            <ul className={CL.songsList}>
                                                <li>
                                                    <input
                                                        type="text"
                                                        className={CL.songFilterInput}
                                                        placeholder="搜索歌名或歌手..."
                                                        value={songFilter}
                                                        onChange={(e) => setSongFilter(e.target.value)}
                                                    />
                                                </li>
                                                {(() => {
                                                    const filterLower = songFilter.trim().toLowerCase();
                                                    const filteredSongs = filterLower
                                                        ? songs.filter((song) =>
                                                            song.title.toLowerCase().includes(filterLower) ||
                                                            song.artist.toLowerCase().includes(filterLower)
                                                        )
                                                        : songs;
                                                    if (filteredSongs.length === 0) {
                                                        return (
                                                            <li className={CL.filterEmpty}>无匹配歌曲</li>
                                                        );
                                                    }
                                                    return filteredSongs.map((song) => (
                                                        <li key={song.id} className={CL.songItem}>
                                                            <label className={CL.songLabel}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedSongs.includes(song.id)}
                                                                    onChange={(e) => onToggleSong(song.id, e.target.checked)}
                                                                />
                                                                <span className={CL.songTitle}>{song.title}</span>
                                                                <span className={CL.songArtist}>{song.artist}</span>
                                                            </label>
                                                        </li>
                                                    ));
                                                })()}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {selectedSongs.length > 0 && (
                            <div className={CL.importBar}>
                                <span className={CL.importBarText}>已选 {selectedSongs.length} 首</span>
                                <button type="button" className={CL.importBtn} onClick={onImportSelectedSongs}>
                                    导入到播放列表
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 搜索 Tab（QQ音乐 / 网易云） */}
                {(activeTab === 'qqmusic' || activeTab === 'netease') && (
                    <div className={CL.search}>
                        <div className={CL.searchBar}>
                            <input
                                type="text"
                                className={CL.searchInput}
                                placeholder={`搜索${activeTab === 'qqmusic' ? 'QQ音乐' : '网易云'}歌曲...`}
                                value={searchKey}
                                onChange={(e) => setSearchKey(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSearch();
                                }}
                            />
                            <button
                                type="button"
                                className={CL.searchBtn}
                                onClick={() => void handleSearch()}
                                disabled={searchLoading}
                            >
                                {searchLoading ? '...' : '搜索'}
                            </button>
                        </div>

                        <div className={CL.searchResults}>
                            {searchResults.map((item) => {
                                const key = `${item.platform}:${item.songmid}`;
                                const existingId = existingMap[key];
                                const isImporting = importingKey === key;
                                return (
                                    <div key={key} className={CL.resultItem}>
                                        <div className={CL.resultInfo}>
                                            <div className={CL.resultTitle}>{item.title}</div>
                                            <div className={CL.resultArtist}>{item.artist}</div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`${CL.resultImportBtn}${existingId ? ` ${CL.resultImported}` : ''}${isImporting ? ` ${CL.resultDisabled}` : ''}`}
                                            disabled={isImporting}
                                            onClick={() => void handleImportSearchResult(item)}
                                        >
                                            {isImporting ? '...' : existingId ? '已导入' : '导入'}
                                        </button>
                                    </div>
                                );
                            })}
                            {searchResults.length === 0 && !searchLoading && (
                                <div className={CL.emptyHint}>
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
