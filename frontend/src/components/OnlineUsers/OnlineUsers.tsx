import { useMemo } from 'react';
import type { OnlineUser } from '../../context/SocketContext';

interface OnlineUsersProps {
    users: OnlineUser[];
}

/**
 * 根据用户名生成稳定的随机颜色
 * 使用简单的哈希算法确保同一用户名总是生成相同的颜色
 */
function generateColorFromName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // 转换为32位整数
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
}

/**
 * 获取用户名的首字符（支持中文和英文）
 */
function getFirstChar(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

export default function OnlineUsers({ users }: OnlineUsersProps) {
    const userItems = useMemo(() => {
        return users.map((user) => ({
            ...user,
            color: generateColorFromName(user.username),
            firstChar: getFirstChar(user.username)
        }));
    }, [users]);

    if (users.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-panel mt-4">
                <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block bg-text-tertiary"></span>
                    <span className="text-sm font-medium text-text-secondary">暂无在线用户</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-panel mt-4">
            <div className="flex items-center justify-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full inline-block bg-success shadow-green-sm"></span>
                <span className="text-sm font-medium text-text-secondary">{users.length} 人在线</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
                {userItems.map((user) => (
                    <div key={user.user_id} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                        <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-semibold text-white hover:scale-110 transition-transform duration-200"
                            style={{ backgroundColor: user.color, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                        >
                            {user.firstChar}
                        </div>
                        <span className="text-xs max-w-[64px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-text-primary">{user.username}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}