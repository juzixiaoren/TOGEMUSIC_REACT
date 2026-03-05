import type { DragEvent } from 'react';
import type { Song } from './types';

type PlaylistPanelProps = {
    displayPlaylist: Song[];
    currentSongId: number | null;
    formatTime: (time: number) => string;
    onPlay: () => void;
    onClear: () => void;
    onDeleteSong: (songId: number) => void;
    onDragStart: (index: number) => void;
    onDragOver: (event: DragEvent<HTMLLIElement>) => void;
    onDrop: (targetIndex: number) => void;
    onDragEnd: () => void;
};

export default function PlaylistPanel({
    displayPlaylist,
    currentSongId,
    formatTime,
    onPlay,
    onClear,
    onDeleteSong,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd
}: PlaylistPanelProps) {
    return (
        <div className="playlist-panel">
            <div className="playlist-header">
                <h2>播放列表</h2>
                <div className="playlist-actions">
                    <button type="button" onClick={onPlay} className="action-btn" title="开始播放">▶ 播放</button>
                    <button type="button" onClick={onClear} className="action-btn" title="清空列表">🗑 清空</button>
                </div>
            </div>

            <ul className="songs-queue">
                {displayPlaylist.map((song, index) => {
                    const draggable = index > 0;
                    return (
                        <li
                            key={song.id}
                            className={`song-item ${song.id === currentSongId ? 'current-playing' : ''} ${draggable ? 'draggable-item' : ''}`}
                            draggable={draggable}
                            onDragStart={() => onDragStart(index)}
                            onDragOver={onDragOver}
                            onDrop={() => onDrop(index)}
                            onDragEnd={onDragEnd}
                        >
                            <div className="song-number">{index + 1}</div>
                            <div className="song-details">
                                <div className="song-name">{song.title}</div>
                                <div className="song-artist-small">{song.artist}</div>
                            </div>
                            <div className="song-controls">
                                <span className="song-duration">{formatTime(song.duration || 0)}</span>
                                <button
                                    type="button"
                                    onClick={() => onDeleteSong(song.id)}
                                    className="delete-btn"
                                    title="删除"
                                >
                                    ✕
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {displayPlaylist.length === 0 && (
                <div className="empty-state">
                    <p>播放列表为空，请导入歌曲</p>
                </div>
            )}
        </div>
    );
}
