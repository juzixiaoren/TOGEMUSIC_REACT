import type { HeaderTopProps } from '../../types/alltypes'
import { useNavigate } from 'react-router-dom'

export default function HeaderTop({ isLogin, userId }: HeaderTopProps) {
    const navigate = useNavigate();
    const onLoginOut = () => {
        window.dispatchEvent(new Event('app:logout'));
        localStorage.clear();
        navigate('/login', { replace: true });
    }

    // 顶部容器样式
    const topClass = "w-screen h-[120px] overflow-hidden fixed z-[999] box-border bg-white/50 backdrop-blur-[1px] shadow-header border-b border-white/[0.115]";

    // Logo容器样式 - 右上角正方形
    const logoClass = "absolute right-0 top-0 w-[120px] h-[120px] overflow-hidden";
    const logoImgClass = "w-full h-full object-cover";

    // Amiya动态图样式 - hover显示
    const amiyaClass = "absolute opacity-0 right-[150px] top-[10px] transition-opacity duration-[1300ms] hover:opacity-100 z-10";
    const amiyaImgClass = "h-[100px]";

    // 退出登录按钮样式
    const logoutBtnClass = "ml-4 px-4 py-1.5 rounded-lg border border-border-blue-input bg-surface-blue-light text-text-blue-dark font-mcfont text-sm font-bold cursor-pointer transition-all duration-200 hover:bg-surface-blue-soft hover:shadow-hover-card";

    if (!isLogin) {
        return (
            <div className={topClass}>
                <div className="w-full absolute bottom-3 font-mcfont text-text-primary ml-[50px]">
                    <h1 className="text-4xl tracking-wide">TOGEMUSIC</h1>
                </div>
                <div className={logoClass}>
                    <img id="logo" src="/logo.jpg" alt="logo" className={logoImgClass} />
                </div>
                <div className={amiyaClass}>
                    <img src="/amiya.gif" alt="阿米娅" className={amiyaImgClass} id="amiyaimg" />
                </div>
            </div>
        )
    }
    else {
        return (
            <div className={topClass}>
                <div className="w-full absolute bottom-3 font-mcfont text-text-primary ml-[50px]">
                    <h1 className="text-4xl tracking-wide">TOGEMUSIC</h1>
                    <div className="flex items-center gap-3 text-base mt-2">
                        <h2 className="text-lg">欢迎，{userId}</h2>
                        <button className={logoutBtnClass} onClick={onLoginOut}>退出登录</button>
                    </div>
                </div>
                <div className={logoClass}>
                    <img id="logo" src="/logo.jpg" alt="logo" className={logoImgClass} />
                </div>
                <div className={amiyaClass}>
                    <img src="/amiya.gif" alt="阿米娅" className={amiyaImgClass} id="amiyaimg" />
                </div>
            </div >
        )
    }
}
