import { useEffect } from 'react';
import './FeatureSwitchBar.css';

export type FeatureKey = 'upload' | 'playlist' | 'player';

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
    { key: 'player', label: '音乐播放' }
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

    return (
        <div className="feature-switch-bar" role="tablist" aria-label="功能切换">
            {options.map((item) => {
                const isActive = item.key === selectedKey;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`feature-switch-button ${isActive ? 'active' : ''}`}
                        onClick={() => onChange(item.key)}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
