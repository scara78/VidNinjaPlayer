import { NextRequest, NextResponse } from 'next/server';
import { StreamRequest, StreamResponse } from '@/types/stream';
import { scraperService } from '@/lib/services/scraper';
import { tmdbService } from '@/lib/services/tmdb';

// Add CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request: NextRequest) {
    return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const body: StreamRequest = await request.json();
        const { embedId, url } = body;

        if (!embedId || !url) {
            return NextResponse.json<StreamResponse>({
                success: false,
                error: 'Missing embedId or url parameter'
            }, {
                status: 400,
                headers: corsHeaders
            });
        }

        // If embedId is a TMDB ID, fetch TMDB data and scrape
        if (embedId.startsWith('tmdb:')) {
            const [, type, id] = embedId.split(':');

            if (!type || !id || !['movie', 'tv'].includes(type)) {
                return NextResponse.json<StreamResponse>({
                    success: false,
                    error: 'Invalid TMDB ID format. Use tmdb:movie:123 or tmdb:tv:123'
                }, {
                    status: 400,
                    headers: corsHeaders
                });
            }

            try {
                const tmdbData = type === 'movie'
                    ? await tmdbService.getMovieDetails(parseInt(id))
                    : await tmdbService.getTVShowDetails(parseInt(id)); if (!tmdbData) {
                        return NextResponse.json<StreamResponse>({
                            success: false,
                            error: 'TMDB content not found'
                        }, { status: 404 });
                    }

                // Parse season and episode from URL if provided
                // Format for TV shows: tmdb:tv:123:s1:e1
                let season = 1;
                let episode = 1;

                if (type === 'tv' && url) {
                    // Try to extract season/episode from URL
                    const seasonMatch = url.match(/s(\d+)/i);
                    const episodeMatch = url.match(/e(\d+)/i);

                    if (seasonMatch && seasonMatch[1]) {
                        season = parseInt(seasonMatch[1], 10);
                    }

                    if (episodeMatch && episodeMatch[1]) {
                        episode = parseInt(episodeMatch[1], 10);
                    }
                }

                // Create media object for scraper
                const media = type === 'movie' ? {
                    type: 'movie' as const,
                    title: tmdbData.title,
                    releaseYear: tmdbData.year,
                    tmdbId: id,
                    imdbId: tmdbData.imdbId
                } : {
                    type: 'show' as const,
                    title: tmdbData.title,
                    releaseYear: tmdbData.year,
                    tmdbId: id,
                    imdbId: tmdbData.imdbId,
                    season: {
                        number: season,
                        tmdbId: `${id}-s${season}`
                    },
                    episode: {
                        number: episode,
                        tmdbId: `${id}-s${season}-e${episode}`
                    }
                }; const result = await scraperService.scrapeStream(media);

                if (!result) {
                    return NextResponse.json<StreamResponse>({
                        success: false,
                        error: 'No stream found for this content'
                    }, { status: 404 });
                }

                return NextResponse.json<StreamResponse>({
                    success: true,
                    stream: result.stream
                });

            } catch (tmdbError) {
                console.error('TMDB API error:', tmdbError);
                return NextResponse.json<StreamResponse>({
                    success: false,
                    error: 'Failed to fetch content information'
                }, {
                    status: 500,
                    headers: corsHeaders
                });
            }
        }

        // Otherwise, try embed scraping
        const result = await scraperService.scrapeEmbed(embedId, url);

        if (!result) {
            return NextResponse.json<StreamResponse>({
                success: false,
                error: 'Stream not found'
            }, {
                status: 404,
                headers: corsHeaders
            });
        }

        return NextResponse.json<StreamResponse>({
            success: true,
            stream: result.stream
        }, {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('Stream API error:', error);
        return NextResponse.json<StreamResponse>({
            success: false,
            error: 'Internal server error'
        }, {
            status: 500,
            headers: corsHeaders
        });
    }
}