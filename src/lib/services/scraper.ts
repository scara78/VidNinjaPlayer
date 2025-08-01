import {
    buildProviders,
    makeStandardFetcher,
    setM3U8ProxyUrl,
    targets
} from '../providers/index.js';
import { Stream } from '@/types/stream';
import { providerConfig } from './providerConfig';

// Create a custom fetch function that routes all requests through our universal proxy
function createUniversalProxyFetch() {
    return async (url: string, options: RequestInit = {}) => {
        console.log('Universal proxy fetch request:', { url, options });

        // Create proxy URL - use proper base URL
        const baseURL = typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        const proxyUrl = new URL('/api/universal-proxy', baseURL);
        proxyUrl.searchParams.set('destination', url);

        // Make request through our universal proxy with better headers
        return fetch(proxyUrl.toString(), {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: options.body,
        });
    };
} export interface ScraperMedia {
    type: 'movie' | 'show';
    title: string;
    releaseYear: number;
    imdbId?: string;
    tmdbId: string;
    season?: {
        number: number;
        tmdbId: string;
    };
    episode?: {
        number: number;
        tmdbId: string;
    };
}

export interface ScraperResult {
    stream: {
        id: string;
        type: 'hls' | 'file';
        playlist?: string;
        qualities?: Record<string, { type: 'mp4'; url: string }>;
        captions: Array<{
            url: string;
            type: 'srt' | 'vtt';
            language: string;
            display?: string;
        }>;
    };
    embedId: string;
    sourceId: string;
}

class ScraperService {
    private providers: ReturnType<ReturnType<typeof buildProviders>['build']>;

    constructor() {
        // Set up M3U8 proxy base URL to point to our local API
        // Use the full URL including the protocol and host
        const baseURL = typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        const m3u8ProxyUrl = `${baseURL}/api/proxy/m3u8`;
        console.log('Setting M3U8 proxy URL to:', m3u8ProxyUrl);
        setM3U8ProxyUrl(m3u8ProxyUrl);

        // Build providers with the improved configuration but using our local proxy
        // Use standard fetcher for regular requests and our universal proxy for proxied requests
        const standardFetcher = makeStandardFetcher(fetch);
        const proxyFetcher = makeStandardFetcher(createUniversalProxyFetch());

        console.log('Using universal proxy for scraping requests');

        this.providers = buildProviders()
            .setTarget(targets.BROWSER)
            .setFetcher(standardFetcher)
            .setProxiedFetcher(proxyFetcher)
            .addBuiltinProviders()
            .enableConsistentIpForRequests() // Same as CLI - important for source consistency
            .build();
    }

    async scrapeStream(media: ScraperMedia, providedSourceId?: string): Promise<ScraperResult | null> {
        try {
            console.log('Starting scrape for:', media);
            console.log('Source ID provided:', providedSourceId);
            console.log('Using universal proxy for external requests');

            // Ensure we have season and episode data for shows
            if (media.type === 'show' && (!media.season || !media.episode)) {
                throw new Error('Season and episode data required for TV shows');
            }

            // Prepare media object based on type
            const scrapeMedia = media.type === 'movie' ? {
                type: 'movie' as const,
                title: media.title,
                releaseYear: media.releaseYear,
                imdbId: media.imdbId,
                tmdbId: media.tmdbId
            } : {
                type: 'show' as const,
                title: media.title,
                releaseYear: media.releaseYear,
                imdbId: media.imdbId,
                tmdbId: media.tmdbId,
                season: media.season!,
                episode: media.episode!
            };

            let result;

            if (providedSourceId) {
                // If a specific source is requested (from server selector), try only that source
                console.log(`Running specific source: ${providedSourceId}`);
                try {
                    result = await this.providers.runSourceScraper({
                        id: providedSourceId,
                        media: scrapeMedia,
                        disableOpensubtitles: true,
                        events: {
                            update: (data: { percentage: number; status: string }) => {
                                console.log(`Scrape progress for ${providedSourceId}:`, data);
                            }
                        }
                    });
                } catch (sourceError) {
                    console.error(`Error with source ${providedSourceId}:`, sourceError);
                    throw new Error(`Source ${providedSourceId} failed: ${sourceError instanceof Error ? sourceError.message : 'Unknown error'}`);
                }
            } else {
                // Original behavior: Use runAll to try all providers automatically
                console.log('Running all providers automatically (original behavior)');
                result = await this.providers.runAll({
                    media: scrapeMedia,
                    events: {
                        update: (data: { percentage: number; status: string; id?: string }) => {
                            console.log('Scrape progress:', data);
                        }
                    }
                });
            }

            if (!result?.stream) {
                // Check if we got embeds instead of direct streams
                if (result && 'embeds' in result && Array.isArray(result.embeds) && result.embeds.length > 0) {
                    console.log('Found embeds instead of direct stream:', result.embeds);

                    // Try to process the first embed
                    const firstEmbed = result.embeds[0];
                    console.log('Processing embed:', firstEmbed);

                    try {
                        // For mp4hydra, we need to run the embed scraper to process the URL
                        if (firstEmbed.embedId.startsWith('mp4hydra-')) {
                            console.log('Running mp4hydra embed scraper for:', firstEmbed);

                            const embedResult = await this.providers.runEmbedScraper({
                                id: firstEmbed.embedId,
                                url: firstEmbed.url,
                                disableOpensubtitles: true
                            });

                            if (embedResult && embedResult.stream) {
                                console.log('Embed scraper returned stream:', embedResult.stream);

                                // Convert the embed result to our Stream format
                                const embedStreams = Array.isArray(embedResult.stream) ? embedResult.stream : [embedResult.stream];
                                const streamData = embedStreams[0];

                                const stream: Stream = {
                                    id: streamData.id || `${firstEmbed.embedId}-stream`,
                                    type: streamData.type as 'hls' | 'file',
                                    captions: streamData.captions || []
                                };

                                if (streamData.type === 'hls' && streamData.playlist) {
                                    stream.playlist = streamData.playlist;
                                } else if (streamData.type === 'file' && streamData.qualities) {
                                    // Convert qualities and proxy the URLs for CORS
                                    const qualities: Record<string, { type: 'mp4'; url: string }> = {};
                                    Object.entries(streamData.qualities).forEach(([quality, streamFile]) => {
                                        if (streamFile && typeof streamFile === 'object' && 'url' in streamFile) {
                                            const originalUrl = (streamFile as { url: string }).url;

                                            // Check if the URL needs proxying (mp4hydra has CORS_ALLOWED flag, so might not need it)
                                            // But let's proxy it anyway to be safe
                                            const baseURL = typeof window !== 'undefined'
                                                ? window.location.origin
                                                : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

                                            const proxyUrl = new URL('/api/universal-proxy', baseURL);
                                            proxyUrl.searchParams.set('destination', originalUrl);

                                            qualities[quality] = { type: 'mp4', url: proxyUrl.toString() };
                                        }
                                    });
                                    stream.qualities = qualities as Record<'360' | '480' | '720' | '1080' | '4k', { type: 'mp4'; url: string }>;
                                }

                                return {
                                    stream,
                                    embedId: firstEmbed.embedId,
                                    sourceId: providedSourceId || 'mp4hydra'
                                };
                            }
                        }

                        // Fallback: Handle other embed types or if mp4hydra embed scraper fails
                        // Handle mp4hydra's special URL format: "url|quality"
                        let embedUrl = firstEmbed.url;
                        let quality = '1080';

                        if (embedUrl.includes('|')) {
                            const [url, qual] = embedUrl.split('|');
                            embedUrl = url;
                            quality = qual || '1080';
                        }

                        console.log('Fallback: Direct embed URL:', embedUrl, 'Quality:', quality);

                        // For mp4hydra, the embed URL is actually a direct MP4 file
                        // But it might need to go through our proxy for CORS
                        const baseURL = typeof window !== 'undefined'
                            ? window.location.origin
                            : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

                        const proxyUrl = new URL('/api/universal-proxy', baseURL);
                        proxyUrl.searchParams.set('destination', embedUrl);
                        const proxiedUrl = proxyUrl.toString();

                        console.log('Proxied embed URL:', proxiedUrl);

                        // Create a file stream with the quality
                        const stream: Stream = {
                            id: `${firstEmbed.embedId}-${quality}`,
                            type: 'file',
                            qualities: {
                                [quality]: { type: 'mp4', url: proxiedUrl }
                            } as Record<'360' | '480' | '720' | '1080' | '4k', { type: 'mp4'; url: string }>,
                            captions: []
                        };

                        return {
                            stream,
                            embedId: firstEmbed.embedId,
                            sourceId: providedSourceId || 'unknown'
                        };

                    } catch (embedError) {
                        console.error('Error processing embed:', embedError);
                        return null;
                    }
                }

                console.log('No stream found');
                return null;
            }

            console.log('Stream found:', result.stream);

            // Convert the result to our Stream format
            const streamData = Array.isArray(result.stream) ? result.stream[0] : result.stream;

            const stream: Stream = {
                id: streamData.id || 'scraped-stream',
                type: streamData.type,
                captions: streamData.captions || []
            };

            if (streamData.type === 'hls' && 'playlist' in streamData) {
                stream.playlist = streamData.playlist;
            } else if (streamData.type === 'file' && 'qualities' in streamData) {
                // Convert provider qualities to our format
                const qualities: Record<string, { type: 'mp4'; url: string }> = {};
                Object.entries(streamData.qualities || {}).forEach(([quality, streamFile]) => {
                    if (streamFile && typeof streamFile === 'object' && 'url' in streamFile) {
                        qualities[quality] = { type: 'mp4', url: (streamFile as { url: string }).url };
                    }
                });
                stream.qualities = qualities as Record<'360' | '480' | '720' | '1080' | '4k', { type: 'mp4'; url: string }>;
            }

            // For runSourceScraper, the result is different than runAll
            const resultEmbedId = (result && typeof result === 'object' && 'embedId' in result && typeof result.embedId === 'string')
                ? result.embedId : 'unknown';
            const resultSourceId = (result && typeof result === 'object' && 'sourceId' in result && typeof result.sourceId === 'string')
                ? result.sourceId : (providedSourceId || 'unknown'); // Use provided sourceId as fallback

            return {
                stream,
                embedId: resultEmbedId,
                sourceId: resultSourceId
            };

        } catch (error) {
            console.error('Scraper error:', error);
            return null;
        }
    }

    async scrapeEmbed(embedId: string, url: string): Promise<ScraperResult | null> {
        try {
            console.log('Starting embed scrape:', { embedId, url });

            const result = await this.providers.runEmbedScraper({
                id: embedId,
                url: url
            });

            if (!result) {
                console.log('No result from embed scraper');
                return null;
            }

            // The result has a 'stream' property that contains an array of streams
            const streams = (result as { stream: Array<Record<string, unknown>> }).stream;

            if (!streams || streams.length === 0) {
                console.log('No streams found from embed');
                return null;
            }

            // Take the first stream result
            const streamData = streams[0];

            console.log('Embed stream found:', streamData);

            // Convert the result to our Stream format
            const stream: Stream = {
                id: (streamData.id as string) || 'embed-stream',
                type: streamData.type as 'hls' | 'file',
                captions: (streamData.captions as Array<{
                    url: string;
                    type: 'srt' | 'vtt';
                    language: string;
                    display?: string;
                }>) || []
            };

            if (streamData.type === 'hls' && streamData.playlist) {
                stream.playlist = streamData.playlist as string;
            } else if (streamData.type === 'file' && streamData.qualities) {
                // Convert provider qualities to our format
                const qualities: Record<string, { type: 'mp4'; url: string }> = {};
                Object.entries(streamData.qualities as Record<string, unknown>).forEach(([quality, streamFile]) => {
                    if (streamFile && typeof streamFile === 'object' && 'url' in streamFile) {
                        qualities[quality] = { type: 'mp4', url: (streamFile as { url: string }).url };
                    }
                });
                stream.qualities = qualities as Record<'360' | '480' | '720' | '1080' | '4k', { type: 'mp4'; url: string }>;
            }

            return {
                stream,
                embedId: embedId,
                sourceId: 'embed'
            };

        } catch (error) {
            console.error('Embed scraper error:', error);
            return null;
        }
    }

    listAvailableSources() {
        // Get all sources from providers (original behavior)
        const allSources = this.providers.listSources();
        console.log('All available sources from providers:', allSources.map(s => ({ id: s.id, rank: s.rank })));

        // Map sources to include display names from provider config
        const sourcesWithDisplayNames = allSources.map(source => ({
            id: source.id,
            name: providerConfig.getProviderDisplayName(source.id),
            rank: source.rank
        })).sort((a, b) => a.rank - b.rank);

        console.log('Sources with display names:', sourcesWithDisplayNames);
        return sourcesWithDisplayNames;
    }

    listAvailableEmbeds() {
        return this.providers.listEmbeds();
    }
}

export const scraperService = new ScraperService();
