import { NextResponse, NextRequest } from 'next/server';
import likesData from '@/data/likes.json';

interface CompiledMedia {
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

interface Tweet {
  id: string;
  authorName: string;
  authorHandle: string;
  tweetUrl: string;
  text: string;
  hashtags: string[];
  media: CompiledMedia[];
  category: string;
  collectedAt: string;
}

interface Wallpaper {
  id: string;
  imageUrl: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  artistName: string;
  artistHandle: string;
  tweetUrl: string;
  attribution: string;
  category: string;
  collectedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const random = searchParams.get('random') === 'true';
    const single = searchParams.get('single') === 'true';
    const limitParam = searchParams.get('limit');
    const widthParam = searchParams.get('width');
    const heightParam = searchParams.get('height');

    const tweets = likesData as Tweet[];
    let wallpapers: Wallpaper[] = [];

    // Flatten tweets with multiple images into separate wallpaper items
    for (const t of tweets) {
      t.media.forEach((m, idx) => {
        if (!m.url) return;
        
        const cleanText = t.text
          .replace(/https:\/\/t\.co\/\w+/g, '')
          .trim();

        wallpapers.push({
          id: t.media.length > 1 ? `${t.id}-${idx}` : t.id,
          imageUrl: m.url,
          width: m.width,
          height: m.height,
          aspectRatio: m.aspectRatio,
          artistName: t.authorName || `@${t.authorHandle}`,
          artistHandle: t.authorHandle,
          tweetUrl: t.tweetUrl,
          attribution: cleanText,
          category: t.category,
          collectedAt: t.collectedAt
        });
      });
    }

    // Apply category filter
    if (category && category !== 'All') {
      const catLower = category.toLowerCase();
      wallpapers = wallpapers.filter(w => w.category.toLowerCase() === catLower);
    }

    // Apply search filter
    if (search) {
      const query = search.toLowerCase().trim();
      wallpapers = wallpapers.filter(w => 
        w.artistName.toLowerCase().includes(query) ||
        w.artistHandle.toLowerCase().includes(query) ||
        w.attribution.toLowerCase().includes(query)
      );
    }

    // Apply screensize orientation filtering
    if (widthParam && heightParam) {
      const width = parseInt(widthParam, 10);
      const height = parseInt(heightParam, 10);

      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        const clientRatio = width / height;
        let matchedWallpapers = wallpapers;

        if (clientRatio >= 1.2) {
          // Screen is landscape: Filter for landscape wallpapers (aspectRatio >= 1.2)
          matchedWallpapers = wallpapers.filter(w => w.aspectRatio && w.aspectRatio >= 1.2);
        } else if (clientRatio <= 0.85) {
          // Screen is portrait: Filter for portrait wallpapers (aspectRatio <= 0.85)
          matchedWallpapers = wallpapers.filter(w => w.aspectRatio && w.aspectRatio <= 0.85);
        } else {
          // Screen is square/neutral: Filter for neutral aspect ratios
          matchedWallpapers = wallpapers.filter(w => w.aspectRatio && w.aspectRatio > 0.85 && w.aspectRatio < 1.2);
        }

        // Fallback: If no wallpapers match the orientation-specific filter, keep the unfiltered list
        if (matchedWallpapers.length > 0) {
          wallpapers = matchedWallpapers;
        }
      }
    }

    // Apply random sorting if requested
    if (random) {
      // Fisher-Yates shuffle
      for (let i = wallpapers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wallpapers[i], wallpapers[j]] = [wallpapers[j], wallpapers[i]];
      }
    }

    // Apply limit if specified (ignored if single=true)
    if (limitParam && !single) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        wallpapers = wallpapers.slice(0, limit);
      }
    }

    // If single item requested, return a single object directly (or 404 if empty)
    if (single) {
      if (wallpapers.length === 0) {
        return NextResponse.json({ error: 'No wallpapers found' }, { status: 404 });
      }
      return NextResponse.json(wallpapers[0], {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    }

    // Return the list JSON response
    return NextResponse.json(wallpapers, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=60, s-maxage=60'
      }
    });

  } catch (err) {
    console.error('Error serving wallpapers API:', err);
    return NextResponse.json(
      { error: 'Internal server error occurred' },
      { status: 500 }
    );
  }
}

// Allow CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
