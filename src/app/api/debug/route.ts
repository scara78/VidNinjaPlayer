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
    const testUrl = searchParams.get('test');

    // Test the M3U8 proxy with a known working HLS stream
    const testM3U8Url = testUrl || 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';

    try {
        // Test direct fetch first
        console.log('Testing direct fetch to:', testM3U8Url);
        const directResponse = await fetch(testM3U8Url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const directContent = await directResponse.text();

        // Test through our M3U8 proxy
        const proxyUrl = new URL('/api/proxy/m3u8', request.url);
        proxyUrl.searchParams.set('url', testM3U8Url);

        console.log('Testing M3U8 proxy with:', proxyUrl.toString());
        const proxyResponse = await fetch(proxyUrl.toString());
        const proxyContent = await proxyResponse.text();

        return NextResponse.json({
            testUrl: testM3U8Url,
            direct: {
                status: directResponse.status,
                contentType: directResponse.headers.get('content-type'),
                contentLength: directContent.length,
                isM3U8: directContent.includes('#EXTM3U'),
                preview: directContent.substring(0, 300)
            },
            proxy: {
                status: proxyResponse.status,
                contentType: proxyResponse.headers.get('content-type'),
                contentLength: proxyContent.length,
                isM3U8: proxyContent.includes('#EXTM3U'),
                preview: proxyContent.substring(0, 300)
            }
        }, {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('Debug test error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            testUrl: testM3U8Url
        }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
