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

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url') || searchParams.get('destination');
    const headersParam = searchParams.get('headers');

    console.log('M3U8 Proxy Request:', { url, headersParam });

    if (!url) {
        return NextResponse.json({ error: 'URL or destination parameter is required' }, {
            status: 400,
            headers: corsHeaders
        });
    }

    try {
        let headers = {};
        if (headersParam) {
            headers = JSON.parse(headersParam);
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // Use default User-Agent only if not provided in headers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                // Spread the provided headers after default User-Agent so they can override it
                ...headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let content = await response.text();

        console.log('M3U8 Response received:', {
            url,
            status: response.status,
            contentType: response.headers.get('content-type'),
            contentLength: content.length,
            contentPreview: content.substring(0, 200),
            isM3U8: content.includes('#EXTM3U'),
            isHTML: content.toLowerCase().includes('<html')
        });

        // Check if we received HTML instead of M3U8
        if (content.toLowerCase().includes('<html') || content.toLowerCase().includes('<!doctype html')) {
            console.error('M3U8 proxy received HTML content instead of M3U8:', { url, contentPreview: content.substring(0, 500) });
            throw new Error('Received HTML content instead of M3U8 playlist');
        }

        // Validate that we received a valid M3U8 file
        if (!content.includes('#EXTM3U') && !content.includes('#EXT-X-VERSION')) {
            console.error('M3U8 proxy received invalid content:', { url, contentPreview: content.substring(0, 500) });
            throw new Error('Invalid M3U8 content received');
        }

        // Process M3U8 content to proxy all URLs (TS segments, sub-playlists, etc.)
        if (content.includes('#EXTM3U')) {
            const lines = content.split('\n');
            const processedLines = lines.map(line => {
                // If line is a URL (not a comment), proxy it
                if (line.trim() && !line.startsWith('#')) {
                    const segmentUrl = line.trim();

                    // Convert relative URLs to absolute
                    const absoluteUrl = new URL(segmentUrl, url).href;

                    // Determine which proxy to use based on file extension
                    let proxyEndpoint = '/api/proxy/ts'; // Default for TS segments

                    if (segmentUrl.includes('.m3u8') || segmentUrl.includes('.m3u')) {
                        // Sub-playlist - use M3U8 proxy
                        proxyEndpoint = '/api/proxy/m3u8';
                    } else if (segmentUrl.includes('.html') || segmentUrl.includes('.json') || !segmentUrl.includes('.')) {
                        // HTML pages or other resources - use fetch proxy
                        proxyEndpoint = '/api/proxy/fetch';
                    }

                    const proxyParams = new URLSearchParams();
                    proxyParams.set('url', absoluteUrl);
                    if (headersParam) {
                        proxyParams.set('headers', headersParam);
                    }
                    const proxiedUrl = `${proxyEndpoint}?${proxyParams.toString()}`;

                    console.log('M3U8 URL rewrite:', { original: segmentUrl, absolute: absoluteUrl, proxied: proxiedUrl, endpoint: proxyEndpoint });
                    return proxiedUrl;
                }
                return line;
            });
            content = processedLines.join('\n');
        }

        return new NextResponse(content, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Cache-Control': 'public, max-age=300'
            }
        });

    } catch (error) {
        console.error('M3U8 proxy error:', error);
        return NextResponse.json({ error: 'Failed to fetch M3U8' }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
