import { useRef } from 'react';

type UploadDropzoneProps = {
    onFilesSelected: (files: FileList | null) => void;
};

export default function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <div
            className="border-2 border-dashed border-border-dashed bg-surface rounded-2xl p-[26px] px-5 text-center shadow-card"
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
                className="hidden"
            />
            <button
                type="button"
                className="border-none rounded-[10px] px-[18px] py-2.5 text-white cursor-pointer bg-primary font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => fileInputRef.current?.click()}
            >
                选择文件或拖拽上传
            </button>
            <p className="mt-2.5 text-text-tertiary text-xs">支持 mp3、flac 等格式</p>
        </div>
    );
}
