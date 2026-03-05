import './HeaderTop.css'
import type { HeaderTopProps } from '../../types/alltypes'
export default function HeaderTop({ isLogin, userId }: HeaderTopProps) {
    if (!isLogin) {
        return (
            <div className="top">
                <div className="title">
                    <h1>TOGEMUSIC</h1>
                </div>
                <div className="logo">
                    <img id="logo" src="/src/assets/images/logo.png" alt="logo" height="200px"></img>
                </div>
                <div className="amiya">
                    <img src="/src/assets/images/amiya.gif" alt="阿米娅" height="200px" id="amiyaimg"></img>
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
                        <button onClick={() => { }}>退出登录</button>
                    </div>
                </div>
                <div className="amiya">
                    <img src="/src/assets/images/amiya.gif" alt="阿米娅" height="200px" id="amiyaimg"></img>
                </div>
            </div >
        )
    }
}