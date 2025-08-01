import { NextRequest, NextResponse } from 'next/server';

// Add CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { status: 200, headers: corsHeaders });
}

/**
 * Universal proxy endpoint - Works like the powerful cloudflare proxy used in the dev-cli
 * This functions as a direct pass-through proxy to handle all requests
 */
export async function GET(request: NextRequest) {
    try {
        // Get the destination URL from the query parameter
        const { searchParams } = new URL(request.url);
        const destination = searchParams.get('destination');
        const isM3U8 = searchParams.get('type') === 'm3u8';
        const isTS = searchParams.get('type') === 'ts';

        if (!destination) {
            return NextResponse.json({ error: 'Destination URL is required' }, { status: 400, headers: corsHeaders });
        }

        console.log('Universal Proxy Request:', { destination, isM3U8, isTS });

        // Forward the request to the destination
        const response = await fetch(destination, {
            method: 'GET',
            headers: {
                // Standard headers that most scrapers need
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Origin': new URL(destination).origin,
                'Referer': new URL(destination).origin + '/',
            },
        });

        if (!response.ok) {
            console.error(`Proxy error: ${response.status} ${response.statusText}`);
            return NextResponse.json({ error: `HTTP error! status: ${response.status}` }, {
                status: response.status,
                headers: corsHeaders
            });
        }

        // Get content type to properly handle different response types
        const contentType = response.headers.get('content-type') || 'text/plain';

        // Special handling for HLS M3U8 playlists - rewrite URLs to use our proxy
        if (isM3U8 || destination.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('vnd.apple')) {
            const text = await response.text();

            // Check if valid M3U8
            if (!text.includes('#EXTM3U') && !text.includes('#EXT-X-VERSION')) {
                console.error('Invalid M3U8 content:', text.substring(0, 200));
                return NextResponse.json({ error: 'Invalid M3U8 content' }, { status: 400, headers: corsHeaders });
            }

            // Process M3U8 content to proxy all URLs
            const baseUrl = new URL(destination).href;
            const lines = text.split('\n');
            const processedLines = lines.map(line => {
                // If line is a URL (not a comment), proxy it
                if (line.trim() && !line.startsWith('#')) {
                    const segmentUrl = line.trim();

                    // Convert relative URLs to absolute
                    const absoluteUrl = new URL(segmentUrl, baseUrl).href;

                    // Create universal proxy URL
                    const proxyUrl = new URL("/api/universal-proxy", request.nextUrl.origin);
                    proxyUrl.searchParams.set("destination", absoluteUrl);

                    // If it's a TS segment or another M3U8, mark it appropriately
                    if (segmentUrl.includes('.ts')) {
                        proxyUrl.searchParams.set("type", "ts");
                    } else if (segmentUrl.includes('.m3u8')) {
                        proxyUrl.searchParams.set("type", "m3u8");
                    }

                    console.log('M3U8 URL rewrite:', { original: segmentUrl, absolute: absoluteUrl, proxied: proxyUrl.toString() });
                    return proxyUrl.toString();
                }
                return line;
            });

            const processedM3U8 = processedLines.join('\n');

            return new NextResponse(processedM3U8, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Cache-Control': 'public, max-age=300'
                }
            });
        }
        // Special handling for TS segments
        else if (isTS || destination.endsWith('.ts')) {
            const arrayBuffer = await response.arrayBuffer();

            return new NextResponse(arrayBuffer, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'video/mp2t',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }
        // Handle different content types appropriately
        else if (contentType.includes('application/json')) {
            const data = await response.json();
            return NextResponse.json(data, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        } else if (contentType.includes('text/')) {
            const text = await response.text();
            return new NextResponse(text, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': contentType
                }
            });
        } else {
            // Binary content
            const buffer = await response.arrayBuffer();
            return new NextResponse(buffer, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': contentType
                }
            });
        }
    } catch (error) {
        console.error('Universal proxy error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, {
            status: 500,
            headers: corsHeaders
        });
    }
}