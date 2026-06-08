import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tweetId, imageUrl, reason, details } = body;

    if (!tweetId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO; // e.g. 'username/tweeter-likes'

    if (!githubToken || !githubRepo) {
      // In local development, we might not have the token set up. Just return success to simulate it.
      if (process.env.NODE_ENV === 'development') {
        console.log('[Dev] Simulated sending report to GitHub:', body);
        return NextResponse.json({ success: true, simulated: true });
      }
      
      console.error('Missing GITHUB_TOKEN or GITHUB_REPO in environment variables.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // Trigger GitHub Action repository_dispatch
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'image_reported',
        client_payload: {
          tweetId,
          imageUrl: imageUrl || 'N/A',
          reason,
          details: details || 'None provided'
        }
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to trigger GitHub Action:', text);
      return NextResponse.json({ error: 'Failed to process report' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in report API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
