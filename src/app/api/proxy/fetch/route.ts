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
    const method = searchParams.get('method') || 'GET';
    const bodyParam = searchParams.get('body');

    console.log('Fetch Proxy Request:', { url, method, headersParam });

    if (!url) {
        return NextResponse.json({ error: 'URL or destination parameter is required' }, {
            status: 400,
            headers: corsHeaders
        });
    }

    try {
        let headers: Record<string, string> = {
            // Default headers that most scrapers need
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        };

        // Override with provided headers
        if (headersParam) {
            const providedHeaders = JSON.parse(headersParam);
            headers = { ...headers, ...providedHeaders };
        }

        let body = undefined;
        if (bodyParam && method !== 'GET') {
            body = JSON.parse(bodyParam);
        }

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.log(`Fetch proxy error for ${url}: ${response.status} - ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        // Get response content type
        const contentType = response.headers.get('content-type') || 'text/plain';

        // Handle different response types
        if (contentType.includes('application/json')) {
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
            const arrayBuffer = await response.arrayBuffer();
            return new NextResponse(arrayBuffer, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': contentType
                }
            });
        }

    } catch (error) {
        console.error('Fetch proxy error:', error);
        return NextResponse.json({ error: 'Failed to fetch resource' }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
