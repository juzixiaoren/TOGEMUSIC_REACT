export type Song = {
    id: number;
    title: string;
    artist: string;
    duration: number;
    file_extension: string;
    file_path?: string;
};

export type Playlist = {
    id: number;
    playlist_name: string;
};
