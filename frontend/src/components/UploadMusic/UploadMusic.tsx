import axios from 'axios';
import { parseBlob } from 'music-metadata-browser';
import { useCallback, useMemo, useState } from 'react';
import { useMessage } from '../../context/MessageContext';
import UploadDropzone from './UploadDropzone';
import UploadFileTable from './UploadFileTable';
import type { UploadFileItem } from './types';
import './UploadMusic.css';

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_CHUNKS = 3;
export default function UploadMusic() {
    const setMessage = useMessage().setMessage;
    const [files, setFiles] = useState<UploadFileItem[]>([]);
    const [uploading, setUploading] = useState(false);

    const authHeader = useMemo(
        () => ({ Authorization: localStorage.getItem('token') || '' }),
        []
    );

    const updateFile = useCallback((index: number, updater: (file: UploadFileItem) => UploadFileItem) => {
        setFiles((prev) => prev.map((file, currentIndex) => (currentIndex === index ? updater(file) : file)));
    }, []);

    const smartParseFilename = useCallback((filename: string) => {
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        const parts = nameWithoutExt.split(/\s*[-–]\s*/);
        if (parts.length >= 2) {
            return { artist: parts[0], title: parts.slice(1).join(' - ') };
        }
        return { title: nameWithoutExt, artist: '' };
    }, []);

    const formatDuration = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const parseDurationFallback = useCallback((file: File, index: number) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);

        audio.onloadedmetadata = () => {
            updateFile(index, (target) => ({
                ...target,
                durationSec: audio.duration,
                duration: formatDuration(audio.duration)
            }));
            URL.revokeObjectURL(url);
        };

        audio.onerror = () => {
            updateFile(index, (target) => ({
                ...target,
                duration: '未知'
            }));
            URL.revokeObjectURL(url);
        };
    }, [formatDuration, updateFile]);

    const parseMusicMetadata = useCallback(async (file: File, index: number) => {
        try {
            const metadata = await parseBlob(file);
            updateFile(index, (target) => ({
                ...target,
                title: metadata.common.title || target.title,
                artist: metadata.common.artist || target.artist,
                durationSec: metadata.format.duration || target.durationSec,
                duration: metadata.format.duration ? formatDuration(metadata.format.duration) : target.duration
            }));
        } catch {
            parseDurationFallback(file, index);
        }
    }, [formatDuration, parseDurationFallback, updateFile]);

    const addFiles = useCallback((fileList: FileList | null) => {
        if (!fileList) {
            return;
        }

        const incoming = Array.from(fileList)
            .filter((file) => file.type.startsWith('audio/'))
            .map((file) => {
                const guess = smartParseFilename(file.name);
                return {
                    file,
                    name: file.name,
                    title: guess.title,
                    artist: guess.artist,
                    duration: '加载中...',
                    durationSec: 0,
                    uploadProgress: 0,
                    uploading: false,
                    uploadSuccess: false,
                    uploadError: false,
                    uploadSessionId: null
                } satisfies UploadFileItem;
            });

        if (incoming.length === 0) {
            setMessage('仅支持音频文件上传', 'warning');
            return;
        }

        setFiles((prev) => {
            const startIndex = prev.length;
            const merged = [...prev, ...incoming];
            incoming.forEach((file, localIndex) => {
                const index = startIndex + localIndex;
                void parseMusicMetadata(file.file, index);
            });
            return merged;
        });
    }, [parseMusicMetadata, setMessage, smartParseFilename]);

    const uploadChunk = useCallback(async (
        fileData: UploadFileItem,
        chunkIndex: number,
        totalChunks: number,
        retryCount = 0
    ) => {
        const maxRetries = 3;
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileData.file.size);
        const chunk = fileData.file.slice(start, end);

        const formData = new FormData();
        formData.append('sessionId', fileData.uploadSessionId || '');
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));
        formData.append('chunk', chunk);

        try {
            await axios.post('uploadchunk', formData, {
                headers: {
                    ...authHeader,
                    'Content-Type': 'multipart/form-data'
                }
            });
        } catch (error) {
            const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
            const nonRetryable = statusCode === 400 || statusCode === 401 || statusCode === 403;

            if (nonRetryable) {
                throw new Error(`分片上传失败（${statusCode}）`);
            }

            if (retryCount < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
                return uploadChunk(fileData, chunkIndex, totalChunks, retryCount + 1);
            }

            throw new Error(`分片 ${chunkIndex} 上传失败`);
        }
    }, [authHeader]);

    const uploadSingleFile = useCallback(async (index: number) => {
        const currentFile = files[index];
        if (!currentFile || currentFile.uploadSuccess) {
            return;
        }

        updateFile(index, (target) => ({
            ...target,
            uploading: true,
            uploadError: false,
            uploadProgress: 0,
            uploadSessionId: null
        }));

        try {
            const file = currentFile.file;
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

            const initResponse = await axios.post('/uploadchunkinit', {
                filename: file.name,
                totalChunks,
                fileSize: file.size,
                title: currentFile.title,
                artist: currentFile.artist,
                duration: Math.floor(currentFile.durationSec * 1000)
            }, { headers: authHeader });

            const sessionId = initResponse.data?.sessionId as string;
            updateFile(index, (target) => ({ ...target, uploadSessionId: sessionId }));

            let uploadedChunkCount = 0;
            let nextChunkIndex = 0;
            const workerCount = Math.min(MAX_CONCURRENT_CHUNKS, totalChunks);

            const worker = async () => {
                while (true) {
                    const chunkIndex = nextChunkIndex;
                    nextChunkIndex += 1;
                    if (chunkIndex >= totalChunks) {
                        return;
                    }

                    await uploadChunk({ ...currentFile, uploadSessionId: sessionId }, chunkIndex, totalChunks);
                    uploadedChunkCount += 1;
                    const progress = Math.min(Math.round((uploadedChunkCount / totalChunks) * 100), 99);
                    updateFile(index, (target) => ({ ...target, uploadProgress: progress }));
                }
            };

            await Promise.all(Array.from({ length: workerCount }, () => worker()));

            await axios.post('/uploadchunkmerge', {
                sessionId
            }, { headers: authHeader });

            updateFile(index, (target) => ({
                ...target,
                uploadProgress: 100,
                uploadSuccess: true,
                uploadError: false,
                uploading: false
            }));
        } catch {
            updateFile(index, (target) => ({
                ...target,
                uploading: false,
                uploadError: true
            }));
        }
    }, [authHeader, files, updateFile, uploadChunk]);

    const uploadFiles = useCallback(async () => {
        setUploading(true);
        const pendingIndexes = files
            .map((file, index) => ({ file, index }))
            .filter(({ file }) => !file.uploadSuccess)
            .map(({ index }) => index);

        if (pendingIndexes.length === 0) {
            setMessage('所有文件都已上传成功', 'success');
            setUploading(false);
            return;
        }

        await Promise.allSettled(pendingIndexes.map((index) => uploadSingleFile(index)));

        setFiles((current) => {
            const successCount = current.filter((file) => file.uploadSuccess).length;
            const failCount = current.filter((file) => file.uploadError).length;

            setMessage(
                `上传完成：${successCount}个成功，${failCount}个失败`,
                successCount === current.length ? 'success' : failCount === current.length ? 'error' : 'warning'
            );

            return current;
        });

        setUploading(false);
    }, [files, setMessage, uploadSingleFile]);

    return (
        <div className="upload-music-page">
            <h2>上传音乐</h2>
            <UploadDropzone onFilesSelected={addFiles} />
            <UploadFileTable
                files={files}
                uploading={uploading}
                onTitleChange={(index, value) => updateFile(index, (target) => ({ ...target, title: value }))}
                onArtistChange={(index, value) => updateFile(index, (target) => ({ ...target, artist: value }))}
                onRemoveFile={(index) => {
                    setFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
                }}
                onRetryFile={(index) => {
                    void uploadSingleFile(index);
                }}
                onUploadAll={() => {
                    void uploadFiles();
                }}
            />
        </div>
    );
}
