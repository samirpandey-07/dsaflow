import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        return true;
    }

    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${cronSecret}`;
}

function getApiBaseUrl() {
    const rawUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!rawUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not configured');
    }

    return rawUrl.replace(/\/$/, '');
}

async function pingRenderApi() {
    const response = await fetch(`${getApiBaseUrl()}/api/healthz`, {
        cache: 'no-store',
        headers: {
            'user-agent': 'vercel-render-keepalive',
        },
    });

    const payload = await response.json().catch(() => null);

    return {
        ok: response.ok,
        status: response.status,
        payload,
    };
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await pingRenderApi();

        return NextResponse.json(
            {
                ok: result.ok,
                upstreamStatus: result.status,
                upstream: result.payload,
            },
            { status: result.ok ? 200 : 502 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            {
                ok: false,
                message,
            },
            { status: 500 },
        );
    }
}
