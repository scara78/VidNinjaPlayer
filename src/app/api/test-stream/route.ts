import { NextResponse } from 'next/server';

// Add CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
    // Return a test stream with a known working HLS URL
    const testStream = {
        id: 'test-stream',
        type: 'hls',
        playlist: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        captions: []
    };

    return NextResponse.json({
        success: true,
        stream: testStream
    }, {
        headers: corsHeaders
    });
}
