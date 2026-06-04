import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useMessage } from '../../context/MessageContext';

type Platform = 'qqmusic';

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
    songmid: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
};

const platformConfig: Record<Platform, { name: string; icon: string }> = {
    qqmusic: { name: 'QQ音乐', icon: '🎵' },
    // netease 和 kugou 暂未实现
    // netease: { name: '网易云音乐', icon: '🎶' },
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
    targetPlaylistId,
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

    // 获取歌单中的歌曲
    const fetchPlaylistSongs = useCallback(async (platform: Platform, playlistId: string) => {
        setLoadingSongs(true);
        try {
            const resp = await axios.get(`/music-login/${platform}/playlist-songs`, {
                params: { playlist_id: playlistId },
                headers: authHeader,
            });
            setSongs(resp.data.songs || []);
            setSelectedSongmids(resp.data.songs.map((s: PlatformSong) => s.songmid));
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
            setSelectedSongmids(songs.map((s) => s.songmid));
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
            // 逐个导入歌曲（使用现有的qqmusic/import接口）
            let imported = 0;
            let failed = 0;

            for (const songmid of selectedSongmids) {
                try {
                    await axios.post('/qqmusic/import', { songmid }, { headers: authHeader });
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
        <div className="platform-import-overlay">
            <div className="platform-import-dialog">
                <div className="platform-import-header">
                    <h3>
                        导入歌单到「{targetPlaylistName}」
                    </h3>
                    <button className="close-btn" onClick={onCancel}>×</button>
                </div>

                <div className="platform-import-body">
                    {/* 步骤1: 选择平台 */}
                    {step === 'select-platform' && (
                        <div className="step-content">
                            <h4>选择音乐平台</h4>
                            <div className="platform-list">
                                {platforms.map((p) => (
                                    <button
                                        key={p.platform}
                                        className={`platform-item ${p.logged_in ? 'logged-in' : 'not-logged-in'}`}
                                        onClick={() => p.logged_in && handleSelectPlatform(p.platform)}
                                        disabled={!p.logged_in}
                                    >
                                        <span className="platform-icon">{p.icon}</span>
                                        <span className="platform-name">{p.name}</span>
                                        <span className="platform-status">
                                            {p.logged_in ? `已登录 (${p.nickname})` : '未登录'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <p className="hint-text">
                                请先在「音乐平台」页面登录账号后再导入歌单
                            </p>
                        </div>
                    )}

                    {/* 步骤2: 选择歌单 */}
                    {step === 'select-playlist' && (
                        <div className="step-content">
                            <div className="step-header">
                                <button className="back-btn" onClick={handleBack}>← 返回</button>
                                <h4>选择歌单 ({platformConfig[activePlatform].name})</h4>
                            </div>
                            {loading ? (
                                <div className="loading-text">加载中...</div>
                            ) : playlists.length === 0 ? (
                                <div className="empty-text">未找到歌单</div>
                            ) : (
                                <div className="playlist-grid">
                                    {playlists.map((playlist) => (
                                        <button
                                            key={playlist.id}
                                            className="playlist-card"
                                            onClick={() => handleSelectPlaylist(playlist)}
                                        >
                                            <div className="playlist-cover">
                                                {playlist.cover ? (
                                                    <img src={playlist.cover} alt={playlist.name} />
                                                ) : (
                                                    <div className="cover-placeholder">🎵</div>
                                                )}
                                                <span className="song-count">{playlist.song_count}首</span>
                                            </div>
                                            <div className="playlist-name">{playlist.name}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 步骤3: 选择歌曲 */}
                    {step === 'select-songs' && (
                        <div className="step-content">
                            <div className="step-header">
                                <button className="back-btn" onClick={handleBack}>← 返回</button>
                                <h4>{selectedPlaylist?.name}</h4>
                                <button className="select-all-btn" onClick={toggleAll}>
                                    {selectedSongmids.length === songs.length ? '取消全选' : '全选'}
                                </button>
                            </div>
                            {loadingSongs ? (
                                <div className="loading-text">加载中...</div>
                            ) : songs.length === 0 ? (
                                <div className="empty-text">歌单为空</div>
                            ) : (
                                <div className="song-list">
                                    {songs.map((song) => (
                                        <label key={song.songmid} className="song-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedSongmids.includes(song.songmid)}
                                                onChange={() => toggleSong(song.songmid)}
                                            />
                                            <div className="song-info">
                                                <div className="song-title">{song.title}</div>
                                                <div className="song-artist">{song.artist}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="platform-import-footer">
                    <span className="selected-count">
                        已选择 {selectedSongmids.length} 首歌曲
                    </span>
                    <div className="footer-buttons">
                        <button className="cancel-btn" onClick={onCancel}>取消</button>
                        <button
                            className="import-btn"
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
