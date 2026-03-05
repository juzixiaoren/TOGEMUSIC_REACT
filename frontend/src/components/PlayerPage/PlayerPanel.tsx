import type { Song } from './types';

type PlayerPanelProps = {
    currentSong: Song | null;
    currentSongCoverUrl: string | null;
    defaultCoverImage: string;
    progressPercentage: number;
    currentTime: number;
    volume: number;
    formatTime: (time: number) => string;
    onPrevSong: () => void;
    onNextSong: () => void;
    onShuffle: () => void;
    onOpenImportDialog: () => void;
    onVolumeChange: (volume: number) => void;
    onCoverLoadFailed: () => void;
};

export default function PlayerPanel({
    currentSong,
    currentSongCoverUrl,
    defaultCoverImage,
    progressPercentage,
    currentTime,
    volume,
    formatTime,
    onPrevSong,
    onNextSong,
    onShuffle,
    onOpenImportDialog,
    onVolumeChange,
    onCoverLoadFailed
}: PlayerPanelProps) {
    return (
        <div className="player-panel">
            <div className="player-header">
                <h2>正在播放</h2>
            </div>

            <div className="cover-container">
                {currentSongCoverUrl ? (
                    <img
                        src={currentSongCoverUrl}
                        alt={currentSong?.title ?? '播放器'}
                        className="cover-image"
                        onError={onCoverLoadFailed}
                    />
                ) : (
                    <div className="cover-placeholder">
                        <img src={defaultCoverImage} alt="播放器" className="placeholder-image" />
                    </div>
                )}
            </div>

            <div className="song-info">
                {currentSong ? (
                    <>
                        <h1 className="song-title">{currentSong.title}</h1>
                        <p className="song-artist">{currentSong.artist}</p>
                    </>
                ) : (
                    <>
                        <h1 className="song-title">未选择歌曲</h1>
                        <p className="song-artist">请从播放列表中选择歌曲</p>
                    </>
                )}
            </div>

            {currentSong && (
                <div className="progress-section">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                    <div className="time-info">
                        <span className="current-time">{formatTime(currentTime)}</span>
                        <span className="total-time">{formatTime(currentSong.duration || 0)}</span>
                    </div>
                </div>
            )}

            <div className="control-buttons">
                <button type="button" onClick={onPrevSong} className="control-btn prev-btn" title="上一首">
                    <span>⏮</span>
                </button>
                <button type="button" onClick={onNextSong} className="control-btn next-btn" title="下一首">
                    <span>⏭</span>
                </button>
            </div>

            <div className="volume-section">
                <label htmlFor="volume" className="volume-label">🔊</label>
                <input
                    id="volume"
                    type="range"
                    className="volume-slider"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(event) => onVolumeChange(Number(event.target.value))}
                    style={{ ['--volume' as string]: `${volume}%` }}
                />
                <span className="volume-value">{volume}%</span>
            </div>

            <div className="extra-controls">
                <button type="button" onClick={onShuffle} className="toggle-btn">
                    🔀 随机播放
                </button>
                <button type="button" onClick={onOpenImportDialog} className="toggle-btn">
                    📂 导入歌曲
                </button>
            </div>
        </div>
    );
}
