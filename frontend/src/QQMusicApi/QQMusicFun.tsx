import axios from 'axios';
import { useState } from 'react';
import { useMessage } from '../context/MessageContext';

type QQSearchItem = {
    songmid: string;
    title: string;
    artist: string;
    duration: number;
    strMediaMid?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSearchItems(payload: any): QQSearchItem[] {
    const rawItems = Array.isArray(payload?.items)
        ? payload.items
        : (() => {
            const data = payload?.data;
            if (Array.isArray(data?.list)) {
                return data.list;
            }
            if (Array.isArray(data?.song?.list)) {
                return data.song.list;
            }
            return [];
        })();

    return rawItems
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => {
            const singers = Array.isArray(item?.singer) ? item.singer : [];
            const artist = singers
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((s: any) => s?.name)
                .filter(Boolean)
                .join('/');

            const songmid = item?.songmid || item?.mid || item?.id;
            if (!songmid) {
                return null;
            }

            return {
                songmid,
                title: item?.songname || item?.title || '',
                artist: artist || item?.artist || '',
                duration: Number(item?.interval || 0) * 1000,
                strMediaMid: item?.strMediaMid || item?.media_mid || songmid
            } as QQSearchItem;
        })
        .filter((item: QQSearchItem | null): item is QQSearchItem => Boolean(item));
}

export default function QQMusicFun() {
    const { setMessage } = useMessage();
    const [items, setItems] = useState<QQSearchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchKey, setSearchKey] = useState('');
    const handleSearchKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchKey(e.target.value);
    }
    const [importingSongmid, setImportingSongmid] = useState<string | null>(null);
    const authHeader: Record<string, string> = {
        Authorization: localStorage.getItem('token') || ''
    };

    async function searchMusic() {
        setLoading(true);
        try {
            const response = await axios.get('/qqmusic/search', {
                params: {
                    key: searchKey,
                    pageNo: 1,
                    pageSize: 5
                },
                headers: authHeader
            });
            const resultItems = normalizeSearchItems(response.data);
            setItems(resultItems);
            setMessage(`搜索完成，共 ${resultItems.length} 条`, 'success');
            console.log('QQ 音乐搜索结果', resultItems);
        } catch (error) {
            console.error('QQ 音乐搜索失败', error);
            setMessage('QQ 音乐搜索失败，请检查登录状态与后端服务', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function importSong(item: QQSearchItem) {
        setImportingSongmid(item.songmid);
        try {
            const response = await axios.post('/qqmusic/import', {
                songmid: item.songmid,
                title: item.title,
                artist: item.artist,
                duration: item.duration,
                strMediaMid: item.strMediaMid,
                type: 'm4a',
                addToPlaylist: true
            }, {
                headers: authHeader
            });
            setMessage(response.data?.message || '导入成功', 'success');
        } catch (error) {
            console.error('QQ 音乐导入失败', error);
            setMessage('QQ 音乐导入失败，请检查后端日志', 'error');
        } finally {
            setImportingSongmid(null);
        }
    }

    return (
        <div>
            <input
                type="text"
                placeholder="输入搜索关键词"
                value={searchKey}
                onChange={handleSearchKeyChange}
                className="w-[350px] h-10 border-2 border-border rounded-full px-[15px] outline-none mx-auto block"
            />
            <ul>
                {items.map((item) => (
                    <li key={item.songmid} className="flex items-center p-2.5 border border-dotted border-border-pink">
                        {item.title} - {item.artist}
                        <button
                            className="relative ml-auto"
                            disabled={importingSongmid === item.songmid}
                            onClick={() => {
                                void importSong(item);
                            }}
                        >
                            {importingSongmid === item.songmid ? '导入中...' : '导入到曲库'}
                        </button>
                    </li>
                ))}
            </ul>
            <button onClick={searchMusic} disabled={loading} className="h-[50px] px-10 border border-platform-qq-mid bg-platform-qq-mid text-white rounded-b-[20px] rounded-t-none cursor-pointer block mx-auto">
                {loading ? '搜索中...' : 'QQ 音乐搜索'}
            </button>
        </div >
    )
}