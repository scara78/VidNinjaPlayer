import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Use the real createM3U8ProxyUrl from the providers library
export { createM3U8ProxyUrl } from './providers/index.js';

export function createTSProxyUrl(url: string, headers?: Record<string, string>): string {
    const params = new URLSearchParams();
    params.set('url', url);

    if (headers && Object.keys(headers).length > 0) {
        params.set('headers', JSON.stringify(headers));
    }

    return `/api/proxy/ts?${params.toString()}`;
}

export function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getQualityLabel(quality: string): string {
    const labels: Record<string, string> = {
        '360': '360p',
        '480': '480p',
        '720': '720p HD',
        '1080': '1080p Full HD',
        '4k': '4K Ultra HD'
    };

    return labels[quality] || quality;
}