import { useEffect, useState } from 'react';
import HeaderTop from '../../components/HeaderTop/HeaderTop';
import { useNavigate } from 'react-router-dom';
import { useMessage } from '../../context/MessageContext';
import '../../styles/base.css';
import './HomePage.css';
import FeatureSwitchBar, { type FeatureKey } from '../../components/FeatureSwitchBar/FeatureSwitchBar';
import PlayerPage from '../../components/PlayerPage/PlayerPage';
import UploadMusic from '../../components/UploadMusic/UploadMusic';
import PlaylistManager from '../../components/PlaylistManager/PlaylistManager';
import { AudioProvider } from '../../context/AudioContext';
import { SocketProvider } from '../../context/SocketContext';
export default function HomePage() {
    const navigate = useNavigate();
    const setMessage = useMessage().setMessage;
    const [activeFeature, setActiveFeature] = useState<FeatureKey>('upload');
    const userId = localStorage.getItem('userId') || "";
    const token = localStorage.getItem('token');
    const isLoggedIn = Boolean(userId && token);

    useEffect(() => {
        if (!isLoggedIn) {
            setMessage('请重新登录', 'error');
            localStorage.clear();
            navigate('/login', { replace: true });
        }
    }, [isLoggedIn, navigate, setMessage]);

    if (!isLoggedIn) {
        return null;
    }

    return (
        <div>
            <HeaderTop isLogin={true} userId={userId ?? undefined} />
            <div className='content home-content'>
                <div className="feature-switch-wrap">
                    <FeatureSwitchBar selectedKey={activeFeature} onChange={setActiveFeature} />
                </div>
                <SocketProvider>
                    <AudioProvider>
                        <div className="home-feature-panel glass">
                            {activeFeature === 'upload' && <UploadMusic />}
                            {activeFeature === 'playlist' && <PlaylistManager />}
                            {/* PlayerPage 始终挂载以保持 Socket 事件监听，切歌才能同步 */}
                            <div style={{ display: activeFeature === 'player' ? 'contents' : 'none' }}>
                                <PlayerPage />
                            </div>
                        </div>
                    </AudioProvider>
                </SocketProvider>
            </div>
        </div>
    )
}