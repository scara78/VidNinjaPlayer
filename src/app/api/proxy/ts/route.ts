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

        console.log('TS Proxy Response:', {
            url,
            status: response.status,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Check if we received HTML instead of video data
        const uint8Array = new Uint8Array(arrayBuffer);
        const firstBytes = new TextDecoder().decode(uint8Array.slice(0, 100));

        if (firstBytes.toLowerCase().includes('<html') || firstBytes.toLowerCase().includes('<!doctype html')) {
            console.error('TS proxy received HTML content instead of video segment:', { url, contentPreview: firstBytes });
            throw new Error('Received HTML content instead of video segment');
        }

        // Validate that we received video data (TS files should start with sync byte 0x47)
        if (uint8Array.length > 0 && uint8Array[0] !== 0x47) {
            console.warn('TS segment may not be valid - does not start with sync byte 0x47:', {
                url,
                firstByte: uint8Array[0].toString(16),
                contentPreview: firstBytes.substring(0, 50)
            });
        }

        console.log('TS segment successfully fetched:', {
            url,
            size: arrayBuffer.byteLength,
            firstByte: uint8Array.length > 0 ? uint8Array[0].toString(16) : 'empty'
        });

        return new NextResponse(arrayBuffer, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'video/mp2t',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });

    } catch (error) {
        console.error('TS proxy error:', error);
        return NextResponse.json({ error: 'Failed to fetch TS segment' }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
