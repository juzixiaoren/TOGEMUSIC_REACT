import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import { useAudio } from '../../context/AudioContext';
import { useSocket } from '../../context/SocketContext';
import type { SocketEventHandlers } from '../../context/SocketContext';
import audioimg from '../../assets/images/audioimg.png';
import DrawerSearchPanel from './DrawerSearchPanel';
import PlayerPanel from './PlayerPanel';
import PlaylistPanel from './PlaylistPanel';
import OnlineUsers from '../OnlineUsers/OnlineUsers';
import type { Playlist, Song } from './types';
const MAIN_PLAYLIST_ID = 1;

export default function PlayerPage() {
    const { setMessage } = useMessage();
    const {
        volume,
        currentTime,
        playSong,
        stopPlayback,
        setOnEndedCallback,
        handleSetVolume,
        nextSong,
        prevSong,
        shufflePlaylist
    } = useAudio();
    const {
        registerEventHandlers,
        unregisterEventHandlers,
        onlineUsers
    } = useSocket();

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [currentPlaylist, setCurrentPlaylist] = useState<Song[]>([]);
    const [selectedSongs, setSelectedSongs] = useState<number[]>([]);
    const [expandedPlaylist, setExpandedPlaylist] = useState<number | null>(null);
    const [playlistSongsMap, setPlaylistSongsMap] = useState<Record<number, Song[]>>({});
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [currentSongCoverUrl, setCurrentSongCoverUrl] = useState<string | null>(null);
    const hasInitializedRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const endedFallbackTimerRef = useRef<number | null>(null);
    const currentSongIdRef = useRef<number | null>(null);
    const [allSongs, setAllSongs] = useState<Song[]>([]);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const clearEndedFallbackTimer = useCallback(() => {
        if (endedFallbackTimerRef.current !== null) {
            window.clearTimeout(endedFallbackTimerRef.current);
            endedFallbackTimerRef.current = null;
        }
    }, []);

    const authHeader = useMemo(
        () => ({ Authorization: localStorage.getItem('token') || '' }),
        []
    );

    const loadAllSongs = useCallback(async () => {
        try {
            const response = await axios.get('/songs', { headers: authHeader });
            setAllSongs(response.data as Song[]);
        } catch {
            setMessage('加载歌曲失败', 'error');
        }
    }, [authHeader, setMessage]);

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

    // 获取封面图（本地失败时，QQ 歌曲回退到官方封面）
    const fetchSongCover = useCallback(async (song: Song) => {
        const songId = song.id;
        const isQQSong = (song.title || '').endsWith('[qq]') || (song.file_path || '').includes('qq.com');
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
            if (currentSongIdRef.current !== songId) {
                return;
            }

            if (!isQQSong) {
                setCurrentSongCoverUrl(null);
                return;
            }

            try {
                const qqCoverResp = await axios.get(`/qqmusic/cover/${songId}`, { headers: authHeader });
                if (currentSongIdRef.current !== songId) {
                    return;
                }
                const cover = qqCoverResp.data?.cover;
                setCurrentSongCoverUrl(typeof cover === 'string' && cover ? cover : null);
            } catch {
                if (currentSongIdRef.current === songId) {
                    setCurrentSongCoverUrl(null);
                }
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
        // 无论播放是否成功，都先设置当前歌曲信息和封面
        setCurrentSong(song);
        currentSongIdRef.current = song.id;
        setCurrentSongCoverUrl(null);
        void fetchSongCover(song);

        const success = await playSong(song, offset);
        if (!success) {
            console.warn('播放失败（可能被浏览器自动播放限制阻止），歌曲信息和封面已更新');
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
            const data = response.data;
            const list = Array.isArray(data) ? data : (data.items || []);
            setPlaylists(list as Playlist[]);
        } catch {
            try {
                const fallbackResponse = await axios.get('/playlists', { headers: authHeader });
                const data = fallbackResponse.data;
                const list = Array.isArray(data) ? data : (data.items || []);
                setPlaylists(list as Playlist[]);
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
        if (playlistId === -1) {//虚拟歌单
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
            setDrawerOpen(false);
            setSelectedSongs([]);
            setMessage('导入歌曲成功', 'success');
        } catch {
            setMessage('导入歌曲失败', 'error');
        }
    }, [authHeader, loadDefaultPlaylist, selectedSongs, setMessage]);

    // 检查播放状态并同步
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
                const success = await playWithOffset(song, offset);
                if (success) {
                    setMessage('已同步播放状态', 'success');
                } else {
                    setMessage('已同步歌曲信息（点击页面任意位置解锁播放）', 'warning');
                }

            } else {
                console.log('服务器未在播放');
            }
        } catch (err) {
            console.warn('检查播放状态失败:', err);
        }
    }, [authHeader, playWithOffset, setMessage]);

    const scheduleEndedFallbackSync = useCallback(() => {
        clearEndedFallbackTimer();

        // 记录当前歌曲，5 秒后若还未切歌，主动拉一次播放状态。
        const endedSongId = currentSongIdRef.current;
        endedFallbackTimerRef.current = window.setTimeout(() => {
            endedFallbackTimerRef.current = null;
            if (endedSongId !== null && currentSongIdRef.current === endedSongId) {
                console.log('5秒内未收到新歌事件，主动同步播放状态');
                void checkAndSyncPlayStatus();
            }
        }, 5000);
    }, [checkAndSyncPlayStatus, clearEndedFallbackTimer]);

    useEffect(() => {
        setOnEndedCallback(() => {
            scheduleEndedFallbackSync();
        });

        return () => {
            setOnEndedCallback(null);
            clearEndedFallbackTimer();
        };
    }, [clearEndedFallbackTimer, scheduleEndedFallbackSync, setOnEndedCallback]);

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
                clearEndedFallbackTimer();
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
                clearEndedFallbackTimer();
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
                    clearEndedFallbackTimer();
                    const serverNow = data.server_now;
                    const startTime = new Date(data.play_start_time).getTime();
                    const offset = Math.max(0, Math.floor((serverNow - startTime) / 1000));

                    // playWithOffset 内部会设置 currentSong 和获取封面
                    const success = await playWithOffset(data.current_song, offset);
                    if (success) {
                        setMessage('已同步播放状态', 'success');
                    } else {
                        setMessage('已同步歌曲信息（点击页面任意位置解锁播放）', 'warning');
                    }
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
        clearEndedFallbackTimer,
        playWithOffset,
        registerEventHandlers,
        rotatePlaylistTo,
        setMessage,
        stopPlayback,
        unregisterEventHandlers
    ]);


    // 初始加载
    useEffect(() => {
        if (hasInitializedRef.current) {
            return;
        }
        hasInitializedRef.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void Promise.all([loadPlaylists(), loadDefaultPlaylist(), loadAllSongs()]).then(() => {
            // 加载完成后检查并同步播放状态
            setTimeout(() => {
                void checkAndSyncPlayStatus();
            }, 1000);
        });
    }, []);

    const syncPlaylistsAndStatus = useCallback(async () => {
        setLoading(true);
        void Promise.all([loadPlaylists(), loadDefaultPlaylist(), loadAllSongs()]).then(() => {
            // 加载完成后检查并同步播放状态
            setTimeout(() => {
                void checkAndSyncPlayStatus();
            }, 1000);
        });
        setLoading(false);
    }, [loadDefaultPlaylist, loadPlaylists, loadAllSongs, checkAndSyncPlayStatus]);


    return (
        <>
            <div className="relative w-full overflow-hidden min-h-[620px] rounded-3xl p-6 max-[1100px]:flex-col max-[1100px]:p-4 max-[1100px]:rounded-[20px] max-[1100px]:min-h-0">
                <div className={`flex gap-6 w-full min-h-[572px] transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] max-[1100px]:flex-col max-[1100px]:min-h-0 ${drawerOpen ? '-translate-x-[400px]' : ''}`}>
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
                        onOpenImportDialog={() => setDrawerOpen(true)}
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
                            if (draggedIndex === null || draggedIndex === targetIndex) return;
                            if (draggedIndex === 0 || targetIndex === 0) return;
                            const newPlaylist = [...currentPlaylist];
                            const [draggedSong] = newPlaylist.splice(draggedIndex, 1);
                            if (!draggedSong) return;
                            newPlaylist.splice(targetIndex, 0, draggedSong);
                            setCurrentPlaylist(newPlaylist);
                            setDraggedIndex(null);
                            void syncPlaylistOrder(newPlaylist);
                        }}
                        onDragEnd={() => setDraggedIndex(null)}
                    />
                </div>

                <button
                    type="button"
                    className="absolute cursor-pointer flex items-center justify-center right-6 top-1/2 -translate-y-1/2 w-[18px] h-[50px] bg-primary-light border border-primary-light-2 border-r-0 rounded-l-lg text-primary-hover text-[10px] z-10 transition-all duration-200 hover:bg-primary-light-2 hover:text-primary-muted hover:w-[22px] max-[1100px]:w-full max-[1100px]:min-h-0 max-[1100px]:h-7 max-[1100px]:rounded-b-[14px] max-[1100px]:order-[-1] max-[1100px]:right-0 max-[1100px]:top-0 max-[1100px]:translate-y-0"
                    onClick={() => setDrawerOpen(!drawerOpen)}
                    title={drawerOpen ? '关闭' : '打开导入与搜索'}
                >
                    {drawerOpen ? '▶' : '◀'}
                </button>

                <DrawerSearchPanel
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    playlists={playlists}
                    allSongs={allSongs}
                    expandedPlaylist={expandedPlaylist}
                    playlistSongsMap={playlistSongsMap}
                    selectedSongs={selectedSongs}
                    onTogglePlaylistExpand={(playlistId) => { void togglePlaylistExpand(playlistId); }}
                    onSelectAllFromPlaylist={selectAllFromPlaylist}
                    onClearSelectionFromPlaylist={clearSelectionFromPlaylist}
                    onToggleSong={toggleSongSelection}
                    onImportSelectedSongs={() => { void importSelectedSongs(); }}
                    onSongImported={() => { void syncPlaylistsAndStatus(); }}
                />
            </div>

            <OnlineUsers users={onlineUsers} />

            <button onClick={syncPlaylistsAndStatus} disabled={loading} className="h-[50px] border border-[rgb(29,178,185)] bg-[rgb(29,185,178)] text-white rounded-lg cursor-pointer block mx-auto">
                {loading ? '同步中' : '同步歌单和播放状态'}
            </button>
        </>
    );
}