import type { DragEvent } from 'react';
import type { Song } from './types';

const CL = {
    panel: 'bg-surface rounded-2xl flex flex-col min-w-0 flex-1 p-6 shadow-panel max-[1100px]:w-full',
    header: 'flex justify-between items-center mb-5 border-b-2 border-surface-gray pb-3',
    actions: 'flex gap-2.5',
    actionBtn: 'bg-surface cursor-pointer py-2.5 px-3.5 border border-border rounded-lg text-[13px] text-text-secondary font-medium -translate-y-1.5',
    queue: 'list-none p-0 m-0 flex-1 overflow-y-auto',
    item: 'flex items-center p-3 px-[15px] mb-2 bg-surface-muted rounded-lg',
    itemCurrent: 'bg-primary/10 border-l-4 border-primary',
    itemDraggable: 'cursor-move',
    number: 'flex-shrink-0 w-[35px] text-center text-text-quaternary text-xs font-semibold',
    details: 'flex-1 min-w-0 mx-[15px]',
    songName: 'whitespace-nowrap overflow-hidden text-ellipsis font-medium text-[13px] text-text-primary',
    songArtist: 'whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 text-[11px] text-text-quaternary',
    controls: 'flex items-center gap-3 flex-shrink-0',
    duration: 'text-right w-[50px] text-xs text-text-quaternary',
    deleteBtn: 'w-8 h-8 border-none rounded-full cursor-pointer flex items-center justify-center bg-delete text-white text-sm',
    empty: 'flex items-center justify-center h-[150px] text-text-quaternary text-sm',
};

type PlaylistPanelProps = {
    displayPlaylist: Song[];
    currentSongId: number | null;
    formatTime: (time: number) => string;
    onPlay: () => void;
    onStopPlay: () => void;
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
    onStopPlay,
    onClear,
    onDeleteSong,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd
}: PlaylistPanelProps) {
    return (
        <div className={CL.panel}>
            <div className={CL.header}>
                <h2 className="m-0 text-xl text-text-primary">播放列表</h2>
                <div className={CL.actions}>
                    <button type="button" onClick={onStopPlay} className={CL.actionBtn} title="暂停播放">|| 暂停</button>
                    <button type="button" onClick={onPlay} className={CL.actionBtn} title="开始播放">▶ 播放</button>
                    <button type="button" onClick={onClear} className={CL.actionBtn} title="清空列表">🗑 清空</button>
                </div>
            </div>

            <ul className={CL.queue}>
                {displayPlaylist.map((song, index) => {
                    const draggable = index > 0;
                    return (
                        <li
                            key={song.id}
                            className={`${CL.item}${song.id === currentSongId ? ` ${CL.itemCurrent}` : ''}${draggable ? ` ${CL.itemDraggable}` : ''}`}
                            draggable={draggable}
                            onDragStart={() => onDragStart(index)}
                            onDragOver={onDragOver}
                            onDrop={() => onDrop(index)}
                            onDragEnd={onDragEnd}
                        >
                            <div className={CL.number}>{index + 1}</div>
                            <div className={CL.details}>
                                <div className={CL.songName}>{song.title}</div>
                                <div className={CL.songArtist}>{song.artist}</div>
                            </div>
                            <div className={CL.controls}>
                                <span className={CL.duration}>{formatTime(song.duration || 0)}</span>
                                <button
                                    type="button"
                                    onClick={() => onDeleteSong(song.id)}
                                    className={CL.deleteBtn}
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
                <div className={CL.empty}>
                    <p>播放列表为空，请导入歌曲</p>
                </div>
            )}
        </div>
    );
}
