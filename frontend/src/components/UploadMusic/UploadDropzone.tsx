import { useRef } from 'react';

type UploadDropzoneProps = {
    onFilesSelected: (files: FileList | null) => void;
};

export default function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <div
            className="upload-dropzone"
            onDrop={(event) => {
                event.preventDefault();
                onFilesSelected(event.dataTransfer.files);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragEnter={(event) => event.preventDefault()}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*"
                onChange={(event) => onFilesSelected(event.target.files)}
                style={{ display: 'none' }}
            />
            <button
                type="button"
                className="upload-primary-btn"
                onClick={() => fileInputRef.current?.click()}
            >
                选择文件或拖拽上传
            </button>
            <p className="upload-dropzone-tip">支持 mp3、flac 等格式</p>
        </div>
    );
}
