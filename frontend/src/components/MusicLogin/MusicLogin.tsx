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

type CookieCount = {
    count: number;
    platform: string;
};

type VipCount = {
    vip: number;
    non_vip: number;
    total: number;
    platform: string;
};

const platformConfig: Record<Platform, { name: string; icon: string; color: string }> = {
    qqmusic: { name: 'QQ音乐', icon: '🎵', color: '#31c27c' },
    netease: { name: '网易云音乐', icon: '🎶', color: '#c20c0c' },
    kugou: { name: '酷狗音乐', icon: '🎤', color: '#2ca2c9' },
};

export default function MusicLogin() {
    const { setMessage } = useMessage();
    const [activePlatform, setActivePlatform] = useState<Platform>('qqmusic');
    const [cookieCount, setCookieCount] = useState<CookieCount>({ count: 0, platform: 'qqmusic' });
    const [vipCount, setVipCount] = useState<VipCount>({ vip: 0, non_vip: 0, total: 0, platform: 'qqmusic' });
    const [loginStatus, setLoginStatus] = useState<LoginStatus>({ logged_in: false, uin: '', nickname: '' });
    const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
    const [loading, setLoading] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [systemLoggedIn, setSystemLoggedIn] = useState<boolean>(!!localStorage.getItem('token'));

    const authHeader = { Authorization: localStorage.getItem('token') || '' };

    // 获取可用Cookie数量
    const fetchCookieCount = useCallback(async () => {
        try {
            const resp = await axios.get('/cookie/count', { headers: authHeader });
            setCookieCount(resp.data);
        } catch (error) {
            console.error('获取Cookie数量失败', error);
        }
    }, []);

    // 获取VIP Cookie数量
    const fetchVipCount = useCallback(async () => {
        try {
            const resp = await axios.get('/cookie/vip-count', { headers: authHeader });
            setVipCount(resp.data);
        } catch (error) {
            console.error('获取VIP Cookie数量失败', error);
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
        fetchCookieCount();
        fetchVipCount();
        if (systemLoggedIn) {
            fetchLoginStatus();
        }
    }, [activePlatform, systemLoggedIn]);

    useEffect(() => {
        if (loginStatus.logged_in) {
            fetchUserPlaylists();
        } else {
            setUserPlaylists([]);
        }
    }, [loginStatus.logged_in]);

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
            pollLoginStatus();
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
    const pollLoginStatus = () => {
        const interval = setInterval(async () => {
            try {
                const resp = await axios.get('/music-login/qqmusic/status', { headers: authHeader });
                if (resp.data.logged_in) {
                    clearInterval(interval);
                    setLoginStatus(resp.data);
                    setMessage('QQ音乐登录成功', 'success');
                    // 刷新Cookie数量和VIP数量
                    fetchCookieCount();
                    fetchVipCount();
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
        } catch {
            setMessage('退出登录失败', 'error');
        }
    };

    // 导入歌单
    const handleImportPlaylist = async (playlist: UserPlaylist) => {
        setLoading(true);
        try {
            // TODO: 实现歌单导入逻辑
            setMessage(`正在导入歌单: ${playlist.name}`, 'info');
        } catch {
            setMessage('导入歌单失败', 'error');
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
                        {key === 'qqmusic' && cookieCount.count > 0 && (
                            <span className="cookie-badge">{cookieCount.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Cookie状态 */}
            <div className="cookie-status">
                <span className="cookie-label">共享Cookie池:</span>
                <span className="cookie-count">{cookieCount.count} 个可用</span>
                {vipCount.vip > 0 && <span className="vip-badge">VIP: {vipCount.vip}</span>}
                {vipCount.non_vip > 0 && <span className="non-vip-badge">普通: {vipCount.non_vip}</span>}
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
                            <div className="coming-soon">即将支持</div>
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
            {loginStatus.logged_in && userPlaylists.length > 0 && (
                <div className="user-playlists">
                    <h3 className="section-title">我的歌单</h3>
                    <div className="playlist-grid">
                        {userPlaylists.map((playlist) => (
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
                </div>
            )}

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