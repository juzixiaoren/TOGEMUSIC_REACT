import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useMessage } from '../../context/MessageContext';

const CL = {
    overlay: 'fixed inset-0 flex items-center justify-center bg-black/50 z-[1000]',
    dialog: 'flex flex-col bg-surface rounded-2xl w-[90%] max-w-[700px] max-h-[80vh] shadow-dialog-lg',
    header: 'flex items-center justify-between py-5 px-6 border-b border-border-light',
    headerTitle: 'm-0 font-semibold text-lg text-text-primary',
    closeBtn: 'w-8 h-8 border-none rounded-lg cursor-pointer flex items-center justify-center bg-surface-gray text-xl text-text-secondary hover:bg-surface-gray-hover hover:text-text-primary',
    body: 'flex-1 overflow-y-auto py-5 px-6',
    stepContent: 'min-h-[200px]',
    stepTitle: 'm-0 font-semibold mb-4 text-base text-text-primary',
    stepHeader: 'flex items-center gap-3 mb-4',
    stepHeaderTitle: 'flex-1 m-0',
    backBtn: 'bg-surface-elevated rounded-md cursor-pointer py-1.5 px-3 border border-border text-[13px] text-text-secondary hover:border-platform-qq hover:text-platform-qq',
    selectAllBtn: 'bg-surface-elevated rounded-md cursor-pointer py-1.5 px-3 border border-platform-qq text-[13px] text-platform-qq hover:bg-platform-qq hover:text-white',
    platformList: 'flex flex-col gap-3',
    platformItem: 'flex items-center gap-3 cursor-pointer p-4 border-2 border-border-light rounded-xl bg-surface-card transition-all duration-200',
    platformItemLogged: 'hover:border-platform-qq hover:bg-surface-green-light',
    platformItemNotLogged: 'opacity-60 cursor-not-allowed',
    platformIcon: 'text-2xl',
    platformName: 'font-semibold text-base text-text-primary',
    platformStatus: 'ml-auto text-[13px] text-text-tertiary',
    hintText: 'mt-4 text-center text-[13px] text-text-tertiary',
    playlistGrid: 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4',
    playlistCard: 'bg-surface-card cursor-pointer overflow-hidden p-0 text-left border-2 border-border-light rounded-xl transition-all duration-200 hover:border-platform-qq hover:-translate-y-0.5 hover:shadow-hover-card',
    playlistCover: 'relative overflow-hidden aspect-square',
    coverImg: 'w-full h-full object-cover',
    coverPlaceholder: 'w-full h-full flex items-center justify-center bg-primary text-4xl',
    songCount: 'absolute bottom-2 right-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded-[10px]',
    playlistName: 'font-medium overflow-hidden text-ellipsis whitespace-nowrap py-2.5 px-3 text-[13px] text-text-primary',
    songList: 'flex flex-col gap-1 overflow-y-auto max-h-[400px]',
    songItem: 'flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-background duration-200 hover:bg-surface-gray',
    songCheckbox: 'cursor-pointer w-[18px] h-[18px] accent-platform-qq',
    songInfo: 'flex-1 min-w-0',
    songTitle: 'font-medium overflow-hidden text-ellipsis whitespace-nowrap text-sm text-text-primary',
    songArtist: 'mt-0.5 text-xs text-text-tertiary',
    footer: 'flex items-center justify-between py-4 px-6 border-t border-border-light bg-surface-header rounded-b-2xl',
    selectedCount: 'text-sm text-text-secondary',
    footerBtns: 'flex gap-3',
    cancelBtn: 'bg-surface-elevated rounded-lg cursor-pointer py-2.5 px-5 border border-border text-sm text-text-secondary transition-all duration-200 hover:border-text-tertiary hover:text-text-primary',
    importBtn: 'border-none rounded-lg font-semibold cursor-pointer py-2.5 px-6 bg-platform-qq text-sm text-white transition-all duration-200 hover:-translate-y-px hover:shadow-active-green disabled:opacity-60 disabled:cursor-not-allowed',
    loadingText: 'text-center py-10 text-sm text-text-tertiary',
    emptyText: 'text-center py-10 text-sm text-text-tertiary',
};

type Platform = 'qqmusic' | 'netease';

type PlatformStatus = {
    platform: Platform;
    name: string;
    icon: string;
    logged_in: boolean;
    nickname: string;
};

type PlatformPlaylist = {
    id: string;
    name: string;
    song_count: number;
    cover: string;
};

type PlatformSong = {
    songmid?: string;      // QQ音乐
    song_id?: string | number; // 网易云音乐
    title: string;
    artist: string;
    album?: string;
    duration: number;
};

const platformConfig: Record<Platform, { name: string; icon: string }> = {
    qqmusic: { name: 'QQ音乐', icon: '🎵' },
    netease: { name: '网易云音乐', icon: '🎶' },
    // kugou: { name: '酷狗音乐', icon: '🎤' },
};

interface PlatformPlaylistImportProps {
    open: boolean;
    targetPlaylistId: number;
    targetPlaylistName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function PlatformPlaylistImport({
    open,
    targetPlaylistName,
    onConfirm,
    onCancel,
}: PlatformPlaylistImportProps) {
    const { setMessage } = useMessage();
    const authHeader = useMemo(() => ({ Authorization: localStorage.getItem('token') || '' }), []);

    const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
    const [activePlatform, setActivePlatform] = useState<Platform>('qqmusic');
    const [playlists, setPlaylists] = useState<PlatformPlaylist[]>([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState<PlatformPlaylist | null>(null);
    const [songs, setSongs] = useState<PlatformSong[]>([]);
    const [selectedSongmids, setSelectedSongmids] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<'select-platform' | 'select-playlist' | 'select-songs'>('select-platform');

    // 检查各平台登录状态
    const checkPlatformStatus = useCallback(async () => {
        const platformList: PlatformStatus[] = [];
        for (const [key, config] of Object.entries(platformConfig)) {
            try {
                const resp = await axios.get(`/music-login/${key}/status`, { headers: authHeader });
                platformList.push({
                    platform: key as Platform,
                    name: config.name,
                    icon: config.icon,
                    logged_in: resp.data.logged_in,
                    nickname: resp.data.nickname || '',
                });
            } catch {
                platformList.push({
                    platform: key as Platform,
                    name: config.name,
                    icon: config.icon,
                    logged_in: false,
                    nickname: '',
                });
            }
        }
        setPlatforms(platformList);
    }, [authHeader]);

    // 获取平台歌单
    const fetchPlaylists = useCallback(async (platform: Platform) => {
        setLoading(true);
        try {
            const resp = await axios.get(`/music-login/${platform}/playlists`, { headers: authHeader });
            setPlaylists(resp.data.playlists || []);
            setStep('select-playlist');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setMessage(err.response?.data?.message || '获取歌单失败', 'error');
        } finally {
            setLoading(false);
        }
    }, [authHeader, setMessage]);

    // 获取歌曲唯一ID（兼容不同平台字段名）
    const getSongId = (song: PlatformSong): string => {
        return String(song.songmid || song.song_id || '');
    };

    // 获取歌单中的歌曲
    const fetchPlaylistSongs = useCallback(async (platform: Platform, playlistId: string) => {
        setLoadingSongs(true);
        try {
            const resp = await axios.get(`/music-login/${platform}/playlist-songs`, {
                params: { playlist_id: playlistId },
                headers: authHeader,
            });
            const songsData: PlatformSong[] = resp.data.songs || [];
            setSongs(songsData);
            setSelectedSongmids(songsData.map((s: PlatformSong) => getSongId(s)));
            setStep('select-songs');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setMessage(err.response?.data?.message || '获取歌曲失败', 'error');
        } finally {
            setLoadingSongs(false);
        }
    }, [authHeader, setMessage]);

    useEffect(() => {
        if (open) {
            checkPlatformStatus();
            setStep('select-platform');
            setSelectedPlaylist(null);
            setSongs([]);
            setSelectedSongmids([]);
        }
    }, [open, checkPlatformStatus]);

    // 选择平台
    const handleSelectPlatform = (platform: Platform) => {
        setActivePlatform(platform);
        fetchPlaylists(platform);
    };

    // 选择歌单
    const handleSelectPlaylist = (playlist: PlatformPlaylist) => {
        setSelectedPlaylist(playlist);
        fetchPlaylistSongs(activePlatform, playlist.id);
    };

    // 切换歌曲选择
    const toggleSong = (songmid: string) => {
        setSelectedSongmids((prev) =>
            prev.includes(songmid) ? prev.filter((id) => id !== songmid) : [...prev, songmid]
        );
    };

    // 全选/取消全选
    const toggleAll = () => {
        if (selectedSongmids.length === songs.length) {
            setSelectedSongmids([]);
        } else {
            setSelectedSongmids(songs.map((s) => getSongId(s)));
        }
    };

    // 导入歌曲
    const handleImport = async () => {
        if (selectedSongmids.length === 0) {
            setMessage('请选择要导入的歌曲', 'warning');
            return;
        }

        setImporting(true);
        try {
            let imported = 0;
            let failed = 0;

            // 根据平台选择对应的导入接口
            const importEndpoint = activePlatform === 'qqmusic' ? '/qqmusic/import' : '/netease/import';

            for (const songId of selectedSongmids) {
                try {
                    await axios.post(importEndpoint, { songmid: songId }, { headers: authHeader });
                    imported++;
                } catch {
                    failed++;
                }
            }

            setMessage(`导入完成: 成功 ${imported} 首, 失败 ${failed} 首`, imported > 0 ? 'success' : 'error');
            if (imported > 0) {
                onConfirm();
            }
        } catch {
            setMessage('导入失败', 'error');
        } finally {
            setImporting(false);
        }
    };

    // 返回上一步
    const handleBack = () => {
        if (step === 'select-songs') {
            setStep('select-playlist');
            setSelectedPlaylist(null);
            setSongs([]);
        } else if (step === 'select-playlist') {
            setStep('select-platform');
            setPlaylists([]);
        }
    };

    if (!open) return null;

    return (
        <div className={CL.overlay}>
            <div className={CL.dialog}>
                <div className={CL.header}>
                    <h3 className={CL.headerTitle}>
                        导入歌单到「{targetPlaylistName}」
                    </h3>
                    <button className={CL.closeBtn} onClick={onCancel}>×</button>
                </div>

                <div className={CL.body}>
                    {/* 步骤1: 选择平台 */}
                    {step === 'select-platform' && (
                        <div className={CL.stepContent}>
                            <h4 className={CL.stepTitle}>选择音乐平台</h4>
                            <div className={CL.platformList}>
                                {platforms.map((p) => (
                                    <button
                                        key={p.platform}
                                        className={`${CL.platformItem} ${p.logged_in ? CL.platformItemLogged : CL.platformItemNotLogged}`}
                                        onClick={() => p.logged_in && handleSelectPlatform(p.platform)}
                                        disabled={!p.logged_in}
                                    >
                                        <span className={CL.platformIcon}>{p.icon}</span>
                                        <span className={CL.platformName}>{p.name}</span>
                                        <span className={CL.platformStatus}>
                                            {p.logged_in ? `已登录 (${p.nickname})` : '未登录'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <p className={CL.hintText}>
                                请先在「音乐平台」页面登录账号后再导入歌单
                            </p>
                        </div>
                    )}

                    {/* 步骤2: 选择歌单 */}
                    {step === 'select-playlist' && (
                        <div className={CL.stepContent}>
                            <div className={CL.stepHeader}>
                                <button className={CL.backBtn} onClick={handleBack}>← 返回</button>
                                <h4 className={CL.stepHeaderTitle}>选择歌单 ({platformConfig[activePlatform].name})</h4>
                            </div>
                            {loading ? (
                                <div className={CL.loadingText}>加载中...</div>
                            ) : playlists.length === 0 ? (
                                <div className={CL.emptyText}>未找到歌单</div>
                            ) : (
                                <div className={CL.playlistGrid}>
                                    {playlists.map((playlist) => (
                                        <button
                                            key={playlist.id}
                                            className={CL.playlistCard}
                                            onClick={() => handleSelectPlaylist(playlist)}
                                        >
                                            <div className={CL.playlistCover}>
                                                {playlist.cover ? (
                                                    <img src={playlist.cover} alt={playlist.name} className={CL.coverImg} />
                                                ) : (
                                                    <div className={CL.coverPlaceholder}>🎵</div>
                                                )}
                                                <span className={CL.songCount}>{playlist.song_count}首</span>
                                            </div>
                                            <div className={CL.playlistName}>{playlist.name}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 步骤3: 选择歌曲 */}
                    {step === 'select-songs' && (
                        <div className={CL.stepContent}>
                            <div className={CL.stepHeader}>
                                <button className={CL.backBtn} onClick={handleBack}>← 返回</button>
                                <h4 className={CL.stepHeaderTitle}>{selectedPlaylist?.name}</h4>
                                <button className={CL.selectAllBtn} onClick={toggleAll}>
                                    {selectedSongmids.length === songs.length ? '取消全选' : '全选'}
                                </button>
                            </div>
                            {loadingSongs ? (
                                <div className={CL.loadingText}>加载中...</div>
                            ) : songs.length === 0 ? (
                                <div className={CL.emptyText}>歌单为空</div>
                            ) : (
                                <div className={CL.songList}>
                                    {songs.map((song) => {
                                        const songId = getSongId(song);
                                        return (
                                            <label key={songId} className={CL.songItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSongmids.includes(songId)}
                                                    onChange={() => toggleSong(songId)}
                                                    className={CL.songCheckbox}
                                                />
                                                <div className={CL.songInfo}>
                                                    <div className={CL.songTitle}>{song.title}</div>
                                                    <div className={CL.songArtist}>{song.artist}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className={CL.footer}>
                    <span className={CL.selectedCount}>
                        已选择 {selectedSongmids.length} 首歌曲
                    </span>
                    <div className={CL.footerBtns}>
                        <button className={CL.cancelBtn} onClick={onCancel}>取消</button>
                        <button
                            className={CL.importBtn}
                            onClick={handleImport}
                            disabled={step !== 'select-songs' || selectedSongmids.length === 0 || importing}
                        >
                            {importing ? '导入中...' : '导入选中歌曲'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
