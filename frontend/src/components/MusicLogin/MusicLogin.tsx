import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useMessage } from '../../context/MessageContext';
import './MusicLogin.css';

type Platform = 'qqmusic' | 'netease' | 'kugou';

type LoginStatus = {
    logged_in: boolean;
    uin: string;
    nickname: string;
    is_vip?: boolean;
};

type UserPlaylist = {
    id: string;
    name: string;
    song_count: number;
    cover: string;
};

type PlatformCookieData = {
    count: number;
    vip: number;
    non_vip: number;
    total: number;
};

const platformConfig: Record<Platform, { name: string; icon: string; color: string }> = {
    qqmusic: { name: 'QQ音乐', icon: '🎵', color: '#31c27c' },
    netease: { name: '网易云音乐', icon: '🎶', color: '#c20c0c' },
    kugou: { name: '酷狗音乐', icon: '🎤', color: '#2ca2c9' },
};

export default function MusicLogin() {
    const { setMessage } = useMessage();
    const [activePlatform, setActivePlatform] = useState<Platform>('qqmusic');
    const [platformCookieData, setPlatformCookieData] = useState<Record<Platform, PlatformCookieData>>({
        qqmusic: { count: 0, vip: 0, non_vip: 0, total: 0 },
        netease: { count: 0, vip: 0, non_vip: 0, total: 0 },
        kugou: { count: 0, vip: 0, non_vip: 0, total: 0 },
    });
    const [loginStatus, setLoginStatus] = useState<LoginStatus>({ logged_in: false, uin: '', nickname: '' });
    const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
    const [playlistPage, setPlaylistPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [systemLoggedIn, setSystemLoggedIn] = useState<boolean>(!!localStorage.getItem('token'));

    const authHeader = { Authorization: localStorage.getItem('token') || '' };

    // 获取所有平台的Cookie数据
    const fetchAllPlatformCookieData = useCallback(async () => {
        const platforms: Platform[] = ['qqmusic', 'netease', 'kugou'];
        const newData: Record<Platform, PlatformCookieData> = {
            qqmusic: { count: 0, vip: 0, non_vip: 0, total: 0 },
            netease: { count: 0, vip: 0, non_vip: 0, total: 0 },
            kugou: { count: 0, vip: 0, non_vip: 0, total: 0 },
        };

        try {
            // 并行获取所有平台的数据
            const promises = platforms.map(async (platform) => {
                try {
                    const [countResp, vipResp] = await Promise.all([
                        axios.get(`/cookie/count?platform=${platform}`, { headers: authHeader }),
                        axios.get(`/cookie/vip-count?platform=${platform}`, { headers: authHeader }),
                    ]);
                    newData[platform] = {
                        count: countResp.data.count || 0,
                        vip: vipResp.data.vip || 0,
                        non_vip: vipResp.data.non_vip || 0,
                        total: vipResp.data.total || 0,
                    };
                } catch (error) {
                    console.error(`获取${platform} Cookie数据失败`, error);
                }
            });

            await Promise.all(promises);
            setPlatformCookieData(newData);
        } catch (error) {
            console.error('获取Cookie数据失败', error);
        }
    }, []);

    // 获取登录状态
    const fetchLoginStatus = useCallback(async () => {
        try {
            const resp = await axios.get(`/music-login/${activePlatform}/status`, { headers: authHeader });
            setLoginStatus(resp.data);
        } catch (error) {
            console.error('获取登录状态失败', error);
        }
    }, [activePlatform]);

    // 获取用户歌单
    const fetchUserPlaylists = useCallback(async () => {
        if (!loginStatus.logged_in) return;
        try {
            const resp = await axios.get(`/music-login/${activePlatform}/playlists`, { headers: authHeader });
            setUserPlaylists(resp.data.playlists || []);
            setPlaylistPage(0); // 重置页码
        } catch (error: unknown) {
            const err = error as { response?: { data?: { code?: string } } };
            if (err.response?.data?.code === 'NOT_LOGGED_IN') {
                setLoginStatus({ logged_in: false, uin: '', nickname: '' });
            }
            console.error('获取用户歌单失败', error);
        }
    }, [activePlatform, loginStatus.logged_in]);

    // 检查系统登录状态
    useEffect(() => {
        const checkSystemLogin = () => {
            setSystemLoggedIn(!!localStorage.getItem('token'));
        };
        window.addEventListener('storage', checkSystemLogin);
        return () => window.removeEventListener('storage', checkSystemLogin);
    }, []);

    useEffect(() => {
        fetchAllPlatformCookieData();
        if (systemLoggedIn) {
            fetchLoginStatus();
        }
    }, [systemLoggedIn]);

    useEffect(() => {
        if (loginStatus.logged_in) {
            fetchUserPlaylists();
        } else {
            setUserPlaylists([]);
        }
    }, [loginStatus.logged_in, activePlatform]);

    // QQ音乐登录
    const handleQQMusicLogin = async () => {
        if (!localStorage.getItem('token')) {
            setMessage('请先登录系统后再操作', 'warning');
            return;
        }
        setLoginLoading(true);
        try {
            const resp = await axios.post('/music-login/qqmusic/init', {}, { headers: authHeader });
            setMessage(resp.data.message, 'info');
            // 开始轮询登录状态
            pollLoginStatus('qqmusic');
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { message?: string } } };
            if (err.response?.status === 401) {
                setMessage('系统登录已过期，请重新登录', 'error');
                setSystemLoggedIn(false);
            } else {
                setMessage(err.response?.data?.message || '启动登录失败', 'error');
            }
        } finally {
            setLoginLoading(false);
        }
    };

    // 网易云音乐登录
    const handleNeteaseLogin = async () => {
        if (!localStorage.getItem('token')) {
            setMessage('请先登录系统后再操作', 'warning');
            return;
        }
        setLoginLoading(true);
        try {
            const resp = await axios.post('/music-login/netease/init', {}, { headers: authHeader });
            setMessage(resp.data.message, 'info');
            // 开始轮询登录状态
            pollLoginStatus('netease');
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { message?: string } } };
            if (err.response?.status === 401) {
                setMessage('系统登录已过期，请重新登录', 'error');
                setSystemLoggedIn(false);
            } else {
                setMessage(err.response?.data?.message || '启动登录失败', 'error');
            }
        } finally {
            setLoginLoading(false);
        }
    };

    // 轮询登录状态
    const pollLoginStatus = (platform: Platform) => {
        const interval = setInterval(async () => {
            try {
                const resp = await axios.get(`/music-login/${platform}/status`, { headers: authHeader });
                if (resp.data.logged_in) {
                    clearInterval(interval);
                    setLoginStatus(resp.data);
                    setMessage(`${platformConfig[platform].name}登录成功`, 'success');
                    // 刷新所有平台的Cookie数据
                    fetchAllPlatformCookieData();
                }
            } catch {
                // 忽略错误
            }
        }, 4000); // 4秒轮询一次

        // 5分钟后停止轮询
        setTimeout(() => clearInterval(interval), 300000);
    };

    // 退出登录
    const handleLogout = async () => {
        try {
            await axios.post(`/music-login/${activePlatform}/logout`, {}, { headers: authHeader });
            setLoginStatus({ logged_in: false, uin: '', nickname: '' });
            setUserPlaylists([]);
            setMessage('已退出登录', 'info');
            // 刷新所有平台的Cookie数据
            fetchAllPlatformCookieData();
        } catch {
            setMessage('退出登录失败', 'error');
        }
    };

    // 导入歌单
    const handleImportPlaylist = async (playlist: UserPlaylist) => {
        setLoading(true);
        try {
            setMessage(`正在获取歌单 ${playlist.name} 的歌曲...`, 'info');

            // 第一步：获取歌单中的所有歌曲
            const songsResp = await axios.get(
                `/music-login/${activePlatform}/playlist-songs?playlist_id=${playlist.id}`,
                { headers: authHeader }
            );

            const songs = songsResp.data.songs || [];
            if (songs.length === 0) {
                setMessage('歌单中没有歌曲', 'warning');
                return;
            }

            setMessage(`正在导入 ${songs.length} 首歌曲...`, 'info');

            // 第二步：调用导入API（传递歌单封面和歌曲数量信息）
            const importResp = await axios.post(
                `/music-login/${activePlatform}/import-playlist`,
                {
                    playlist_id: playlist.id,
                    playlist_name: playlist.name,
                    songs: songs,
                    cover_url: playlist.cover || '',
                    track_count: playlist.song_count || songs.length
                },
                { headers: authHeader }
            );

            const result = importResp.data;
            setMessage(
                `导入完成: 成功 ${result.imported} 首, 失败 ${result.failed} 首`,
                result.failed > 0 ? 'warning' : 'success'
            );
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setMessage(err.response?.data?.message || '导入歌单失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="music-login-container">
            {/* 平台切换 */}
            <div className="platform-tabs">
                {(Object.entries(platformConfig) as [Platform, typeof platformConfig.qqmusic][]).map(([key, config]) => (
                    <button
                        key={key}
                        className={`platform-tab ${activePlatform === key ? 'active' : ''}`}
                        onClick={() => setActivePlatform(key)}
                        style={activePlatform === key ? { borderColor: config.color } : undefined}
                    >
                        <span className="platform-icon">{config.icon}</span>
                        <span className="platform-name">{config.name}</span>
                        {platformCookieData[key].count > 0 && (
                            <span className="cookie-badge">{platformCookieData[key].count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Cookie状态 */}
            <div className="cookie-status">
                <div className="cookie-summary">
                    <span className="cookie-label">可用共享Cookie池:</span>
                    <span className="cookie-count">
                        {platformCookieData.qqmusic.count + platformCookieData.netease.count + platformCookieData.kugou.count} 个可用
                    </span>
                </div>
                <div className="cookie-details">
                    <span className="cookie-detail-item">
                        <span className="platform-label">QQ:</span>
                        <span className="detail-info">普通: {platformCookieData.qqmusic.non_vip} vip: {platformCookieData.qqmusic.vip}</span>
                    </span>
                    <span className="cookie-detail-item">
                        <span className="platform-label">网易云:</span>
                        <span className="detail-info">普通: {platformCookieData.netease.non_vip} vip: {platformCookieData.netease.vip}</span>
                    </span>
                    <span className="cookie-detail-item">
                        <span className="platform-label">酷狗:</span>
                        <span className="detail-info">普通: {platformCookieData.kugou.non_vip} vip: {platformCookieData.kugou.vip}</span>
                    </span>
                </div>
            </div>

            {/* 系统登录提示 */}
            {!systemLoggedIn && (
                <div className="system-login-hint">
                    <p>请先<a href="/login">登录系统</a>后再使用音乐平台功能</p>
                </div>
            )}

            {/* 登录区域 */}
            <div className="login-section">
                {loginStatus.logged_in ? (
                <div className="logged-in-info">
                    <div className="user-info">
                        <span className="user-icon">👤</span>
                        <span className="user-name">{loginStatus.nickname || loginStatus.uin}</span>
                        {loginStatus.is_vip && <span className="user-vip-tag">VIP</span>}
                        <span className="user-uid">({loginStatus.uin})</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>退出登录</button>
                </div>
                ) : (
                    <div className="login-actions">
                        {activePlatform === 'qqmusic' && (
                            <button
                                className="login-btn qqmusic"
                                onClick={handleQQMusicLogin}
                                disabled={loginLoading}
                            >
                                {loginLoading ? '启动中...' : '🔑 登录QQ音乐'}
                            </button>
                        )}
                        {activePlatform === 'netease' && (
                            <button
                                className="login-btn netease"
                                onClick={handleNeteaseLogin}
                                disabled={loginLoading}
                            >
                                {loginLoading ? '启动中...' : '🔑 登录网易云音乐'}
                            </button>
                        )}
                        {activePlatform === 'kugou' && (
                            <div className="coming-soon">即将支持</div>
                        )}
                        <p className="login-hint">
                            登录后可获取您的个人歌单，Cookie将自动加入共享池
                        </p>
                    </div>
                )}
            </div>

            {/* 用户歌单列表 */}
            {loginStatus.logged_in && userPlaylists.length > 0 && (() => {
                const pageSize = 9;
                const totalPages = Math.ceil(userPlaylists.length / pageSize);
                const paginatedPlaylists = userPlaylists.slice(playlistPage * pageSize, (playlistPage + 1) * pageSize);

                return (
                    <div className="user-playlists">
                        <h3 className="section-title">我的歌单</h3>
                        <div className="playlist-grid">
                            {paginatedPlaylists.map((playlist) => (
                                <div key={playlist.id} className="playlist-card">
                                    <div className="playlist-cover">
                                        {playlist.cover ? (
                                            <img src={playlist.cover} alt={playlist.name} />
                                        ) : (
                                            <div className="playlist-cover-placeholder">🎵</div>
                                        )}
                                        <span className="song-count">{playlist.song_count}首</span>
                                    </div>
                                    <div className="playlist-info">
                                        <h4 className="playlist-name">{playlist.name}</h4>
                                        <button
                                            className="import-btn"
                                            onClick={() => handleImportPlaylist(playlist)}
                                            disabled={loading}
                                        >
                                            {loading ? '导入中...' : '导入到曲库'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="playlist-pagination">
                                <button
                                    className="page-btn"
                                    onClick={() => setPlaylistPage(p => p - 1)}
                                    disabled={playlistPage === 0}
                                >
                                    上一页
                                </button>
                                <span className="page-info">{playlistPage + 1} / {totalPages}</span>
                                <button
                                    className="page-btn"
                                    onClick={() => setPlaylistPage(p => p + 1)}
                                    disabled={playlistPage >= totalPages - 1}
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* 功能说明 */}
            <div className="feature-notes">
                <h4>功能说明</h4>
                <ul>
                    <li><strong>搜索音乐</strong>：无需登录，使用共享Cookie池</li>
                    <li><strong>播放音乐</strong>：无需登录，使用共享Cookie池</li>
                    <li><strong>导入歌单</strong>：需要登录，获取您的个人歌单</li>
                </ul>
            </div>
        </div>
    );
}