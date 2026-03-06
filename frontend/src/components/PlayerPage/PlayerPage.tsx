import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import { useAudio } from '../../context/AudioContext';
import { useSocket } from '../../context/SocketContext';
import type { SocketEventHandlers } from '../../context/SocketContext';
import audioimg from '../../assets/images/audioimg.png';
import ImportSongsDialog from './ImportSongsDialog';
import PlayerPanel from './PlayerPanel';
import PlaylistPanel from './PlaylistPanel';
import type { Playlist, Song } from './types';
import './PlayerPage.css';

const MAIN_PLAYLIST_ID = 1;

export default function PlayerPage() {
    const { setMessage } = useMessage();
    const {
        volume,
        currentTime,
        playSong,
        stopPlayback,
        handleSetVolume,
        setOnEndedCallback,
        nextSong,
        prevSong,
        shufflePlaylist
    } = useAudio();
    const {
        emitSongEnded,
        registerEventHandlers,
        unregisterEventHandlers
    } = useSocket();

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [currentPlaylist, setCurrentPlaylist] = useState<Song[]>([]);
    const [showSelectDialog, setShowSelectDialog] = useState(false);
    const [selectedSongs, setSelectedSongs] = useState<number[]>([]);
    const [expandedPlaylist, setExpandedPlaylist] = useState<number | null>(null);
    const [playlistSongsMap, setPlaylistSongsMap] = useState<Record<number, Song[]>>({});
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [currentSongCoverUrl, setCurrentSongCoverUrl] = useState<string | null>(null);
    const hasInitializedRef = useRef(false);

    const currentSongIdRef = useRef<number | null>(null);

    const authHeader = useMemo(
        () => ({ Authorization: localStorage.getItem('token') || '' }),
        []
    );

    const displayPlaylist = useMemo(() => {
        if (!currentSong) {
            return currentPlaylist;
        }
        const remaining = currentPlaylist.filter((song) => song.id !== currentSong.id);
        return [currentSong, ...remaining];
    }, [currentPlaylist, currentSong]);

    const progressPercentage = useMemo(() => {
        if (!currentSong || !currentSong.duration) {
            return 0;
        }
        const durationInSeconds = currentSong.duration > 3600 ? currentSong.duration / 1000 : currentSong.duration;
        if (!durationInSeconds) {
            return 0;
        }
        return Math.min(100, (currentTime / durationInSeconds) * 100);
    }, [currentSong, currentTime]);

    const formatTime = useCallback((timeValue: number) => {
        const seconds = timeValue > 3600 ? timeValue / 1000 : timeValue;
        if (!seconds || Number.isNaN(seconds)) {
            return '0:00';
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // 获取封面图
    const fetchSongCover = useCallback(async (songId: number) => {
        try {
            const response = await axios.get(`/songs/${songId}/cover`, { headers: authHeader });
            if (currentSongIdRef.current !== songId) {
                return;
            }
            if (response.data && response.data.cover) {
                setCurrentSongCoverUrl(response.data.cover as string);
            } else {
                setCurrentSongCoverUrl(null);
            }
        } catch {
            if (currentSongIdRef.current === songId) {
                setCurrentSongCoverUrl(null);
            }
        }
    }, [authHeader]);

    // 旋转播放列表让指定歌曲到首位
    const rotatePlaylistTo = useCallback((songId: number) => {
        setCurrentPlaylist((prev) => {
            if (!prev || prev.length === 0) return prev;
            const idx = prev.findIndex((s) => s.id === songId);
            if (idx <= 0) {
                if (idx === 0) {
                    setCurrentSong(prev[0]);
                    currentSongIdRef.current = prev[0].id;
                }
                return prev;
            }
            const head = prev.slice(idx);
            const tail = prev.slice(0, idx);
            const newPlaylist = [...head, ...tail];
            setCurrentSong(newPlaylist[0]);
            currentSongIdRef.current = newPlaylist[0].id;
            return newPlaylist;
        });
    }, []);

    // 播放歌曲（带进度偏移）
    const playWithOffset = useCallback(async (song: Song, offset = 0) => {
        const success = await playSong(song, offset);
        if (success) {
            setCurrentSong(song);
            currentSongIdRef.current = song.id;
            setCurrentSongCoverUrl(null);
            void fetchSongCover(song.id);
        }
        return success;
    }, [fetchSongCover, playSong]);

    // 同步播放列表顺序到后端
    const syncPlaylistOrder = useCallback(async (songs: Song[]) => {
        try {
            await axios.post('/reorderPlaylist', {
                playlist_id: MAIN_PLAYLIST_ID,
                song_ids: songs.map((song) => song.id)
            }, { headers: authHeader });
        } catch {
            setMessage('同步播放列表顺序失败', 'warning');
        }
    }, [authHeader, setMessage]);

    // 加载默认播放列表
    const loadDefaultPlaylist = useCallback(async () => {
        try {
            const response = await axios.get(`/playlists/${MAIN_PLAYLIST_ID}`, { headers: authHeader });
            const songs = (response.data?.songs || []) as Song[];
            setCurrentPlaylist(songs);
            if (songs.length === 0) {
                setCurrentSong(null);
                stopPlayback();
                return;
            }
            if (!currentSongIdRef.current || !songs.some((song) => song.id === currentSongIdRef.current)) {
                setCurrentSong(songs[0]);
                currentSongIdRef.current = songs[0].id;
            }
        } catch {
            setMessage('加载默认歌单失败', 'error');
        }
    }, [authHeader, setMessage, stopPlayback]);

    // 加载所有歌单
    const loadPlaylists = useCallback(async () => {
        try {
            const response = await axios.get('/getAllPlaylists', { headers: authHeader });
            setPlaylists(response.data as Playlist[]);
        } catch {
            try {
                const fallbackResponse = await axios.get('/playlists', { headers: authHeader });
                setPlaylists(fallbackResponse.data as Playlist[]);
            } catch {
                setMessage('加载歌单失败', 'error');
            }
        }
    }, [authHeader, setMessage]);

    // 清空播放列表
    const clearPlaylist = useCallback(async () => {
        try {
            const response = await axios.get('/clearplaylist', { headers: authHeader });
            if (response.data?.success) {
                setCurrentPlaylist([]);
                setCurrentSong(null);
                stopPlayback();
                setMessage('播放列表已清空', 'success');
            } else {
                setMessage('清除播放列表失败: ' + (response.data?.message || '未知错误'), 'error');
            }
        } catch {
            setMessage('清除播放列表失败', 'error');
        }
    }, [authHeader, setMessage, stopPlayback]);

    // 删除单首歌曲
    const deleteSong = useCallback(async (songId: number) => {
        try {
            const response = await axios.post('/removesongfromplaylist', {
                playlist_id: MAIN_PLAYLIST_ID,
                song_id: songId
            }, {
                headers: authHeader
            });
            if (response.data?.success) {
                setMessage('歌曲已删除', 'success');
            } else {
                setMessage(response.data?.message || '删除失败', 'error');
            }
        } catch {
            setMessage('删除歌曲失败', 'error');
        }
    }, [authHeader, setMessage]);

    // 展开/收起歌单
    const togglePlaylistExpand = useCallback(async (playlistId: number) => {
        if (expandedPlaylist === playlistId) {
            setExpandedPlaylist(null);
            return;
        }

        setExpandedPlaylist(playlistId);
        if (playlistSongsMap[playlistId]) {
            return;
        }

        try {
            const response = await axios.get(`/playlists/${playlistId}`, { headers: authHeader });
            const songs = (response.data?.songs || []) as Song[];
            setPlaylistSongsMap((prev) => ({
                ...prev,
                [playlistId]: songs
            }));
            setMessage('歌单的歌曲加载完成', 'success');
        } catch {
            setMessage('加载歌单失败', 'error');
        }
    }, [authHeader, expandedPlaylist, playlistSongsMap, setMessage]);

    const selectAllFromPlaylist = useCallback((playlistId: number) => {
        const songs = playlistSongsMap[playlistId] || [];
        setSelectedSongs((prev) => {
            const merged = new Set([...prev, ...songs.map((song) => song.id)]);
            return [...merged];
        });
    }, [playlistSongsMap]);

    const clearSelectionFromPlaylist = useCallback((playlistId: number) => {
        const songs = playlistSongsMap[playlistId] || [];
        const songIdSet = new Set(songs.map((song) => song.id));
        setSelectedSongs((prev) => prev.filter((songId) => !songIdSet.has(songId)));
    }, [playlistSongsMap]);

    const toggleSongSelection = useCallback((songId: number, checked: boolean) => {
        setSelectedSongs((prev) => {
            if (checked) {
                if (prev.includes(songId)) {
                    return prev;
                }
                return [...prev, songId];
            }
            return prev.filter((id) => id !== songId);
        });
    }, []);

    const importSelectedSongs = useCallback(async () => {
        if (selectedSongs.length === 0) {
            setMessage('请选择要导入的歌曲', 'warning');
            return;
        }
        try {
            await axios.post(`/playlists/${MAIN_PLAYLIST_ID}/songs`, {
                songIds: selectedSongs
            }, {
                headers: authHeader
            });
            await loadDefaultPlaylist();
            setShowSelectDialog(false);
            setSelectedSongs([]);
            setMessage('导入歌曲成功', 'success');
        } catch {
            setMessage('导入歌曲失败', 'error');
        }
    }, [authHeader, loadDefaultPlaylist, selectedSongs, setMessage]);

    // 检查播放状态并同步
    const checkAndSyncPlayStatus = useCallback(async () => {
        try {
            const res = await axios.get('/getplaystatus', { headers: authHeader });
            const status = res.data;
            console.log(res);

            if (status.is_playing === 1 && status.current_song) {
                // 服务器正在播放，计算偏移量并同步
                const serverNow = status['server_now'] as number;
                const startTime = new Date(status['play_start_time'] as string).getTime();
                const offset = Math.max(0, Math.floor((serverNow - startTime) / 1000));
                console.log(`本地播放进度: ${currentTime}s, 服务器播放进度: ${offset}s, 需要同步`);

                console.log(`同步播放进度: offset=${offset}s`);

                const song = status.current_song as Song;
                await playWithOffset(song, offset);
                setMessage('已同步播放状态', 'success');

            } else {
                console.log('服务器未在播放');
            }
        } catch (err) {
            console.warn('检查播放状态失败:', err);
        }
    }, [authHeader, playWithOffset, setMessage]);

    // 开始播放（请求后端开始）
    const startPlay = useCallback(async () => {
        if (currentPlaylist.length === 0) {
            setMessage('播放列表为空，请先导入歌曲', 'warning');
            return;
        }
        try {
            // 请求后端开始播放
            await axios.post('/requestplay', {
                song_ids: currentPlaylist.map((song) => song.id)
            }, {
                headers: authHeader
            });

            // 等待一段时间后同步播放状态
            setTimeout(() => {
                void checkAndSyncPlayStatus();
            }, 500);
        } catch {
            setMessage('请求播放失败', 'error');
        }
    }, [authHeader, checkAndSyncPlayStatus, currentPlaylist, setMessage]);

    // 注册 Socket 事件处理器
    useEffect(() => {
        const handlers: SocketEventHandlers = {
            // 歌曲切换事件
            onSongChanged: async (data) => {
                const songInfo = data.current_song;
                if (songInfo) {
                    setMessage(`🎵 正在播放: ${songInfo.title} - ${songInfo.artist}`, 'success');
                    rotatePlaylistTo(data.new_song_id);
                    await playWithOffset(songInfo, 0);
                } else {
                    // 从当前播放列表中查找
                    const newSong = currentPlaylist.find((s) => s.id === data.new_song_id);
                    if (newSong) {
                        rotatePlaylistTo(data.new_song_id);
                        await playWithOffset(newSong, 0);
                    } else {
                        setMessage('播放的歌曲不在当前播放列表中', 'error');
                    }
                }
            },

            // 播放列表打乱事件
            onPlaylistShuffled: (data) => {
                setMessage('播放顺序已更新', 'success');
                if (data.songs) {
                    setCurrentPlaylist(data.songs);
                }
            },

            // 歌曲删除且需要切歌事件
            onSongDeletedAndChanged: async (data) => {
                setCurrentPlaylist(data.playlist);

                if (data.new_song && data.new_song_id) {
                    rotatePlaylistTo(data.new_song_id);
                    setMessage(`🎵 歌曲已删除，自动切歌: ${data.new_song.title} - ${data.new_song.artist}`, 'success');
                    await playWithOffset(data.new_song, 0);
                } else {
                    setMessage('⚠️ 歌曲已删除，播放列表已清空', 'warning');
                    stopPlayback();
                    setCurrentSong(null);
                }
            },

            // 播放列表更新事件（歌曲删除但非当前播放）
            onPlaylistUpdated: (data) => {
                setCurrentPlaylist(data.playlist);
                setMessage('🎵 歌曲已从列表删除', 'success');
            },

            // 初始播放状态同步
            onSyncPlayStatus: async (data) => {
                if (data.is_playing && data.current_song) {
                    const serverNow = data.server_now;
                    const startTime = new Date(data.play_start_time).getTime();
                    const offset = Math.max(0, Math.floor((serverNow - startTime) / 1000));

                    setCurrentSong(data.current_song);
                    await playWithOffset(data.current_song, offset);
                    setMessage('已同步播放状态', 'success');
                }
            },

            // 初始播放列表同步
            onSyncPlaylist: (data) => {
                setCurrentPlaylist(data.songs || []);
                setMessage('已同步播放列表', 'success');
            }
        };

        registerEventHandlers(handlers);

        return () => {
            unregisterEventHandlers();
        };
    }, [
        currentPlaylist,
        playWithOffset,
        registerEventHandlers,
        rotatePlaylistTo,
        setMessage,
        stopPlayback,
        unregisterEventHandlers
    ]);

    // 设置歌曲结束回调
    useEffect(() => {
        setOnEndedCallback(() => {
            console.log('歌曲播放结束，通知后端');
            emitSongEnded();
        });

        return () => {
            setOnEndedCallback(null);
        };
    }, [emitSongEnded, setOnEndedCallback]);

    // 初始加载
    useEffect(() => {
        if (hasInitializedRef.current) {
            return;
        }
        hasInitializedRef.current = true;
        void Promise.all([loadPlaylists(), loadDefaultPlaylist()]).then(() => {
            // 加载完成后检查并同步播放状态
            setTimeout(() => {
                void checkAndSyncPlayStatus();
            }, 1000);
        });
    }, []);


    return (
        <>
            <div className="player-page">
                <PlayerPanel
                    currentSong={currentSong}
                    currentSongCoverUrl={currentSongCoverUrl}
                    defaultCoverImage={audioimg}
                    progressPercentage={progressPercentage}
                    currentTime={currentTime}
                    volume={volume}
                    formatTime={formatTime}
                    onPrevSong={prevSong}
                    onNextSong={nextSong}
                    onShuffle={shufflePlaylist}
                    onOpenImportDialog={() => setShowSelectDialog(true)}
                    onVolumeChange={handleSetVolume}
                    onCoverLoadFailed={() => setCurrentSongCoverUrl(null)}
                />
                <PlaylistPanel
                    displayPlaylist={displayPlaylist}
                    currentSongId={currentSong?.id ?? null}
                    formatTime={formatTime}
                    onStopPlay={() => { void stopPlayback(); }}
                    onPlay={() => { void startPlay(); }}
                    onClear={() => { void clearPlaylist(); }}
                    onDeleteSong={(songId) => { void deleteSong(songId); }}
                    onDragStart={(index) => setDraggedIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(targetIndex) => {
                        if (draggedIndex === null || draggedIndex === targetIndex) {
                            return;
                        }
                        if (draggedIndex === 0 || targetIndex === 0) {
                            return;
                        }
                        const newPlaylist = [...currentPlaylist];
                        const [draggedSong] = newPlaylist.splice(draggedIndex, 1);
                        if (!draggedSong) {
                            return;
                        }
                        newPlaylist.splice(targetIndex, 0, draggedSong);
                        setCurrentPlaylist(newPlaylist);
                        setDraggedIndex(null);
                        void syncPlaylistOrder(newPlaylist);
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                />
            </div>

            <ImportSongsDialog
                isOpen={showSelectDialog}
                playlists={playlists}
                expandedPlaylist={expandedPlaylist}
                playlistSongsMap={playlistSongsMap}
                selectedSongs={selectedSongs}
                onTogglePlaylistExpand={(playlistId) => { void togglePlaylistExpand(playlistId); }}
                onSelectAllFromPlaylist={selectAllFromPlaylist}
                onClearSelectionFromPlaylist={clearSelectionFromPlaylist}
                onToggleSong={toggleSongSelection}
                onImportSelectedSongs={() => { void importSelectedSongs(); }}
                onClose={() => setShowSelectDialog(false)}
            />
        </>
    );
}