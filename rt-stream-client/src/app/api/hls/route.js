export const dynamic = 'force-dynamic'; // static by default, unless reading the request

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        if (!url) {
            return new Response('Missing URL parameter', { status: 400 });
        }
        return await fetch(url);
    } catch (error) {
        return new Response(`Failed to fetch HLS content: ${error}`, { status: 500 });
    }
};