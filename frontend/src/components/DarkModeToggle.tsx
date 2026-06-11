import { useDarkMode } from '../context/DarkModeContext';

export default function DarkModeToggle() {
    const { isDark, toggleDarkMode } = useDarkMode();

    return (
        <button
            onClick={toggleDarkMode}
            className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg border-2"
            style={{
                background: isDark
                    ? 'linear-gradient(135deg, #2d2d3f, #1a1a2e)'
                    : 'linear-gradient(135deg, #fff9c4, #ffee58)',
                borderColor: isDark ? '#4a4a6a' : '#fdd835',
                boxShadow: isDark
                    ? '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 15px rgba(99, 102, 241, 0.2)'
                    : '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 15px rgba(255, 238, 88, 0.4)',
            }}
            title={isDark ? '切换到浅色模式' : '切换到深色模式'}
            aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
        >
            {isDark ? (
                // 灭灯泡 - 深色模式（灯泡关闭）
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a0a0c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21h6" />
                    <path d="M10 21v-1a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                    <path d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3z" opacity="0.5" />
                    <line x1="4" y1="4" x2="20" y2="20" stroke="#ff6b6b" strokeWidth="2" />
                </svg>
            ) : (
                // 亮灯泡 - 浅色模式（灯泡开启）
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f57f17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21h6" />
                    <path d="M10 21v-1a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                    <path d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3z" fill="#ffee58" />
                    {/* 光芒 */}
                    <line x1="12" y1="0" x2="12" y2="1" />
                    <line x1="4.22" y1="4.22" x2="4.93" y2="4.93" />
                    <line x1="1" y1="12" x2="2" y2="12" />
                    <line x1="4.22" y1="19.78" x2="4.93" y2="19.07" />
                    <line x1="19.78" y1="4.22" x2="19.07" y2="4.93" />
                    <line x1="23" y1="12" x2="22" y2="12" />
                    <line x1="19.78" y1="19.78" x2="19.07" y2="19.07" />
                </svg>
            )}
        </button>
    );
}
