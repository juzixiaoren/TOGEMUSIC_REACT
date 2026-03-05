import type { UploadFileItem } from './types';

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
        <div className="upload-file-list">
            <h3>上传文件列表</h3>
            <div className="upload-table-wrap">
                <table className="upload-table">
                    <thead>
                        <tr>
                            <th>文件名</th>
                            <th>歌名</th>
                            <th>歌手</th>
                            <th>时长</th>
                            <th>上传进度</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {files.map((file, index) => (
                            <tr key={`${file.name}-${index}`}>
                                <td>{file.name}</td>
                                <td>
                                    <input
                                        value={file.title}
                                        onChange={(event) => onTitleChange(index, event.target.value)}
                                        placeholder="歌名"
                                        disabled={file.uploading}
                                    />
                                </td>
                                <td>
                                    <input
                                        value={file.artist}
                                        onChange={(event) => onArtistChange(index, event.target.value)}
                                        placeholder="歌手"
                                        disabled={file.uploading}
                                    />
                                </td>
                                <td>{file.duration || '加载中...'}</td>
                                <td>
                                    <div className="upload-progress-bar">
                                        <div className="upload-progress-fill" style={{ width: `${file.uploadProgress}%` }}></div>
                                        <span className="upload-progress-text">{file.uploadProgress}%</span>
                                    </div>
                                </td>
                                <td>
                                    <span
                                        className={[
                                            file.uploading ? 'upload-status-uploading' : '',
                                            file.uploadSuccess ? 'upload-status-success' : '',
                                            file.uploadError ? 'upload-status-error' : ''
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
                                <td>
                                    <div className="upload-actions-row">
                                        <button
                                            type="button"
                                            className="upload-secondary-btn"
                                            onClick={() => onRemoveFile(index)}
                                            disabled={file.uploading}
                                        >
                                            删除
                                        </button>
                                        {file.uploadError && (
                                            <button
                                                type="button"
                                                className="upload-secondary-btn"
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
                className="upload-primary-btn"
                onClick={onUploadAll}
                disabled={uploading || files.some((file) => file.uploading)}
            >
                {uploading ? '上传中...' : '确认上传'}
            </button>
        </div>
    );
}
