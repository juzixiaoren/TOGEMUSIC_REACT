export type Playlist = {
    id: number;
    playlist_name: string;
};

export type Song = {
    id: number;
    title: string;
    artist: string;
    duration: number;
    uploader_id: number;
    time_added: string;
};

export type User = {
    id: number;
    username: string;
};

export type SortBy = 'time_added' | 'title' | 'artist' | 'duration';
