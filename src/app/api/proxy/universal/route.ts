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
    const destination = searchParams.get('destination');

    if (!destination) {
        return NextResponse.json({ error: 'Destination parameter is required' }, {
            status: 400,
            headers: corsHeaders
        });
    }

    try {
        // Use the same proxy approach as dev-cli
        const proxyBaseUrl = 'https://proxy.swasthikshetty101.workers.dev/';
        const proxyUrl = `${proxyBaseUrl}/?destination=${encodeURIComponent(destination)}`;

        console.log('Universal proxy request:', { destination, proxyUrl });

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            }
        });

        if (!response.ok) {
            throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
        }

        // Get the content type from the response
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Handle different response types
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return NextResponse.json(data, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        } else if (contentType.includes('text/') || contentType.includes('application/vnd.apple.mpegurl')) {
            const text = await response.text();
            return new NextResponse(text, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': contentType
                }
            });
        } else {
            // Binary content
            const arrayBuffer = await response.arrayBuffer();
            return new NextResponse(arrayBuffer, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': contentType
                }
            });
        }

    } catch (error) {
        console.error('Universal proxy error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown proxy error'
        }, {
            status: 500,
            headers: corsHeaders
        });
    }
}

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination');

    if (!destination) {
        return NextResponse.json({ error: 'Destination parameter is required' }, {
            status: 400,
            headers: corsHeaders
        });
    }

    try {
        const body = await request.text();
        const requestHeaders = Object.fromEntries(request.headers.entries());

        // Use the same proxy approach as dev-cli
        const proxyBaseUrl = 'https://proxy.swasthikshetty101.workers.dev/';
        const proxyUrl = `${proxyBaseUrl}/?destination=${encodeURIComponent(destination)}`;

        console.log('Universal proxy POST request:', { destination, proxyUrl, bodyLength: body.length });

        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                ...requestHeaders,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            body: body || undefined
        });

        if (!response.ok) {
            throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            return NextResponse.json(data, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            const text = await response.text();
            return new NextResponse(text, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': contentType
                }
            });
        }

    } catch (error) {
        console.error('Universal proxy POST error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown proxy error'
        }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
