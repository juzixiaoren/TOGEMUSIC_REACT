import type { Playlist, Song, SortBy, User } from './types';

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

function filterAndSortSongs(songs: Song[], searchQuery: string, filterUser: string, sortBy: SortBy) {
    const q = searchQuery.trim().toLowerCase();
    const filtered = songs.filter((song) => {
        const matchSearch =
            !q || song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q);
        const matchUser = !filterUser || String(song.uploader_id) === filterUser;
        return matchSearch && matchUser;
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
        return new Date(right.time_added).getTime() - new Date(left.time_added).getTime();
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

    return (
        <div className="playlist-dialog-overlay" role="dialog" aria-modal="true" aria-label={title}>
            <div className="playlist-dialog">
                <h3>{title}</h3>
                {mode === 'create' && (
                    <div className="playlist-create-row">
                        <label htmlFor="playlist-name">歌单名称</label>
                        <input
                            id="playlist-name"
                            value={playlistName}
                            onChange={(event) => onPlaylistNameChange(event.target.value)}
                            placeholder="请输入歌单名称"
                        />
                    </div>
                )}

                <div className="playlist-import-tabs">
                    <button
                        type="button"
                        className={activeTab === 'songs' ? 'active' : ''}
                        onClick={() => onTabChange('songs')}
                    >
                        从所有音乐选择
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'playlists' ? 'active' : ''}
                        onClick={() => onTabChange('playlists')}
                    >
                        从其他歌单选择
                    </button>
                </div>

                <div className="playlist-filter-row">
                    <input
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder="搜索歌名或歌手"
                    />
                    <select value={filterUser} onChange={(event) => onFilterUserChange(event.target.value)}>
                        <option value="">所有用户</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                    </select>
                    <select value={sortBy} onChange={(event) => onSortByChange(event.target.value as SortBy)}>
                        <option value="time_added">上传时间</option>
                        <option value="title">歌名</option>
                        <option value="artist">歌手</option>
                        <option value="duration">时长</option>
                    </select>
                </div>

                {activeTab === 'songs' && (
                    <ul className="song-pick-list">
                        {filteredAllSongs.map((song) => (
                            <li key={song.id}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={selectedSongIds.includes(song.id)}
                                        onChange={(event) => onToggleSong(song.id, event.target.checked)}
                                    />
                                    <span>{song.title} - {song.artist} ({formatTime(song.duration)})</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                {activeTab === 'playlists' && (
                    <ul className="source-playlist-list">
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
                                <li key={playlist.id} className="source-playlist-item">
                                    <div className="source-playlist-header">
                                        <label className="source-select">
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={(event) => onToggleSourcePlaylistSelect(playlist.id, event.target.checked)}
                                            />
                                            <span>{playlist.playlist_name}</span>
                                        </label>
                                        <button
                                            type="button"
                                            className="source-expand-btn"
                                            onClick={() => onToggleSourcePlaylistExpand(playlist.id)}
                                        >
                                            {expanded ? '收起' : '展开'}
                                        </button>
                                        <button type="button" onClick={() => onSelectAllFromSourcePlaylist(playlist.id)}>全选</button>
                                        <button type="button" onClick={() => onClearSelectionFromSourcePlaylist(playlist.id)}>取消全选</button>
                                    </div>
                                    {expanded && (
                                        <ul className="song-pick-list nested">
                                            {songs.map((song) => (
                                                <li key={song.id}>
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSongIds.includes(song.id)}
                                                            onChange={(event) => onToggleSong(song.id, event.target.checked)}
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

                <div className="playlist-dialog-footer">
                    <span>已选歌曲：{selectedSongIds.length}</span>
                    <div>
                        <button type="button" className="playlist-primary-btn" onClick={onConfirm}>确认</button>
                        <button type="button" className="playlist-secondary-btn" onClick={onCancel}>取消</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
