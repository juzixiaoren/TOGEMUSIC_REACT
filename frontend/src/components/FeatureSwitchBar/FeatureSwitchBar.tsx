import { useEffect } from 'react';

export type FeatureKey = 'upload' | 'playlist' | 'player' | 'music-login';

type FeatureOption = {
    key: FeatureKey;
    label: string;
};

type FeatureSwitchBarProps = {
    selectedKey: FeatureKey;
    onChange: (key: FeatureKey) => void;
};

const options: FeatureOption[] = [
    { key: 'upload', label: '上传音乐' },
    { key: 'playlist', label: '管理歌单' },
    { key: 'player', label: '音乐播放' },
    { key: 'music-login', label: '音乐平台' }
];

export default function FeatureSwitchBar({ selectedKey, onChange }: FeatureSwitchBarProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            const isTyping = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.getAttribute('contenteditable') === 'true';
            if (isTyping) {
                return;
            }

            const currentIndex = options.findIndex((item) => item.key === selectedKey);
            if (currentIndex < 0) {
                return;
            }

            if (event.key === 'ArrowLeft' || event.code === 'Numpad4') {
                event.preventDefault();
                const prevIndex = (currentIndex - 1 + options.length) % options.length;
                onChange(options[prevIndex].key);
            }

            if (event.key === 'ArrowRight' || event.code === 'Numpad6') {
                event.preventDefault();
                const nextIndex = (currentIndex + 1) % options.length;
                onChange(options[nextIndex].key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedKey, onChange]);

    // 容器样式 - 毛玻璃效果
    const barClass = "w-[min(780px,92%)] min-h-[68px] mx-auto p-2.5 rounded-full flex items-center justify-between gap-2 bg-black/10 dark:bg-white/10 border-[3px] border-white/30 dark:border-white/15 backdrop-blur-xl";

    // 按钮基础样式
    const btnBaseClass = "flex-1 min-h-12 border-none rounded-full font-mcfont text-base font-bold cursor-pointer bg-transparent text-platform-green transition-all duration-200 ease-in-out";
    // 按钮 hover 样式
    const btnHoverClass = "hover:bg-white/25 dark:hover:bg-white/15";
    // 按钮 active 样式
    const btnActiveClass = "bg-white/50 dark:bg-white/20 shadow-active-white";

    return (
        <div className={barClass} role="tablist" aria-label="功能切换">
            {options.map((item) => {
                const isActive = item.key === selectedKey;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`${btnBaseClass} ${btnHoverClass} ${isActive ? btnActiveClass : ''}`}
                        onClick={() => onChange(item.key)}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
