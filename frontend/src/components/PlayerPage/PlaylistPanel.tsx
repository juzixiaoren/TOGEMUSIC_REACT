import type { DragEvent } from 'react';
import type { Song } from './types';
import Pagination from '../PlaylistManager/Pagination';

const CL = {
    panel: 'bg-surface rounded-2xl flex flex-col min-w-0 flex-1 p-6 shadow-panel max-[1100px]:w-full',
    header: 'flex justify-between items-center mb-5 border-b-2 border-surface-gray pb-3',
    actions: 'flex gap-2.5',
    actionBtn: 'bg-surface-elevated cursor-pointer py-2.5 px-3.5 border border-border rounded-lg text-[13px] text-text-secondary font-medium -translate-y-1.5 hover:bg-surface-elevated-hover',
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
    // 分页相关
    totalSongs: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    // 搜索相关
    searchQuery: string;
    onSearchChange: (query: string) => void;
    // 置顶/置底
    onPinToTop: (songId: number) => void;
    onPinToBottom: (songId: number) => void;
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
    onDragEnd,
    totalSongs,
    currentPage,
    pageSize: _pageSize,
    totalPages,
    onPageChange,
    searchQuery,
    onSearchChange,
    onPinToTop,
    onPinToBottom
}: PlaylistPanelProps) {
    return (
        <div className={CL.panel}>
            <div className={CL.header}>
                <div className="flex items-center gap-4">
                    <h2 className="m-0 text-xl text-text-primary">播放列表</h2>
                    <span className="text-sm text-text-quaternary">
                        共 {totalSongs} 首
                    </span>
                </div>
                <div className={CL.actions}>
                    <button type="button" onClick={onStopPlay} className={CL.actionBtn} title="暂停播放">|| 暂停</button>
                    <button type="button" onClick={onPlay} className={CL.actionBtn} title="开始播放">▶ 播放</button>
                    <button type="button" onClick={onClear} className={CL.actionBtn} title="清空列表">🗑 清空</button>
                </div>
            </div>

            {/* 搜索框 */}
            <div className="mb-3">
                <input
                    type="text"
                    className="w-full py-2 px-3 text-sm border border-border rounded-lg outline-none focus:border-primary placeholder:text-text-muted"
                    placeholder="搜索歌名或歌手..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <ul className={CL.queue}>
                {displayPlaylist.map((song, index) => {
                    const draggable = index > 0;
                    const isCurrentSong = song.id === currentSongId;
                    return (
                        <li
                            key={song.id}
                            className={`${CL.item}${isCurrentSong ? ` ${CL.itemCurrent}` : ''}${draggable ? ` ${CL.itemDraggable}` : ''}`}
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
                                {/* 置顶/置底按钮（当前播放歌曲不显示） */}
                                {!isCurrentSong && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onPinToTop(song.id)}
                                            className="w-7 h-7 border-none rounded-md cursor-pointer flex items-center justify-center bg-surface-elevated text-text-secondary hover:bg-primary hover:text-white transition-colors duration-150"
                                            title="置顶"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 19V5M5 12l7-7 7 7" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onPinToBottom(song.id)}
                                            className="w-7 h-7 border-none rounded-md cursor-pointer flex items-center justify-center bg-surface-elevated text-text-secondary hover:bg-primary hover:text-white transition-colors duration-150"
                                            title="置底"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 5v14M19 12l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </>
                                )}
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
                    <p>{searchQuery.trim() ? '无匹配歌曲' : '播放列表为空，请导入歌曲'}</p>
                </div>
            )}
            
            {totalPages > 1 && (
                <div className="mt-4">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            )}
        </div>
    );
}
