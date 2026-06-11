import type { UploadFileItem } from './types';

const TABLE_CELL_CLASSES = 'border border-border-blue-light p-2.5 text-left text-xs text-[#444] align-middle';
const TABLE_HEADER_CLASSES = `${TABLE_CELL_CLASSES} bg-surface-soft`;
const INPUT_CLASSES = 'w-full border border-border-blue-soft rounded-lg px-2.5 py-2 text-xs outline-none';
const SECONDARY_BTN_CLASSES = 'border border-border-blue-muted bg-surface rounded-lg px-2.5 py-1.5 text-text-blue-muted cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const PRIMARY_BTN_CLASSES = 'border-none rounded-[10px] px-[18px] py-2.5 text-white cursor-pointer bg-primary font-semibold disabled:opacity-60 disabled:cursor-not-allowed';

type UploadFileTableProps = {
    files: UploadFileItem[];
    uploading: boolean;
    onTitleChange: (index: number, value: string) => void;
    onArtistChange: (index: number, value: string) => void;
    onRemoveFile: (index: number) => void;
    onRetryFile: (index: number) => void;
    onUploadAll: () => void;
};

export default function UploadFileTable({
    files,
    uploading,
    onTitleChange,
    onArtistChange,
    onRemoveFile,
    onRetryFile,
    onUploadAll
}: UploadFileTableProps) {
    if (files.length === 0) {
        return null;
    }

    return (
        <div className="bg-surface rounded-2xl p-[18px] shadow-card flex flex-col gap-3.5">
            <h3 className="m-0 text-text-primary">上传文件列表</h3>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 980 }}>
                    <thead>
                        <tr>
                            <th className={TABLE_HEADER_CLASSES}>文件名</th>
                            <th className={TABLE_HEADER_CLASSES}>歌名</th>
                            <th className={TABLE_HEADER_CLASSES}>歌手</th>
                            <th className={TABLE_HEADER_CLASSES}>时长</th>
                            <th className={TABLE_HEADER_CLASSES}>上传进度</th>
                            <th className={TABLE_HEADER_CLASSES}>状态</th>
                            <th className={TABLE_HEADER_CLASSES}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.map((file, index) => (
                            <tr key={`${file.name}-${index}`}>
                                <td className={TABLE_CELL_CLASSES}>{file.name}</td>
                                <td className={TABLE_CELL_CLASSES}>
                                    <input
                                        className={INPUT_CLASSES}
                                        value={file.title}
                                        onChange={(event) => onTitleChange(index, event.target.value)}
                                        placeholder="歌名"
                                        disabled={file.uploading}
                                    />
                                </td>
                                <td className={TABLE_CELL_CLASSES}>
                                    <input
                                        className={INPUT_CLASSES}
                                        value={file.artist}
                                        onChange={(event) => onArtistChange(index, event.target.value)}
                                        placeholder="歌手"
                                        disabled={file.uploading}
                                    />
                                </td>
                                <td className={TABLE_CELL_CLASSES}>{file.duration || '加载中...'}</td>
                                <td className={TABLE_CELL_CLASSES}>
                                    <div className="relative h-[22px] min-w-[150px] rounded-[20px] overflow-hidden" style={{ backgroundColor: '#eef0f7' }}>
                                        <div className="h-full bg-primary" style={{ width: `${file.uploadProgress}%`, transition: 'width 0.25s ease' }}></div>
                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-text-blue-dark">{file.uploadProgress}%</span>
                                    </div>
                                </td>
                                <td className={TABLE_CELL_CLASSES}>
                                    <span
                                        className={[
                                            file.uploading ? 'text-warning font-bold' : '',
                                            file.uploadSuccess ? 'text-success-light font-bold' : '',
                                            file.uploadError ? 'text-error-light font-bold' : ''
                                        ].join(' ')}
                                    >
                                        {file.uploading
                                            ? '上传中...'
                                            : file.uploadSuccess
                                                ? '成功'
                                                : file.uploadError
                                                    ? '失败'
                                                    : '待上传'}
                                    </span>
                                </td>
                                <td className={TABLE_CELL_CLASSES}>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className={SECONDARY_BTN_CLASSES}
                                            onClick={() => onRemoveFile(index)}
                                            disabled={file.uploading}
                                        >
                                            删除
                                        </button>
                                        {file.uploadError && (
                                            <button
                                                type="button"
                                                className={SECONDARY_BTN_CLASSES}
                                                onClick={() => onRetryFile(index)}
                                                disabled={file.uploading}
                                            >
                                                重试
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button
                type="button"
                className={PRIMARY_BTN_CLASSES}
                onClick={onUploadAll}
                disabled={uploading || files.some((file) => file.uploading)}
            >
                {uploading ? '上传中...' : '确认上传'}
            </button>
        </div>
    );
}
