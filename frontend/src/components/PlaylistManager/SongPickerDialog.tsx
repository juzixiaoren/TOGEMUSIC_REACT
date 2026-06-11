import type { Playlist, Song, SortBy, User } from './types';

const CL = {
    overlay: 'fixed inset-0 flex items-center justify-center bg-black/32 z-[1100]',
    dialog: 'flex flex-col gap-3 bg-white w-[min(980px,92vw)] h-[min(86vh,760px)] rounded-2xl p-[18px] shadow-dialog',
    dialogTitle: 'm-0 text-text-primary',
    createRow: 'flex items-center gap-2.5',
    createLabel: 'text-[13px] text-text-blue-label',
    createInput: 'rounded-lg border border-border-blue-input py-2 px-2.5 text-[13px]',
    tabs: 'flex gap-2',
    tabBtn: 'bg-white rounded-lg cursor-pointer border border-border-blue-page py-2 px-3 text-text-blue-muted',
    tabBtnActive: 'border-transparent text-white bg-primary',
    filterRow: 'flex gap-2 flex-wrap',
    filterInput: 'rounded-lg border border-border-blue-input py-2 px-2.5 text-[13px] flex-1 min-w-[240px]',
    filterSelect: 'rounded-lg border border-border-blue-input py-2 px-2.5 text-[13px]',
    pickList: 'list-none m-0 p-0 flex-1 min-h-0 overflow-auto rounded-xl border border-border-blue-pale p-2 bg-surface-blue-pick',
    pickItem: 'rounded-lg p-2 hover:bg-surface-blue-hover',
    pickListNested: 'border-none bg-[#f8faff]',
    checkbox: 'cursor-pointer w-4 h-4 accent-[#6366F1] m-2.5',
    sourceList: 'list-none m-0 p-0 flex-1 min-h-0 overflow-auto flex flex-col gap-2',
    sourceItem: 'overflow-hidden border border-border-blue-source rounded-[10px]',
    sourceHeader: 'flex items-center gap-2 bg-surface-blue-soft p-2',
    sourceSelect: 'flex items-center gap-1.5 flex-1',
    sourceBtn: 'bg-white rounded-md cursor-pointer border border-border-blue-expand py-[5px] px-2 text-text-blue-muted',
    footer: 'flex flex-shrink-0 justify-between items-center border-t border-border-blue-pale pt-[10px] text-text-blue-label',
    footerBtns: 'flex gap-2',
    primaryBtn: 'border-none rounded-xl font-semibold cursor-pointer py-[9px] px-[14px] text-white bg-primary',
    secondaryBtn: 'bg-white rounded-lg cursor-pointer border border-border-blue-muted py-1.5 px-2.5 text-text-blue-muted',
};

type SongPickerDialogProps = {
    open: boolean;
    title: string;
    mode: 'create' | 'import';
    playlistName: string;
    selectedSongIds: number[];
    allSongs: Song[];
    users: User[];
    sourcePlaylists: Playlist[];
    sourcePlaylistSongsMap: Record<number, Song[]>;
    selectedSourcePlaylistIds: number[];
    expandedSourcePlaylistIds: number[];
    searchQuery: string;
    filterUser: string;
    sortBy: SortBy;
    activeTab: 'songs' | 'playlists';
    onPlaylistNameChange: (value: string) => void;
    onSearchQueryChange: (value: string) => void;
    onFilterUserChange: (value: string) => void;
    onSortByChange: (value: SortBy) => void;
    onTabChange: (tab: 'songs' | 'playlists') => void;
    onToggleSong: (songId: number, checked: boolean) => void;
    onToggleSourcePlaylistSelect: (playlistId: number, checked: boolean) => void;
    onToggleSourcePlaylistExpand: (playlistId: number) => void;
    onSelectAllFromSourcePlaylist: (playlistId: number) => void;
    onClearSelectionFromSourcePlaylist: (playlistId: number) => void;
    onConfirm: () => void;
    onCancel: () => void;
};

function formatTime(duration: number) {
    const seconds = duration > 3600 ? duration / 1000 : duration;
    if (!seconds || Number.isNaN(seconds)) {
        return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function filterAndSortSongs(songs: Song[], searchQuery: string, filterUser: string, sortBy: SortBy) {// 过滤
    const q = searchQuery.trim().toLowerCase();
    const filtered = songs.filter((song) => {
        const matchSearch =
            !q || song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q);
        const matchUser = !filterUser || String(song.uploader_id) === filterUser;
        return matchSearch && matchUser;// 只有同时满足搜索和用户过滤条件的歌曲才会被保留
    });

    return filtered.sort((left, right) => {
        if (sortBy === 'title') {
            return left.title.localeCompare(right.title, 'zh-CN');
        }
        if (sortBy === 'artist') {
            return left.artist.localeCompare(right.artist, 'zh-CN');
        }
        if (sortBy === 'duration') {
            return (right.duration || 0) - (left.duration || 0);
        }
        return new Date(right.time_added).getTime() - new Date(left.time_added).getTime();// 默认按照添加时间排序，时间新的在前面
    });
}

export default function SongPickerDialog(props: SongPickerDialogProps) {
    const {
        open,
        title,
        mode,
        playlistName,
        selectedSongIds,
        allSongs,
        users,
        sourcePlaylists,
        sourcePlaylistSongsMap,
        selectedSourcePlaylistIds,
        expandedSourcePlaylistIds,
        searchQuery,
        filterUser,
        sortBy,
        activeTab,
        onPlaylistNameChange,
        onSearchQueryChange,
        onFilterUserChange,
        onSortByChange,
        onTabChange,
        onToggleSong,
        onToggleSourcePlaylistSelect,
        onToggleSourcePlaylistExpand,
        onSelectAllFromSourcePlaylist,
        onClearSelectionFromSourcePlaylist,
        onConfirm,
        onCancel
    } = props;

    if (!open) {
        return null;
    }

    const filteredAllSongs = filterAndSortSongs(allSongs, searchQuery, filterUser, sortBy);
    const onSelectAll = () => {
        const songs = filterAndSortSongs(allSongs, searchQuery, filterUser, sortBy);
        const allIds = songs.map((song) => song.id);
        allIds.map((id) => onToggleSong(id, true));
    };



    return (
        <div className={CL.overlay} role="dialog" aria-modal="true" aria-label={title}>
            <div className={CL.dialog}>
                <h3 className={CL.dialogTitle}>{title}</h3>
                {mode === 'create' && (
                    <div className={CL.createRow}>
                        <label className={CL.createLabel} htmlFor="playlist-name">歌单名称</label>
                        <input
                            id="playlist-name"
                            value={playlistName}
                            onChange={(event) => onPlaylistNameChange(event.target.value)}
                            placeholder="请输入歌单名称"
                            className={CL.createInput}
                        />
                    </div>
                )}

                <div className={CL.tabs}>
                    <button
                        type="button"
                        className={`${CL.tabBtn} ${activeTab === 'songs' ? CL.tabBtnActive : ''}`}
                        onClick={() => onTabChange('songs')}
                    >
                        从所有音乐选择
                    </button>
                    <button
                        type="button"
                        className={`${CL.tabBtn} ${activeTab === 'playlists' ? CL.tabBtnActive : ''}`}
                        onClick={() => onTabChange('playlists')}
                    >
                        从其他歌单选择
                    </button>
                </div>

                <div className={CL.filterRow}>
                    <input
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder="搜索歌名或歌手"
                        className={CL.filterInput}
                    />
                    <select value={filterUser} onChange={(event) => onFilterUserChange(event.target.value)} className={CL.filterSelect}>
                        <option value="">所有用户</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                    </select>
                    <select value={sortBy} onChange={(event) => onSortByChange(event.target.value as SortBy)} className={CL.filterSelect}>
                        <option value="time_added">上传时间</option>
                        <option value="title">歌名</option>
                        <option value="artist">歌手</option>
                        <option value="duration">时长</option>
                    </select>
                </div>

                {activeTab === 'songs' && (
                    <ul className={CL.pickList}>
                        {filteredAllSongs.map((song) => (
                            <li key={song.id} className={CL.pickItem}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={selectedSongIds.includes(song.id)}
                                        onChange={(event) => onToggleSong(song.id, event.target.checked)}
                                        className={CL.checkbox}
                                    />
                                    <span>{song.title} - {song.artist} ({formatTime(song.duration)})</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                {activeTab === 'playlists' && (
                    <ul className={CL.sourceList}>
                        {sourcePlaylists.map((playlist) => {
                            const selected = selectedSourcePlaylistIds.includes(playlist.id);
                            const expanded = expandedSourcePlaylistIds.includes(playlist.id);
                            const songs = filterAndSortSongs(
                                sourcePlaylistSongsMap[playlist.id] || [],
                                searchQuery,
                                filterUser,
                                sortBy
                            );
                            return (
                                <li key={playlist.id} className={CL.sourceItem}>
                                    <div className={CL.sourceHeader}>
                                        <label className={CL.sourceSelect}>
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={(event) => onToggleSourcePlaylistSelect(playlist.id, event.target.checked)}
                                                className={CL.checkbox}
                                            />
                                            <span>{playlist.playlist_name}</span>
                                        </label>
                                        <button
                                            type="button"
                                            className={CL.sourceBtn}
                                            onClick={() => onToggleSourcePlaylistExpand(playlist.id)}
                                        >
                                            {expanded ? '收起' : '展开'}
                                        </button>
                                        <button type="button" className={CL.sourceBtn} onClick={() => onSelectAllFromSourcePlaylist(playlist.id)}>全选</button>
                                        <button type="button" className={CL.sourceBtn} onClick={() => onClearSelectionFromSourcePlaylist(playlist.id)}>取消全选</button>
                                    </div>
                                    {expanded && (
                                        <ul className={`${CL.pickList} ${CL.pickListNested}`}>
                                            {songs.map((song) => (
                                                <li key={song.id} className={CL.pickItem}>
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSongIds.includes(song.id)}
                                                            onChange={(event) => onToggleSong(song.id, event.target.checked)}
                                                            className={CL.checkbox}
                                                        />
                                                        <span>{song.title} - {song.artist} ({formatTime(song.duration)})</span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className={CL.footer}>
                    <span>已选歌曲：{selectedSongIds.length}</span>
                    <div className={CL.footerBtns}>
                        <button type="button" className={CL.primaryBtn} onClick={onSelectAll}>全选</button>
                        <button type="button" className={CL.primaryBtn} onClick={onConfirm}>确认</button>
                        <button type="button" className={CL.secondaryBtn} onClick={onCancel}>取消</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
