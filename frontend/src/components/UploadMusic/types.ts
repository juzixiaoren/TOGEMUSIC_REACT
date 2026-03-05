export type UploadFileItem = {
    file: File;
    name: string;
    title: string;
    artist: string;
    duration: string;
    durationSec: number;
    uploadProgress: number;
    uploading: boolean;
    uploadSuccess: boolean;
    uploadError: boolean;
    uploadSessionId: string | null;
};
