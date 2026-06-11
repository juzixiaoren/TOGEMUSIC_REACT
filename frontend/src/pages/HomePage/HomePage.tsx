import { useEffect, useState } from 'react';
import HeaderTop from '../../components/HeaderTop/HeaderTop';
import { useNavigate } from 'react-router-dom';
import { useMessage } from '../../context/MessageContext';
import FeatureSwitchBar, { type FeatureKey } from '../../components/FeatureSwitchBar/FeatureSwitchBar';
import PlayerPage from '../../components/PlayerPage/PlayerPage';
import UploadMusic from '../../components/UploadMusic/UploadMusic';
import PlaylistManager from '../../components/PlaylistManager/PlaylistManager';
import MusicLogin from '../../components/MusicLogin/MusicLogin';
import { AudioProvider } from '../../context/AudioContext';
import { SocketProvider } from '../../context/SocketContext';
import { PlaylistProvider } from '../../context/PlaylistContext';
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
            <div className='content justify-start'>
                <div className="w-full mt-10">
                    <FeatureSwitchBar selectedKey={activeFeature} onChange={setActiveFeature} />
                </div>
                <SocketProvider>
                    <AudioProvider>
                        <div className="glass w-[min(1100px,92%)] min-h-[280px] p-7 rounded-3xl text-text-dark font-mcfont [&_h2]:m-0 [&_h2]:mb-3.5">
                            {activeFeature === 'upload' && <UploadMusic />}
                            {activeFeature === 'playlist' && (
                                <PlaylistProvider>
                                    <PlaylistManager />
                                </PlaylistProvider>
                            )}
                            {activeFeature === 'music-login' && <MusicLogin />}
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