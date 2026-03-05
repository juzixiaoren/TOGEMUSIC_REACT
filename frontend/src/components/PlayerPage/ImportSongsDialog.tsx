import type { Playlist, Song } from './types';

type ImportSongsDialogProps = {
    isOpen: boolean;
    playlists: Playlist[];
    expandedPlaylist: number | null;
    playlistSongsMap: Record<number, Song[]>;
    selectedSongs: number[];
    onTogglePlaylistExpand: (playlistId: number) => void;
    onSelectAllFromPlaylist: (playlistId: number) => void;
    onClearSelectionFromPlaylist: (playlistId: number) => void;
    onToggleSong: (songId: number, checked: boolean) => void;
    onImportSelectedSongs: () => void;
    onClose: () => void;
};

export default function ImportSongsDialog({
    isOpen,
    playlists,
    expandedPlaylist,
    playlistSongsMap,
    selectedSongs,
    onTogglePlaylistExpand,
    onSelectAllFromPlaylist,
    onClearSelectionFromPlaylist,
    onToggleSong,
    onImportSelectedSongs,
    onClose
}: ImportSongsDialogProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="dialog" role="dialog" aria-modal="true" aria-label="导入歌曲">
            <h3>选择歌单并导入歌曲</h3>
            <div className="playlist-select">
                <h4>可用歌单:</h4>
                <ul className="playlist-list">
                    {playlists.map((playlist) => {
                        const songs = playlistSongsMap[playlist.id] || [];
                        const isExpanded = expandedPlaylist === playlist.id;
                        return (
                            <li key={playlist.id} className="playlist-item">
                                <div className="playlist-header">
                                    <button
                                        type="button"
                                        onClick={() => onTogglePlaylistExpand(playlist.id)}
                                        className="expand-btn"
                                    >
                                        {isExpanded ? '▼' : '▶'}
                                    </button>
                                    <span>{playlist.playlist_name}</span>
                                    <button
                                        type="button"
                                        onClick={() => onSelectAllFromPlaylist(playlist.id)}
                                        className="select-all-btn"
                                    >
                                        全选
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onClearSelectionFromPlaylist(playlist.id)}
                                        className="clear-btn"
                                    >
                                        取消全选
                                    </button>
                                </div>
                                {isExpanded && (
                                    <ul className="songs-list">
                                        {songs.map((song) => (
                                            <li key={song.id}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSongs.includes(song.id)}
                                                    onChange={(event) => onToggleSong(song.id, event.target.checked)}
                                                />
                                                {song.title} - {song.artist}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <button type="button" onClick={onImportSelectedSongs}>导入选中歌曲</button>
            <button type="button" onClick={onClose}>取消</button>
        </div>
    );
}
