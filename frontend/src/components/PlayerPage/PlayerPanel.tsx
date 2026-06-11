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

const TOGGLE_BTN = 'bg-white cursor-pointer py-2.5 px-3.5 border border-border rounded-lg text-[13px] text-text-secondary font-medium -translate-y-1.5';

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
        <>
            <style>{`
.volume-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#6366F1;cursor:pointer}
.volume-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#6366F1;cursor:pointer;border:none}
`}</style>
            <div className="bg-white rounded-2xl flex flex-col items-center flex-[0_0_360px] px-6 shadow-panel">
                <div className="w-full mb-5">
                    <h2 className="m-0 text-center text-2xl text-text-primary">正在播放</h2>
                </div>

                <div className="rounded-2xl flex items-center justify-center overflow-hidden w-60 h-60 mb-6 shadow-cover bg-[#f0f0f0]">
                    {currentSongCoverUrl ? (
                        <img
                            src={currentSongCoverUrl}
                            alt={currentSong?.title ?? '播放器'}
                            className="w-full h-full object-cover"
                            onError={onCoverLoadFailed}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-gray">
                            <img src={defaultCoverImage} alt="播放器" className="opacity-50 w-[200px] h-[200px]" />
                        </div>
                    )}
                </div>

                <div className="w-full text-center mb-6">
                    {currentSong ? (
                        <>
                            <h1 className="m-0 font-bold text-[22px] text-text-primary break-words">{currentSong.title}</h1>
                            <p className="m-0 text-sm text-text-quaternary">{currentSong.artist}</p>
                        </>
                    ) : (
                        <>
                            <h1 className="m-0 font-bold text-[22px] text-text-primary break-words">未选择歌曲</h1>
                            <p className="m-0 text-sm text-text-quaternary">请从播放列表中选择歌曲</p>
                        </>
                    )}
                </div>

                {currentSong && (
                    <div className="w-full mb-5">
                        <div className="w-full overflow-hidden h-1.5 bg-[#e0e0e0] rounded-[3px] mb-3">
                            <div className="h-full bg-primary rounded-[3px] transition-[width] duration-100 ease-linear" style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-text-quaternary">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(currentSong.duration || 0)}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-center gap-[30px] mb-6">
                    <button type="button" onClick={onPrevSong} className="border-none rounded-full cursor-pointer flex items-center justify-center w-[60px] h-[60px] bg-primary text-white" title="上一首">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
                        </svg>
                    </button>
                    <button type="button" onClick={onNextSong} className="border-none rounded-full cursor-pointer flex items-center justify-center w-[60px] h-[60px] bg-primary text-white" title="下一首">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 18l8.5-6L6 6v12zm2-1.14L13.09 12 8 7.14v9.72z" />
                            <path d="M16 6h2v12h-2V6z" />
                        </svg>
                    </button>
                </div>

                <div className="w-full flex items-center gap-3 rounded-lg">
                    <label htmlFor="volume" className="flex-shrink-0 text-xl">🔊</label>
                    <input
                        id="volume"
                        type="range"
                        className="volume-slider flex-1 outline-none h-1.5 rounded-[3px] appearance-none"
                        min={0}
                        max={100}
                        value={volume}
                        onChange={(event) => onVolumeChange(Number(event.target.value))}
                        style={{ background: `linear-gradient(90deg, #6366F1 0%, #6366F1 ${volume}%, #ddd ${volume}%, #ddd 100%)` }}
                    />
                    <span className="font-semibold text-right text-[13px] text-text-secondary min-w-[40px]">{volume}%</span>
                </div>

                <div className="w-full flex flex-col gap-3">
                    <button type="button" onClick={onShuffle} className={TOGGLE_BTN}>
                        🔀 随机播放
                    </button>
                    <button type="button" onClick={onOpenImportDialog} className={TOGGLE_BTN}>
                        📂 导入歌曲
                    </button>
                </div>
            </div>
        </>
    );
}
