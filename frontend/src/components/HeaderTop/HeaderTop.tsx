import './HeaderTop.css'
import type { HeaderTopProps } from '../../types/alltypes'
import { useNavigate } from 'react-router-dom'
export default function HeaderTop({ isLogin, userId }: HeaderTopProps) {
    const navigate = useNavigate();
    const onLoginOut = () => {
        window.dispatchEvent(new Event('app:logout'));
        localStorage.clear();
        navigate('/login', { replace: true });
    }
    if (!isLogin) {
        return (
            <div className="top">
                <div className="title">
                    <h1>TOGEMUSIC</h1>
                </div>
                <div className="logo">
                    <img id="logo" src="/logo.jpg" alt="logo" height="200px"></img>
                </div>
                <div className="amiya">
                    <img src="/amiya.gif" alt="阿米娅" height="200px" id="amiyaimg"></img>
                </div>
            </div>
        )
    }
    else {
        return (
            <div className="top">
                <div className="titleaftl">
                    <h1>TOGEMUSIC</h1>
                    <div className="welcome">
                        <h2>欢迎，{userId}</h2>
                        <button onClick={onLoginOut}>退出登录</button>
                    </div>
                </div>
                <div className="logo">
                    <img id="logo" src="/logo.jpg" alt="logo" height="200px"></img>
                </div>
                <div className="amiya">
                    <img src="/amiya.gif" alt="阿米娅" height="200px" id="amiyaimg"></img>
                </div>
            </div >
        )
    }
}