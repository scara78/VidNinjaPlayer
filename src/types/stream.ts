export type StreamType = 'hls' | 'file';

export interface StreamQuality {
    type: 'mp4';
    url: string;
}

export interface StreamCaption {
    url: string;
    type: 'srt' | 'vtt';
    language: string;
    display?: string;
}

export interface Stream {
    id: string;
    type: StreamType;
    playlist?: string; // for HLS
    qualities?: Record<'360' | '480' | '720' | '1080' | '4k', StreamQuality>;
    captions: StreamCaption[];
}

export interface StreamRequest {
    embedId: string;
    url: string;
}

export interface StreamResponse {
    success: boolean;
    stream?: Stream;
    error?: string;
}
